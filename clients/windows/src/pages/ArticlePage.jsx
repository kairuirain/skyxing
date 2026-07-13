import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sanitizeHTML, formatRelativeTime } from '../../shared/sanitize';

function CommentItem({ comment, user, onDelete, onReply }) {
  const canDelete = user && (user.id === comment.userId || user.role === 'admin');

  return (
    <div className="mb-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">
            {(comment.userDisplayName || comment.username || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {comment.userDisplayName || comment.username || '匿名'}
            </span>
            <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
          <div className="flex gap-3 mt-1.5">
            {user && (
              <button onClick={() => onReply(comment.id)} className="text-xs text-gray-400 hover:text-primary-600">
                回复
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} className="text-xs text-red-400 hover:text-red-600">
                删除
              </button>
            )}
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 mt-2 pl-4 border-l-2 border-gray-100 space-y-3">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} user={user} onDelete={onDelete} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArticlePage() {
  const { id } = useParams();
  const { user, api } = useAuth();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchArticle = useCallback(async () => {
    try {
      const data = await api.getArticle(id);
      setArticle(data.article);
    } catch (err) {
      console.error(err);
    }
  }, [api, id]);

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.getComments(id);
      const allComments = data.comments || [];
      // 构建评论树
      const map = {};
      const roots = [];
      allComments.forEach(c => { map[c.id] = { ...c, replies: [] }; });
      allComments.forEach(c => {
        if (c.parentId && map[c.parentId]) {
          map[c.parentId].replies.push(map[c.id]);
        } else if (!c.parentId) {
          roots.push(map[c.id]);
        }
      });
      setComments(roots);
    } catch { /* ignore */ }
  }, [api, id]);

  useEffect(() => {
    Promise.all([fetchArticle(), fetchComments()]).finally(() => setLoading(false));
  }, [fetchArticle, fetchComments]);

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      const data = { articleId: id, content: commentText.trim() };
      if (replyTo) data.parentId = replyTo;
      await api.createComment(data);
      setCommentText('');
      setReplyTo(null);
      fetchComments();
    } catch (err) {
      alert(err.message || '评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm('确定删除这条评论吗？')) return;
    try {
      await api.deleteComment(commentId);
      fetchComments();
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const deleteArticle = async () => {
    if (!confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await api.deleteArticle(id);
      navigate('/');
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse max-w-3xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-8"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-20">
        <p className="text-6xl mb-4">404</p>
        <p className="text-gray-500 text-lg">文章不存在或已删除</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">返回首页</Link>
      </div>
    );
  }

  const isOwner = user && (user.id === article.authorId || user.role === 'admin');
  const sanitizedContent = sanitizeHTML(article.content);

  return (
    <div className="max-w-3xl mx-auto">
      {/* 文章头部 */}
      <article>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
          <Link to={`/user/${article.authorId}`} className="text-primary-600 hover:text-primary-700">
            {article.authorName || '匿名'}
          </Link>
          <span>{formatRelativeTime(article.createdAt)}</span>
          <span>{article.views || 0} 阅读</span>
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {article.tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-primary-50 text-primary-600 rounded">{tag}</span>
            ))}
          </div>
        )}
        {isOwner && (
          <div className="flex gap-2 mb-6">
            <Link to={`/edit/${article.id}`} className="btn-outline btn-sm">编辑</Link>
            <button onClick={deleteArticle} className="btn-danger btn-sm">删除</button>
          </div>
        )}
        {article.coverImage && (
          <img src={article.coverImage} alt={article.title} className="w-full rounded-xl mb-6 max-h-96 object-cover" />
        )}
        <div
          className="article-content text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </article>

      {/* 作者卡片 */}
      <div className="card p-4 mt-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">
            {(article.authorName || '匿').charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <Link to={`/user/${article.authorId}`} className="font-medium text-gray-900 hover:text-primary-600">
            {article.authorName || '匿名'}
          </Link>
          <p className="text-sm text-gray-500">文章作者</p>
        </div>
      </div>

      {/* 评论区域 */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">评论 ({comments.length})</h2>

        {user ? (
          <div className="mb-6">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                <span>回复评论中</span>
                <button onClick={() => setReplyTo(null)} className="text-primary-600">取消</button>
              </div>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论..."
              className="input min-h-[100px] resize-y"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || submitting}
              className="btn-primary btn-sm mt-2"
            >
              {submitting ? '发布中...' : '发布评论'}
            </button>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500">
              <Link to="/login" className="text-primary-600">登录</Link> 后参与评论
            </p>
          </div>
        )}

        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                user={user}
                onDelete={deleteComment}
                onReply={(cid) => { setReplyTo(cid); }}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8">暂无评论，来说点什么吧</p>
        )}
      </section>
    </div>
  );
}
