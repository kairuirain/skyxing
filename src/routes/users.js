import { Hono } from 'hono';
import { kvGet, kvPut, kvList, kvDelete, PREFIX } from '../utils/kv.js';
import { authRequired, authOptional } from '../middleware/rbac.js';
import { bumpSyncVersion } from '../utils/sync.js';

const users = new Hono();

/**
 * GET /server/api/users/:id
 * Get user public profile
 */
users.get('/:id', authOptional, async (c) => {
  const env = c.env;
  const id = c.req.param('id');

  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get user's published articles count
  const allArticles = await kvList(env, PREFIX.ARTICLES, 1000);
  let articleCount = 0;
  for (const key of allArticles) {
    const article = await kvGet(env, key.name);
    if (article && article.authorId === id && article.status === 'published') {
      articleCount++;
    }
  }

  const { passwordHash, ...publicUser } = user;

  return c.json({
    user: {
      ...publicUser,
      articleCount,
    },
  });
});

/**
 * PUT /server/api/users/:id
 * Update user profile (owner or admin only)
 */
users.put('/:id', authRequired, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  // Only allow self-update or admin
  if (user.userId !== id && user.role !== 'admin') {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const env = c.env;
  const target = await kvGet(env, PREFIX.USERS + id);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const { displayName, bio, avatar } = body;

    // 基于完整用户对象更新，避免覆盖 passwordHash / totpSecret / 设置字段
    const updated = {
      ...target,
      displayName: displayName !== undefined ? displayName : target.displayName,
      bio: bio !== undefined ? bio : target.bio,
      avatar: avatar !== undefined ? avatar : target.avatar,
      updatedAt: new Date().toISOString(),
    };

    await kvPut(env, PREFIX.USERS + id, updated);
    await bumpSyncVersion(env, id);

    const { passwordHash, totpSecret, ...publicUser } = updated;
    return c.json({ message: 'Profile updated', user: publicUser });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * DELETE /server/api/users/me
 * 注销当前登录账号：删除账号、唯一性索引及其发布的文章（含评论索引）
 */
users.delete('/me', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;

  const full = await kvGet(env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: 'User not found' }, 404);

  // 删除该用户发布的文章及对应评论索引
  const allArticles = await kvList(env, PREFIX.ARTICLES, 1000);
  for (const key of allArticles) {
    const art = await kvGet(env, key.name);
    if (art && art.authorId === user.userId) {
      await kvDelete(env, key.name);
      await kvDelete(env, PREFIX.COMMENT_INDEX + art.id);
    }
  }

  // 删除唯一性索引与用户记录
  await kvDelete(env, PREFIX.USERNAME_INDEX + full.username.toLowerCase());
  await kvDelete(env, PREFIX.EMAIL_INDEX + full.email.toLowerCase());
  await kvDelete(env, PREFIX.USERS + user.userId);

  return c.json({ message: 'Account deleted' });
});

export default users;
