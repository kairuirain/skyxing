/**
 * KV Storage helpers for SkyXing
 * Uses Cloudflare Workers KV namespace binding: SKYXING_KV
 */

const PREFIX = {
  USERS: 'user:',
  USERNAME_INDEX: 'username:',
  EMAIL_INDEX: 'email:',
  ARTICLES: 'article:',
  COMMENTS: 'comment:',
  COMMENT_INDEX: 'comment:idx:',
  TAGS: 'tag:',
  COUNTERS: 'counter:',
  MESSAGES: 'msg:',
  UPDATES: 'update:',
  NOTIFICATIONS: 'notif:',
  NOTIFICATION_INDEX: 'notif:idx:',
  SYNC: 'sync:',          // 用户同步版本号：sync:<userId>
  RATELIMIT: 'rl:',       // 防人机验证计数器：rl:loginfail:<ip> 等
};

/**
 * Get a value from KV
 */
export async function kvGet(env, key, parseJson = true) {
  try {
    const value = await env.SKYXING_KV.get(key);
    if (!value) return null;
    return parseJson ? JSON.parse(value) : value;
  } catch (e) {
    return null;
  }
}

/**
 * Put a value into KV
 */
export async function kvPut(env, key, value) {
  const data = typeof value === 'string' ? value : JSON.stringify(value);
  await env.SKYXING_KV.put(key, data);
}

/**
 * Delete a value from KV
 */
export async function kvDelete(env, key) {
  await env.SKYXING_KV.delete(key);
}

/**
 * 内存缓存（同一 Worker 实例内共享）
 * 避免每个请求都消耗 KV list() 配额（免费计划每日有限）
 */
const listCache = new Map();

function getListCacheKey(prefix, limit) {
  return `kvlist:${prefix}:${limit}`;
}

/**
 * List keys with a prefix（带 60s 内存缓存，减少 KV list() 调用）
 */
export async function kvList(env, prefix, limit = 100) {
  const cacheKey = getListCacheKey(prefix, limit);
  const cached = listCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60_000) {
    return cached.data;
  }
  const result = await env.SKYXING_KV.list({ prefix, limit });
  listCache.set(cacheKey, { data: result.keys, ts: Date.now() });
  return result.keys;
}

/**
 * 清除指定前缀的 list 缓存（在写入操作后调用）
 */
export function invalidateListCache(prefix) {
  for (const key of listCache.keys()) {
    if (key.startsWith(`kvlist:${prefix}`)) {
      listCache.delete(key);
    }
  }
}

/**
 * Get and increment a counter
 */
export async function kvIncrement(env, key) {
  const current = await env.SKYXING_KV.get(key);
  const num = current ? parseInt(current) + 1 : 1;
  await env.SKYXING_KV.put(key, num.toString());
  return num;
}

/**
 * Batch-get multiple KV values in parallel (O(1) round-trips via Promise.all)
 * @param {string[]} keys full KV keys
 */
export async function kvGetMany(env, keys) {
  return Promise.all(keys.map((k) => kvGet(env, k)));
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a slug from a title
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export { PREFIX };
