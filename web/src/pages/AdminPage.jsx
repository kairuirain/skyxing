import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { prepareArticleContent } from '../lib/markdown.js';
import sanitizeHTML from '../lib/sanitize.js';
import {
  Users, FileText, MessageSquare, Eye, Trash2, Shield, Send,
  LayoutDashboard, UserCheck, BookOpen, Bell, RefreshCw, AlertTriangle,
  ChevronDown, Search, Filter,
} from 'lucide-react';

function StatCard({ icon, label, value, color, children }) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
    purple: 'from-purple-500 to-violet-500',
  };
  return (
    <div className="card p-5 animate-fadeInUp">
      <div className="flex items-center gap-3">
        <div className={'w-11 h-11 rounded-xl bg-gradient-to-br ' + (colors[color] || colors.blue) + ' flex items-center justify-center text-white shadow-sm'}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
      {children}
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
  const [notify, setNotify] = useState({ title: '', content: '', link: '' });
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [notifyErr, setNotifyErr] = useState('');
  const [cleanupResult, setCleanupResult] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['admin', 'official'].includes(user.role)) { navigate('/'); return; }
    loadData();
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      const [statsData, usersData, articlesData] = await Promise.all([
        api.getStats(),
        api.getAdminUsers(),
        api.getAdminArticles(),
      ]);
      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setArticles(articlesData.articles || []);
    } catch (e) { console.error('Failed to load admin data:', e); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try { await api.updateUserRole(userId, newRole); loadData(); }
    catch (e) { alert(e.message); }
  };
  const handleDeleteUser = async (userId) => {
    if (!confirm('确定删除该用户吗？此操作不可撤销。')) return;
    try { await api.deleteUser(userId); loadData(); }
    catch (e) { alert(e.message); }
  };
  const handleDeleteArticle = async (articleId) => {
    if (!confirm('确定删除这篇文章吗？')) return;
    try { await api.deleteArticle(articleId); loadData(); }
    catch (e) { alert(e.message); }
  };
  const handlePublishNotify = async (e) => {
    e.preventDefault();
    if (!notify.content.trim()) { setNotifyErr('通知内容不能为空'); return; }
    setNotifyLoading(true); setNotifyErr(''); setNotifyMsg('');
    try {
      const data = await api.publishNotification(notify.title.trim(), notify.content, notify.link.trim());
      setNotifyMsg(data.message || '发布成功');
      setNotify({ title: '', content: '', link: '' });
    } catch (err) { setNotifyErr(err.message || '发布失败'); }
    finally { setNotifyLoading(false); }
  };
  const handleCleanup = async () => {
    if (!confirm('确定要清理重复用户？')) return;
    setCleanupResult('');
    try {
      const d = await api.request('/admin/users/cleanup', { method: 'POST' });
      setCleanupResult(d.message);
      loadData();
    } catch (e) { setCleanupResult('错误: ' + e.message); }
  };

  if (loading) return <Loading />;

  const roleLabel = (role) => {
    const map = { user: '用户', admin: '管理员', official: '官方' };
    return map[role] || role;
  };
  const roleColor = (role) => {
    const map = {
      user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
      admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      official: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    };
    return map[role] || '';
  };

  const tabs = [
    { key: 'overview', label: '概览', icon: LayoutDashboard },
    { key: 'users', label: '用户管理', icon: UserCheck },
    { key: 'articles', label: '文章管理', icon: BookOpen },
    { key: 'notify', label: '发布通知', icon: Bell },
  ];

  return (
    <div className="animate-fadeIn">
      {/* 顶栏 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white shadow-sm">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">管理后台</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role === 'official' ? '官方管理员' : '管理员'} · {user.displayName}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit animate-fadeIn">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* 概览 */}
      {tab === 'overview' && stats && (
        <div className="animate-fadeIn">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<Users size={18} />} label="用户" value={stats.totalUsers} color="blue" />
            <StatCard icon={<FileText size={18} />} label="文章" value={stats.totalArticles} color="green" />
            <StatCard icon={<MessageSquare size={18} />} label="评论" value={stats.totalComments} color="orange" />
            <StatCard icon={<Eye size={18} />} label="总阅读" value={stats.totalViews} color="purple" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={<BookOpen size={18} />} label="发布状态" color="green" value={stats.publishedArticles}>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">已发布</span><span className="font-medium text-green-600 dark:text-green-400">{stats.publishedArticles}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">草稿</span><span className="font-medium text-yellow-600 dark:text-yellow-400">{stats.draftArticles}</span></div>
              </div>
            </StatCard>
            {user.role === 'official' && (
              <StatCard icon={<RefreshCw size={18} />} label="KV 维护" color="orange" value="工具">
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">清理重复/无效的用户数据</p>
                  <button onClick={handleCleanup}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                    清理用户数据
                  </button>
                  {cleanupResult && <p className="text-xs mt-2 text-gray-600 dark:text-gray-300">{cleanupResult}</p>}
                </div>
              </StatCard>
            )}
          </div>
        </div>
      )}

      {/* 用户管理 */}
      {tab === 'users' && (
        <div className="animate-fadeIn">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">用户</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">角色</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">注册时间</th>
                    <th className="text-right p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-200">
                            {u.displayName?.[0] || u.username?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{u.displayName || u.username}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <select value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium ${roleColor(u.role)}`}
                          disabled={u.id === user.id || user.role !== 'official'}>
                          <option value="user">用户</option>
                          <option value="admin">管理员</option>
                          <option value="official">官方</option>
                        </select>
                      </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="p-4 text-right">
                        {u.id !== user.id && (
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 文章管理 */}
      {tab === 'articles' && (
        <div className="animate-fadeIn">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标题</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">作者</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">阅读</th>
                    <th className="text-right p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate max-w-xs">{a.title}</p>
                      </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{a.author?.displayName || '-'}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.status === 'published'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {a.status === 'published' ? '已发布' : '草稿'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{a.views || 0}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteArticle(a.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 发布通知 */}
      {tab === 'notify' && (
        <div className="animate-fadeIn">
          <div className="card p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Bell size={18} className="text-[#fb7299]" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">发布系统通知</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">内容支持 Markdown，将推送给全站所有用户。</p>
            <form onSubmit={handlePublishNotify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题（可选）</label>
                <input type="text" value={notify.title} onChange={(e) => setNotify({ ...notify, title: e.target.value })}
                  className="input" placeholder="如：系统维护通知" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容（支持 Markdown）</label>
                <textarea value={notify.content} onChange={(e) => setNotify({ ...notify, content: e.target.value })}
                  rows={8} className="input resize-none font-mono text-sm" placeholder="支持 **加粗**、*斜体*、列表、标题、[链接](https://...) 等" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">跳转链接（可选）</label>
                <input type="text" value={notify.link} onChange={(e) => setNotify({ ...notify, link: e.target.value })}
                  className="input" placeholder="如 /article/xxx 或 https://..." />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">预览</p>
                <div className="article-content prose max-w-none border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 min-h-[4rem]"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(prepareArticleContent(notify.content || '*预览将显示在这里*')) }} />
              </div>
              {notifyErr && <p className="text-sm text-red-500">{notifyErr}</p>}
              {notifyMsg && <p className="text-sm text-green-600">{notifyMsg}</p>}
              <button type="submit" disabled={notifyLoading} className="btn-primary inline-flex items-center gap-1.5">
                <Send size={16} /> {notifyLoading ? '发布中...' : '发布通知'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
