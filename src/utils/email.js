/**
 * 邮件服务 (Resend API)
 * 预留代码，未启用（域名未配置）
 * API Key: re_HB4KU7E6_Ab5vKPcuMjE5CDdM2KeDNCWYz
 */

const RESEND_API_KEY = 're_HB4KU7E6_Ab5vKPcuMjE5CDdM2KeDNCWYz';
const FROM_EMAIL = 'noreply@skyxing.org';

/** 是否启用邮件服务（未配置域名前为 false） */
export const EMAIL_ENABLED = false;

/** 生成6位数字验证码 */
export function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/** 发送验证码邮件（预留） */
export async function sendVerificationEmail(email, code) {
    if (!EMAIL_ENABLED) {
        console.log(`[Email] DISABLED - Would send code ${code} to ${email}`);
        return { success: false, message: '邮件服务暂未启用' };
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `SkyXing <${FROM_EMAIL}>`,
                to: email,
                subject: 'SkyXing 验证码',
                html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
<h2 style="color:#667eea">SkyXing 验证码</h2>
<p>您的验证码是：</p>
<div style="font-size:32px;font-weight:bold;letter-spacing:6px;padding:15px;background:#f0f0f0;border-radius:8px;text-align:center">${code}</div>
<p style="color:#888;font-size:13px">验证码10分钟内有效，请勿泄露给他人。</p>
</div>`
            })
        });

        const data = await res.json();
        return res.ok ? { success: true, id: data.id } : { success: false, message: data.message || '发送失败' };
    } catch (e) {
        console.error('[Email] 发送失败:', e.message);
        return { success: false, message: '邮件服务异常' };
    }
}

/** 存储邮箱验证码到 KV（10分钟过期） */
export async function storeEmailCode(env, email, code) {
    await env.SkyXing.put(`email_code:${email.toLowerCase()}`, code, { expirationTtl: 600 });
}

/** 验证邮箱验证码 */
export async function verifyEmailCode(env, email, code) {
    const stored = await env.SkyXing.get(`email_code:${email.toLowerCase()}`);
    if (!stored) return { valid: false, reason: '验证码已过期' };
    await env.SkyXing.delete(`email_code:${email.toLowerCase()}`);
    if (stored === code) return { valid: true };
    return { valid: false, reason: '验证码错误' };
}

/** 检查邮箱验证码发送频率（60秒1次） */
export async function checkEmailRateLimit(env, email) {
    const key = `rl:email:${email.toLowerCase()}`;
    const n = parseInt(await env.SkyXing.get(key) || '0') + 1;
    await env.SkyXing.put(key, String(n), { expirationTtl: 60 });
    return n <= 1;
}
