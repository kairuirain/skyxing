import { verifyToken } from '../utils/auth.js';

/**
 * RBAC 角色层级（数值越大权限越高）
 * 用于在后端强制进行权限分级校验，前端仅做视图层展示/隐藏。
 */
export const ROLE_RANK = {
  user: 1,
  author: 2,
  admin: 3,
};

function extractPayload(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return verifyToken(authHeader.slice(7));
}

/**
 * 必须登录：校验 JWT，并将用户信息挂到 context（c.set('user', payload)）。
 * 任何未携带合法令牌的请求直接被后端拦截（401）。
 */
export async function authRequired(c, next) {
  const payload = await extractPayload(c);
  if (!payload) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  c.set('user', payload);
  await next();
}

/**
 * 可选登录：携带合法令牌时挂载用户信息，否则不拦截。
 */
export async function authOptional(c, next) {
  const payload = await extractPayload(c);
  if (payload) {
    c.set('user', payload);
  }
  await next();
}

/**
 * 基于角色层级的权限校验中间件（后端强制拦截）。
 * @param {string} minRole 所需的最低角色，如 'user' | 'author' | 'admin'
 */
export function requireRole(minRole = 'user') {
  const min = ROLE_RANK[minRole] ?? 1;
  return async (c, next) => {
    const payload = await extractPayload(c);
    if (!payload) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    if ((ROLE_RANK[payload.role] ?? 0) < min) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    c.set('user', payload);
    await next();
  };
}

/** 兼容别名：管理员路由使用 requireRole('admin') */
export const adminRequired = requireRole('admin');
