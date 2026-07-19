import { Hono } from 'hono';
import { kvGet, kvGetMany, PREFIX } from '../utils/kv.js';
import { authRequired } from '../middleware/rbac.js';

const notifications = new Hono();

/**
 * GET /server/api/notifications
 * 当前用户的系统通知列表（含未读计数）
 */
notifications.get('/', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;

  const idx = (await kvGet(env, PREFIX.NOTIFICATION_INDEX + user.userId)) || [];
  const list = (await kvGetMany(env, idx.map((id) => PREFIX.NOTIFICATIONS + id))).filter(Boolean);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unread = list.filter((n) => !n.read).length;
  return c.json({ notifications: list, unread });
});

/**
 * PUT /server/api/notifications/:id/read
 * 标记单条通知为已读
 */
notifications.put('/:id/read', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;
  const id = c.req.param('id');

  const notif = await kvGet(env, PREFIX.NOTIFICATIONS + id);
  if (!notif) return c.json({ error: 'Notification not found' }, 404);
  if (notif.userId !== user.userId) return c.json({ error: 'Forbidden' }, 403);

  notif.read = true;
  await kvPut(env, PREFIX.NOTIFICATIONS + id, notif);
  return c.json({ notification: notif });
});

/**
 * PUT /server/api/notifications/read-all
 * 全部标记为已读
 */
notifications.put('/read-all', authRequired, async (c) => {
  const user = c.get('user');
  const env = c.env;

  const idx = (await kvGet(env, PREFIX.NOTIFICATION_INDEX + user.userId)) || [];
  for (const id of idx) {
    const notif = await kvGet(env, PREFIX.NOTIFICATIONS + id);
    if (notif && !notif.read) {
      notif.read = true;
      await kvPut(env, PREFIX.NOTIFICATIONS + id, notif);
    }
  }
  return c.json({ message: 'All marked as read' });
});

export default notifications;
