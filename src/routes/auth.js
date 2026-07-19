import { Hono } from 'hono';
import { generateToken, verifyToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { kvGet, kvPut, generateId, PREFIX } from '../utils/kv.js';
import { createNotification } from '../utils/notifications.js';
import { authRequired } from '../middleware/rbac.js';

const auth = new Hono();

/**
 * POST /server/api/auth/register
 * 注册新用户（角色固定为 'user'）
 */
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, password, displayName } = body;

    if (!username || !email || !password) {
      return c.json({ error: 'Username, email, and password are required' }, 400);
    }
    if (username.length < 3 || username.length > 30) {
      return c.json({ error: 'Username must be between 3 and 30 characters' }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const env = c.env;
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
      role: 'user', // 账号角色：1=user, 2=admin, 3=official（注册只能创建 user）
      createdAt: now, updatedAt: now,
    };

    await kvPut(env, PREFIX.USERS + id, user);
    await kvPut(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), id);
    await kvPut(env, PREFIX.EMAIL_INDEX + email.toLowerCase(), id);

    const token = await generateToken({ userId: id, username: user.username, role: user.role }, env);

    // 欢迎通知
    await createNotification(env, {
      userId: id, type: 'system', actor: null,
      text: '欢迎加入 SkyXing！开始分享你的想法吧。', link: '/',
    });

    const { passwordHash, ...userWithoutPassword } = user;
    return c.json({ message: 'Registration successful', token, user: userWithoutPassword }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ─── 登录 ──────────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password) return c.json({ error: 'Username and password are required' }, 400);

    const env = c.env;
    const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), false);
    if (!userId) return c.json({ error: 'Invalid credentials' }, 401);

    const user = await kvGet(env, PREFIX.USERS + userId);
    if (!user) return c.json({ error: 'Invalid credentials' }, 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

    // 旧格式密码自动迁移到 PBKDF2
    if (!user.passwordHash || !user.passwordHash.startsWith('pbkdf2$')) {
      user.passwordHash = await hashPassword(password);
      user.updatedAt = new Date().toISOString();
      await kvPut(env, PREFIX.USERS + user.id, user);
    }

    const token = await generateToken({ userId: user.id, username: user.username, role: user.role }, env);
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
  const { passwordHash, ...userWithoutPassword } = user;
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

/**
 * 确保 SkyXing 官方账号存在（幂等，可在应用启动时调用）
 * 仅当 no 名为 SkyXing 的用户时创建；角色固定为 official（level 3）
 */
export async function ensureOfficialAccount(env) {
  const username = 'SkyXing';
  const existing = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase());
  if (existing) return; // 已存在

  const id = generateId();
  const hashedPassword = await hashPassword('WUkaiRUI@(SkyXing2026)');
  const now = new Date().toISOString();
  const user = {
    id, username, email: 'official@skyxing.app',
    passwordHash: hashedPassword,
    displayName: 'SkyXing 官方', avatar: '', bio: 'SkyXing 官方账号',
    role: 'official', createdAt: now, updatedAt: now,
  };

  await kvPut(env, PREFIX.USERS + id, user);
  await kvPut(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), id);
  await kvPut(env, PREFIX.EMAIL_INDEX + 'official@skyxing.app', id);
  console.log('[Bootstrap] SkyXing 官方账号已创建');
}

export default auth;
