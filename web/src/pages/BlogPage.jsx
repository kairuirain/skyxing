import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import useSync from '../hooks/useSync';
import { Search, Pin, Sparkles, Calendar, Eye, User, Tag } from 'lucide-react';

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
    } catch {}
    finally { setLoading(false); }
  }, [page, selectedTag, search]);

  useEffect(() => { loadArticles(); api.getTags().then(d => setTags(d.tags || [])).catch(() => {}); }, [loadArticles]);

  const pinned = articles.filter(a => a.pinned);
  const normal = articles.filter(a => !a.pinned);

  const fmtDate = d => new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 sk-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white"><Sparkles size={20} /></div>
        <div><h1 className="text-2xl font-bold text-[var(--text)]">博客</h1><p className="text-xs text-[var(--text-tertiary)]">浏览所有文章</p></div>
      </div>

      <form onSubmit={e => { e.preventDefault(); setPage(1); }} className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文章..." className="sk-input pl-10" />
      </form>

      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scroll-hide pb-1">
          <button onClick={() => { setSelectedTag(''); setPage(1); }} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedTag ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>全部</button>
          {tags.map(t => (
            <button key={t} onClick={() => { setSelectedTag(t); setPage(1); }} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedTag === t ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>{t}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="sk-card p-5 animate-pulse"><div className="sk-skeleton h-5 w-3/4 mb-2" /><div className="sk-skeleton h-4 w-full mb-2" /><div className="sk-skeleton h-4 w-1/2" /></div>)}</div>
      ) : articles.length === 0 ? (
        <div className="sk-empty"><Sparkles size={40} className="mx-auto mb-3 opacity-30" /><p>还没有文章</p></div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide mb-3"><Pin size={12} className="text-[var(--accent)]" /> 置顶推荐</h2>
              <div className="space-y-3">
                {pinned.map(a => (
                  <Link key={a.id} to={`/article/${a.id}`} className="sk-card sk-card-hover p-5 block" style={{ borderLeft: '4px solid var(--accent)' }}>
                    <h2 className="text-lg font-semibold text-[var(--text)] mb-1">{a.title}</h2>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{a.excerpt || a.content?.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="space-y-3">
            {(pinned.length > 0 ? normal : articles).map(a => (
              <Link key={a.id} to={`/article/${a.id}`} className="sk-card sk-card-hover p-5 block">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-1">{a.title}</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">{a.excerpt || a.content?.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
                <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] flex-wrap">
                  {a.author && <span className="flex items-center gap-1"><User size={11} />{a.author.displayName}</span>}
                  <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(a.createdAt)}</span>
                  <span className="flex items-center gap-1"><Eye size={11} />{a.views || 0}</span>
                  {a.tags?.map(t => <span key={t} className="sk-badge sk-badge-accent"><Tag size={9} />{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="sk-btn sk-btn-outline sk-btn-sm">上一页</button>
              <span className="flex items-center px-4 text-sm text-[var(--text-secondary)]">{page}/{pagination.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="sk-btn sk-btn-outline sk-btn-sm">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
