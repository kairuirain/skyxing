import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { MessageSquare, Send, Trash2, PenSquare, RefreshCw, Wifi, WifiOff, Loader, Bell } from 'lucide-react';
import useRealtime from '../hooks/useRealtime';
import NotificationsList from '../components/NotificationsList';

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('messages'); // 'messages' | 'notifications'
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    try { const d = await api.getConversations(); setConversations(d.conversations || []); }
    catch (e) { if (!silent) console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadNotifs = useCallback(async () => {
    setNotifLoading(true);
    try { const d = await api.getNotifications(); setNotifs(d.notifications || []); }
    catch (e) { console.error(e); }
    finally { setNotifLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'notifications') loadNotifs(); }, [tab, loadNotifs]);

  const onRefresh = useCallback((list) => setConversations(list), []);
  const { status } = useRealtime({ onRefresh });

  const handleStart = async (e) => {
    e.preventDefault();
    if (!target.trim()) return;
    setStarting(true);
    try { const d = await api.startConversation(target.trim()); navigate(`/messages/${d.conversation.id}`); }
    catch (err) { alert(err.message || '发起私信失败'); }
    finally { setStarting(false); }
  };

  const handleDelete = async (convId) => {
    if (!confirm('删除该会话？')) return;
    try { await api.deleteConversation(convId); setConversations(l => l.filter(c => c.id !== convId)); }
    catch (err) { alert(err.message || '删除失败'); }
  };

  const handleNotifRead = async (id) => {
    setNotifs((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await api.markNotificationRead(id); } catch (e) {}
  };

  if (!user) return <div className="max-w-3xl mx-auto text-center py-12"><p className="text-gray-500">请先 <Link to="/login" className="text-primary-600">登录</Link> 后查看私信</p></div>;
  if (loading) return <Loading />;

  const StatusIcon = () => {
    if (status === 'connecting') return <Loader size={14} className="animate-spin text-amber-500"/>;
    if (status === 'disconnected') return <WifiOff size={14} className="text-red-500"/>;
    return <Wifi size={14} className="text-green-500"/>;
  };

  const tabBtn = (key, label, Icon) => (
    <button
      onClick={() => setTab(key)}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {tabBtn('messages', '私信', MessageSquare)}
          {tabBtn('notifications', '系统通知', Bell)}
        </div>
        {tab === 'messages' && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400"><StatusIcon/></span>
        )}
      </div>

      {tab === 'notifications' ? (
        <NotificationsList notifications={notifs} loading={notifLoading} onMarkRead={handleNotifRead} />
      ) : (
        <>
          <form onSubmit={handleStart} className="card p-3 mb-4 flex gap-2 items-center">
            <PenSquare size={16} className="text-gray-400 shrink-0"/>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="输入对方用户名，发起新私信" className="input flex-1"/>
            <button type="submit" disabled={starting || !target.trim()} className="btn-primary btn-sm"><Send size={14} className="mr-1"/>发起</button>
          </form>

          {conversations.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><MessageSquare size={40} className="mx-auto mb-3 opacity-40"/><p>还没有会话</p></div>
          ) : (
            <div className="space-y-2">
              {conversations.map(conv => (
                <div key={conv.id} className="card p-3 flex items-center gap-3 hover:shadow">
                  <Link to={`/messages/${conv.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold shrink-0">
                      {conv.otherUser?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{conv.otherUser?.displayName || conv.otherUser?.username}</span>
                        {conv.unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">{conv.unreadCount}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.lastMessage || ''}</p>
                    </div>
                  </Link>
                  <button onClick={() => handleDelete(conv.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
