import { kvPut, kvGet, PREFIX } from './kv.js';

/**
 * 生成一条系统通知并写入接收方索引。
 * @param {object} env Cloudflare env（含 SKYXING_KV）
 * @param {object} notif { userId, type, actor, text, link }
 *   - actor: { id, username, displayName, avatar } | null（系统通知无 actor）
 */
export async function createNotification(env, { userId, type, actor = null, text, link = null }) {
  if (!userId) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
  const notif = {
    id,
    userId,
    type,
    actor,
    text,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await kvPut(env, PREFIX.NOTIFICATIONS + id, notif);

  const idxKey = PREFIX.NOTIFICATION_INDEX + userId;
  const idx = (await kvGet(env, idxKey)) || [];
  idx.unshift(id);
  await kvPut(env, idxKey, idx.slice(0, 200)); // 最多保留 200 条
  return notif;
}

// 从 KV 取用户公开快照，用于通知中展示可点击的用户名
export async function getActorSnapshot(env, userId) {
  const u = await kvGet(env, PREFIX.USERS + userId);
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || '',
  };
}
