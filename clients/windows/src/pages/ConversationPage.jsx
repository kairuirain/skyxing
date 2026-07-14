import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Send, Trash2, ArrowLeft } from 'lucide-react';

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

  // 进入页面立即加载
  useEffect(() => { load(); }, [load]);

  // 每 4 秒轮询，实现"近实时"同步（对方发来的消息会自动出现）
  useEffect(() => {
    const timer = setInterval(() => { load(true); }, 4000);
    return () => clearInterval(timer);
  }, [load]);

  // 消息更新或初次加载后滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSubmitting(true);
    try {
      const data = await api.sendMessage(convId, newMsg.trim());
      // 乐观更新：直接把消息追加到列表，无需等待轮询
      if (data.message) {
        setMessages((list) => [...list, data.message]);
      }
      setNewMsg('');
    } catch (err) {
      alert(err.message || '发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('删除该会话？')) return;
    try {
      await api.deleteConversation(convId);
      navigate('/messages');
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto animate-pulse h-40 bg-gray-200 rounded-lg" />;
  }

  const peerName = otherUser?.displayName || otherUser?.username || '会话';

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[75vh]">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/messages" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">
          {peerName}
        </h1>
        <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-600" title="删除会话">
          <Trash2 size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">还没有消息，开始聊天吧</p>
        )}
        {messages.map((m) => {
          const mine = m.fromId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="输入消息..."
          className="input flex-1"
        />
        <button type="submit" disabled={submitting || !newMsg.trim()} className="btn-primary btn-sm self-end">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
