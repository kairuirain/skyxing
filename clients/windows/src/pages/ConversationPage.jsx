import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Send, Trash2, ArrowLeft } from 'lucide-react';

export default function ConversationPage() {
  const { convId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [convId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSubmitting(true);
    try {
      await api.sendMessage(convId, newMsg.trim());
      setNewMsg('');
      load();
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

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[75vh]">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/messages" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">
          {messages[0]
            ? (messages[0].fromId === user?.id ? messages[0].toId : messages[0].fromId)
            : '会话'}
        </h1>
        <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-600" title="删除会话">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
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
