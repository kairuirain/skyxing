/**
 * 基于 KV 的轻量滑动窗口计数器
 * 用于防人机验证的「异常高频操作」判定（登录失败、注册频率、API 调用等）。
 *
 * 每个计数键存储 { count, ts }，超过窗口时间自动重置。
 */

/**
 * 读取当前窗口内的计数
 */
export async function getCounter(env, key, windowMs = 10 * 60 * 1000) {
  try {
    const raw = await env.SKYXING_KV.get(key);
    if (!raw) return 0;
    const o = JSON.parse(raw);
    if (Date.now() - o.ts > windowMs) return 0;
    return o.count || 0;
  } catch {
    return 0;
  }
}

/**
 * 计数 +1，返回当前窗口内的最新计数
 */
export async function incrCounter(env, key, windowMs = 10 * 60 * 1000) {
  let o = null;
  try {
    const raw = await env.SKYXING_KV.get(key);
    if (raw) o = JSON.parse(raw);
  } catch { /* ignore */ }

  const now = Date.now();
  if (!o || now - o.ts > windowMs) o = { count: 0, ts: now };
  o.count += 1;
  await env.SKYXING_KV.put(key, JSON.stringify(o));
  return o.count;
}

/**
 * 清零计数器（如登录成功后重置失败计数）
 */
export async function resetCounter(env, key) {
  try {
    await env.SKYXING_KV.delete(key);
  } catch { /* ignore */ }
}
