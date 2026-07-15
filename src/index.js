import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
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

// User lookup by username (独立路径 /user-lookup 避免与 /users/* 子路由器冲突)
api.get('/user-lookup/:username', async (c) => {
  const env = c.env;
  const username = c.req.param('username').toLowerCase();
  const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username);
  if (!userId) return c.json({ error: 'User not found' }, 404);
  const user = await kvGet(env, PREFIX.USERS + userId);
  if (!user) return c.json({ error: 'User not found' }, 404);
  const { passwordHash, ...publicUser } = user;
  return c.json({ user: publicUser });
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

// Serve static frontend files from public/ directory
app.get('/assets/*', serveStatic({ root: './' }));
app.get('/favicon.svg', serveStatic({ path: './public/favicon.svg' }));
app.get('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// SPA fallback - serve index.html for all non-API routes
app.get('/*', serveStatic({ path: './public/index.html' }));

export default app;
