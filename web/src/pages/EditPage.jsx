import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Save, X } from 'lucide-react';

export default function EditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    api.getArticle(id).then(data => {
      const article = data.article;
      if (article.authorId !== user.id && user.role !== 'admin') {
        navigate(`/article/${id}`);
        return;
      }
      setTitle(article.title);
      setContent(article.content);
      setTags((article.tags || []).join(', '));
      setCoverImage(article.coverImage || '');
      setExcerpt(article.excerpt || '');
    }).catch(() => {
      navigate('/');
    }).finally(() => {
      setFetching(false);
    });
  }, [id, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.updateArticle(id, {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        coverImage: coverImage.trim() || undefined,
      });
      navigate(`/article/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-80 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">编辑文章</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input text-xl font-semibold"
            placeholder="文章标题"
            required
          />
        </div>

        <div>
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="input"
            placeholder="封面图片URL（可选）"
          />
        </div>

        <div>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="input"
            placeholder="标签，用逗号分隔（可选）"
          />
        </div>

        <div>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="input resize-none"
            rows={2}
            placeholder="文章摘要（可选）"
          />
        </div>

        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input resize-none font-mono"
            rows={20}
            placeholder="文章内容（支持HTML）..."
            required
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            <Save size={16} className="mr-1.5" />
            {loading ? '保存中...' : '保存修改'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/article/${id}`)}
            className="btn-outline"
          >
            <X size={16} className="mr-1.5" />
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
