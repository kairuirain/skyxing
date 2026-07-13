import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function EditPage() {
  const { id } = useParams();
  const { user, api } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: '', coverImage: '', tags: '', excerpt: '', content: '' });
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getArticle(id);
        const article = data.article;
        if (user && (user.id === article.authorId || user.role === 'admin')) {
          setForm({
            title: article.title || '',
            coverImage: article.coverImage || '',
            tags: (article.tags || []).join(', '),
            excerpt: article.excerpt || '',
            content: article.content || '',
          });
        } else {
          navigate('/');
        }
      } catch (err) {
        setError('文章不存在');
      } finally {
        setFetching(false);
      }
    })();
  }, [id, api, user, navigate]);

  const update = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.updateArticle(id, {
        title: form.title.trim(),
        content: form.content.trim(),
        coverImage: form.coverImage.trim() || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        excerpt: form.excerpt.trim() || undefined,
      });
      navigate(`/article/${id}`);
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑文章</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" value={form.title} onChange={update('title')} className="input text-lg font-medium" placeholder="文章标题" />
        <input type="text" value={form.coverImage} onChange={update('coverImage')} className="input" placeholder="封面图 URL" />
        <input type="text" value={form.tags} onChange={update('tags')} className="input" placeholder="标签，逗号分隔" />
        <input type="text" value={form.excerpt} onChange={update('excerpt')} className="input" placeholder="摘要" />
        <textarea value={form.content} onChange={update('content')} className="input min-h-[400px] font-mono text-sm resize-y" placeholder="文章内容（支持 HTML）" />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(`/article/${id}`)} className="btn-outline btn-sm">取消</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? '保存中...' : '保存修改'}</button>
        </div>
      </form>
    </div>
  );
}
