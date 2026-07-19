import { Hono } from 'hono';
import { cors } from './middleware/cors.js';
import { kvGet, PREFIX } from './utils/kv.js';
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import commentsRoutes from './routes/comments.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import messagesRoutes from './routes/messages.js';
import notificationsRoutes from './routes/notifications.js';
import updatesRoutes from './routes/updates.js';
import stateRoutes from './routes/state.js';

const app = new Hono();

// 全局错误处理：返回 JSON 而非默认的纯文本 "Internal Server Error"
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error', detail: err.message }, 500);
});

app.use('*', cors);

const api = new Hono();

api.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));
api.route('/auth', authRoutes);
api.route('/articles', articlesRoutes);
api.route('/comments', commentsRoutes);
api.route('/users', usersRoutes);

api.get('/lookup/:username', async (c) => {
  try {
    const username = c.req.param('username').toLowerCase();
    const userId = await kvGet(c.env, PREFIX.USERNAME_INDEX + username);
    if (!userId) return c.json({ error: 'User not found' }, 404);
    const user = await kvGet(c.env, PREFIX.USERS + userId);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const { passwordHash, ...publicUser } = user;
    return c.json({ user: publicUser });
  } catch (e) {
    return c.json({ error: e.message || 'Internal error' }, 500);
  }
});

api.route('/admin', adminRoutes);
api.route('/messages', messagesRoutes);
api.route('/notifications', notificationsRoutes);
api.route('/updates', updatesRoutes);
api.route('/state', stateRoutes);

app.route('/server/api', api);

// SPA fallback — 所有非 API、非静态资源路径，返回构建产物中的 index.html
// （通过 ASSETS 绑定动态读取，避免硬编码资源 hash 导致部署后白屏）
app.get('/*', async (c) => {
  try {
    const assetReq = new Request(new URL('/index.html', c.req.url), c.req.raw);
    const res = await c.env.ASSETS.fetch(assetReq);
    if (res && res.ok) {
      return new Response(res.body, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (e) {
    console.error('SPA fallback failed:', e);
  }
  return c.text('Not Found', 404);
});

export default app;
