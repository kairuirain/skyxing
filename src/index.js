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
api.route('/updates', updatesRoutes);
api.route('/state', stateRoutes);

app.route('/server/api', api);

// SPA fallback — 所有非 API 路径返回 index.html（硬编码构建时的最新内容）
app.get('/*', (c) => c.html('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>SkyXing</title><link rel="icon" type="image/svg+xml" href="/favicon.svg" /><meta name="description" content="SkyXing - 自由创作，分享你的想法" /><script type="module" crossorigin src="/assets/index-DJfzNDFs.js"></script><link rel="stylesheet" crossorigin href="/assets/index-DVf33LXn.css"></head><body class="bg-gray-50 text-gray-900"><div id="root"></div></body></html>'));

export default app;
