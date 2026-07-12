import { Hono } from 'hono';
import { verifyToken } from '../utils/auth.js';
import { kvGet, kvPut, kvDelete, kvList, generateId, PREFIX } from '../utils/kv.js';

const comments = new Hono();

async function authRequired(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', payload);
  await next();
}

/**
 * GET /server/api/comments?articleId=xxx
 * Get comments for an article
 */
comments.get('/', async (c) => {
  const env = c.env;
  const articleId = c.req.query('articleId');

  if (!articleId) {
    return c.json({ error: 'articleId query parameter is required' }, 400);
  }

  const allKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  let commentList = [];

  for (const key of allKeys) {
    const comment = await kvGet(env, key.name);
    if (comment && comment.articleId === articleId) {
      commentList.push(comment);
    }
  }

  // Sort by createdAt asc (oldest first for comment threads)
  commentList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Get user info for each comment
  const commentsWithUser = await Promise.all(
    commentList.map(async (comment) => {
      const user = await kvGet(env, PREFIX.USERS + comment.userId);
      return {
        ...comment,
        user: user ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        } : null,
      };
    })
  );

  return c.json({ comments: commentsWithUser, total: commentsWithUser.length });
});

/**
 * POST /server/api/comments
 * Create a new comment (auth required)
 */
comments.post('/', authRequired, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { articleId, content, parentId } = body;

    if (!articleId || !content) {
      return c.json({ error: 'articleId and content are required' }, 400);
    }

    if (content.trim().length === 0) {
      return c.json({ error: 'Comment cannot be empty' }, 400);
    }

    const env = c.env;

    // Verify article exists
    const article = await kvGet(env, PREFIX.ARTICLES + articleId);
    if (!article) {
      return c.json({ error: 'Article not found' }, 404);
    }

    // If parent comment, verify it exists
    if (parentId) {
      const parentComment = await kvGet(env, PREFIX.COMMENTS + parentId);
      if (!parentComment) {
        return c.json({ error: 'Parent comment not found' }, 404);
      }
    }

    const id = generateId();
    const now = new Date().toISOString();

    const comment = {
      id,
      articleId,
      userId: user.userId,
      content: content.trim(),
      parentId: parentId || null,
      createdAt: now,
      updatedAt: now,
    };

    await kvPut(env, PREFIX.COMMENTS + id, comment);

    return c.json({ message: 'Comment created', comment }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * PUT /server/api/comments/:id
 * Update a comment (owner only)
 */
comments.put('/:id', authRequired, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const env = c.env;

    const comment = await kvGet(env, PREFIX.COMMENTS + id);
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    if (comment.userId !== user.userId && user.role !== 'admin') {
      return c.json({ error: 'Not authorized to edit this comment' }, 403);
    }

    const body = await c.req.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Comment cannot be empty' }, 400);
    }

    comment.content = content.trim();
    comment.updatedAt = new Date().toISOString();

    await kvPut(env, PREFIX.COMMENTS + id, comment);

    return c.json({ message: 'Comment updated', comment });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * DELETE /server/api/comments/:id
 * Delete a comment (owner or admin only)
 */
comments.delete('/:id', authRequired, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const env = c.env;

  const comment = await kvGet(env, PREFIX.COMMENTS + id);
  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  if (comment.userId !== user.userId && user.role !== 'admin') {
    return c.json({ error: 'Not authorized to delete this comment' }, 403);
  }

  // Delete all child comments too
  const allKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  for (const key of allKeys) {
    const childComment = await kvGet(env, key.name);
    if (childComment && childComment.parentId === id) {
      await kvDelete(env, key.name);
    }
  }

  await kvDelete(env, PREFIX.COMMENTS + id);

  return c.json({ message: 'Comment deleted' });
});

export default comments;
