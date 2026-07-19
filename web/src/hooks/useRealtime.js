import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

const POLL_INTERVAL = 5000; // 5s

/**
 * useRealtime — 私信实时同步 Hook
 *
 * 后端当前仅提供 REST（/server/api/messages/*），无 WebSocket 端点，
 * 因此本 Hook 采用「轮询 + 时间戳比对」的轻量实时方案：
 *   - 通过 /messages/unread-count 的 latestUpdatedAt 检测会话/消息变化，
 *     变化时回调 onRefresh（MessagesPage 刷新会话列表）或 onNewMessage（ConversationPage 刷新消息）。
 *   - 发送消息失败（网络抖动）时进入本地重发队列，pendingCount 反映待重发条数，
 *     下次轮询或连接恢复时自动重发。
 *
 * 返回：
 *   - status: 'connecting' | 'connected' | 'disconnected'
 *   - sendMessage(convId, content): Promise<{ ok, message? }>
 *   - pendingCount: 待重发消息条数
 *
 * @param {Object} opts
 * @param {Function} [opts.onRefresh]  会话列表变化回调（MessagesPage）
 * @param {string}   [opts.conversationId] 当前会话 id（ConversationPage）
 * @param {string}   [opts.userId]     当前用户 id
 * @param {Function} [opts.onNewMessage] 消息变化回调，传入新消息数组（ConversationPage）
 */
export default function useRealtime(opts = {}) {
  const { onRefresh, conversationId, userId, onNewMessage } = opts;

  const [status, setStatus] = useState('connecting');
  const [pendingCount, setPendingCount] = useState(0);

  const latestRef = useRef(null);          // 上次 latestUpdatedAt
  const onRefreshRef = useRef(onRefresh);
  const onNewMessageRef = useRef(onNewMessage);
  const queueRef = useRef([]);             // 待重发消息 [{ convId, content }]
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // 重发本地队列
  const flushQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return;
    const queue = queueRef.current;
    queueRef.current = [];
    setPendingCount(0);
    for (const item of queue) {
      try {
        await api.sendMessage(item.convId, item.content);
      } catch {
        // 仍失败，放回队列稍后重试
        queueRef.current.push(item);
      }
    }
    setPendingCount(queueRef.current.length);
    if (queueRef.current.length === 0 && onNewMessageRef.current && conversationId) {
      try {
        const data = await api.getConversationMessages(conversationId);
        onNewMessageRef.current(data.messages || []);
      } catch { /* ignore */ }
    }
  }, [conversationId]);

  const poll = useCallback(async () => {
    try {
      const data = await api.getUnreadCount();
      const ts = data.latestUpdatedAt || null;

      if (latestRef.current !== null && ts !== latestRef.current) {
        // 有变化，按需刷新
        if (conversationId) {
          try {
            const d = await api.getConversationMessages(conversationId);
            if (onNewMessageRef.current) onNewMessageRef.current(d.messages || []);
          } catch { /* ignore */ }
        } else if (onRefreshRef.current) {
          try { onRefreshRef.current(); } catch (e) { console.error('[useRealtime] onRefresh error:', e); }
        }
      }
      latestRef.current = ts;

      // 连接恢复则尝试重发队列
      await flushQueue();

      if (status !== 'connected') setStatus('connected');
    } catch {
      if (status !== 'disconnected') setStatus('disconnected');
    }
  }, [conversationId, status, flushQueue]);

  useEffect(() => {
    stoppedRef.current = false;
    setStatus('connecting');
    poll();
    timerRef.current = setInterval(() => {
      if (!stoppedRef.current) poll();
    }, POLL_INTERVAL);

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  const sendMessage = useCallback(async (convId, content) => {
    try {
      const data = await api.sendMessage(convId, content);
      // 发送成功，立即刷新当前消息（若正处于该会话）
      if (conversationId === convId && onNewMessageRef.current) {
        const d = await api.getConversationMessages(convId);
        onNewMessageRef.current(d.messages || []);
      }
      await flushQueue();
      return { ok: true, message: data.message };
    } catch (err) {
      // 进入本地重发队列
      queueRef.current.push({ convId, content });
      setPendingCount(queueRef.current.length);
      return { ok: false, error: err.message || '发送失败，稍后重发' };
    }
  }, [conversationId, flushQueue]);

  return { status, sendMessage, pendingCount };
}
