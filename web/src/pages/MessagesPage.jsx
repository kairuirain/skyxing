import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { MessageSquare, Send, Trash2, PenSquare, RefreshCw } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState(false);
  const latestUpdatedAt = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      if (!silent) console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 轻量轮询：每 3s 检查 unreadCount + latestUpdatedAt，仅在变化时加载全量数据
  useEffect(() => {
    if (!user) return;
    let active = true;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const d = await api.getUnreadCount();
        if (!active) return;
        if (d.latestUpdatedAt && d.latestUpdatedAt !== latestUpdatedAt.current) {
          latestUpdatedAt.current = d.latestUpdatedAt;
          load(true);
        }
      } catch (e) { /* 静默失败 */ }
    };

    const timer = setInterval(poll, 3000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      active = false;
    };
  }, [user, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!target.trim()) return;
    setStarting(true);
    try {
      const data = await api.startConversation(target.trim());
      navigate(`/messages/${data.conversation.id}`);
    } catch (err) {
      alert(err.message || '发起私信失败');
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = async (convId) => {
    if (!confirm('删除该会话？')) return;
    try {
      await api.deleteConversation(convId);
      setConversations((list) => list.filter((c) => c.id !== convId));
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-gray-500">请先 <Link to="/login" className="text-primary-600">登录</Link> 后查看私信</p>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto animate-pulse space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare size={22} /> 私信
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors"
          title="刷新列表"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleStart} className="card p-3 mb-4 flex gap-2 items-center">
        <PenSquare size={16} className="text-gray-400 shrink-0" />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="输入对方用户名，发起新私信"
          className="input flex-1"
        />
        <button type="submit" disabled={starting || !target.trim()} className="btn-primary btn-sm">
          <Send size={14} className="mr-1" /> 发起
        </button>
      </form>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p>还没有会话，发起第一条私信吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div key={conv.id} className="card p-3 flex items-center gap-3 hover:shadow transition-shadow">
              <Link to={`/messages/${conv.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold shrink-0">
                  {conv.otherUser?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{conv.otherUser?.displayName || conv.otherUser?.username}</span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage || '（无消息）'}</p>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(conv.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="删除会话"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
