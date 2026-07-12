import { Hono } from 'hono';
import { generateToken, verifyToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { kvGet, kvPut, kvList, generateId, PREFIX } from '../utils/kv.js';

const auth = new Hono();

/**
 * POST /server/api/auth/register
 * Register a new user
 */
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, password, displayName } = body;

    // Validation
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

    // Check if username already exists
    const existingUsername = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), false);
    if (existingUsername) {
      return c.json({ error: 'Username already taken' }, 409);
    }

    // Check if email already exists
    const allUsers = await kvList(env, PREFIX.USERS);
    for (const key of allUsers) {
      const user = await kvGet(env, key.name);
      if (user && user.email === email) {
        return c.json({ error: 'Email already registered' }, 409);
      }
    }

    const id = generateId();
    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    const user = {
      id,
      username,
      email,
      passwordHash: hashedPassword,
      displayName: displayName || username,
      avatar: '',
      bio: '',
      role: 'user', // 'user', 'author', 'admin'
      createdAt: now,
      updatedAt: now,
    };

    // Store user
    await kvPut(env, PREFIX.USERS + id, user);
    // Index username -> userId
    await kvPut(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), id);

    // Generate token
    const token = await generateToken({
      userId: id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return c.json({
      message: 'Registration successful',
      token,
      user: userWithoutPassword,
    }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * POST /server/api/auth/login
 * Login with username/email and password
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const env = c.env;

    // Find user by username (case-insensitive)
    const userId = await kvGet(env, PREFIX.USERNAME_INDEX + username.toLowerCase(), false);

    if (!userId) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const user = await kvGet(env, PREFIX.USERS + userId);
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate token
    const token = await generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return c.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * GET /server/api/auth/me
 * Get current user profile
 */
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const user = await kvGet(c.env, PREFIX.USERS + payload.userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { passwordHash, ...userWithoutPassword } = user;
  return c.json({ user: userWithoutPassword });
});

export default auth;
