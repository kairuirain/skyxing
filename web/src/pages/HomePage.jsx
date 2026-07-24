import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useTransition } from '../context/TransitionContext';
import api from '../lib/api';
import { Search, PenSquare, MessageSquare, Bell, User, Settings, ArrowRight, BookOpen, Sparkles, Globe, Users, TrendingUp } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { launch } = useTransition();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => { if (user) api.getUnreadCount().then(d => setUnread(d.unreadCount || 0)).catch(() => {}); }, [user]);

  const handleSearch = (e) => { e.preventDefault(); if (search.trim()) navigate('/blog?search=' + encodeURIComponent(search.trim())); };

  const quickLinks = [
    { icon: BookOpen, label: '博客', to: '/blog', desc: '浏览文章' },
    { icon: MessageSquare, label: '私信', to: '/messages', desc: '实时沟通', badge: unread },
    { icon: User, label: '我的', to: '/me', desc: '个人主页' },
    { icon: Settings, label: '设置', to: '/settings', desc: '偏好配置' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full sk-badge sk-badge-accent text-xs mb-5">
          <Sparkles size={13} /> 跨平台博客平台
        </div>
        <h1 className="text-4xl font-extrabold text-[var(--text)] mb-3 tracking-tight">SkyXing</h1>
        <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-6 leading-relaxed">
          自由创作，分享想法。与志同道合的人一起探索知识的边界。
        </p>
        <form onSubmit={handleSearch} className="max-w-md mx-auto relative mb-6">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文章..."
            className="sk-input pl-10 pr-4 h-11" />
        </form>
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          {user ? (
            <button onClick={e => launch(e, '/write')} className="sk-btn sk-btn-primary">
              <PenSquare size={16} /> 写文章
            </button>
          ) : (
            <Link to="/register" className="sk-btn sk-btn-primary">立即加入 <ArrowRight size={16} /></Link>
          )}
          <Link to="/download" className="sk-btn sk-btn-outline">下载客户端</Link>
        </div>
      </section>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map(link => (
          <Link key={link.to} to={link.to} className="sk-card sk-card-hover p-4 relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white mb-2.5">
              <link.icon size={18} />
            </div>
            <p className="font-semibold text-sm text-[var(--text)]">{link.label}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{link.desc}</p>
            {link.badge > 0 && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {link.badge > 99 ? '99+' : link.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* 用户信息卡片 */}
      {user && (
        <Link to="/me" className="sk-card sk-card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(user.displayName || user.username)[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[var(--text)] truncate">{user.displayName || user.username}</p>
            <p className="text-xs text-[var(--text-tertiary)]">查看个人主页 →</p>
          </div>
          <Bell size={18} className="text-[var(--text-tertiary)]" />
        </Link>
      )}

      {/* 浏览博客入口 */}
      <Link to="/blog" className="sk-card sk-card-hover p-4 flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white">
          <BookOpen size={18} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-[var(--text)]">浏览博客文章</p>
          <p className="text-xs text-[var(--text-tertiary)]">阅读最新发布的文章和内容</p>
        </div>
        <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* 底部统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: '文章', value: '探索', color: '#6366f1' },
          { icon: Users, label: '社区', value: '交流', color: '#8b5cf6' },
          { icon: TrendingUp, label: '动态', value: '同步', color: '#22c55e' },
          { icon: Globe, label: '跨平台', value: '全端', color: '#f59e0b' },
        ].map(item => (
          <div key={item.label} className="sk-card p-3.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: item.color + '20' }}>
              <item.icon size={15} style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)]">{item.label}</p>
              <p className="text-[13px] font-semibold text-[var(--text)]">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
