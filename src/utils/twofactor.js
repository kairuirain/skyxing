/**
 * 二次认证模块 (TOTP + 邮箱验证码)
 * RFC 6238 标准 TOTP，基于 HMAC-SHA1
 */

// Base32 字符集
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 生成随机 Base32 密钥 */
export function generateSecret() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    let base32 = '';
    let bits = 0, value = 0;
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            base32 += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) base32 += BASE32[(value << (5 - bits)) & 31];
    return base32;
}

/** 生成 otpauth URI (用于 QR 码) */
export function generateUri(secret, username, issuer = 'SkyXing') {
    const encIssuer = encodeURIComponent(issuer);
    const encUser = encodeURIComponent(username);
    return `otpauth://totp/${encIssuer}:${encUser}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Base32 解码 */
function base32Decode(str) {
    str = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const bytes = [];
    let bits = 0, value = 0;
    for (const c of str) {
        value = (value << 5) | BASE32.indexOf(c);
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return new Uint8Array(bytes);
}

/**
 * 生成当前 TOTP 码
 * @param {string} secret - Base32 密钥
 * @param {number} [timeStep=30] - 时间步长
 * @returns {Promise<string>} 6位数字验证码
 */
export async function generateTOTP(secret, timeStep = 30) {
    const keyData = base32Decode(secret);
    let counter = Math.floor(Date.now() / 1000 / timeStep);
    const counterBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
        counterBytes[i] = counter & 0xff;
        counter = counter >>> 8;
    }

    const key = await crypto.subtle.importKey('raw', keyData,
        { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const hmac = await crypto.subtle.sign('HMAC', key, counterBytes);
    const hmacBytes = new Uint8Array(hmac);
    const offset = hmacBytes[19] & 0x0f;
    const codeNum = ((hmacBytes[offset] & 0x7f) << 24 |
        (hmacBytes[offset + 1] & 0xff) << 16 |
        (hmacBytes[offset + 2] & 0xff) << 8 |
        (hmacBytes[offset + 3] & 0xff)) % 1000000;
    return String(codeNum).padStart(6, '0');
}

/**
 * 验证 TOTP 码（允许前后一个时间窗口）
 */
export async function verifyTOTP(secret, code, timeStep = 30) {
    if (!secret || !code) return false;
    const expected = await generateTOTP(secret, timeStep);
    if (expected === code) return true;

    // 检查上一个窗口
    const prevStep = timeStep * (Math.floor(Date.now() / 1000 / timeStep) - 1);
    const prevCounter = Math.floor(prevStep / timeStep);
    // 简化：用Date.now() - timeStep*1000 的 counter
    const keyData = base32Decode(secret);
    let counter = Math.floor((Date.now() - timeStep * 1000) / 1000 / timeStep);
    const counterBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) { counterBytes[i] = counter & 0xff; counter = counter >>> 8; }
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const hmac = await crypto.subtle.sign('HMAC', key, counterBytes);
    const hmacBytes = new Uint8Array(hmac);
    const offset = hmacBytes[19] & 0x0f;
    const prevCode = String(((hmacBytes[offset] & 0x7f) << 24 | (hmacBytes[offset + 1] & 0xff) << 16 | (hmacBytes[offset + 2] & 0xff) << 8 | (hmacBytes[offset + 3] & 0xff)) % 1000000).padStart(6, '0');
    if (prevCode === code) return true;

    // 检查下一个窗口
    counter = Math.floor((Date.now() + timeStep * 1000) / 1000 / timeStep);
    const cb2 = new Uint8Array(8);
    let c2 = counter;
    for (let i = 7; i >= 0; i--) { cb2[i] = c2 & 0xff; c2 = c2 >>> 8; }
    const hmac2 = await crypto.subtle.sign('HMAC', key, cb2);
    const hb2 = new Uint8Array(hmac2);
    const off2 = hb2[19] & 0x0f;
    const nextCode = String(((hb2[off2] & 0x7f) << 24 | (hb2[off2 + 1] & 0xff) << 16 | (hb2[off2 + 2] & 0xff) << 8 | (hb2[off2 + 3] & 0xff)) % 1000000).padStart(6, '0');
    return nextCode === code;
}

/** 生成备用恢复码 (8位字母数字 * 6个) */
export function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 6; i++) {
        let code = '';
        for (let j = 0; j < 8; j++) {
            code += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
        }
        codes.push(code);
    }
    return codes;
}
