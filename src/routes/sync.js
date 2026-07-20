import { Hono } from 'hono';
import { kvGet, kvPut, kvGetMany, PREFIX } from '../utils/kv.js';
import { authRequired } from '../middleware/rbac.js';
import { getSyncVersion, bumpSyncVersion, extractSettings } from '../utils/sync.js';

const sync = new Hono();

/**
 * GET /server/api/sync
 * 拉取当前用户的完整同步快照（登录时、版本号变化后调用）。
 * 包含：用户设置、通知已读状态（轻量）、未读数、同步版本号。
 */
sync.get('/', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;

  const full = await kvGet(env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: 'User not found' }, 404);

  const version = await getSyncVersion(env, user.userId);

  const idx = (await kvGet(env, PREFIX.NOTIFICATION_INDEX + user.userId)) || [];
  const list = (await kvGetMany(env, idx.map((id) => PREFIX.NOTIFICATIONS + id))).filter(Boolean);
  const notifications = list.map((n) => ({ id: n.id, read: !!n.read, updatedAt: n.updatedAt }));

  return c.json({
    version,
    settings: extractSettings(full),
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
});

/**
 * GET /server/api/sync/version?since=<n>
 * 轻量轮询端点：客户端定期调用，判断本地数据是否过期。
 */
sync.get('/version', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;
  const version = await getSyncVersion(env, user.userId);
  const since = c.req.query('since');
  const sinceNum = since ? parseInt(since, 10) : null;
  return c.json({ version, changed: sinceNum !== null ? version > sinceNum : false });
});

/**
 * PUT /server/api/sync
 * 上报本地变更（仅传变更字段），服务端应用并递增版本号。
 * 冲突处理：若 baseVersion 与当前版本不一致，返回 409 + 服务端最新状态，
 * 由客户端提示「设置已在其他设备更新」并刷新。
 *
 * body: {
 *   baseVersion: number,
 *   settings?: { language?, animationMode?, debugEnabled?, agreedToTerms? },
 *   readIds?: string[],    // 标记已读的通知
 *   unreadIds?: string[]   // 标记未读的通知
 * }
 */
sync.put('/', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const currentVersion = await getSyncVersion(env, user.userId);
  if (body.baseVersion !== undefined && body.baseVersion !== null && body.baseVersion !== currentVersion) {
    const full = await kvGet(env, PREFIX.USERS + user.userId);
    return c.json(
      { error: 'conflict', conflict: true, version: currentVersion, settings: extractSettings(full) },
      409
    );
  }

  const full = await kvGet(env, PREFIX.USERS + user.userId);
  if (!full) return c.json({ error: 'User not found' }, 404);

  let changed = false;

  if (body.settings && typeof body.settings === 'object') {
    const s = body.settings;
    if (s.language !== undefined) { full.language = s.language; changed = true; }
    if (s.animationMode !== undefined) { full.animationMode = s.animationMode; changed = true; }
    if (s.debugEnabled !== undefined) { full.debugEnabled = !!s.debugEnabled; changed = true; }
    if (s.agreedToTerms !== undefined) { full.agreedToTerms = !!s.agreedToTerms; changed = true; }
  }

  // 通知已读/未读状态变更（幂等，跨端一致）
  const applyRead = async (ids, value) => {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      const notif = await kvGet(env, PREFIX.NOTIFICATIONS + id);
      if (notif && notif.userId === user.userId && !!notif.read !== value) {
        notif.read = value;
        await kvPut(env, PREFIX.NOTIFICATIONS + id, notif);
        changed = true;
      }
    }
  };
  await applyRead(body.readIds, true);
  await applyRead(body.unreadIds, false);

  if (changed) {
    full.updatedAt = new Date().toISOString();
    await kvPut(env, PREFIX.USERS + user.userId, full);
    await bumpSyncVersion(env, user.userId);
  }

  const newVersion = await getSyncVersion(env, user.userId);
  return c.json({ version: newVersion, settings: extractSettings(full) });
});

export default sync;
