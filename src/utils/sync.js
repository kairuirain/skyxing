import { kvGet, kvPut, kvIncrement, kvGetMany, PREFIX } from './kv.js';

/**
 * 用户设置默认值（需求 1/6/13：多语言、动画模式、调试开关、协议同意）
 */
export const SETTINGS_DEFAULTS = {
  language: null, // null = 跟随系统
  animationMode: 'normal', // 'minimal' | 'normal' | 'rich'
  debugEnabled: false,
  agreedToTerms: false,
};

/**
 * 读取用户同步版本号（每次设置/通知状态变更 +1）
 */
export async function getSyncVersion(env, userId) {
  const v = await env.SKYXING_KV.get(PREFIX.SYNC + userId);
  return v ? parseInt(v, 10) : 0;
}

/**
 * 递增用户同步版本号，返回新值
 */
export async function bumpSyncVersion(env, userId) {
  return await kvIncrement(env, PREFIX.SYNC + userId);
}

/**
 * 从完整用户对象中提取可被同步的设置字段
 */
export function extractSettings(user) {
  return {
    language: user.language ?? null,
    animationMode: user.animationMode ?? 'normal',
    debugEnabled: !!user.debugEnabled,
    agreedToTerms: !!user.agreedToTerms,
  };
}
