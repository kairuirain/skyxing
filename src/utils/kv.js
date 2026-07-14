/**
 * KV Storage helpers for SkyXing
 * Uses Cloudflare Workers KV namespace binding: SKYXING_KV
 */

const PREFIX = {
  USERS: 'user:',
  USERNAME_INDEX: 'username:',
  ARTICLES: 'article:',
  COMMENTS: 'comment:',
  TAGS: 'tag:',
  COUNTERS: 'counter:',
  MESSAGES: 'msg:',
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
 * List keys with a prefix
 */
export async function kvList(env, prefix, limit = 100) {
  const result = await env.SKYXING_KV.list({ prefix, limit });
  return result.keys;
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
