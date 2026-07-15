import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSync from '../hooks/useSync';
import { extractExcerpt, formatRelativeTime } from '../../shared/sanitize';

function ArticleCard({ article }) {
  const excerpt = article.excerpt || extractExcerpt(article.content, 150);

  return (
    <Link
      to={`/article/${article.id}`}
      className="card block hover:shadow-md transition-shadow duration-200"
    >
      {article.coverImage && (
        <div className="w-full h-44 bg-gray-100 overflow-hidden">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          {article.pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
              📌 置顶
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900 line-clamp-2 hover:text-primary-600 transition-colors">
            {article.title}
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{article.authorName || '匿名'}</span>
          <span>·</span>
          <span>{formatRelativeTime(article.createdAt)}</span>
          <span>·</span>
          <span>{article.views || 0} 阅读</span>
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {article.tags.slice(0, 4).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-primary-50 text-primary-600 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}

export default function HomePage() {
  const { api } = useAuth();
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (selectedTag) params.tag = selectedTag;
      if (search.trim()) params.search = search.trim();
      const data = await api.getArticles(params);
      setArticles(data.articles || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  }, [api, selectedTag, search]);

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.getTags();
      setTags(data.tags || []);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchArticles(1); }, [fetchArticles]);
  const onSyncRefresh = useCallback(() => fetchArticles(1), [fetchArticles]);
  useSync(api, onSyncRefresh, { enabled: !selectedTag && !search.trim() });

  const handleSearch = (e) => {
    e.preventDefault();
    fetchArticles(1);
  };

  return (
    <div>
      {/* 搜索与标签 */}
      <div className="mb-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="搜索文章..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            搜索
          </button>
        </form>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedTag(''); }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                !selectedTag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 文章列表 */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">📝</p>
          <p className="text-gray-500 text-lg">还没有文章，快来写第一篇吧！</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => fetchArticles(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-outline btn-sm disabled:opacity-30"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchArticles(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-outline btn-sm disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
