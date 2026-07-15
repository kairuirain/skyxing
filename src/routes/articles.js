import { Hono } from 'hono';
import { kvGet, kvPut, kvDelete, kvList, kvIncrement, kvGetMany, generateId, slugify, PREFIX } from '../utils/kv.js';
import { sanitizeHTML } from '../utils/sanitize.js';
import { authRequired, adminRequired } from '../middleware/rbac.js';

const articles = new Hono();

/**
 * GET /server/api/articles
 * List articles with pagination, search, and tag filtering
 */
articles.get('/', async (c) => {
  const env = c.env;
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const tag = c.req.query('tag');
  const search = c.req.query('search');
  const authorId = c.req.query('authorId');

  // 全量读取后并行批量获取（避免串行 N 次 KV 往返），再于内存中过滤
  const allKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const allArticles = await kvGetMany(env, allKeys.map((k) => k.name));
  let articleList = allArticles.filter((a) => a && a.status === 'published');

  // Filter by tag
  if (tag) {
    articleList = articleList.filter(a => a.tags && a.tags.includes(tag));
  }

  // Filter by author
  if (authorId) {
    articleList = articleList.filter(a => a.authorId === authorId);
  }

  // Search in title and content
  if (search) {
    const q = search.toLowerCase();
    articleList = articleList.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.excerpt && a.excerpt.toLowerCase().includes(q))
    );
  }

  // Sort: pinned first, then by createdAt desc
  articleList.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const total = articleList.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginatedArticles = articleList.slice(start, start + limit);

  // Get author info for each article
  const articlesWithAuthor = await Promise.all(
    paginatedArticles.map(async (article) => {
      const author = await kvGet(env, PREFIX.USERS + article.authorId);
      return {
        ...article,
        author: author ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatar: author.avatar,
        } : null,
      };
    })
  );

  // 公开只读接口：边缘缓存 60s，stale-while-revalidate 300s
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  return c.json({
    articles: articlesWithAuthor,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
});

/**
 * GET /server/api/articles/tags
 * Get all unique tags
 */
articles.get('/tags', async (c) => {
  const env = c.env;
  const allKeys = await kvList(env, PREFIX.ARTICLES, 1000);
  const allArticles = await kvGetMany(env, allKeys.map((k) => k.name));
  const tagSet = new Set();

  for (const article of allArticles) {
    if (article && article.status === 'published' && article.tags) {
      article.tags.forEach((tag) => tagSet.add(tag));
    }
  }

  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

  return c.json({ tags: Array.from(tagSet).sort() });
});

/**
 * GET /server/api/articles/:id
 * Get a single article by ID
 */
articles.get('/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  const article = await kvGet(env, PREFIX.ARTICLES + id);

  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  // Increment view count
  article.views = (article.views || 0) + 1;
  await kvPut(env, PREFIX.ARTICLES + id, article);

  // Get author info
  const author = await kvGet(env, PREFIX.USERS + article.authorId);

  return c.json({
    article: {
      ...article,
      author: author ? {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatar: author.avatar,
        bio: author.bio,
      } : null,
    },
  });
});

/**
 * POST /server/api/articles
 * Create a new article (auth required)
 */
articles.post('/', authRequired, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { title, content, excerpt, tags, coverImage } = body;

    if (!title || !content) {
      return c.json({ error: 'Title and content are required' }, 400);
    }

    const env = c.env;
    const id = generateId();
    const slug = slugify(title) + '-' + id.slice(-6);
    const now = new Date().toISOString();

    const article = {
      id,
      title,
      slug,
      content: sanitizeHTML(content),
      excerpt: excerpt || sanitizeHTML(content).replace(/<[^>]*>/g, '').slice(0, 200),
      tags: tags || [],
      coverImage: coverImage || '',
      authorId: user.userId,
      status: 'published',
      views: 0,
      likes: 0,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    await kvPut(env, PREFIX.ARTICLES + id, article);

    return c.json({ message: 'Article created', article }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * PUT /server/api/articles/:id
 * Update an article (owner or admin only)
 */
articles.put('/:id', authRequired, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const env = c.env;

    const article = await kvGet(env, PREFIX.ARTICLES + id);
    if (!article) {
      return c.json({ error: 'Article not found' }, 404);
    }

    // Check ownership
    if (article.authorId !== user.userId && user.role !== 'admin') {
      return c.json({ error: 'Not authorized to edit this article' }, 403);
    }

    const body = await c.req.json();
    const { title, content, excerpt, tags, coverImage, status } = body;

    const updated = {
      ...article,
      title: title || article.title,
      content: content ? sanitizeHTML(content) : article.content,
      excerpt: excerpt || article.excerpt,
      tags: tags || article.tags,
      coverImage: coverImage !== undefined ? coverImage : article.coverImage,
      status: status || article.status,
      updatedAt: new Date().toISOString(),
    };

    await kvPut(env, PREFIX.ARTICLES + id, updated);

    return c.json({ message: 'Article updated', article: updated });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * PUT /server/api/articles/:id/pin
 * Toggle article pin status (admin only)
 */
articles.put('/:id/pin', adminRequired, async (c) => {
  const id = c.req.param('id');
  const env = c.env;

  const article = await kvGet(env, PREFIX.ARTICLES + id);
  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  article.pinned = !article.pinned;
  article.updatedAt = new Date().toISOString();
  await kvPut(env, PREFIX.ARTICLES + id, article);

  return c.json({ message: article.pinned ? 'Article pinned' : 'Article unpinned', article });
});

/**
 * DELETE /server/api/articles/:id
 * Delete an article (owner or admin only)
 */
articles.delete('/:id', authRequired, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const env = c.env;

  const article = await kvGet(env, PREFIX.ARTICLES + id);
  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  if (article.authorId !== user.userId && user.role !== 'admin') {
    return c.json({ error: 'Not authorized to delete this article' }, 403);
  }

  // Delete associated comments
  const commentKeys = await kvList(env, PREFIX.COMMENTS, 1000);
  for (const key of commentKeys) {
    const comment = await kvGet(env, key.name);
    if (comment && comment.articleId === id) {
      await kvDelete(env, key.name);
    }
  }

  await kvDelete(env, PREFIX.ARTICLES + id);

  return c.json({ message: 'Article deleted' });
});

export default articles;
