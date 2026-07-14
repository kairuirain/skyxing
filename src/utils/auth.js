import * as jose from 'jose';

const JWT_SECRET = 'UlT0luWq90YhcRuwiU5gQ5Roir5zIFcZ0pePgF9Guzg';
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Generate a JWT token for a user
 */
export async function generateToken(payload) {
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  return jwt;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Hash a password using Web Crypto API (SHA-256)
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'skyxing-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}
