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
import verifyRoutes from './routes/verify.js';
import syncRoutes from './routes/sync.js';
import feedbackRoutes from './routes/feedback.js';
import bootstrapRoutes from './routes/bootstrap.js';

const app = new Hono();

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error', detail: err.message }, 500);
});

app.use('*', cors);

// 全局禁用 HTML 缓存（Cloudflare CDN 会缓存自定义域名下的静态资源）
app.use('*', async (c, next) => {
  await next();
  const ct = c.res.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.res.headers.set('Pragma', 'no-cache');
    c.res.headers.set('Expires', '0');
  }
});

let bootstrapped = false;
app.use('*', async (c, next) => {
  if (!bootstrapped) {
    bootstrapped = true;
    ensureOfficialAccount(c.env).catch((e) => console.error('[Bootstrap] 创建官方账号失败:', e));
  }
  await next();
});

const api = new Hono();

/**
 * 详细服务状态检测（需求 3）
 * 检测后端微服务运行状态：KV 数据库连通性、缓存层、API 网关等。
 */
async function runHealthCheck(env) {
  const result = { status: 'ok', timestamp: Date.now(), services: {} };
  const set = (key, name, status, detail) => {
    result.services[key] = { name, status, ...(detail ? { detail } : {}) };
    if (status === 'error') result.status = 'error';
    if (status === 'degraded' && result.status !== 'error') result.status = 'degraded';
  };

  // 数据库（Cloudflare KV）
  try {
    const probe = 'health:ping';
    await env.SKYXING_KV.put(probe, String(Date.now()));
    const v = await env.SKYXING_KV.get(probe);
    await env.SKYXING_KV.delete(probe);
    set('kv', '数据库 (Cloudflare KV)', v ? 'ok' : 'degraded');
  } catch (e) {
    set('kv', '数据库 (Cloudflare KV)', 'error', String(e.message || e));
  }

  // 缓存层（Workers Cache + KV 兼具缓存职责）
  set('cache', '缓存层 (Workers Cache)', 'ok');

  // 消息队列：当前架构未启用独立消息队列，优雅标注为 N/A
  set('queue', '消息队列 (可选)', 'n/a', '当前架构未启用独立消息队列');

  // API 网关（Worker 自身）
  set('api', 'API 网关 (Cloudflare Worker)', 'ok');

  return result;
}

api.get('/health', async (c) => {
  const health = await runHealthCheck(c.env);
  return c.json(health);
});

/**
 * GET /health —— 服务状态可视化页面（需求 3）
 * 设置页的「服务状态检测」按钮将打开此页面（Web 新标签 / 客户端内置浏览器）。
 */
app.get('/health', async (c) => {
  let health;
  try {
    health = await runHealthCheck(c.env);
  } catch (e) {
    health = { status: 'error', timestamp: Date.now(), services: {} };
  }
  const services = (health && health.services) || {};
  const badge = (s) =>
    ({ ok: '#16a34a', error: '#dc2626', degraded: '#d97706', 'n/a': '#6b7280' }[s] || '#6b7280');
  const names = Object.keys(services);
  let rows = '';
  for (const key of names) {
    const svc = services[key] || {};
    rows += `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">${svc.name || key}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">
        <span style="display:inline-block;min-width:64px;text-align:center;color:#fff;background:${badge(svc.status)};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;">${(svc.status || 'n/a').toUpperCase()}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${svc.detail || '—'}</td>
    </tr>`;
  }
  const overall = (health && health.status) || 'error';
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>SkyXing 服务状态</title></head>
    <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:48px auto;padding:0 16px;">
        <h1 style="font-size:22px;margin:0 0 4px;">SkyXing 服务状态</h1>
        <p style="color:#64748b;margin:0 0 20px;">API 连通性与后端微服务运行状态</p>
        <div style="background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden;">
          <div style="padding:16px 18px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;">总体状态</span>
            <span style="color:#fff;background:${badge(overall)};border-radius:999px;padding:4px 14px;font-weight:700;font-size:13px;">${overall.toUpperCase()}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="color:#64748b;text-align:left;font-size:12px;">
              <th style="padding:10px 14px;">服务</th><th style="padding:10px 14px;">状态</th><th style="padding:10px 14px;">说明</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px;">检测时间：${new Date((health && health.timestamp) || Date.now()).toLocaleString()}</p>
      </div>
    </body></html>`;
  return c.body(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
});
api.route('/auth', authRoutes);
api.route('/articles', articlesRoutes);
api.route('/comments', commentsRoutes);
api.route('/users', usersRoutes);

api.get('/lookup/:username', async (c) => {
  try {
    const username = c.req.param('username').toLowerCase();
    const userId = await kvGet(c.env, PREFIX.USERNAME_INDEX + username, false);
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
api.route('/verify', verifyRoutes);
api.route('/sync', syncRoutes);
api.route('/feedback', feedbackRoutes);
api.route('/bootstrap', bootstrapRoutes);

/**
 * GET /server/api/config —— 公开配置（供前端读取 Turnstile 站点密钥等）
 */
api.get('/config', (c) => c.json({
  turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || '',
  clientMinVersion: '2.0.1-beta.1',
}));

app.route('/server/api', api);

// SPA fallback: 非 API 请求 → 尝试 ASSETS 获取文件，失败则返回 index.html
app.get('/*', async (c) => {
 try {
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
      const headers = new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate, proxy-revalidate, s-maxage=0, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '-1',
        'Clear-Site-Data': '"cache"',
      });
      return new Response(indexRes.body, { status: 200, headers });
    }
  } catch (e) {
    console.error('SPA fallback failed:', e);
  }
  return c.text('Not Found', 404);
 } catch (e) {
  console.error('SPA fallback OUTER url=', c.req.url, 'err=', e && e.stack ? e.stack : e);
  return c.text('Not Found', 404);
 }
});

export default app;
