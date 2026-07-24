import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { prepareArticleContent } from '../lib/markdown.js';
import sanitizeHTML from '../lib/sanitize.js';
import {
  Users, FileText, MessageSquare, Eye, Trash2, Shield, Send,
  LayoutDashboard, UserCheck, BookOpen, Bell, RefreshCw,
  X, Check, ArrowLeft, UserPlus, Megaphone, Wrench,
} from 'lucide-react';

// ── 小面板 ──
function Panel({ icon, label, value, sub, color }) {
  const bgMap = { blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' };
  const iconMap = { blue: 'text-blue-600 dark:text-blue-400', green: 'text-green-600 dark:text-green-400', orange: 'text-orange-600 dark:text-orange-400', purple: 'text-purple-600 dark:text-purple-400' };
  return (
    <div className={'rounded-2xl border p-5 ' + (bgMap[color] || bgMap.blue)}>
      <div className="flex items-center gap-3 mb-2">
        <div className={iconMap[color]}>{icon}</div>
        <span className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── 模态 ──
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeInUp" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // 模态
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [notifyData, setNotifyData] = useState({ title: '', content: '', link: '' });
  const [notifyLoading, setNotifyLoading] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (!['admin', 'official'].includes(user.role)) { setError('无权访问管理后台'); return; }
    loadData();
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [statsData, usersData, articlesData] = await Promise.all([
        api.getStats(), api.getAdminUsers(), api.getAdminArticles(),
      ]);
      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setArticles(articlesData.articles || []);
    } catch (e) { setError('加载数据失败: ' + (e.message || '请确认你已登录官方账号')); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try { await api.updateUserRole(userId, newRole); loadData(); showToast('角色已更新'); }
    catch (e) { showToast('错误: ' + e.message); }
  };
  const handleDeleteUser = async (userId) => {
    if (!confirm('确定删除该用户？')) return;
    try { await api.deleteUser(userId); loadData(); showToast('用户已删除'); }
    catch (e) { showToast('错误: ' + e.message); }
  };
  const handleDeleteArticle = async (articleId) => {
    if (!confirm('确定删除这篇文章？')) return;
    try { await api.deleteArticle(articleId); loadData(); showToast('文章已删除'); }
    catch (e) { showToast('错误: ' + e.message); }
  };
  const handleNotify = async () => {
    if (!notifyData.content.trim()) { showToast('请填写通知内容'); return; }
    setNotifyLoading(true);
    try {
      const data = await api.publishNotification(notifyData.title.trim(), notifyData.content, notifyData.link.trim());
      showToast(data.message || '发布成功');
      setNotifyOpen(false);
      setNotifyData({ title: '', content: '', link: '' });
    } catch (e) { showToast('发布失败: ' + e.message); }
    finally { setNotifyLoading(false); }
  };
  const handleCleanup = async () => {
    setCleanupOpen(false);
    try { const d = await api.request('/admin/users/cleanup', { method: 'POST' }); showToast(d.message); loadData(); }
    catch (e) { showToast('错误: ' + e.message); }
  };
  const handleResetAll = async () => {
    setResetOpen(false);
    try { const d = await api.request('/admin/users/reset-all', { method: 'POST' }); showToast(d.message); loadData(); }
    catch (e) { showToast('错误: ' + e.message); }
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 animate-fadeIn">
        <Shield size={48} className="mx-auto text-red-400" />
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{error}</p>
        <button onClick={() => navigate('/')} className="btn-outline"><ArrowLeft size={16} className="mr-1" /> 返回首页</button>
      </div>
    </div>
  );
  if (loading) return <Loading />;

  const roleLabel = (r) => ({ user: '用户', admin: '管理员', official: '官方' })[r] || r;
  const roleBadge = (r) => {
    const m = { user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', official: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
    return m[r] || '';
  };

  const tabs = [
    { key: 'overview', icon: LayoutDashboard, label: '概览' },
    { key: 'users', icon: Users, label: '用户' },
    { key: 'articles', icon: BookOpen, label: '文章' },
  ];

  return (
    <div className="min-h-full animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium shadow-lg animate-fadeInUp">
          {toast}
        </div>
      )}

      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white shadow-sm"><Shield size={20} /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">管理后台</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabel(user.role)} · {user.displayName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setNotifyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#fb7299] to-[#00a1d6] text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity">
            <Megaphone size={15} /> 发布通知
          </button>
          {user.role === 'official' && (
            <button onClick={() => setCleanupOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium shadow-sm hover:bg-amber-600 transition-colors">
              <Wrench size={15} /> 维护
            </button>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200' }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── 概览 ── */}
      {tab === 'overview' && stats && (
        <div className="space-y-8 animate-fadeInUp">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Panel icon={<Users size={20} />} label="用户总数" value={stats.totalUsers} sub="所有注册用户" color="blue" />
            <Panel icon={<FileText size={20} />} label="文章总数" value={stats.totalArticles} sub={`已发布 ${stats.publishedArticles} · 草稿 ${stats.draftArticles}`} color="green" />
            <Panel icon={<MessageSquare size={20} />} label="评论总数" value={stats.totalComments} sub="所有文章评论" color="orange" />
            <Panel icon={<Eye size={20} />} label="总阅读量" value={stats.totalViews} sub="全站累计阅读" color="purple" />
          </div>
        </div>
      )}

      {/* ── 用户管理 ── */}
      {tab === 'users' && (
        <div className="animate-fadeInUp">
          {users.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无用户</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-200 shrink-0">
                    {(u.displayName || u.username)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{u.displayName || u.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">@{u.username} · {new Date(u.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border-0 cursor-pointer font-medium ${roleBadge(u.role)}`}
                    disabled={u.id === user.id || user.role !== 'official'}>
                    <option value="user">用户</option>
                    <option value="admin">管理员</option>
                    <option value="official">官方</option>
                  </select>
                  {u.id !== user.id && (
                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 文章管理 ── */}
      {tab === 'articles' && (
        <div className="animate-fadeInUp">
          {articles.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无文章</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {articles.map(a => (
                <div key={a.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{a.title || '无标题'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.author?.displayName || '-'} · {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${a.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                        {a.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{a.views || 0} 阅读</span>
                  <button onClick={() => handleDeleteArticle(a.id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 发布通知 模态 ── */}
      <Modal open={notifyOpen} title="发布系统通知" onClose={() => setNotifyOpen(false)}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">内容支持 Markdown，将推送给全站所有用户。</p>
        <div className="space-y-4">
          <input type="text" placeholder="标题（可选）" value={notifyData.title}
            onChange={e => setNotifyData({ ...notifyData, title: e.target.value })}
            className="input" />
          <textarea rows={6} placeholder="通知内容（支持 Markdown）" value={notifyData.content}
            onChange={e => setNotifyData({ ...notifyData, content: e.target.value })}
            className="input resize-none font-mono text-sm" />
          <input type="text" placeholder="跳转链接（可选）" value={notifyData.link}
            onChange={e => setNotifyData({ ...notifyData, link: e.target.value })}
            className="input" />
          <div className="prose max-w-none text-sm border rounded-lg p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 min-h-[3rem]"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(prepareArticleContent(notifyData.content || '*预览*')) }} />
          <button onClick={handleNotify} disabled={notifyLoading}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#fb7299] to-[#00a1d6] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {notifyLoading ? '发布中...' : '确认发布'}
          </button>
        </div>
      </Modal>

      {/* ── 维护 模态 ── */}
      <Modal open={cleanupOpen} title="KV 维护工具" onClose={() => setCleanupOpen(false)}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">以下操作用于维护 KV 存储中的用户数据。</p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">清理重复用户</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">删除重复的用户记录和无效数据，保留每个用户名的第一条记录。</p>
            <button onClick={handleCleanup}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              执行清理
            </button>
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">重置所有用户</p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">⚠ 删除全部用户数据，仅保留 SkyXing 官方账号。此操作不可撤销！</p>
            <div className="flex items-center gap-2 mb-3">
              <input type="text" placeholder="输入「确认重置」" value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="input flex-1 text-sm" />
            </div>
            <button onClick={() => { if (confirmText === '确认重置') handleResetAll(); else showToast('请输入「确认重置」'); }}
              disabled={confirmText !== '确认重置'}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              重置所有用户
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
