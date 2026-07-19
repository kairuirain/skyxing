import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { Calendar, Eye, Tag, User, Send, Trash2, Edit3, Pin, PinOff } from 'lucide-react';
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
    try {
      const data = await api.getArticle(id);
      setArticle(data.article);
      document.title = `${data.article.title} - SkyXing`;
    } catch (e) {
      console.error('Failed to load article:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    try {
      const data = await api.getComments(id);
      setComments(data.comments || []);
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  }, [id]);

  useEffect(() => {
    loadArticle();
    loadComments();
  }, [loadArticle, loadComments]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await api.createComment({
        articleId: id,
        content: newComment,
        parentId: replyTo,
      });
      setNewComment('');
      setReplyTo(null);
      loadComments();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('确定删除这条评论吗？')) return;
    try {
      await api.deleteComment(commentId);
      loadComments();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteArticle = async () => {
    if (!confirm('确定删除这篇文章吗？此操作不可撤销。')) return;
    try {
      await api.deleteArticle(id);
      navigate('/');
    } catch (e) {
      alert(e.message);
    }
  };

  const handlePinArticle = async () => {
    try {
      const data = await api.pinArticle(id);
      setArticle(prev => ({ ...prev, pinned: data.article.pinned }));
    } catch (e) {
      alert(e.message);
    }
  };

  const handlePinComment = async (commentId) => {
    try {
      await api.pinComment(commentId);
      loadComments();
    } catch (e) {
      alert(e.message);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const LINK_BASE = 'https://skyxing.dpdns.org';

  // 拦截文章内链接点击（必须在早期 return 之前）
  useEffect(() => {
    if (!article) return;
    const handler = (e) => {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith(`${LINK_BASE}/link?url=`)) {
        e.preventDefault();
        navigate(`/link?${href.substring(`${LINK_BASE}/link?`.length)}`);
        return;
      }
      if (href.startsWith('/link?url=')) {
        e.preventDefault();
        navigate(href);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [navigate, article]);

  if (loading) return <Loading />;

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">文章不存在或已被删除</p>
        <Link to="/" className="btn-primary mt-4 inline-block">返回首页</Link>
      </div>
    );
  }

  const isOwner = user && (user.id === article.authorId || user.role === 'admin');
  const isArticleAuthor = user && user.id === article.authorId;

  // Build comment tree
  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (commentId) => comments.filter(c => c.parentId === commentId);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Article header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {article.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          {article.author && (
            <Link
              to={`/user/${article.author.id}`}
              className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
            >
              <User size={14} />
              {article.author.displayName}
            </Link>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(article.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={14} />
            {article.views || 0} 阅读
          </span>
          {article.tags?.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full text-xs"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="flex gap-2 mt-4">
            <Link to={`/edit/${article.id}`} className="btn-outline btn-sm">
              <Edit3 size={14} className="mr-1" />
              编辑
            </Link>
            {user?.role === 'admin' && (
              <button onClick={handlePinArticle} className="btn-outline btn-sm">
                {article.pinned ? <PinOff size={14} className="mr-1" /> : <Pin size={14} className="mr-1" />}
                {article.pinned ? '取消置顶' : '置顶'}
              </button>
            )}
            <button onClick={handleDeleteArticle} className="btn-danger btn-sm">
              <Trash2 size={14} className="mr-1" />
              删除
            </button>
          </div>
        )}
      </div>

      {/* Cover image */}
      {article.coverImage && (
        <img
          src={article.coverImage}
          alt={article.title}
          className="w-full rounded-xl mb-8 object-cover max-h-96"
        />
      )}

      {/* Article content */}
      <div
        className="article-content prose max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(prepareArticleContent(article.content)) }}
      />

      {/* Author card */}
      {article.author && (
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
              {article.author.displayName?.[0] || '?'}
            </div>
            <div>
              <Link
                to={`/user/${article.author.id}`}
                className="font-semibold text-gray-900 hover:text-primary-600"
              >
                {article.author.displayName}
              </Link>
              {article.author.bio && (
                <p className="text-sm text-gray-600">{article.author.bio}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments section */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-xl font-bold mb-6">
          评论 ({comments.length})
        </h2>

        {/* Comment form */}
        {user ? (
          <form onSubmit={handleComment} className="mb-8">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                <span>回复中...</span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-primary-600 hover:text-primary-700"
                >
                  取消
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="input flex-1 resize-none"
                rows={3}
                placeholder="写下你的评论..."
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="btn-primary self-end"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center mb-8">
            <Link to="/login" className="text-primary-600 hover:text-primary-700">
              登录
            </Link>
            {' '}后参与评论
          </div>
        )}

        {/* Comments list */}
        <div className="space-y-4">
          {topLevelComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              currentUser={user}
              onReply={setReplyTo}
              onDelete={handleDeleteComment}
              onPin={handlePinComment}
              isArticleAuthor={isArticleAuthor}
              formatDate={formatDate}
            />
          ))}
          {comments.length === 0 && (
            <p className="text-center text-gray-500 py-8">暂无评论，来说两句吧</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, replies, currentUser, onReply, onDelete, onPin, isArticleAuthor, formatDate }) {
  const canDelete = currentUser && (
    currentUser.id === comment.userId || currentUser.role === 'admin'
  );

  return (
    <div className={'border-l-2 pl-4 ' + (comment.pinned ? 'border-primary-300 bg-primary-50/30 -ml-2 pl-6 pr-2 py-2 rounded-r-lg' : 'border-gray-100')}>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
          {comment.user?.displayName?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">
              {comment.user?.displayName || '匿名用户'}
            </span>
            {comment.pinned && (
              <span className="inline-flex items-center gap-0.5 text-xs text-primary-600 font-medium">
                <Pin size={10} /> 置顶
              </span>
            )}
            <span className="text-xs text-gray-400">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          <p className="text-gray-700 text-sm mb-2">{comment.content}</p>
          <div className="flex gap-3 text-xs">
            {currentUser && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-gray-500 hover:text-primary-600"
              >
                回复
              </button>
            )}
            {isArticleAuthor && (
              <button
                onClick={() => onPin(comment.id)}
                className="text-gray-500 hover:text-primary-600"
              >
                {comment.pinned ? '取消置顶' : '置顶'}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-gray-500 hover:text-red-600"
              >
                删除
              </button>
            )}
          </div>

          {/* Nested replies */}
          {replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  replies={[]}
                  currentUser={currentUser}
                  onReply={onReply}
                  onDelete={onDelete}
                  onPin={onPin}
                  isArticleAuthor={isArticleAuthor}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
