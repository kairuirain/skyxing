import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Calendar, Eye, Tag, User } from 'lucide-react';

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
    loadTags();
  }, [page, selectedTag]);

  const loadArticles = async () => {
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
  };

  const loadTags = async () => {
    try {
      const data = await api.getTags();
      setTags(data.tags || []);
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadArticles();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">SkyXing</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          自由创作，分享你的想法。与志同道合的人一起探索知识的边界。
        </p>
      </div>

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
                    <h2 className="text-xl font-semibold text-gray-900 mb-2 hover:text-primary-600 transition-colors">
                      {article.title}
                    </h2>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {article.excerpt || article.content?.replace(/<[^>]*>/g, '').slice(0, 200)}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      {article.author && (
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {article.author.displayName}
                        </span>
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
                  </Link>
                ))}
              </div>

              {/* Pagination */}
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
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="card p-4 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-3">标签</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedTag(''); setPage(1); }}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  !selectedTag
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setSelectedTag(tag); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTag === tag
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
