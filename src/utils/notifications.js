import { kvPut, kvGet, PREFIX } from './kv.js';

/**
 * 通知类型 → 高层分类（用于分组与配色）
 *  - interaction：评论 / 点赞等互动
 *  - message：私信
 *  - social：关注等社交
 *  - system：系统 / 官方公告
 */
export const NOTIF_CATEGORY = {
  comment: 'interaction',
  like: 'interaction',
  message: 'message',
  follow: 'social',
  system: 'system',
};

/** 通知类型 → 图标键（前端据此映射 lucide 图标） */
export const NOTIF_ICON = {
  comment: 'comment',
  like: 'like',
  message: 'message',
  follow: 'follow',
  system: 'system',
};

/**
 * 生成一条系统通知并写入接收方索引。
 *
 * @param {object} env Cloudflare env（含 SKYXING_KV）
 * @param {object} notif
 *   - userId: string（必填）
 *   - type: 'comment' | 'message' | 'system' | 'follow' | 'like'
 *   - actor: { id, username, displayName, avatar } | null（系统通知无 actor）
 *   - text: string（旧格式正文，向后兼容字段，始终保留）
 *   - link: string | null（点击跳转路径，旧格式字段）
 *   - 以下为「新版结构化通讯」可选字段，缺省时由 normalizeNotification 在读取时回填：
 *     - category: 'interaction' | 'message' | 'social' | 'system'
 *     - title: string（结构化标题，如「新评论」）
 *     - body: string（结构化正文，支持占位，如「xxx 评论了《标题》」）
 *     - icon: string（图标键，见 NOTIF_ICON）
 *     - action: { label: string, url: string } | null（可选操作按钮）
 *     - priority: 'normal' | 'high'
 */
export async function createNotification(env, {
  userId, type, actor = null, text, link = null,
  category, title, body, icon, action = null, priority = 'normal',
}) {
  if (!userId) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
  const notif = {
    id,
    userId,
    type,
    actor,
    text,
    link,
    category: category || NOTIF_CATEGORY[type] || 'system',
    title: title ?? null,
    body: body ?? null,
    icon: icon || NOTIF_ICON[type] || 'system',
    action: action || null,
    priority: priority || 'normal',
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  await kvPut(env, PREFIX.NOTIFICATIONS + id, notif);

  const idxKey = PREFIX.NOTIFICATION_INDEX + userId;
  const idx = (await kvGet(env, idxKey)) || [];
  idx.unshift(id);
  await kvPut(env, idxKey, idx.slice(0, 200)); // 最多保留 200 条
  return notif;
}

/**
 * 将任意格式的通知（含「旧格式」仅含 text/type/actor 的记录）统一规整为
 * 新版结构化形态，保证前端用同一套渲染逻辑即可兼容历史数据。
 * 旧字段全部保留，仅补充缺失的新字段，绝不破坏既有结构。
 */
export function normalizeNotification(n) {
  if (!n || typeof n !== 'object') return n;
  const type = n.type || 'system';
  const category = n.category || NOTIF_CATEGORY[type] || 'system';
  const icon = n.icon || NOTIF_ICON[type] || 'system';

  const actorName = n.actor?.displayName || n.actor?.username || '有人';

  // 标题：优先用新版 title；旧格式按类型生成友好标题
  const title = n.title != null ? n.title
    : ({
        comment: '新评论',
        like: '新点赞',
        message: '新私信',
        follow: '新粉丝',
        system: '系统通知',
      }[type] || '通知');

  // 正文：优先用新版 body；旧格式回退到 text
  const body = n.body != null ? n.body : (n.text || '');

  return {
    ...n,
    category,
    icon,
    title,
    body,
  };
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
