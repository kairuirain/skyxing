/**
 * Cloudflare Turnstile 校验（需求 7：防人机验证）
 *
 * - 未配置 TURNSTILE_SECRET_KEY 时自动放行（本地开发 / 未接入密钥场景）。
 * - 已配置密钥时，请求 siteverify 端点校验前端提交的 token。
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * 校验一个 Turnstile token 是否有效。
 * @param {string} token 前端提交的 Turnstile 响应令牌
 * @param {object} env Worker 绑定环境（含 TURNSTILE_SECRET_KEY）
 * @param {string} ip 客户端 IP（cf-connecting-ip），用于风险分析
 * @returns {Promise<boolean>} 校验通过返回 true
 */
export async function verifyTurnstile(token, env, ip) {
  const secret = env && env.TURNSTILE_SECRET_KEY;
  // 未配置密钥 → 开发/未接入环境自动放行，便于本地测试
  if (!secret) return true;
  // 已配置但缺少 token → 视为校验失败
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set('remoteip', ip);
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('[Turnstile] 校验失败:', JSON.stringify(data['error-codes'] || data));
    }
    return !!data.success;
  } catch (e) {
    console.error('[Turnstile] siteverify 请求异常:', e);
    return false;
  }
}

export default { verifyTurnstile };
