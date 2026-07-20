import { Hono } from 'hono';
import { verifyTurnstile } from '../utils/turnstile.js';

const verify = new Hono();

/**
 * POST /server/api/verify/turnstile
 * 主动校验一个 Turnstile token（前端可在提交前探活，或作为兜底校验）。
 */
verify.post('/turnstile', async (c) => {
  try {
    const { token } = await c.req.json();
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const ok = await verifyTurnstile(token, c.env, ip);
    return c.json({ success: ok });
  } catch (e) {
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }
});

/**
 * GET /server/api/verify/bot-status
 * 返回当前是否启用了 Turnstile，以及站点密钥（供前端决定是否渲染验证组件）。
 */
verify.get('/bot-status', (c) => {
  const enabled = !!(c.env && c.env.TURNSTILE_SECRET_KEY);
  return c.json({
    turnstileEnabled: enabled,
    siteKey: (c.env && c.env.TURNSTILE_SITE_KEY) || '',
  });
});

export default verify;
