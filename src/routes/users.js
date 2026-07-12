import { Hono } from 'hono';
import { verifyToken } from '../utils/auth.js';
import { kvGet, kvPut, kvList, PREFIX } from '../utils/kv.js';

const users = new Hono();

async function authOptional(c, next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      c.set('user', payload);
    }
  }
  await next();
}

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
users.put('/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const id = c.req.param('id');

  // Only allow self-update or admin
  if (payload.userId !== id && payload.role !== 'admin') {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const env = c.env;
  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) {
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
