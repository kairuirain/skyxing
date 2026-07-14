import { Hono } from 'hono';
import { kvGet, kvPut, kvDelete, kvList, generateId, PREFIX } from '../utils/kv.js';
import { authRequired } from '../middleware/rbac.js';

const messages = new Hono();

// ---------- 内部辅助 ----------

async function getUserPublic(env, userId) {
  const u = await kvGet(env, PREFIX.USERS + userId);
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
  };
}

async function getIndex(env, userId) {
  const raw = await kvGet(env, PREFIX.MESSAGES + 'index:' + userId);
  return Array.isArray(raw) ? raw : [];
}

async function addToIndex(env, userId, convId) {
  const list = await getIndex(env, userId);
  if (!list.includes(convId)) list.push(convId);
  await kvPut(env, PREFIX.MESSAGES + 'index:' + userId, list);
}

async function removeFromIndex(env, userId, convId) {
  const list = (await getIndex(env, userId)).filter((id) => id !== convId);
  await kvPut(env, PREFIX.MESSAGES + 'index:' + userId, list);
}

async function findConversation(env, a, b) {
  const keys = await kvList(env, PREFIX.MESSAGES + 'conv:', 1000);
  for (const k of keys) {
    const conv = await kvGet(env, k.name);
    if (conv && conv.participants.length === 2 &&
        conv.participants.includes(a) && conv.participants.includes(b)) {
      return conv;
    }
  }
  return null;
}

async function getOrCreateConversation(env, a, b) {
  const existing = await findConversation(env, a, b);
  if (existing) return { conv: existing, created: false };

  const id = generateId();
  const now = new Date().toISOString();
  const conv = {
    id,
    participants: [a, b],
    lastMessage: '',
    lastSenderId: '',
    createdAt: now,
    updatedAt: now,
  };
  await kvPut(env, PREFIX.MESSAGES + 'conv:' + id, conv);
  await addToIndex(env, a, id);
  await addToIndex(env, b, id);
  return { conv, created: true };
}

function otherParticipant(conv, userId) {
  return conv.participants.find((p) => p !== userId);
}

async function markRead(env, convId, userId) {
  const keys = await kvList(env, PREFIX.MESSAGES + 'msg:' + convId + ':', 1000);
  for (const k of keys) {
    const msg = await kvGet(env, k.name);
    if (msg && msg.toId === userId && !msg.read) {
      msg.read = true;
      await kvPut(env, k.name, msg);
    }
  }
  await kvPut(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + userId, 0);
}

async function conversationSummary(env, conv, userId) {
  const otherId = otherParticipant(conv, userId);
  const otherUser = await getUserPublic(env, otherId);
  const unread = (await kvGet(env, PREFIX.MESSAGES + 'unread:' + conv.id + ':' + userId)) || 0;
  return {
    id: conv.id,
    otherUser,
    lastMessage: conv.lastMessage,
    lastSenderId: conv.lastSenderId,
    unreadCount: unread,
    updatedAt: conv.updatedAt,
  };
}

// ---------- 路由 ----------

/**
 * GET /server/api/messages/conversations
 * 当前用户的会话列表（含对方信息、最后一条消息、未读数量）
 */
messages.get('/conversations', authRequired, async (c) => {
  const env = c.env;
  const user = c.get('user');
  const ids = await getIndex(env, user.userId);

  const conversations = [];
  for (const convId of ids) {
    const conv = await kvGet(env, PREFIX.MESSAGES + 'conv:' + convId);
    if (!conv) {
      await removeFromIndex(env, user.userId, convId);
      continue;
    }
    conversations.push(await conversationSummary(env, conv, user.userId));
  }

  conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return c.json({ conversations });
});

/**
 * GET /server/api/messages/unread-count
 * 当前用户全部会话的未读消息总数（用于角标）
 */
messages.get('/unread-count', authRequired, async (c) => {
  const env = c.env;
  const user = c.get('user');
  const ids = await getIndex(env, user.userId);

  let total = 0;
  for (const convId of ids) {
    total += (await kvGet(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + user.userId)) || 0;
  }
  return c.json({ unreadCount: total });
});

/**
 * POST /server/api/messages/conversations
 * 与目标用户发起（或获取已有）会话：body { targetUserId }
 */
messages.post('/conversations', authRequired, async (c) => {
  try {
    const env = c.env;
    const user = c.get('user');
    const { targetUserId } = await c.req.json();

    if (!targetUserId) {
      return c.json({ error: 'targetUserId is required' }, 400);
    }
    if (targetUserId === user.userId) {
      return c.json({ error: 'Cannot start a conversation with yourself' }, 400);
    }

    const target = await kvGet(env, PREFIX.USERS + targetUserId);
    if (!target) {
      return c.json({ error: 'Target user not found' }, 404);
    }

    const { conv } = await getOrCreateConversation(env, user.userId, targetUserId);
    return c.json({ conversation: await conversationSummary(env, conv, user.userId) }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * POST /server/api/messages/conversations/start
 * 按用户名发起（或获取已有）会话：body { username }
 */
messages.post('/conversations/start', authRequired, async (c) => {
  try {
    const env = c.env;
    const user = c.get('user');
    const { username } = await c.req.json();

    if (!username || !username.trim()) {
      return c.json({ error: 'username is required' }, 400);
    }

    const targetId = await kvGet(env, PREFIX.USERNAME_INDEX + username.trim().toLowerCase(), false);
    if (!targetId) {
      return c.json({ error: 'Target user not found' }, 404);
    }
    if (targetId === user.userId) {
      return c.json({ error: 'Cannot start a conversation with yourself' }, 400);
    }

    const target = await kvGet(env, PREFIX.USERS + targetId);
    if (!target) {
      return c.json({ error: 'Target user not found' }, 404);
    }

    const { conv } = await getOrCreateConversation(env, user.userId, targetId);
    return c.json({ conversation: await conversationSummary(env, conv, user.userId) }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * GET /server/api/messages/conversations/:convId
 * 获取会话消息记录（仅参与者可访问，访问即标记已读）
 */
messages.get('/conversations/:convId', authRequired, async (c) => {
  const env = c.env;
  const user = c.get('user');
  const convId = c.req.param('convId');

  const conv = await kvGet(env, PREFIX.MESSAGES + 'conv:' + convId);
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);
  if (!conv.participants.includes(user.userId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const keys = await kvList(env, PREFIX.MESSAGES + 'msg:' + convId + ':', 1000);
  const list = [];
  for (const k of keys) {
    const msg = await kvGet(env, k.name);
    if (msg) list.push(msg);
  }
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  await markRead(env, convId, user.userId);

  return c.json({ messages: list });
});

/**
 * POST /server/api/messages/conversations/:convId
 * 发送一条私信（仅参与者可发送）
 */
messages.post('/conversations/:convId', authRequired, async (c) => {
  try {
    const env = c.env;
    const user = c.get('user');
    const convId = c.req.param('convId');

    const conv = await kvGet(env, PREFIX.MESSAGES + 'conv:' + convId);
    if (!conv) return c.json({ error: 'Conversation not found' }, 404);
    if (!conv.participants.includes(user.userId)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { content } = await c.req.json();
    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Message content cannot be empty' }, 400);
    }

    const toId = otherParticipant(conv, user.userId);
    const now = new Date().toISOString();
    const msg = {
      id: generateId(),
      convId,
      fromId: user.userId,
      toId,
      content: content.trim(),
      createdAt: now,
      read: false,
    };
    await kvPut(env, PREFIX.MESSAGES + 'msg:' + convId + ':' + msg.id, msg);

    conv.lastMessage = content.trim();
    conv.lastSenderId = user.userId;
    conv.updatedAt = now;
    await kvPut(env, PREFIX.MESSAGES + 'conv:' + convId, conv);

    const unread = (await kvGet(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + toId)) || 0;
    await kvPut(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + toId, unread + 1);

    return c.json({ message: msg }, 201);
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

/**
 * PUT /server/api/messages/conversations/:convId/read
 * 将会话标记为已读
 */
messages.put('/conversations/:convId/read', authRequired, async (c) => {
  const env = c.env;
  const user = c.get('user');
  const convId = c.req.param('convId');

  const conv = await kvGet(env, PREFIX.MESSAGES + 'conv:' + convId);
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);
  if (!conv.participants.includes(user.userId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await markRead(env, convId, user.userId);
  return c.json({ message: 'Marked as read' });
});

/**
 * DELETE /server/api/messages/conversations/:convId
 * 删除当前用户侧的会话；双方都删除后清理底层数据
 */
messages.delete('/conversations/:convId', authRequired, async (c) => {
  const env = c.env;
  const user = c.get('user');
  const convId = c.req.param('convId');

  const conv = await kvGet(env, PREFIX.MESSAGES + 'conv:' + convId);
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);
  if (!conv.participants.includes(user.userId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await removeFromIndex(env, user.userId, convId);

  const otherId = otherParticipant(conv, user.userId);
  const otherIndex = await getIndex(env, otherId);
  if (!otherIndex.includes(convId)) {
    // 双方均已删除，清理数据
    const keys = await kvList(env, PREFIX.MESSAGES + 'msg:' + convId + ':', 1000);
    for (const k of keys) await kvDelete(env, k.name);
    await kvDelete(env, PREFIX.MESSAGES + 'conv:' + convId);
    await kvDelete(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + user.userId);
    await kvDelete(env, PREFIX.MESSAGES + 'unread:' + convId + ':' + otherId);
  }

  return c.json({ message: 'Conversation deleted' });
});

export default messages;
