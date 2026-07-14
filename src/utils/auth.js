import * as jose from 'jose';

/**
 * JWT 密钥来自环境变量 / Cloudflare Secret（c.env.JWT_SECRET），
 * 不再硬编码，避免密钥随代码入库泄露。
 */
function getSecret(env) {
  const secret = env && env.JWT_SECRET;
  if (!secret) {
    // 本地开发回退（仅 dev）：生产密钥必须通过 `wrangler secret put JWT_SECRET` 注入，
    // 绝不随代码/配置入库。
    console.warn('[auth] JWT_SECRET 未配置，使用开发回退密钥，请勿用于生产环境');
    return new TextEncoder().encode('dev-only-insecure-fallback-secret');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate a JWT token for a user
 * @param {object} payload 令牌载荷
 * @param {object} env Cloudflare 运行环境（含 JWT_SECRET）
 */
export async function generateToken(payload, env) {
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret(env));
  return jwt;
}

/**
 * Verify and decode a JWT token
 * @returns {object|null} 解析后的载荷，失败返回 null
 */
export async function verifyToken(token, env) {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(env));
    return payload;
  } catch (e) {
    return null;
  }
}

/* ----------------------- 密码哈希（PBKDF2 + 每用户随机盐） -----------------------
 * 旧实现为 SHA-256(password + 静态盐)，较快且无工作因子，存在被彩虹表攻击风险。
 * 升级为 Web Crypto PBKDF2-HMAC-SHA256（Cloudflare Workers 原生支持），
 * 采用每用户随机盐 + 10 万次迭代，存储格式：pbkdf2$<iter>$<saltB64>$<hashB64>。
 * verifyPassword 兼容旧格式，登录成功后由路由层自动迁移到新格式。
 */

const PBKDF2_ITERATIONS = 100000;
const LEGACY_SALT = 'skyxing-salt';

function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeyMaterial(password) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
}

async function legacyHash(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password + LEGACY_SALT);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Hash a password using PBKDF2 with a per-user random salt.
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    await getKeyMaterial(password),
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(derived))}`;
}

/**
 * Verify a password against a stored hash (兼容旧 SHA-256 格式)。
 */
export async function verifyPassword(password, stored) {
  if (!stored) return false;

  if (stored.startsWith('pbkdf2$')) {
    const [, iter, saltB64, hashB64] = stored.split('$');
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: b64ToBytes(saltB64),
        iterations: Number(iter),
        hash: 'SHA-256',
      },
      await getKeyMaterial(password),
      256
    );
    return bytesToB64(new Uint8Array(derived)) === hashB64;
  }

  // 旧格式：SHA-256(password + 静态盐)
  return (await legacyHash(password)) === stored;
}
