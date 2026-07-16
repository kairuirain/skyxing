import { Hono } from 'hono';
import { cors } from './middleware/cors.js';
import { kvGet, PREFIX } from './utils/kv.js';
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import commentsRoutes from './routes/comments.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import messagesRoutes from './routes/messages.js';
import updatesRoutes from './routes/updates.js';
import stateRoutes from './routes/state.js';

const app = new Hono();

// CORS middleware
app.use('*', cors);

// Public API routes (under /server/api)
const api = new Hono();

// Health check
api.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Auth routes (public)
api.route('/auth', authRoutes);

// Articles routes (public read, auth write)
api.route('/articles', articlesRoutes);

// Comments routes (public read, auth write)
api.route('/comments', commentsRoutes);

// Users routes (public profile, auth for own)
api.route('/users', usersRoutes);

// 在 /server/api 下直接注册常用公共查询
api.get('/lookup/:username', async (c) => {
  try {
    const env = c.env;
    const username = c.req.param('username').toLowerCase();
    const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username);
    if (!userId) return c.json({ error: 'User not found' }, 404);
    const user = await kvGet(env, PREFIX.USERS + userId);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const { passwordHash, ...publicUser } = user;
    return c.json({ user: publicUser });
  } catch (e) {
    return c.json({ error: e.message || 'Internal error' }, 500);
  }
});

// Admin routes (protected)
api.route('/admin', adminRoutes);

// Private messaging routes (auth required)
api.route('/messages', messagesRoutes);

// OTA update routes (public read, admin config)
api.route('/updates', updatesRoutes);

// State version routes (public, for real-time sync polling)
api.route('/state', stateRoutes);

// Mount API under /server/api
app.route('/server/api', api);

// SPA fallback：使用 Cloudflare ASSETS 绑定直接读取真实的 index.html
// 当请求的资源不在 API 路径下时，先尝试 ASSETS，404 则回退到 index.html
app.get('/*', async (c) => {
  if (!c.env.ASSETS) {
    return c.text('ASSETS binding not available', 500);
  }
  const url = new URL(c.req.url);
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  // 命中静态资源（200）或 favicon 等（200/304）则直接返回
  if (assetResponse.status === 200 || assetResponse.status === 304) {
    return assetResponse;
  }
  // SPA fallback：取 index.html
  const indexUrl = new URL('/index.html', url.origin);
  const indexResponse = await c.env.ASSETS.fetch(new Request(indexUrl));
  if (indexResponse.ok) {
    return indexResponse;
  }
  return c.text('Not Found', 404);
});

export default app;
