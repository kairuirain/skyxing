import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTransition } from '../context/TransitionContext';
import {
  Search, PenSquare, MessageSquare, Bell, User, Settings, ArrowRight,
  BookOpen, Sparkles, TrendingUp, Users, Globe, Download,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const { launch } = useTransition();
  const [unread, setUnread] = useState(0);
  const [notifModal, setNotifModal] = useState(null);

  // 未读消息数
  useEffect(() => {
    if (user) {
      api.getUnreadCount().then((d) => setUnread(d.unreadCount || 0)).catch(() => {});
    }
  }, [user]);

  // 加载系统通知并弹窗
  useEffect(() => {
    const shownKey = 'skyxing_notif_shown';
    const lastShown = localStorage.getItem(shownKey);
    api.request('/notifications?systemOnly=true')
      .then((d) => {
        const list = d.notifications || [];
        const unshown = list.filter((n) => n.category === 'system' && (!n.readAt) && n.id !== lastShown);
        if (unshown.length > 0) {
          setNotifModal(unshown[0]);
          localStorage.setItem(shownKey, unshown[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const dismissNotif = () => setNotifModal(null);

  const quickLinks = [
    { icon: BookOpen, label: '博客', to: '/blog', color: 'from-blue-500 to-cyan-500' },
    { icon: MessageSquare, label: '消息', to: '/messages', color: 'from-purple-500 to-pink-500', badge: unread > 0 ? unread : null },
    { icon: User, label: '我的', to: '/me', color: 'from-orange-500 to-amber-500' },
    { icon: Settings, label: '设置', to: '/settings', color: 'from-gray-500 to-slate-500' },
  ];

  return (
    <div>
      {/* 系统通知弹窗 */}
      {notifModal && (
        <div className="fixed inset-0 z-[999] flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-sm"
          onClick={dismissNotif}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#fb7299] to-[#00a1d6] px-5 py-4">
              <p className="text-white font-semibold text-[15px]">{notifModal.title || '系统通知'}</p>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {notifModal.body || notifModal.text || ''}
              </p>
              {notifModal.actionUrl && (
                <a href={notifModal.actionUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 block w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#fb7299] to-[#00a1d6] text-white hover:opacity-90 transition-opacity">
                  {notifModal.actionLabel || '前往查看'}
                </a>
              )}
              <button onClick={dismissNotif}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="text-center mb-8 py-10 bg-gradient-to-br from-primary-50 via-white to-white rounded-2xl border border-primary-100 dark:from-primary-900/30 dark:via-gray-800 dark:to-gray-800 dark:border-gray-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold mb-4 dark:bg-primary-900/40 dark:text-primary-300">
          <Sparkles size={12} /> 跨平台博客平台
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">SkyXing</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6">
          自由创作，分享你的想法。与志同道合的人一起探索知识的边界。
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {user ? (
            <button onClick={(e) => launch(e, '/write')} className="btn-primary">
              <PenSquare size={16} className="mr-1.5" /> 写文章
            </button>
          ) : (
            <button onClick={(e) => launch(e, '/register')} className="btn-primary">
              立即加入 <ArrowRight size={16} className="ml-1" />
            </button>
          )}
          <Link to="/download" className="btn-outline">
            <Download size={16} className="mr-1.5" /> 下载客户端
          </Link>
        </div>
      </section>

      {/* 快捷入口卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to}
            className="group relative card p-4 hover:shadow-md transition-all">
            <div className={'w-10 h-10 rounded-xl bg-gradient-to-br ' + link.color + ' flex items-center justify-center mb-2.5'}>
              <link.icon size={18} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{link.label}</p>
            {link.badge && (
              <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {link.badge > 99 ? '99+' : link.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* 用户信息卡片 */}
      {user && (
        <Link to="/me"
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-all mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user.displayName?.[0] || user.username?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.displayName || user.username}</p>
            <p className="text-xs text-gray-500">查看个人主页 →</p>
          </div>
          <Bell size={18} className="text-gray-400" />
        </Link>
      )}

      {/* 浏览博客 */}
      <Link to="/blog"
        className="card p-4 flex items-center gap-3 hover:shadow-md transition-all group mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <BookOpen size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">浏览博客文章</p>
          <p className="text-xs text-gray-500">阅读最新发布的文章和内容</p>
        </div>
        <ArrowRight size={16} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* 底部统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: '文章', value: '探索', color: 'text-blue-500' },
          { icon: Users, label: '社区', value: '交流', color: 'text-purple-500' },
          { icon: TrendingUp, label: '动态', value: '同步', color: 'text-green-500' },
          { icon: Globe, label: '跨平台', value: '全端', color: 'text-orange-500' },
        ].map((item) => (
          <div key={item.label}
            className="card px-3.5 py-3 flex items-center gap-2.5">
            <item.icon size={16} className={item.color} />
            <div>
              <p className="text-[11px] text-gray-500">{item.label}</p>
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
