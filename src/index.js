import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { cors } from './middleware/cors.js';
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import commentsRoutes from './routes/comments.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import messagesRoutes from './routes/messages.js';
import updatesRoutes from './routes/updates.js';

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

// Admin routes (protected)
api.route('/admin', adminRoutes);

// Private messaging routes (auth required)
api.route('/messages', messagesRoutes);

// OTA update routes (public read, admin config)
api.route('/updates', updatesRoutes);

// Mount API under /server/api
app.route('/server/api', api);

// Serve static frontend files from public/ directory
app.get('/assets/*', serveStatic({ root: './' }));
app.get('/favicon.svg', serveStatic({ path: './public/favicon.svg' }));
app.get('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// SPA fallback - serve index.html for all non-API routes
app.get('/*', serveStatic({ path: './public/index.html' }));

export default app;
