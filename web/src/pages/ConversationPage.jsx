import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Send, Trash2, ArrowLeft, RefreshCw, Wifi, WifiOff, Loader, AlertCircle } from 'lucide-react';
import useRealtime from '../hooks/useRealtime';

export default function ConversationPage() {
  const { convId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data.messages || []);
      if (data.otherUser) setOtherUser(data.otherUser);
    } catch (e) {
      if (!silent) console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [convId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const onNewMessage = useCallback((msgs) => {
    setMessages(msgs);
  }, []);

  const { status, sendMessage, pendingCount } = useRealtime({
    conversationId: convId,
    userId: user?.id,
    onNewMessage,
  });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSubmitting(true);
    const result = await sendMessage(convId, newMsg.trim());
    if (result.ok) {
      setNewMsg('');
      if (result.message) setMessages((list) => [...list, result.message]);
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm('删除该会话？')) return;
    try { await api.deleteConversation(convId); navigate('/messages'); }
    catch (err) { alert(err.message || '删除失败'); }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const StatusIcon = () => {
    if (status === 'connecting') return <Loader size={14} className="animate-spin text-amber-500" />;
    if (status === 'disconnected') return <WifiOff size={14} className="text-red-500" />;
    return <Wifi size={14} className="text-green-500" />;
  };

  const statusLabel = status === 'connecting' ? '连接中...' : status === 'disconnected' ? '已断开' : '已连接';

  if (loading) return <div className="max-w-3xl mx-auto animate-pulse h-40 bg-gray-200 rounded-lg" />;

  const peerName = otherUser?.displayName || otherUser?.username || '会话';

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[75vh]">
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-3">
        <Link to="/messages" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></Link>
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{peerName}</h1>
        <span className="flex items-center gap-1 text-[10px] text-gray-400" title={statusLabel}>
          <StatusIcon /> <span className="hidden sm:inline">{statusLabel}</span>
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600" title={`${pendingCount}条消息等待重发`}>
            <AlertCircle size={12} /> {pendingCount}
          </span>
        )}
        <button onClick={() => load(true)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-primary-600" title="刷新">
          <RefreshCw size={16} />
        </button>
        <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-600" title="删除">
          <Trash2 size={16} />
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">还没有消息，开始聊天吧</p>
        )}
        {messages.map((m) => {
          const mine = m.fromId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                <div className={mine ? 'prose-sm prose-invert' : 'prose-sm'} dangerouslySetInnerHTML={{ __html: m.content }} />
                <div className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-gray-400'}`}>
                  {formatTime(m.createdAt)}
                  {mine && m.read && <span className="ml-1">✓✓</span>}
                  {mine && !m.read && m.fromId && <span className="ml-1">✓</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="输入消息..." className="input flex-1" />
        <button type="submit" disabled={submitting || !newMsg.trim()} className="btn-primary btn-sm self-end">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
