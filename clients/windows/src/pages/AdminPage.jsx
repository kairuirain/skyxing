import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime } from '@shared/sanitize';

export default function AdminPage() {
  const { user, api } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, a] = await Promise.all([
        api.getStats(),
        api.getAdminUsers(),
        api.getAdminArticles(),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setArticles(a.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (user?.role !== 'admin') {
    return <div className="text-center py-20"><p className="text-gray-500">无权访问</p></div>;
  }

  const changeRole = async (targetUser, role) => {
    if (!confirm(`将 ${targetUser.username} 的角色改为 ${role}？`)) return;
    try {
      await api.updateUserRole(targetUser.id, role);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteUser = async (targetUser) => {
    if (targetUser.id === user.id) return alert('不能删除自己');
    if (!confirm(`确定删除用户 ${targetUser.username}？`)) return;
    try {
      await api.deleteUser(targetUser.id);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteArticle = async (article) => {
    if (!confirm(`确定删除 "${article.title}"？`)) return;
    try {
      await api.deleteArticle(article.id);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>;
  }

  const tabs = [
    { key: 'overview', label: '概览' },
    { key: 'users', label: '用户管理' },
    { key: 'articles', label: '文章管理' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">管理后台</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.totalUsers || 0}</p>
            <p className="text-sm text-gray-500 mt-1">用户数</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.totalArticles || 0}</p>
            <p className="text-sm text-gray-500 mt-1">文章数</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.totalComments || 0}</p>
            <p className="text-sm text-gray-500 mt-1">评论数</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.totalViews || 0}</p>
            <p className="text-sm text-gray-500 mt-1">总阅读量</p>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">用户</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">邮箱</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">角色</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">加入时间</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.displayName || u.username}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-50 text-red-600' :
                        u.role === 'author' ? 'bg-blue-50 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatRelativeTime(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 mr-2"
                      >
                        <option value="user">user</option>
                        <option value="author">author</option>
                        <option value="admin">admin</option>
                      </select>
                      <button onClick={() => deleteUser(u)} className="text-xs text-red-500 hover:text-red-700">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'articles' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">作者</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">时间</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articles.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{a.title}</td>
                    <td className="px-4 py-3 text-gray-500">{a.authorName || '未知'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === 'published' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>{a.status === 'published' ? '已发布' : '草稿'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatRelativeTime(a.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteArticle(a)} className="text-xs text-red-500 hover:text-red-700">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
