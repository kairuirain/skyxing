import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { useAnimation } from '../context/AnimationContext';
import { useSync } from '../context/SyncContext';
import api from '../lib/api';
import {
  Home, BookOpen, MessageSquare, User, Settings, Sun, Moon, RefreshCw,
  Bell, PenSquare, Download, LogIn, UserPlus,
} from 'lucide-react';

export default function Layout({ children }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const { animationMode } = useAnimation();
  const { syncVersion } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notifModal, setNotifModal] = useState(null);

  // 未读消息数
  useEffect(() => {
    if (user) api.getUnreadCount().then(d => setUnread(d.unreadCount || 0)).catch(() => {});
  }, [user]);

  // 系统通知弹窗
  useEffect(() => {
    const key = 'sk_notif_shown';
    const last = localStorage.getItem(key);
    api.request('/notifications?systemOnly=true').then(d => {
      const list = d.notifications || [];
      const unshown = list.filter(n => n.category === 'system' && !n.readAt && n.id !== last);
      if (unshown.length > 0) { setNotifModal(unshown[0]); localStorage.setItem(key, unshown[0].id); }
    }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    if (user) {
      try { const d = await api.getUnreadCount(); setUnread(d.unreadCount || 0); } catch {}
    }
    setTimeout(() => setRefreshing(false), 600);
  }, [user]);

  const navItems = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/blog', icon: BookOpen, label: t('nav.blog') },
    ...(user ? [{ to: '/messages', icon: MessageSquare, label: t('nav.messages'), badge: unread }] : []),
    { to: '/download', icon: Download, label: '下载' },
    ...(user ? [{ to: '/me', icon: User, label: t('nav.me') }] : []),
  ];

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* 系统通知弹窗 */}
      {notifModal && (
        <div className="sk-modal-overlay" onClick={() => setNotifModal(null)}>
          <div className="sk-modal" onClick={e => e.stopPropagation()}>
            <div className="sk-modal-header">
              <h3 className="font-semibold text-[var(--text)]">{notifModal.title || '系统通知'}</h3>
            </div>
            <div className="sk-modal-body">
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mb-4">{notifModal.body || notifModal.text}</p>
              {notifModal.actionUrl && (
                <a href={notifModal.actionUrl} target="_blank" rel="noopener" className="sk-btn sk-btn-primary w-full mb-2">
                  {notifModal.actionLabel || '前往查看'}
                </a>
              )}
              <button onClick={() => setNotifModal(null)} className="sk-btn sk-btn-outline w-full">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部栏 */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-bold text-[var(--text)] text-lg tracking-tight">SkyXing</span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(item => (
              <Link key={item.to} to={item.to}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.to) ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}>
                <item.icon size={17} />
                {item.label}
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <button onClick={() => navigate('/write')} className="sk-btn sk-btn-primary sk-btn-sm hidden sm:inline-flex">
                  <PenSquare size={15} /> 写文章
                </button>
                <Link to="/settings" className="sk-btn sk-btn-ghost sk-btn-sm">
                  <Settings size={17} />
                </Link>
                <Link to="/notifications" className="sk-btn sk-btn-ghost sk-btn-sm relative">
                  <Bell size={17} />
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="sk-btn sk-btn-ghost sk-btn-sm"><LogIn size={16} className="mr-1" />登录</Link>
                <Link to="/register" className="sk-btn sk-btn-primary sk-btn-sm"><UserPlus size={16} className="mr-1" />注册</Link>
              </>
            )}
            <button onClick={toggleTheme} className="sk-btn sk-btn-ghost sk-btn-sm" title="切换主题">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sk-page">
        {children}
      </main>

      {/* 移动端底部导航 */}
      <nav className="md:hidden sticky bottom-0 z-50" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => (
            <Link key={item.to} to={item.to}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] font-medium transition-colors relative ${
                isActive(item.to) ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
              }`}>
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* 刷新按钮 */}
      <button onClick={refresh}
        className="fixed right-5 bottom-20 md:bottom-5 w-11 h-11 rounded-full flex items-center justify-center z-40 transition-all"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <RefreshCw size={18} className={refreshing ? 'animate-spin text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
      </button>
    </div>
  );
}
