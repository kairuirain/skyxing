import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import useSync from '../hooks/useSync';
import {
  Calendar, Eye, Tag, User, MessageSquare, Bell, ArrowRight,
  Sparkles, Download, Pin,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [latestConversations, setLatestConversations] = useState([]);

  // 使用 useCallback 保持引用稳定，避免 useSync 无限循环
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (selectedTag) params.tag = selectedTag;
      if (search) params.search = search;
      const data = await api.getArticles(params);
      setArticles(data.articles || []);
      setPagination(data.pagination);
    } catch (e) {
      console.error('Failed to load articles:', e);
    } finally {
      setLoading(false);
    }
  }, [page, selectedTag, search]);

  const loadTags = useCallback(async () => {
    try {
      const data = await api.getTags();
      setTags(data.tags || []);
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadTags();
  }, [loadArticles, loadTags]);

  // 实时同步：后台变化时自动刷新
  useSync(loadArticles, { enabled: !selectedTag && !search });

  // 已登录用户拉取未读数与最近会话
  useEffect(() => {
    if (!user) {
      setUnread(0);
      setLatestConversations([]);
      return;
    }
    let active = true;
    api.getUnreadCount()
      .then((d) => { if (active) setUnread(d.unreadCount || 0); })
      .catch(() => {});
    api.getConversations()
      .then((d) => { if (active) setLatestConversations((d.conversations || []).slice(0, 3)); })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadArticles();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div>
      {/* Hero / 平台介绍 */}
      <section className="text-center mb-10 py-10 bg-gradient-to-br from-primary-50 via-white to-white rounded-2xl border border-primary-100">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold mb-4">
          <Sparkles size={12} /> 跨平台博客平台
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">SkyXing</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
          自由创作，分享你的想法。与志同道合的人一起探索知识的边界。
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {user ? (
            <Link to="/write" className="btn-primary">
              写文章
            </Link>
          ) : (
            <Link to="/register" className="btn-primary">
              立即加入
            </Link>
          )}
          <Link to="/download" className="btn-outline">
            <Download size={16} className="mr-1.5" /> 下载客户端
          </Link>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1">
          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索文章..."
                className="input flex-1"
              />
              <button type="submit" className="btn-primary">搜索</button>
            </div>
          </form>

          {/* Articles list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">还没有文章，快来写第一篇吧！</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {articles.map(article => (
                  <Link
                    key={article.id}
                    to={`/article/${article.id}`}
                    className="card p-6 block hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {article.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                          <Pin size={10} /> 置顶
                        </span>
                      )}
                      <h2 className="text-xl font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                        {article.title}
                      </h2>
                    </div>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {article.excerpt || article.content?.replace(/<[^>]*>/g, '').slice(0, 200)}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      {article.author && (
                        <span className="flex items-center gap-1">
                          <User size={14} /> {article.author.displayName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> {formatDate(article.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={14} /> {article.views || 0} 阅读
                      </span>
                      {article.tags?.map(tag => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full text-xs"
                        >
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-outline btn-sm"
                  >
                    上一页
                  </button>
                  <span className="flex items-center px-4 text-sm text-gray-600">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="btn-outline btn-sm"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
          {/* 消息通知 / 私信 入口 */}
          {user ? (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Bell size={16} className="text-primary-600" /> 消息通知
                  {unread > 0 && (
                    <span className="inline-flex min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </h3>
                <Link to="/messages" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  全部 <ArrowRight size={12} />
                </Link>
              </div>
              {latestConversations.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">还没有私信</p>
              ) : (
                <div className="space-y-2">
                  {latestConversations.map((c) => (
                    <Link
                      key={c.id}
                      to={`/messages/${c.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">
                        {(c.otherUser?.displayName || c.otherUser?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {c.otherUser?.displayName || c.otherUser?.username}
                          </span>
                          {c.unreadCount > 0 && (
                            <span className="text-[10px] text-red-500 font-bold">{c.unreadCount}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {c.lastMessage || '（无消息）'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card p-4 text-center">
              <MessageSquare size={28} className="mx-auto text-primary-500 mb-2" />
              <p className="text-sm text-gray-700 mb-2">登录后即可收发私信</p>
              <Link to="/login" className="btn-primary btn-sm">登录</Link>
            </div>
          )}

          {/* 标签 */}
          <div className="card p-4 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-3">标签</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedTag(''); setPage(1); }}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  !selectedTag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setSelectedTag(tag); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
