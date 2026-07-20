import { Hono } from 'hono';
import { kvGet, kvList, kvGetMany, PREFIX } from '../utils/kv.js';
import { authOptional } from '../middleware/rbac.js';
import { getSyncVersion } from '../utils/sync.js';
import { publicCache } from '../middleware/cache.js';

const bootstrap = new Hono();

/**
 * GET /server/api/bootstrap
 * 首屏批量接口（需求 5：减少请求 / 批量接口）。
 * 一次返回：公开文章首屏、标签、全局状态版本；
 * 若已登录，再附带用户精简信息、未读通知数、同步版本号。
 * 返回字段经精简，避免传输冗余。
 */
bootstrap.get('/', authOptional, async (c) => {
  const env = c.env;
  const user = c.get('user');

  // 公开文章（已发布，按创建时间倒序，取前 10）
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const articles = [];
  for (const key of articleKeys) {
    const a = await kvGet(env, key.name);
    if (a && a.status === 'published') articles.push(a);
  }
  articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const trimmed = articles.slice(0, 10).map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: (a.content || '').slice(0, 160),
    cover: a.cover || '',
    authorId: a.authorId,
    authorName: a.authorName || '',
    createdAt: a.createdAt,
    views: a.views || 0,
    tags: a.tags || [],
  }));

  // 标签
  const tags = (await kvGet(env, PREFIX.TAGS)) || [];

  const payload = {
    timestamp: Date.now(),
    stateVersion: Math.floor(Date.now() / 1000),
    articles: trimmed,
    tags,
  };

  if (user) {
    const full = await kvGet(env, PREFIX.USERS + user.userId);
    const idx = (await kvGet(env, PREFIX.NOTIFICATION_INDEX + user.userId)) || [];
    const list = (await kvGetMany(env, idx.map((id) => PREFIX.NOTIFICATIONS + id))).filter(Boolean);
    const unread = list.filter((n) => !n.read).length;
    payload.user = {
      id: full.id,
      username: full.username,
      displayName: full.displayName,
      avatar: full.avatar || '',
      role: full.role,
      totpEnabled: !!full.totpEnabled,
    };
    payload.unreadNotifications = unread;
    payload.syncVersion = await getSyncVersion(env, user.userId);
  }

  // 公开内容可缓存 30s
  c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  return c.json(payload);
});

export default bootstrap;
