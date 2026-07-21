import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractExcerpt, formatRelativeTime } from '@shared/sanitize';

export default function UserPage() {
  const { id } = useParams();
  const { user, api, updateProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [userData, articlesData] = await Promise.all([
        api.getUser(id),
        api.getArticles({ authorId: id, limit: 20 }),
      ]);
      setProfile(userData.user);
      setArticles(articlesData.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isSelf = user && user.id === id;

  const startEdit = () => {
    setEditForm({
      displayName: profile.displayName || '',
      bio: profile.bio || '',
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: editForm.displayName.trim(),
        bio: editForm.bio.trim(),
      });
      setEditing(false);
      fetchData();
    } catch (err) {
      alert(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">用户不存在</p>
        <Link to="/" className="btn-primary btn-sm mt-4 inline-flex">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 用户信息 */}
      <div className="card p-8 mb-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-3xl font-bold">
              {(profile.displayName || profile.username).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm(p => ({ ...p, displayName: e.target.value }))}
                  className="input"
                  placeholder="显示名称"
                />
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  className="input resize-none"
                  rows={3}
                  placeholder="个人简介"
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="btn-outline btn-sm">取消</button>
                  <button onClick={saveProfile} disabled={saving} className="btn-primary btn-sm">
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{profile.displayName || profile.username}</h1>
                <p className="text-sm text-gray-400 mt-0.5">@{profile.username}</p>
                {profile.bio && <p className="text-gray-600 mt-2">{profile.bio}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-2.5 py-0.5 text-xs bg-primary-50 text-primary-600 rounded-full font-medium">
                    {{ user: '用户', author: '作者', admin: '管理员' }[profile.role] || profile.role}
                  </span>
                  <span className="text-sm text-gray-400">
                    加入于 {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="text-sm text-gray-400">
                    {articles.length} 篇文章
                  </span>
                </div>
                {isSelf && (
                  <button onClick={startEdit} className="btn-outline btn-sm mt-3">编辑资料</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 用户文章 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">发布的文章</h2>
      {articles.length === 0 ? (
        <p className="text-center text-gray-400 py-8">暂无文章</p>
      ) : (
        <div className="space-y-3">
          {articles.map(article => (
            <Link key={article.id} to={`/article/${article.id}`} className="card p-4 block hover:shadow-md transition-shadow">
              <h3 className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1">{article.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {article.excerpt || extractExcerpt(article.content, 100)}
              </p>
              <div className="flex gap-3 text-xs text-gray-400 mt-2">
                <span>{formatRelativeTime(article.createdAt)}</span>
                <span>{article.views || 0} 阅读</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
