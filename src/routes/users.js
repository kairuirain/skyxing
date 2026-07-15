import { Hono } from 'hono';
import { kvGet, kvPut, kvList, PREFIX } from '../utils/kv.js';
import { authRequired, authOptional } from '../middleware/rbac.js';

const users = new Hono();

/**
 * GET /server/api/users/by-username/:username
 * 必须在 /:id 之前注册，否则 Hono 会将 "by-username" 匹配为 :id
 */
users.get('/by-username/:username', async (c) => {
  const env = c.env;
  const username = c.req.param('username').toLowerCase();

  const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username);
  if (!userId) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user = await kvGet(env, PREFIX.USERS + userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { passwordHash, ...publicUser } = user;
  return c.json({ user: publicUser });
});

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

    const updated = {
      ...user,
      displayName: displayName !== undefined ? displayName : user.displayName,
      bio: bio !== undefined ? bio : user.bio,
      avatar: avatar !== undefined ? avatar : user.avatar,
      updatedAt: new Date().toISOString(),
    };

    await kvPut(env, PREFIX.USERS + id, updated);

    const { passwordHash, ...publicUser } = updated;
    return c.json({ message: 'Profile updated', user: publicUser });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

export default users;
