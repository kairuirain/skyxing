import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { PenSquare, User, LogOut, LogIn, Home, Settings, MessageSquare } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
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
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-600 hover:text-primary-700 transition-colors">
            <Home size={24} />
            <span>SkyXing</span>
          </Link>

          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/write"
                  className="flex items-center gap-1.5 btn-primary btn-sm"
                >
                  <PenSquare size={16} />
                  <span className="hidden sm:inline">写文章</span>
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
                  to={`/user/${user.id}`}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <User size={20} />
                  <span className="hidden sm:inline text-sm">{user.displayName}</span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                    title="管理后台"
                  >
                    <Settings size={20} />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 transition-colors"
                  title="退出登录"
                >
                  <LogOut size={20} />
                </button>
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
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>SkyXing &copy; {new Date().getFullYear()} - 自由创作，分享你的想法</p>
        </div>
      </footer>
    </div>
  );
}
