import { Hono } from 'hono';
import { kvGet, kvPut, kvList, PREFIX } from '../utils/kv.js';
import { authRequired, authOptional } from '../middleware/rbac.js';

const users = new Hono();

/**
 * POST /server/api/users/lookup
 * 用 POST + body 传 username（避免与 GET /:id 的路由冲突）
 */
users.post('/lookup', async (c) => {
  try {
    const env = c.env;
    const { username } = await c.req.json();
    if (!username) return c.json({ error: 'username is required' }, 400);

    const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase());
    if (!userId) return c.json({ error: 'User not found' }, 404);

    const user = await kvGet(env, PREFIX.USERS + userId);
    if (!user) return c.json({ error: 'User not found' }, 404);

    const { passwordHash, ...publicUser } = user;
    return c.json({ user: publicUser });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
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
