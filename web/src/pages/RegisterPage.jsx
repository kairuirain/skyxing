import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { validateRegisterForm } from '../lib/validation';
import LegalModal from '../components/LegalModal';
import TurnstileWidget from '../components/TurnstileWidget';
import api from '../lib/api';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const { register, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const usernameRef = useRef(null);

  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', displayName: '' });
  const [errors, setErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => { usernameRef.current?.focus(); }, []);
  useEffect(() => {
    api.getConfig().then(d => { if (d.turnstileSiteKey) { setSiteKey(d.turnstileSiteKey); setNeedTurnstile(true); } }).catch(() => {});
    api.getBotStatus().then(d => { if (d.turnstileEnabled) setNeedTurnstile(true); }).catch(() => {});
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) { const n = { ...errors }; delete n[name]; setErrors(n); }
    setServerError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setServerError('');
    const { errors: fe, firstErrorField } = validateRegisterForm(form);
    setErrors(fe);
    let first = firstErrorField;
    if (!agreed) { setServerError(t('auth.agreeRequired')); if (!first) first = 'agree'; }
    if (first) { const el = document.querySelector(`[name="${first}"]`); el?.focus(); return; }
    if (needTurnstile && !turnstileToken) { setServerError(t('settings.turnstile')); setTurnstileNonce(n => n + 1); return; }
    setLoading(true);
    try {
      await register({ username: form.username.trim(), email: form.email.trim(), password: form.password, displayName: form.displayName.trim() || undefined }, needTurnstile ? turnstileToken : undefined);
      navigate('/');
    } catch (err) {
      if (err.data?.needTurnstile) { setNeedTurnstile(true); setTurnstileToken(null); setTurnstileNonce(n => n + 1); setServerError(t('settings.turnstile')); }
      else setServerError(err.message);
    } finally { setLoading(false); }
  };

  const fieldClass = (field) => `sk-input ${errors[field] ? '!border-red-500' : ''}`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm sk-page">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">S</div>
          <h1 className="text-2xl font-bold text-[var(--text)]">注册 SkyXing</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">创建你的账号</p>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <AlertTriangle size={15} /> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input ref={usernameRef} name="username" value={form.username} onChange={handleChange} placeholder="用户名" autoComplete="username" className={fieldClass('username')} />
          {errors.username && <p className="text-red-500 text-xs -mt-2 ml-1">{errors.username}</p>}
          <input name="email" value={form.email} onChange={handleChange} placeholder="邮箱" autoComplete="email" type="email" className={fieldClass('email')} />
          {errors.email && <p className="text-red-500 text-xs -mt-2 ml-1">{errors.email}</p>}
          <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="昵称（选填）" className={fieldClass('displayName')} />
          <div className="relative">
            <input name="password" value={form.password} onChange={handleChange} type={showPw ? 'text' : 'password'} placeholder="密码" autoComplete="new-password" className={fieldClass('password') + ' pr-10'} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"><EyeOff size={17} /></button>
          </div>
          {errors.password && <p className="text-red-500 text-xs -mt-2 ml-1">{errors.password}</p>}
          <input name="confirmPassword" value={form.confirmPassword} onChange={handleChange} type={showPw ? 'text' : 'password'} placeholder="确认密码" autoComplete="new-password" className={fieldClass('confirmPassword')} />
          {errors.confirmPassword && <p className="text-red-500 text-xs -mt-2 ml-1">{errors.confirmPassword}</p>}

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-[var(--accent)]" />
            我已阅读并同意 <button type="button" onClick={() => setLegalOpen(true)} className="text-[var(--accent)] underline">服务条款与隐私政策</button>
          </label>

          {needTurnstile && siteKey && <div className="flex justify-center"><TurnstileWidget key={turnstileNonce} siteKey={siteKey} onVerify={tok => setTurnstileToken(tok)} /></div>}

          <button type="submit" disabled={loading} className="sk-btn sk-btn-primary sk-btn-lg w-full">{loading ? '注册中...' : '注册'}</button>
        </form>

        <p className="text-center text-sm text-[var(--text-tertiary)] mt-6">已有账号？ <Link to="/login" className="text-[var(--accent)] font-medium hover:underline">登录</Link></p>
      </div>
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
    </div>
  );
}
