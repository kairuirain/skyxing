import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Calendar, Eye, Tag, User, FileText } from 'lucide-react';

export default function BlogPage() {
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadArticles(); }, [page]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const data = await api.getArticles(params);
      setArticles(data.articles || []);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadArticles();
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">博客</h1>
          <p className="text-sm text-gray-500 mt-0.5">浏览所有已发布的文章</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
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

      {/* Articles */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500">还没有文章</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {articles.map((article) => (
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
                      <User size={14} /> {article.author.displayName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> {formatDate(article.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={14} /> {article.views || 0} 阅读
                  </span>
                  {article.tags?.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full text-xs">
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-outline btn-sm"
              >
                上一页
              </button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
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
  );
}
