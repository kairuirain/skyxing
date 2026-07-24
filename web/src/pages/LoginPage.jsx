import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import api from '../lib/api';
import TurnstileWidget from '../components/TurnstileWidget';
import LegalModal from '../components/LegalModal';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const usernameRef = useRef(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const [siteKey, setSiteKey] = useState('');
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => {
    api.getConfig().then(d => { if (d.turnstileSiteKey) { setSiteKey(d.turnstileSiteKey); setNeedTurnstile(true); } }).catch(() => {});
    api.getBotStatus().then(d => { if (d.turnstileEnabled) setNeedTurnstile(true); }).catch(() => {});
  }, []);
  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('请填写用户名和密码'); return; }
    if (!agreed) { setError(t('auth.agreeRequired')); return; }
    if (needTurnstile && !turnstileToken) { setError(t('settings.turnstile')); setTurnstileNonce(n => n + 1); return; }
    setLoading(true);
    try {
      const res = await login(username.trim(), password, needTurnstile ? turnstileToken : undefined);
      if (res.requireTotp) return;
      navigate('/');
    } catch (err) {
      if (err.data?.needTurnstile) { setNeedTurnstile(true); setTurnstileToken(null); setTurnstileNonce(n => n + 1); setError(t('settings.turnstile')); }
      else setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm sk-page">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">S</div>
          <h1 className="text-2xl font-bold text-[var(--text)]">登录 SkyXing</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">欢迎回来</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input ref={usernameRef} value={username} onChange={e => setUsername(e.target.value)} placeholder="用户名" autoComplete="username" className="sk-input h-11" />
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" autoComplete="current-password" className="sk-input h-11 pr-10" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text)]"><EyeOff size={17} /></button>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-[var(--accent)]" />
            我已阅读并同意 <button type="button" onClick={() => setShowLegal(true)} className="text-[var(--accent)] underline">服务条款与隐私政策</button>
          </label>

          {needTurnstile && siteKey && (
            <div className="flex justify-center"><TurnstileWidget key={turnstileNonce} siteKey={siteKey} onVerify={tok => setTurnstileToken(tok)} /></div>
          )}

          <button type="submit" disabled={loading} className="sk-btn sk-btn-primary sk-btn-lg w-full">{loading ? '登录中...' : '登录'}</button>
        </form>

        <p className="text-center text-sm text-[var(--text-tertiary)] mt-6">
          还没有账号？ <Link to="/register" className="text-[var(--accent)] font-medium hover:underline">立即注册</Link>
        </p>
      </div>
      <LegalModal open={showLegal} onClose={() => setShowLegal(false)} />
    </div>
  );
}
