import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Loading from '../components/Loading';
import { Calendar, FileText, ArrowLeft } from 'lucide-react';

export default function UserPage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwn = currentUser?.id === id;

  useEffect(() => { loadProfile(); loadArticles(); }, [id]);

  const loadProfile = async () => {
    try { const data = await api.getUser(id); setProfile(data.user); } catch {}
    finally { setLoading(false); }
  };
  const loadArticles = async () => {
    try { const data = await api.getUserArticles(id); setArticles(data.articles || []); } catch {}
  };

  if (loading) return <Loading />;
  if (!profile) return <div className="sk-empty"><p>用户不存在</p></div>;

  const roleBadge = (r) => ({ user: '用户', admin: '管理员', official: '官方' })[r] || r;
  const roleColor = (r) => ({ user: 'bg-gray-100 text-gray-700', admin: 'bg-purple-100 text-purple-700', official: 'bg-amber-100 text-amber-700' })[r] || '';

  return (
    <div className="max-w-2xl mx-auto sk-page">
      <button onClick={() => navigate(-1)} className="sk-btn sk-btn-ghost sk-btn-sm mb-4"><ArrowLeft size={16} className="mr-1" />返回</button>

      {/* Profile */}
      <div className="sk-card p-6 mb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
          {(profile.displayName || profile.username)[0]}
        </div>
        <h1 className="text-xl font-bold text-[var(--text)]">{profile.displayName || profile.username}</h1>
        <p className="text-sm text-[var(--text-tertiary)]">@{profile.username}</p>
        <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor(profile.role)}`}>{roleBadge(profile.role)}</span>
        {profile.bio && <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-md mx-auto">{profile.bio}</p>}
        {isOwn && <Link to="/settings" className="sk-btn sk-btn-outline sk-btn-sm mt-4 inline-flex">编辑资料</Link>}
      </div>

      {/* Articles */}
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)] mb-3"><FileText size={15} /> 发布的文章 ({articles.length})</h2>
      {articles.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-8">暂无文章</p>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <Link key={a.id} to={`/article/${a.id}`} className="sk-card sk-card-hover p-4 block">
              <p className="font-medium text-sm text-[var(--text)]">{a.title}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1"><Calendar size={11} className="inline mr-1" />{new Date(a.createdAt).toLocaleDateString('zh-CN')}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
