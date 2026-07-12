import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Calendar, Edit3, FileText } from 'lucide-react';

export default function UserPage() {
  const { id } = useParams();
  const { user: currentUser, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '' });

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    loadProfile();
    loadArticles();
  }, [id]);

  const loadProfile = async () => {
    try {
      const data = await api.getUser(id);
      setProfile(data.user);
      setForm({ displayName: data.user.displayName || '', bio: data.user.bio || '' });
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    try {
      const data = await api.getArticles({ authorId: id, limit: 50 });
      setArticles(data.articles || []);
    } catch (e) {
      console.error('Failed to load articles:', e);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(form);
      setProfile({ ...profile, ...form });
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-gray-200 rounded-full" />
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">用户不存在</p>
        <Link to="/" className="btn-primary mt-4 inline-block">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Profile header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl flex-shrink-0">
            {profile.displayName?.[0] || '?'}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
            <p className="text-gray-500 text-sm">@{profile.username}</p>
            {profile.bio && <p className="text-gray-600 mt-2">{profile.bio}</p>}
            <p className="text-sm text-gray-400 mt-2">
              <Calendar size={14} className="inline mr-1" />
              加入于 {formatDate(profile.createdAt)}
              <span className="mx-2">·</span>
              <FileText size={14} className="inline mr-1" />
              {profile.articleCount || 0} 篇文章
            </p>

            {isOwnProfile && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="btn-outline btn-sm mt-3"
              >
                <Edit3 size={14} className="mr-1" />
                编辑资料
              </button>
            )}
          </div>
        </div>

        {/* Edit form */}
        {isOwnProfile && editing && (
          <form onSubmit={handleUpdate} className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="input resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm">保存</button>
              <button type="button" onClick={() => setEditing(false)} className="btn-outline btn-sm">取消</button>
            </div>
          </form>
        )}
      </div>

      {/* User's articles */}
      <h2 className="text-xl font-bold mb-4">发布的文章</h2>
      {articles.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无文章</p>
      ) : (
        <div className="space-y-3">
          {articles.map(article => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="card p-4 block hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 hover:text-primary-600">
                {article.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(article.createdAt)} · {article.views || 0} 阅读
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
