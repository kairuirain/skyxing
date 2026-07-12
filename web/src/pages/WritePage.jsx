import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Save, X } from 'lucide-react';

export default function WritePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await api.createArticle({
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        coverImage: coverImage.trim() || undefined,
      });
      navigate(`/article/${data.article.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">写文章</h1>

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
            placeholder="文章摘要（可选，不填则自动从内容截取）"
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

        <div className="text-sm text-gray-500">
          提示：内容支持 HTML 标签，如 &lt;h2&gt;标题&lt;/h2&gt;、&lt;p&gt;段落&lt;/p&gt;、&lt;img src="..."&gt;图片等。
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            <Save size={16} className="mr-1.5" />
            {loading ? '发布中...' : '发布文章'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
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
