import { Hono } from 'hono';
import * as jose from 'jose';
import { generateToken, verifyToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { kvGet, kvPut, generateId, PREFIX } from '../utils/kv.js';
import { createNotification } from '../utils/notifications.js';
import { authRequired } from '../middleware/rbac.js';
import { generateSecret, verifyTOTP, generateOTPAuthURI } from '../utils/totp.js';
import { verifyTurnstile } from '../utils/turnstile.js';
import { incrCounter, resetCounter } from '../utils/ratelimit.js';

const auth = new Hono();

/** 生成短时效的临时令牌（用于 2FA 第二步认证） */
async function generateTempToken(payload, env) {
  const secret = env?.JWT_SECRET;
  const key = new TextEncoder().encode(secret || 'dev-only-insecure-fallback-secret');
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/** 获取 JWT 密钥（与 utils/auth.js 逻辑一致） */
function getJwtSecret(env) {
  const secret = env?.JWT_SECRET;
  return new TextEncoder().encode(secret || 'dev-only-insecure-fallback-secret');
}

// ─── 注册 ──────────────────────────────────────────────────────────
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, password, displayName } = body;
    if (!username || !email || !password) return c.json({ error: 'Username, email, and password are required' }, 400);
    if (username.length < 3 || username.length > 30) return c.json({ error: 'Username must be between 3 and 30 characters' }, 400);
    if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return c.json({ error: 'Invalid email format' }, 400);

    const env = c.env;
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const regKey = PREFIX.RATELIMIT + 'reg:' + ip;
    // 需求 7：注册强制人机验证（防垃圾账号）。未配置密钥时自动放行（本地开发）。
    const regOk = await verifyTurnstile(body.turnstileToken, env, ip);
    if (!regOk) return c.json({ error: '请先完成人机验证', needTurnstile: true }, 403);

    const existingUsername = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), false);
    if (existingUsername) return c.json({ error: 'Username already taken' }, 409);
    const existingEmail = await kvGet(env, PREFIX.EMAIL_INDEX + email.toLowerCase(), false);
    if (existingEmail) return c.json({ error: 'Email already registered' }, 409);

    const id = generateId();
    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();
    const user = {
      id, username, email,
      passwordHash: hashedPassword,
      displayName: displayName || username,
      avatar: '', bio: '',
      role: 'user',
      totpEnabled: false,
      // 需求 1/2/6/13：协议同意与可同步的用户偏好
      agreedToTerms: !!body.agreedToTerms,
      language: body.language || null,
      animationMode: body.animationMode || 'normal',
      debugEnabled: false,
      createdAt: now, updatedAt: now,
    };

    await kvPut(env, PREFIX.USERS + id, user);
    await kvPut(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), id);
    await kvPut(env, PREFIX.EMAIL_INDEX + email.toLowerCase(), id);
    await incrCounter(env, regKey, 60 * 60 * 1000);

    const token = await generateToken({ userId: id, username: user.username, role: user.role }, env);
    await createNotification(env, {
      userId: id, type: 'system', actor: null,
      text: '欢迎加入 SkyXing！开始分享你的想法吧。', link: '/',
      title: '欢迎加入', body: '欢迎加入 SkyXing！开始分享你的想法吧。',
      category: 'system', icon: 'system', priority: 'normal',
    });

    const { passwordHash, ...userWithoutPassword } = user;
    return c.json({ message: 'Registration successful', token, user: userWithoutPassword }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 登录（感知 2FA） ──────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, turnstileToken } = body;
    if (!username || !password) return c.json({ error: 'Username and password are required' }, 400);

    const env = c.env;
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const failKey = PREFIX.RATELIMIT + 'loginfail:' + ip;

    // 需求 7：登录强制人机验证。未配置密钥时自动放行（本地开发）。
    const loginOk = await verifyTurnstile(turnstileToken, env, ip);
    if (!loginOk) return c.json({ error: '请先完成人机验证', needTurnstile: true }, 403);

    const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), false);
    if (!userId) return c.json({ error: 'Invalid credentials' }, 401);

    const user = await kvGet(env, PREFIX.USERS + userId);
    if (!user) return c.json({ error: 'Invalid credentials' }, 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await incrCounter(env, failKey);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // 登录成功 → 重置失败计数
    await resetCounter(env, failKey);

    // 旧格式密码自动迁移到 PBKDF2
    if (!user.passwordHash || !user.passwordHash.startsWith('pbkdf2$')) {
      user.passwordHash = await hashPassword(password);
      user.updatedAt = new Date().toISOString();
      await kvPut(env, PREFIX.USERS + user.id, user);
    }

    // 若用户启用了 2FA，返回临时令牌，需要第二步验证
    if (user.totpEnabled) {
      const tempToken = await generateTempToken({ userId: user.id, username: user.username, purpose: '2fa' }, env);
      return c.json({ requireTotp: true, tempToken, message: '请输入动态验证码' });
    }

    const token = await generateToken({ userId: user.id, username: user.username, role: user.role }, env);
    const { passwordHash, ...userWithoutPassword } = user;
    return c.json({ message: 'Login successful', token, user: userWithoutPassword });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 2FA 第二步验证 ────────────────────────────────────────────────
auth.post('/2fa/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { tempToken, code } = body;
    if (!tempToken || !code) return c.json({ error: '缺少临时令牌或验证码' }, 400);

    const payload = await jose.jwtVerify(tempToken, getJwtSecret(c.env)).catch(() => null);
    if (!payload) return c.json({ error: '临时令牌无效或已过期' }, 401);
    if (payload.payload?.purpose !== '2fa') return c.json({ error: '无效的令牌用途' }, 403);

    const user = await kvGet(c.env, PREFIX.USERS + payload.payload.userId);
    if (!user || !user.totpSecret) return c.json({ error: '未设置 2FA' }, 400);

    const ok = await verifyTOTP(user.totpSecret, code);
    if (!ok) return c.json({ error: '验证码错误', remainingAttempts: 3 }, 401);

    // 验证通过 → 签发完整 JWT
    const token = await generateToken({ userId: user.id, username: user.username, role: user.role }, c.env);
    const { passwordHash, ...userWithoutPassword } = user;
    return c.json({ message: 'Login successful', token, user: userWithoutPassword });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 当前用户信息 ─────────────────────────────────────────────────
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authentication required' }, 401);
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env);
  if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);
  const user = await kvGet(c.env, PREFIX.USERS + payload.userId);
  if (!user) return c.json({ error: 'User not found' }, 404);
  const { passwordHash, totpSecret, ...userWithoutPassword } = user;
  // 返回 totpEnabled 状态供前端展示
  userWithoutPassword.totpEnabled = !!user.totpEnabled;
  return c.json({ user: userWithoutPassword });
});

// ─── 修改密码 ─────────────────────────────────────────────────────
auth.post('/change-password', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;
  try {
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return c.json({ error: '当前密码与新密码均为必填' }, 400);
    if (newPassword.length < 6) return c.json({ error: '新密码至少 6 位' }, 400);
    const full = await kvGet(env, PREFIX.USERS + user.userId);
    if (!full) return c.json({ error: '用户不存在' }, 404);
    const valid = await verifyPassword(currentPassword, full.passwordHash);
    if (!valid) return c.json({ error: '当前密码不正确' }, 401);
    full.passwordHash = await hashPassword(newPassword);
    full.updatedAt = new Date().toISOString();
    await kvPut(env, PREFIX.USERS + user.userId, full);
    return c.json({ message: '密码修改成功' });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 2FA 设置 ─────────────────────────────────────────────────────
auth.post('/2fa/setup', authRequired, async (c) => {
  const user = c.get('user');
  const full = await kvGet(c.env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: '用户不存在' }, 404);

  if (full.totpEnabled) return c.json({ error: '2FA 已启用，请先关闭后再重新设置' }, 400);

  const secret = generateSecret();
  const uri = generateOTPAuthURI(secret, 'SkyXing', full.email || user.username);

  return c.json({ secret, uri, message: '请使用身份验证器扫描二维码或手动输入密钥' });
});

// ─── 2FA 验证设置 ────────────────────────────────────────────────
auth.post('/2fa/verify-setup', authRequired, async (c) => {
  const user = c.get('user');
  const { secret, code } = await c.req.json();
  if (!secret || !code) return c.json({ error: '缺少密钥或验证码' }, 400);

  const ok = await verifyTOTP(secret, code);
  if (!ok) return c.json({ error: '验证码错误，请重试' }, 401);

  const full = await kvGet(c.env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: '用户不存在' }, 404);

  full.totpSecret = secret;
  full.totpEnabled = true;
  full.updatedAt = new Date().toISOString();
  await kvPut(c.env, PREFIX.USERS + user.userId, full);

  return c.json({ message: '2FA 已启用' });
});

// ─── 2FA 关闭 ─────────────────────────────────────────────────────
auth.post('/2fa/disable', authRequired, async (c) => {
  const user = c.get('user');
  const full = await kvGet(c.env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: '用户不存在' }, 404);

  full.totpSecret = undefined;
  full.totpEnabled = false;
  full.updatedAt = new Date().toISOString();
  await kvPut(c.env, PREFIX.USERS + user.userId, full);

  return c.json({ message: '2FA 已关闭' });
});

/**
 * 确保 SkyXing 官方账号存在
 */
export async function ensureOfficialAccount(env) {
  const username = 'SkyXing';
  const idxKey = PREFIX.USERNAME_INDEX + username.toLowerCase();
  const existingId = await kvGet(env, idxKey, false);
  if (existingId) {
    // 幂等：账号已存在时，若角色不正确（本地旧数据/异常），修复之而非跳过
    const full = await kvGet(env, PREFIX.USERS + existingId);
    if (full && full.role !== 'official') {
      full.role = 'official';
      full.updatedAt = new Date().toISOString();
      await kvPut(env, PREFIX.USERS + existingId, full);
      console.log('[Bootstrap] SkyXing 官方账号角色已修复为 official');
    }
    return;
  }
  const id = generateId();
  const hashedPassword = await hashPassword('WUkaiRUI@(SkyXing2026)');
  const now = new Date().toISOString();
  const user = {
    id, username, email: 'official@skyxing.app',
    passwordHash: hashedPassword,
    displayName: 'SkyXing 官方', avatar: '', bio: 'SkyXing 官方账号',
    role: 'official', totpEnabled: false,
    createdAt: now, updatedAt: now,
  };
  await kvPut(env, PREFIX.USERS + id, user);
  await kvPut(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), id);
  await kvPut(env, PREFIX.EMAIL_INDEX + 'official@skyxing.app', id);
  console.log('[Bootstrap] SkyXing 官方账号已创建');
}

export default auth;
