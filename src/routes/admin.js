import { Hono } from 'hono';
import { hashPassword } from '../utils/auth.js';
import { kvGet, kvPut, kvDelete, kvList, PREFIX } from '../utils/kv.js';
import { adminRequired } from '../middleware/rbac.js';

const admin = new Hono();

/**
 * GET /server/api/admin/stats
 * Get system statistics
 */
admin.get('/stats', adminRequired, async (c) => {
  const env = c.env;

  const userKeys = await kvList(env, PREFIX.USERS, 1000);
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const commentKeys = await kvList(env, PREFIX.COMMENTS, 1000);

  let totalViews = 0;
  let publishedArticles = 0;
  let draftArticles = 0;

  for (const key of articleKeys) {
    const article = await kvGet(env, key.name);
    if (article) {
      totalViews += article.views || 0;
      if (article.status === 'published') publishedArticles++;
      if (article.status === 'draft') draftArticles++;
    }
  }

  return c.json({
    stats: {
      totalUsers: userKeys.length,
      totalArticles: articleKeys.length,
      publishedArticles,
      draftArticles,
      totalComments: commentKeys.length,
      totalViews,
    },
  });
});

/**
 * GET /server/api/admin/users
 * List all users
 */
admin.get('/users', adminRequired, async (c) => {
  const env = c.env;
  const userKeys = await kvList(env, PREFIX.USERS, 1000);
  const users = [];

  for (const key of userKeys) {
    const user = await kvGet(env, key.name);
    if (user) {
      const { passwordHash, ...safeUser } = user;
      users.push(safeUser);
    }
  }

  return c.json({ users });
});

/**
 * PUT /server/api/admin/users/:id/role
 * Change user role
 */
admin.put('/users/:id/role', adminRequired, async (c) => {
  const env = c.env;
  const id = c.req.param('id');

  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!['user', 'author', 'admin'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be user, author, or admin' }, 400);
    }

    user.role = role;
    user.updatedAt = new Date().toISOString();
    await kvPut(env, PREFIX.USERS + id, user);

    const { passwordHash, ...safeUser } = user;
    return c.json({ message: 'User role updated', user: safeUser });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * DELETE /server/api/admin/users/:id
 * Delete a user
 */
admin.delete('/users/:id', adminRequired, async (c) => {
  const env = c.env;
  const id = c.req.param('id');

  const user = await kvGet(env, PREFIX.USERS + id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.role === 'admin') {
    // Count admins before deleting
    const allUsers = await kvList(env, PREFIX.USERS, 1000);
    let adminCount = 0;
    for (const key of allUsers) {
      const u = await kvGet(env, key.name);
      if (u && u.role === 'admin') adminCount++;
    }
    if (adminCount <= 1) {
      return c.json({ error: 'Cannot delete the last admin' }, 400);
    }
  }

  // Delete user's articles and comments
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  for (const key of articleKeys) {
    const article = await kvGet(env, key.name);
    if (article && article.authorId === id) {
      await kvDelete(env, key.name);
    }
  }

  const commentKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  for (const key of commentKeys) {
    const comment = await kvGet(env, key.name);
    if (comment && comment.userId === id) {
      await kvDelete(env, key.name);
    }
  }

  await kvDelete(env, PREFIX.USERNAME_INDEX + user.username.toLowerCase());
  await kvDelete(env, PREFIX.USERS + id);

  return c.json({ message: 'User deleted' });
});

/**
 * GET /server/api/admin/articles
 * List all articles including drafts, with sorting support
 * Query params: sortBy=createdAt|views|weight, sortOrder=asc|desc
 */
admin.get('/articles', adminRequired, async (c) => {
  const env = c.env;
  const sortBy = c.req.query('sortBy') || 'createdAt';
  const sortOrder = c.req.query('sortOrder') || 'desc';
  const articleKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const articles = [];

  for (const key of articleKeys) {
    const article = await kvGet(env, key.name);
    if (article) {
      const author = await kvGet(env, PREFIX.USERS + article.authorId);
      articles.push({
        ...article,
        author: author ? { id: author.id, username: author.username, displayName: author.displayName } : null,
      });
    }
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

/**
 * PUT /server/api/admin/articles/:id/weight
 * Update article weight for custom ordering
 */
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

export default admin;
