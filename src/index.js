import { Hono } from 'hono';
import { cors } from './middleware/cors.js';
import { kvGet, PREFIX } from './utils/kv.js';
import authRoutes, { ensureOfficialAccount } from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import commentsRoutes from './routes/comments.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import messagesRoutes from './routes/messages.js';
import notificationsRoutes from './routes/notifications.js';
import updatesRoutes from './routes/updates.js';
import stateRoutes from './routes/state.js';

const app = new Hono();

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error', detail: err.message }, 500);
});

app.use('*', cors);

let bootstrapped = false;
app.use('*', async (c, next) => {
  if (!bootstrapped) {
    bootstrapped = true;
    ensureOfficialAccount(c.env).catch((e) => console.error('[Bootstrap] 创建官方账号失败:', e));
  }
  await next();
});

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

// SPA fallback: 非 API 请求 → 尝试 ASSETS 获取文件，失败则返回 index.html
app.get('/*', async (c) => {
  const url = new URL(c.req.url);

  // 先尝试从 ASSETS 获取当前路径的文件（JS/CSS/图片等）
  const fileReq = new Request(url, { method: 'GET', redirect: 'follow', headers: c.req.raw.headers });
  const fileRes = await c.env.ASSETS.fetch(fileReq).catch(() => null);
  if (fileRes && fileRes.status !== 404) return fileRes;

  // 没有对应文件 → SPA 回落：用 follow redirect 获取 /index.html
  try {
    const indexReq = new Request(new URL('/index.html', url.origin), { method: 'GET', redirect: 'follow' });
    const indexRes = await c.env.ASSETS.fetch(indexReq);
    if (indexRes.ok || indexRes.status === 304) {
      return new Response(indexRes.body, {
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
