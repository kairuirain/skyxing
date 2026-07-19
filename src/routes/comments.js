import { Hono } from 'hono';
import { kvGet, kvPut, kvDelete, kvList, kvGetMany, generateId, PREFIX } from '../utils/kv.js';
import { authRequired } from '../middleware/rbac.js';
import { createNotification, getActorSnapshot } from '../utils/notifications.js';

const comments = new Hono();

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

  // O(1) 索引定位：直接读取该文章的评论 ID 列表（存为数组，需 JSON 解析）
  let indexIds = await kvGet(env, PREFIX.COMMENT_INDEX + articleId);
  let commentList = [];

  if (indexIds && indexIds.length) {
    // 命中索引：批量并行获取评论
    commentList = (await kvGetMany(env, indexIds.map((id) => PREFIX.COMMENTS + id))).filter(Boolean);
  } else {
    // 向后兼容旧数据：索引缺失时全量扫描并一次性重建该文章索引
    const allKeys = await kvList(env, PREFIX.COMMENTS, 1000);
    const allComments = (await kvGetMany(env, allKeys.map((k) => k.name))).filter(Boolean);
    const forArticle = allComments.filter((c) => c.articleId === articleId);
    if (forArticle.length) {
      const ids = forArticle.map((c) => c.id);
      await kvPut(env, PREFIX.COMMENT_INDEX + articleId, ids);
      indexIds = ids;
      commentList = forArticle;
    }
  }

  // Sort: pinned first, then by createdAt asc
  commentList.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

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

  // 公开只读接口：边缘缓存 30s，stale-while-revalidate 120s
  c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');

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
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    await kvPut(env, PREFIX.COMMENTS + id, comment);

    // 维护「按文章」索引，便于 O(1) 列出某文章评论
    const idxKey = PREFIX.COMMENT_INDEX + articleId;
    const idx = (await kvGet(env, idxKey)) || [];
    idx.push(id);
    await kvPut(env, idxKey, idx);

    // 通知文章作者（评论者非作者本人时）
    if (article.authorId && article.authorId !== user.userId) {
      const actor = await getActorSnapshot(env, user.userId);
      await createNotification(env, {
        userId: article.authorId,
        type: 'comment',
        actor,
        text: `评论了你的文章《${article.title}》`,
        link: `/article/${article.id}`,
      });
    }

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
 * PUT /server/api/comments/:id/pin
 * Toggle comment pin status (article author only)
 */
comments.put('/:id/pin', authRequired, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const env = c.env;

  const comment = await kvGet(env, PREFIX.COMMENTS + id);
  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  // Verify the current user is the article's author
  const article = await kvGet(env, PREFIX.ARTICLES + comment.articleId);
  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }
  if (article.authorId !== user.userId && user.role !== 'admin') {
    return c.json({ error: 'Only the article author can pin comments' }, 403);
  }

  comment.pinned = !comment.pinned;
  comment.updatedAt = new Date().toISOString();
  await kvPut(env, PREFIX.COMMENTS + id, comment);

  return c.json({ message: comment.pinned ? 'Comment pinned' : 'Comment unpinned', comment });
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

  // 收集需删除的评论（含直接子评论）
  const allKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  const toDelete = [id];
  for (const key of allKeys) {
    const childComment = await kvGet(env, key.name);
    if (childComment && childComment.parentId === id) {
      toDelete.push(childComment.id);
    }
  }

  // 更新该文章评论索引，移除已删除项
  const idxKey = PREFIX.COMMENT_INDEX + comment.articleId;
  const idx = (await kvGet(env, idxKey)) || [];
  const remaining = idx.filter((cid) => !toDelete.includes(cid));
  if (remaining.length) {
    await kvPut(env, idxKey, remaining);
  } else {
    await kvDelete(env, idxKey);
  }

  // 删除评论及其子评论
  await Promise.all(toDelete.map((cid) => kvDelete(env, PREFIX.COMMENTS + cid)));

  return c.json({ message: 'Comment deleted' });
});

export default comments;
