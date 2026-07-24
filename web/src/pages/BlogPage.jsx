import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import Loading from '../components/Loading';
import useSync from '../hooks/useSync';
import { Calendar, Eye, Tag, User, Search as SearchIcon, Pin, Sparkles } from 'lucide-react';

export default function BlogPage() {
  const [searchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (selectedTag) params.tag = selectedTag;
      if (search) params.search = search;
      const data = await api.getArticles(params);
      setArticles(data.articles || []);
      setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, selectedTag, search]);

  const loadTags = useCallback(async () => {
    try { const data = await api.getTags(); setTags(data.tags || []); } catch (e) {}
  }, []);

  useEffect(() => { loadArticles(); loadTags(); }, [loadArticles, loadTags]);
  useSync(loadArticles, { enabled: !selectedTag && !search });

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadArticles(); };
  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const pinned = articles.filter((a) => a.pinned);
  const normal = articles.filter((a) => !a.pinned);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center dark:bg-primary-900/30 dark:text-primary-300">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">博客</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">浏览所有已发布的文章</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative max-w-md">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文章..."
            className="input w-full pl-10" />
        </div>
      </form>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button onClick={() => { setSelectedTag(''); setPage(1); }}
            className={`shrink-0 px-3 py-1 rounded-full text-sm transition-colors ${
              !selectedTag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}>
            全部
          </button>
          {tags.map((tag) => (
            <button key={tag} onClick={() => { setSelectedTag(tag); setPage(1); }}
              className={`shrink-0 px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Articles */}
      {loading ? (
        <Loading />
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles size={48} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">还没有文章</p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="mb-6">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                <Pin size={12} /> 置顶推荐
              </h2>
              <div className="space-y-3">
                {pinned.map((a) => (
                  <Link key={a.id} to={`/article/${a.id}`}
                    className="card p-5 block hover:shadow-md transition-shadow border-l-4 border-l-primary-500">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 hover:text-primary-600 transition-colors">{a.title}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{a.excerpt || a.content?.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="space-y-3">
            {(pinned.length > 0 ? normal : articles).map((a) => (
              <Link key={a.id} to={`/article/${a.id}`}
                className="card p-5 block hover:shadow-md transition-shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 hover:text-primary-600 transition-colors">{a.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {a.excerpt || a.content?.replace(/<[^>]*>/g, '').slice(0, 200)}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  {a.author && (
                    <span className="flex items-center gap-1"><User size={12} />{a.author.displayName}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(a.createdAt)}</span>
                  <span className="flex items-center gap-1"><Eye size={12} />{a.views || 0} 阅读</span>
                  {a.tags?.map((t) => (
                    <span key={t} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                      <Tag size={9} />{t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="btn-outline btn-sm">上一页</button>
              <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">{page} / {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                className="btn-outline btn-sm">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
