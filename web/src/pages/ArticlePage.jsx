import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { Calendar, Eye, Tag, User, Send, Trash2, Pin, PinOff, ArrowLeft } from 'lucide-react';
import { sanitizeHTML } from '../lib/sanitize.js';
import { prepareArticleContent } from '../lib/markdown.js';

export default function ArticlePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadArticle = useCallback(async () => {
    try { const data = await api.getArticle(id); setArticle(data.article); document.title = data.article.title + ' - SkyXing'; }
    catch {} finally { setLoading(false); }
  }, [id]);
  const loadComments = useCallback(async () => {
    try { const data = await api.getComments(id); setComments(data.comments || []); } catch {}
  }, [id]);

  useEffect(() => { loadArticle(); loadComments(); }, [loadArticle, loadComments]);

  const handleComment = async e => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try { await api.createComment({ articleId: id, content: newComment, parentId: replyTo }); setNewComment(''); setReplyTo(null); loadComments(); }
    catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };
  const handleDeleteComment = async cid => {
    if (!confirm('确定删除？')) return;
    try { await api.deleteComment(cid); loadComments(); } catch (e) { alert(e.message); }
  };
  const handleDeleteArticle = async () => {
    if (!confirm('确定删除这篇文章？')) return;
    try { await api.deleteArticle(id); navigate('/'); } catch (e) { alert(e.message); }
  };
  const handlePin = async () => {
    try { const d = await api.pinArticle(id); setArticle(p => ({ ...p, pinned: d.article.pinned })); } catch (e) { alert(e.message); }
  };

  const fmtDate = d => new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const LINK_BASE = 'https://skyxing.dpdns.org';

  useEffect(() => {
    if (!article) return;
    const h = e => {
      const a = e.target.closest?.('a'); if (!a) return;
      const href = a.getAttribute('href'); if (!href) return;
      if (href.startsWith(LINK_BASE + '/link?url=') || href.startsWith('/link?url=')) { e.preventDefault(); navigate(href.startsWith('/') ? href : href.substring(LINK_BASE.length)); }
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [navigate, article]);

  if (loading) return <Loading />;
  if (!article) return <div className="sk-empty"><p className="text-lg">文章不存在或已被删除</p><Link to="/" className="sk-btn sk-btn-primary mt-4 inline-flex">返回首页</Link></div>;

  const isAuthor = user?.id === article.authorId;
  const canManage = user?.role === 'official' || user?.role === 'admin' || isAuthor;

  return (
    <div className="max-w-3xl mx-auto sk-page">
      <button onClick={() => navigate(-1)} className="sk-btn sk-btn-ghost sk-btn-sm mb-4"><ArrowLeft size={16} className="mr-1" />返回</button>

      {/* Article */}
      <article className="sk-card p-6 mb-6">
        {article.coverImage && <img src={article.coverImage} alt="" className="w-full rounded-xl mb-4 max-h-80 object-cover" />}
        <h1 className="text-2xl font-bold text-[var(--text)] mb-3">{article.title}</h1>
        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] mb-4 flex-wrap">
          {article.author && <span className="flex items-center gap-1"><User size={12} />{article.author.displayName}</span>}
          <span className="flex items-center gap-1"><Calendar size={12} />{fmtDate(article.createdAt)}</span>
          <span className="flex items-center gap-1"><Eye size={12} />{article.views || 0} 阅读</span>
          {article.tags?.map(t => <span key={t} className="sk-badge sk-badge-accent"><Tag size={9} />{t}</span>)}
        </div>
        {canManage && (
          <div className="flex gap-2 mb-4">
            <button onClick={handlePin} className="sk-btn sk-btn-ghost sk-btn-sm">{article.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
            {isAuthor && <Link to={`/edit/${article.id}`} className="sk-btn sk-btn-ghost sk-btn-sm">编辑</Link>}
            <button onClick={handleDeleteArticle} className="sk-btn sk-btn-ghost sk-btn-sm text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
        <div className="article-content prose max-w-none text-[var(--text)]" dangerouslySetInnerHTML={{ __html: sanitizeHTML(prepareArticleContent(article.content || '')) }} />
      </article>

      {/* Comments */}
      <section className="sk-card p-6">
        <h2 className="font-semibold text-[var(--text)] mb-4">评论 ({comments.length})</h2>
        {user ? (
          <form onSubmit={handleComment} className="flex gap-2 mb-6">
            <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={replyTo ? '回复评论...' : '写下你的评论...'} className="sk-input flex-1" />
            <button type="submit" disabled={submitting} className="sk-btn sk-btn-primary sk-btn-sm"><Send size={14} /></button>
            {replyTo && <button type="button" onClick={() => setReplyTo(null)} className="sk-btn sk-btn-ghost sk-btn-sm text-xs">取消回复</button>}
          </form>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)] mb-6"><Link to="/login" className="text-[var(--accent)]">登录</Link> 后参与评论</p>
        )}
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="border-b border-[var(--border)] pb-3 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-[var(--text)]">{c.author?.displayName}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{fmtDate(c.createdAt)}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{c.content}</p>
              <div className="flex gap-2 mt-1">
                {user && <button onClick={() => setReplyTo(c.id)} className="text-xs text-[var(--accent)] hover:underline">回复</button>}
                {user?.role === 'official' && <button onClick={() => handleDeleteComment(c.id)} className="text-xs text-red-500 hover:underline">删除</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
