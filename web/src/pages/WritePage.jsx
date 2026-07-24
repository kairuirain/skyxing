import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Save, ArrowLeft, AlertTriangle } from 'lucide-react';

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

  if (!user) { navigate('/login'); return null; }

  const handleSubmit = async e => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError('标题和内容不能为空'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.createArticle({
        title: title.trim(), content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        coverImage: coverImage.trim() || undefined,
      });
      navigate('/article/' + data.article.id);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto sk-page">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="sk-btn sk-btn-ghost sk-btn-sm"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold text-[var(--text)]">写文章</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="文章标题" className="sk-input text-lg font-semibold" />
        <input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="封面图片 URL（选填）" className="sk-input" />
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="标签（逗号分隔，如：技术, 生活）" className="sk-input" />
        <input value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="摘要（选填）" className="sk-input" />
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={16} placeholder="支持 Markdown 格式..."
          className="sk-input resize-none font-mono text-sm" />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="sk-btn sk-btn-primary flex-1"><Save size={16} className="mr-1" />{loading ? '发布中...' : '发布文章'}</button>
          <button type="button" onClick={() => navigate(-1)} className="sk-btn sk-btn-outline">取消</button>
        </div>
      </form>
    </div>
  );
}
