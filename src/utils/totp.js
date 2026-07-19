/**
 * TOTP (Time-based One-Time Password) 实现
 * 兼容 Google Authenticator / Authy 等标准 TOTP 应用
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_WINDOW = 30;
const TOTP_DIGITS = 6;

/** 生成随机 20 字节 Base32 密钥 */
export function generateSecret(length = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let bits = 0, value = 0, b32 = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      b32 += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) b32 += BASE32[(value << (5 - bits)) & 31];
  return b32;
}

function base32Decode(encoded) {
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let buffer = 0, bitsLeft = 0;
  for (const ch of cleaned) {
    const val = BASE32.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >>> (bitsLeft - 8)) & 255);
      bitsLeft -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function generateTOTP(secret, timestamp) {
  const keyData = base32Decode(secret);
  let counter = Math.floor(timestamp / TOTP_WINDOW);
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter >>>= 8;
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes));
  const offset = hmac[19] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, '0');
}

/** 验证 TOTP 验证码（允许 ±1 个窗口偏差） */
export async function verifyTOTP(secret, code, windowSize = 1) {
  const now = Math.floor(Date.now() / 1000);
  for (let w = -windowSize; w <= windowSize; w++) {
    const expected = await generateTOTP(secret, now + w * TOTP_WINDOW);
    if (expected === code) return true;
  }
  return false;
}

/** 生成 otpauth:// URI */
export function generateOTPAuthURI(secret, issuer, account) {
  const encodedIssuer = encodeURIComponent(issuer || 'SkyXing');
  const encodedAccount = encodeURIComponent(account || '');
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
