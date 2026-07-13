import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WritePage() {
  const { user, api } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: '', coverImage: '', tags: '', excerpt: '', content: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    navigate('/login');
    return null;
  }

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
      const data = await api.createArticle({
        title: form.title.trim(),
        content: form.content.trim(),
        coverImage: form.coverImage.trim() || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        excerpt: form.excerpt.trim() || undefined,
      });
      navigate(`/article/${data.article.id}`);
    } catch (err) {
      setError(err.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">写文章</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={form.title}
          onChange={update('title')}
          className="input text-lg font-medium"
          placeholder="文章标题"
        />
        <input
          type="text"
          value={form.coverImage}
          onChange={update('coverImage')}
          className="input"
          placeholder="封面图 URL（可选）"
        />
        <input
          type="text"
          value={form.tags}
          onChange={update('tags')}
          className="input"
          placeholder="标签，用逗号分隔（可选）"
        />
        <input
          type="text"
          value={form.excerpt}
          onChange={update('excerpt')}
          className="input"
          placeholder="文章摘要（可选，不填则自动生成）"
        />
        <textarea
          value={form.content}
          onChange={update('content')}
          className="input min-h-[400px] font-mono text-sm resize-y"
          placeholder="文章内容（支持 HTML 标签）"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">支持 HTML 标签：h1-h6, p, img, a, code, pre, ul, ol, blockquote 等</p>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '发布中...' : '发布文章'}
          </button>
        </div>
      </form>
    </div>
  );
}
