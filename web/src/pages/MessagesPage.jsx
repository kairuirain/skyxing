import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import NotificationsList from '../components/NotificationsList';
import { MessageSquare, Send, Trash2, PenSquare, Bell } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('messages');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const load = useCallback(async () => {
    try { const d = await api.getConversations(); setConversations(d.conversations || []); } catch {}
    finally { setLoading(false); }
  }, []);
  const loadNotifs = useCallback(async () => {
    try { const d = await api.getNotifications(); setNotifs(d.notifications || []); } catch {}
  }, []);

  useEffect(() => { load(); loadNotifs(); }, [load, loadNotifs]);

  const handleStart = async e => {
    e.preventDefault();
    if (!target.trim()) return;
    setStarting(true);
    try { const d = await api.startConversation(target.trim()); window.location.href = '/messages/' + d.conversation.id; }
    catch (err) { alert(err.message); }
    finally { setStarting(false); }
  };
  const handleDelete = async convId => {
    if (!confirm('删除该会话？')) return;
    try { await api.deleteConversation(convId); setConversations(l => l.filter(c => c.id !== convId)); }
    catch (err) { alert(err.message); }
  };
  const handleNotifRead = async id => {
    setNotifs(l => l.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.markNotificationRead(id); } catch {}
  };

  if (!user) return <div className="text-center py-12 text-[var(--text-secondary)]">请先 <Link to="/login" className="text-[var(--accent)]">登录</Link></div>;
  if (loading) return <Loading />;

  return (
    <div className="max-w-2xl mx-auto sk-page">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setTab('messages')} className={`sk-btn sk-btn-sm ${tab === 'messages' ? 'sk-btn-primary' : 'sk-btn-ghost'}`}><MessageSquare size={15} className="mr-1" />私信</button>
        <button onClick={() => setTab('notifications')} className={`sk-btn sk-btn-sm ${tab === 'notifications' ? 'sk-btn-primary' : 'sk-btn-ghost'}`}><Bell size={15} className="mr-1" />系统通知</button>
      </div>

      {tab === 'notifications' ? (
        <NotificationsList notifications={notifs} onMarkRead={handleNotifRead} />
      ) : (
        <>
          <form onSubmit={handleStart} className="sk-card p-3 mb-4 flex gap-2 items-center">
            <PenSquare size={16} className="text-[var(--text-tertiary)] shrink-0" />
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="输入对方用户名，发起新私信" className="sk-input flex-1" />
            <button type="submit" disabled={starting || !target.trim()} className="sk-btn sk-btn-primary sk-btn-sm"><Send size={14} className="mr-1" />发起</button>
          </form>

          {conversations.length === 0 ? (
            <div className="sk-empty"><MessageSquare size={40} className="mx-auto mb-3 opacity-30" /><p>还没有会话</p></div>
          ) : (
            <div className="space-y-2">
              {conversations.map(conv => (
                <div key={conv.id} className="sk-card p-3 flex items-center gap-3">
                  <Link to={`/messages/${conv.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold shrink-0">
                      {conv.otherUser?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--text)] truncate">{conv.otherUser?.displayName || conv.otherUser?.username}</span>
                        {conv.unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">{conv.unreadCount}</span>}
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] truncate">{conv.lastMessage || ''}</p>
                    </div>
                  </Link>
                  <button onClick={() => handleDelete(conv.id)} className="p-2 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
