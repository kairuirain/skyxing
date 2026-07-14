import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  Home, MessageSquare, Download, User as UserIcon,
  PenSquare, LogIn, Settings,
} from 'lucide-react';

const TABS = [
  { to: '/', label: '主页', icon: Home, exact: true },
  { to: '/messages', label: '私信', icon: MessageSquare, requireAuth: true },
  { to: '/download', label: '下载', icon: Download },
  { to: '/me', label: '我的', icon: UserIcon, requireAuth: true },
];

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    if (user) {
      api.getUnreadCount()
        .then((d) => { if (active) setUnread(d.unreadCount || 0); })
        .catch(() => {});
    } else {
      setUnread(0);
    }
    return () => { active = false; };
  }, [user, location.pathname]);

  const isActive = (tab) => {
    if (tab.exact) return location.pathname === tab.to;
    return location.pathname === tab.to || location.pathname.startsWith(tab.to + '/');
  };

  const handleTab = (e, tab) => {
    if (tab.requireAuth && !user) {
      e.preventDefault();
      navigate('/login', { state: { from: location.pathname } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-600 hover:text-primary-700 transition-colors">
            <Home size={24} />
            <span>SkyXing</span>
          </Link>

          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/write"
                  className="hidden sm:flex items-center gap-1.5 btn-primary btn-sm"
                >
                  <PenSquare size={16} />
                  <span>写文章</span>
                </Link>
                <Link
                  to="/messages"
                  className="relative text-gray-600 hover:text-gray-900 transition-colors"
                  title="私信"
                >
                  <MessageSquare size={20} />
                  {unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                  title="设置"
                >
                  <Settings size={20} />
                  <span className="hidden md:inline text-sm">{user.displayName}</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-outline btn-sm">
                  <LogIn size={16} className="mr-1.5" />
                  登录
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  注册
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Desktop top tab nav */}
        <div className="hidden md:block border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-2 flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  onClick={(e) => handleTab(e, tab)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'text-primary-600'
                      : 'text-gray-600 hover:text-primary-600'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {tab.to === '/messages' && unread > 0 && (
                    <span className="inline-flex min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 inset-x-3 h-0.5 bg-primary-600 rounded-t" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer (desktop only) */}
      <footer className="hidden md:block border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>SkyXing &copy; {new Date().getFullYear()} - 自由创作，分享你的想法</p>
        </div>
      </footer>

      {/* Bottom Tab Bar (mobile only) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-6xl mx-auto flex items-stretch justify-around">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                onClick={(e) => handleTab(e, tab)}
                className={`flex-1 flex flex-col items-center justify-center py-2 text-[11px] gap-0.5 transition-colors ${
                  active ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="relative">
                  <Icon size={20} />
                  {tab.to === '/messages' && unread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
