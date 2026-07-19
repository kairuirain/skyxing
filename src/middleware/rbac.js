import { verifyToken } from '../utils/auth.js';

/**
 * RBAC 角色层级（数值越大权限越高）
 * 1 = 用户（user），2 = 管理员（admin），3 = 官方（official）
 * 原 "author" 角色已移除，统一归为 "user"
 */
export const ROLE_RANK = {
  user: 1,
  admin: 2,
  official: 3,
};

function extractPayload(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7), c.env);
}

/** 必须登录 */
export async function authRequired(c, next) {
  const payload = await extractPayload(c);
  if (!payload) return c.json({ error: 'Authentication required' }, 401);
  c.set('user', payload);
  await next();
}

/** 可选登录 */
export async function authOptional(c, next) {
  const payload = await extractPayload(c);
  if (payload) c.set('user', payload);
  await next();
}

/**
 * 基于角色层级的权限校验中间件
 * @param {string} minRole 所需最低角色：'user' | 'admin' | 'official'
 */
export function requireRole(minRole = 'user') {
  const min = ROLE_RANK[minRole] ?? 1;
  return async (c, next) => {
    const payload = await extractPayload(c);
    if (!payload) return c.json({ error: 'Authentication required' }, 401);
    if ((ROLE_RANK[payload.role] ?? 0) < min) return c.json({ error: 'Insufficient permissions' }, 403);
    c.set('user', payload);
    await next();
  };
}

export const adminRequired = requireRole('admin');
export const officialRequired = requireRole('official');

/**
 * 判断当前用户是否有权管理目标用户
 * 管理员只能管理普通用户（role='user'），官方可管理所有角色
 */
export function canManage(currentUserRole, targetUserRole) {
  const currentLevel = ROLE_RANK[currentUserRole] ?? 0;
  const targetLevel = ROLE_RANK[targetUserRole] ?? 0;
  if (currentLevel >= 3) return true; // official 可管理一切
  if (currentLevel >= 2 && targetLevel <= 1) return true; // admin 只能管理 user
  return false;
}
