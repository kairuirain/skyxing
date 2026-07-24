import { Hono } from 'hono';
import { hashPassword } from '../utils/auth.js';
import { kvGet, kvPut, kvDelete, kvList, PREFIX } from '../utils/kv.js';
import { adminRequired, officialRequired, canManage, ROLE_RANK } from '../middleware/rbac.js';
import { createNotification } from '../utils/notifications.js';

const admin = new Hono();

/** 有效的角色值 */
const VALID_ROLES = ['user', 'admin', 'official'];

/**
 * 根据当前管理员角色获取有权限查看的用户列表（KV 扫描、逐条解析）
 */
async function getUserList(env, role) {
  const userKeys = await kvList(env, PREFIX.USERS, 1000);
  const users = [];
  for (const key of userKeys) {
    const u = await kvGet(env, key.name);
    if (!u) continue;
    // admin 只能看到 user 角色；official 可看到全部
    if (role === 'admin' && u.role !== 'user') continue;
    const { passwordHash, ...safe } = u;
    users.push(safe);
  }
  return users;
}

// ─── 统计 ──────────────────────────────────────────────────────────────
admin.get('/stats', adminRequired, async (c) => {
  const env = c.env;
  const userKeys = await kvList(env, PREFIX.USERS, 1000);
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const commentKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  let published = 0, draft = 0, totalViews = 0;
  for (const key of articleKeys) {
    const a = await kvGet(env, key.name);
    if (a) {
      totalViews += a.views || 0;
      if (a.status === 'published') published++;
      if (a.status === 'draft') draft++;
    }
  }
  return c.json({ stats: { totalUsers: userKeys.length, totalArticles: articleKeys.length, publishedArticles: published, draftArticles: draft, totalComments: commentKeys.length, totalViews } });
});

// ─── 用户列表 ──────────────────────────────────────────────────────────
admin.get('/users', adminRequired, async (c) => {
  const requester = c.get('user');
  const users = await getUserList(c.env, requester.role);
  return c.json({ users });
});

// ─── 修改角色（仅 official 可操作） ──────────────────────────────────────
admin.put('/users/:id/role', adminRequired, async (c) => {
  const env = c.env;
  const requester = c.get('user');
  // 仅 official 及以上可修改角色
  if ((ROLE_RANK[requester.role] ?? 0) < 3) {
    return c.json({ error: '只有官方账号可以修改角色' }, 403);
  }
  const id = c.req.param('id');
  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) return c.json({ error: 'User not found' }, 404);
  try {
    const { role } = await c.req.json();
    if (!VALID_ROLES.includes(role)) return c.json({ error: '无效角色。可选：user, admin, official' }, 400);
    user.role = role;
    user.updatedAt = new Date().toISOString();
    await kvPut(env, PREFIX.USERS + id, user);
    const { passwordHash, ...safe } = user;
    return c.json({ message: 'User role updated', user: safe });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 删除用户 ──────────────────────────────────────────────────────────
admin.delete('/users/:id', adminRequired, async (c) => {
  const env = c.env;
  const requester = c.get('user');
  const id = c.req.param('id');
  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) return c.json({ error: 'User not found' }, 404);

  // 权限检查：admin 只能删除 user；official 可删除 admin/official（保留至少1个）
  if (!canManage(requester.role, user.role)) {
    return c.json({ error: '无权删除该用户' }, 403);
  }

  // 保护最后一个 admin / official
  const allKeys = await kvList(env, PREFIX.USERS, 1000);
  if (user.role === 'admin' || user.role === 'official') {
    let count = 0;
    for (const key of allKeys) {
      const u = await kvGet(env, key.name);
      if (u && u.role === user.role) count++;
    }
    if (count <= 1) return c.json({ error: `不能删除最后一个 ${user.role === 'admin' ? '管理员' : '官方'} 账号` }, 400);
  }

  // 删除用户关联的文章和评论
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  for (const key of articleKeys) {
    const a = await kvGet(env, key.name);
    if (a && a.authorId === id) await kvDelete(env, key.name);
  }
  const commentKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  for (const key of commentKeys) {
    const c2 = await kvGet(env, key.name);
    if (c2 && c2.userId === id) await kvDelete(env, key.name);
  }
  await kvDelete(env, PREFIX.USERNAME_INDEX + user.username.toLowerCase());
  await kvDelete(env, PREFIX.USERS + id);
  return c.json({ message: 'User deleted' });
});

// ─── 文章列表（全部含草稿） ──────────────────────────────────────────
admin.get('/articles', adminRequired, async (c) => {
  const env = c.env;
  const sortBy = c.req.query('sortBy') || 'createdAt';
  const sortOrder = c.req.query('sortOrder') || 'desc';
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const articles = [];
  for (const key of articleKeys) {
    const a = await kvGet(env, key.name);
    if (!a) continue;
    const author = await kvGet(env, PREFIX.USERS + a.authorId);
    articles.push({ ...a, author: author ? { id: author.id, username: author.username, displayName: author.displayName } : null });
  }
  articles.sort((a, b) => {
    let va, vb;
    if (sortBy === 'views') { va = a.views || 0; vb = b.views || 0; }
    else if (sortBy === 'weight') { va = a.weight || 0; vb = b.weight || 0; }
    else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); }
    return sortOrder === 'asc' ? va - vb : vb - va;
  });
  return c.json({ articles, total: articles.length, sortBy, sortOrder });
});

// ─── 文章权重 ──────────────────────────────────────────────────────────
admin.put('/articles/:id/weight', adminRequired, async (c) => {
  try {
    const env = c.env;
    const id = c.req.param('id');
    const { weight } = await c.req.json();
    const article = await kvGet(env, PREFIX.ARTICLES + id);
    if (!article) return c.json({ error: 'Article not found' }, 404);
    article.weight = typeof weight === 'number' ? weight : 0;
    article.updatedAt = new Date().toISOString();
    await kvPut(env, PREFIX.ARTICLES + id, article);
    return c.json({ message: 'Weight updated', article });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 群发系统通知（支持 Markdown） ──────────────────────────────────
admin.post('/notify', adminRequired, async (c) => {
  const env = c.env;
  try {
    const { title, content, link } = await c.req.json();
    if (!content || !String(content).trim()) return c.json({ error: '通知内容不能为空' }, 400);
    const text = (title ? `**${title}**\n\n` : '') + String(content);
    const userKeys = await kvList(env, PREFIX.USERS, 1000);
    let count = 0;
    for (const key of userKeys) {
      const u = await kvGet(env, key.name);
      if (!u) continue;
      await createNotification(env, {
        userId: u.id, type: 'system', actor: null,
        text, link: link || null,
        title: '官方通知', body: text,
        category: 'system', icon: 'system', priority: 'normal',
        action: link ? { label: '查看详情', url: link } : null,
      });
      count++;
    }
    return c.json({ message: `已向 ${count} 位用户发送系统通知`, count });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 清理重复/无效用户（仅 official） ────────────────────────────────
admin.post('/users/cleanup', officialRequired, async (c) => {
  const env = c.env;
  const userKeys = await kvList(env, PREFIX.USERS, 1000);
  const seen = new Map(); // username_lower → { key, user }
  const duplicates = [];
  const invalid = [];

  for (const key of userKeys) {
    const u = await kvGet(env, key.name);
    if (!u) { invalid.push(key.name); continue; }
    if (!u.id || !u.username) { invalid.push(key.name); continue; }
    const idx = (u.username || '').toLowerCase();
    if (seen.has(idx)) {
      duplicates.push({ keep: seen.get(idx), remove: { key: key.name, user: u } });
    } else {
      seen.set(idx, { key: key.name, user: u });
    }
  }

  // 删除重复（保留第一个）
  let removed = 0;
  for (const dup of duplicates) {
    await kvDelete(env, dup.remove.key);
    await kvDelete(env, PREFIX.USERNAME_INDEX + (dup.remove.user.username || '').toLowerCase());
    removed++;
  }
  // 删除无效
  for (const k of invalid) {
    await kvDelete(env, k);
    removed++;
  }

  return c.json({ message: `清理完成`, removed, duplicateCount: duplicates.length, invalidCount: invalid.length });
});

export default admin;
