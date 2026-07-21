import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTransition } from '../context/TransitionContext';
import api from '../lib/api';
import Avatar from '../components/Avatar';
import {
  User as UserIcon, FileText, PenSquare, Settings, LogOut,
  Shield, Bell, MessageSquare, Bookmark, Heart, KeyRound,
} from 'lucide-react';

export default function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.getMe()
      .then((d) => { if (active) setMe(d.user); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  if (!user) {
    return (
      <div className="card p-10 text-center max-w-md mx-auto">
        <UserIcon size={40} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">请先登录</h2>
        <p className="text-sm text-gray-500 mb-5">登录后即可查看个人主页与设置</p>
        <Link to="/login" className="btn-primary">前往登录</Link>
      </div>
    );
  }

  const display = me || user;

  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？')) return;
    await logout();
    navigate('/');
  };

  const copyToken = async () => {
    const t = localStorage.getItem('skyxing_token');
    if (!t) { alert('当前未登录，无法复制令牌'); return; }
    try {
      await navigator.clipboard.writeText(t);
      alert('已复制登录令牌，请在桌面客户端「使用登录令牌登录」处粘贴即可登录。');
    } catch {
      window.prompt('无法自动复制，请手动复制以下登录令牌：', t);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Profile header */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/30 dark:to-gray-800">
        <div className="flex items-center gap-4">
          <Avatar src={display.avatar} name={display.displayName || display.username} className="w-16 h-16 rounded-2xl text-2xl" initialClass="bg-primary-600 text-white" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {display.displayName || display.username}
            </h1>
            <p className="text-sm text-gray-500">@{display.username}</p>
            {['admin','official'].includes(display.role) && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary-700 font-semibold">
                <Shield size={12} /> {display.role === 'official' ? '官方' : '管理员'}
              </span>
            )}
          </div>
        </div>
        {display.bio && (
          <p className="text-sm text-gray-600 mt-4 pt-4 border-t border-primary-100">{display.bio}</p>
        )}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 mb-3">快捷操作</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <ActionCard to="/write" icon={PenSquare} title="写文章" desc="发布新作品" />
        <ActionCard to={`/user/${display.id}`} icon={UserIcon} title="我的主页" desc="查看公开资料" />
        <ActionCard to="/messages" icon={MessageSquare} title="我的私信" desc="查看会话列表" />
        <ActionCard to="/settings" icon={Settings} title="设置" desc="调试 / 更新 / 关于" />
        <ActionCard to="/bookmarks" icon={Bookmark} title="我的收藏" desc="稍后阅读" comingSoon />
        <ActionCard to="/notifications" icon={Bell} title="消息通知" desc="系统消息" />
      </div>

      {/* Admin entry */}
      {['admin','official'].includes(display.role) && (
        <div className="card p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary-600" />
            <span className="font-semibold text-gray-900">管理后台</span>
          </div>
          <button onClick={() => navigate('/admin')} className="btn-outline btn-sm">进入</button>
        </div>
      )}

      {/* 登录令牌：用于同步到桌面客户端 */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-primary-600" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">登录令牌</div>
            <div className="text-xs text-gray-500 mt-0.5">复制到桌面客户端可直接登录</div>
          </div>
        </div>
        <button onClick={copyToken} className="btn-outline btn-sm">复制</button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full card p-4 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        退出登录
      </button>

      {/* 条款快捷入口：新标签页打开完整内容 */}
      <div className="mt-6 text-center text-sm space-x-5">
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-primary-600"
        >
          服务条款
        </a>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-primary-600"
        >
          隐私政策
        </a>
      </div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, desc, comingSoon }) {
  const navigate = useNavigate();
  const { launch } = useTransition();
  if (comingSoon) {
    return (
      <div className="card p-4 opacity-60 cursor-not-allowed">
        <Icon size={20} className="text-gray-400 mb-2" />
        <div className="font-semibold text-gray-700 text-sm">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}（即将上线）</div>
      </div>
    );
  }
  // 二级菜单（/settings /notifications /admin）走 SlideOutlet，直接 navigate
  const SLIDE_ROUTES = ['/settings', '/notifications', '/admin'];
  const isSlide = SLIDE_ROUTES.some(p => to.startsWith(p));
  return (
    <button
      onClick={(e) => isSlide ? navigate(to) : launch(e, to)}
      className="card p-4 hover:shadow-md transition-shadow block text-left w-full"
    >
      <Icon size={20} className="text-primary-600 mb-2" />
      <div className="font-semibold text-gray-900 text-sm">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
    </button>
  );
}
