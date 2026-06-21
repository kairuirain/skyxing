/**
 * 安全认证工具模块
 * - 密码哈希 (SHA-256 + salt)
 * - Token 签名与验证 (HMAC-SHA256, 无状态)
 * - Cookie 安全设置
 */
const TOKEN_SECRET_KEY = 'skyxing-auth-secret-v2';

function buf2hex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function textEncode(str) { return new TextEncoder().encode(str); }

export async function hashPassword(password, salt) {
    if (!salt) salt = buf2hex(crypto.getRandomValues(new Uint8Array(16)));
    const digest = await crypto.subtle.digest('SHA-256', textEncode(salt + password));
    return { hash: buf2hex(digest), salt };
}

export async function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = await hashPassword(password, storedSalt);
    return hash === storedHash;
}

/**
 * HMAC-SHA256 签名 token
 * 格式: btoa(username:timestamp:sigHex16)
 */
export async function signToken(username, timestamp) {
    const payload = `${username}:${timestamp}`;
    const key = await crypto.subtle.importKey('raw', textEncode(TOKEN_SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, textEncode(payload));
    return btoa(`${payload}:${buf2hex(signature).substring(0, 16)}`);
}

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * 无状态验证 token（不依赖 KV）
 */
export async function verifyToken(token) {
    try {
        const decoded = atob(token);
        const parts = decoded.split(':');
        if (parts.length !== 3) return null;
        const [username, timestampStr, signature] = parts;
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL) return null;

        const payload = `${username}:${timestamp}`;
        const key = await crypto.subtle.importKey('raw', textEncode(TOKEN_SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const expectedSig = await crypto.subtle.sign('HMAC', key, textEncode(payload));
        if (signature !== buf2hex(expectedSig).substring(0, 16)) return null;
        return { username, timestamp };
    } catch (e) { return null; }
}

export function createSecureCookie(name, value, maxAgeSeconds = 7 * 24 * 60 * 60) {
    return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict`;
}

export function extractToken(request) {
    const ah = request.headers.get('Authorization');
    if (ah && ah.startsWith('Bearer ')) return ah.substring(7);
    const ch = request.headers.get('Cookie');
    if (ch) {
        for (const c of ch.split(';')) {
            const [n, v] = c.trim().split('=');
            if (n === 'auth_token') return v;
        }
    }
    return null;
}

export function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 'unknown';
}
