import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { Users, FileText, MessageSquare, Eye, Trash2, Shield } from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, navigate]);

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
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('确定删除该用户吗？此操作不可撤销。')) return;
    try {
      await api.deleteUser(userId);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteArticle = async (articleId) => {
    if (!confirm('确定删除这篇文章吗？')) return;
    try {
      await api.deleteArticle(articleId);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <Loading />;

  const roleLabel = (role) => {
    const map = { user: '用户', admin: '管理员', official: '官方' };
    return map[role] || role;
  };

  const roleColor = (role) => {
    const map = {
      user: 'bg-gray-100 text-gray-700',
      admin: 'bg-purple-100 text-purple-700',
      official: 'bg-amber-100 text-amber-700',
    };
    return map[role] || '';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg inline-flex">
        {['overview', 'users', 'articles'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'overview' && '概览'}
            {t === 'users' && '用户管理'}
            {t === 'articles' && '文章管理'}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users />} label="用户" value={stats.totalUsers} color="blue" />
            <StatCard icon={<FileText />} label="文章" value={stats.totalArticles} color="green" />
            <StatCard icon={<MessageSquare />} label="评论" value={stats.totalComments} color="orange" />
            <StatCard icon={<Eye />} label="总阅读" value={stats.totalViews} color="purple" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-2">发布状态</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">已发布</span>
                  <span className="font-medium text-green-600">{stats.publishedArticles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">草稿</span>
                  <span className="font-medium text-yellow-600">{stats.draftArticles}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 text-sm font-medium text-gray-500">用户</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">角色</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">注册时间</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                          {u.displayName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.displayName}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full ${roleColor(u.role)} border-0 cursor-pointer`}
                        disabled={u.id === user.id || user.role !== 'official'}
                      >
                        <option value="user">用户</option>
                        <option value="admin">管理员</option>
                        <option value="official">官方</option>
                      </select>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="p-4 text-right">
                      {u.id !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 text-sm font-medium text-gray-500">标题</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">作者</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">阅读</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-medium text-sm truncate max-w-xs">{a.title}</p>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {a.author?.displayName || '-'}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {a.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{a.views || 0}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteArticle(a.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
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

function StatCard({ icon, label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
