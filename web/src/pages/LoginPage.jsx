import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import LegalModal from '../components/LegalModal';
import TurnstileWidget from '../components/TurnstileWidget';
import api from '../lib/api';

export default function LoginPage() {
  const { login, complete2FALogin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalType, setLegalType] = useState(null);
  // 2FA
  const [tempToken, setTempToken] = useState(null);
  const [code, setCode] = useState('');
  // 人机验证（需求 7）
  const [siteKey, setSiteKey] = useState('');
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  useEffect(() => {
    api.getConfig().then((d) => {
      const key = d.turnstileSiteKey || '';
      setSiteKey(key);
      if (key) setNeedTurnstile(true);
    }).catch(() => {});
    api.getBotStatus().then((d) => { if (d.turnstileEnabled) setNeedTurnstile(true); }).catch(() => {});
  }, []);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const agreeRef = useRef(null);

  const fieldClass = (field) =>
    `input ${errors[field] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const fe = {};
    if (!username.trim()) fe.username = '请输入用户名';
    if (!password) fe.password = '请输入密码';
    setErrors(fe);
    let firstInvalid = Object.keys(fe)[0] || null;
    if (!agreed) {
      setAgreeError(t('auth.agreeRequired'));
      if (!firstInvalid) firstInvalid = 'agree';
    } else { setAgreeError(''); }
    if (firstInvalid) {
      if (firstInvalid === 'agree') agreeRef.current?.focus();
      else (firstInvalid === 'username' ? usernameRef : passwordRef).current?.focus();
      return;
    }
    // 如果需要人机验证但 token 缺失/过期，强制 Turnstile 重新渲染
    if (needTurnstile && !turnstileToken) {
      setServerError(t('settings.turnstile'));
      setTurnstileNonce((n) => n + 1);
      return;
    }
    setLoading(true);
    try {
      const res = await login(username.trim(), password, needTurnstile ? turnstileToken : undefined);
      if (res.requireTotp) { setTempToken(res.tempToken); setLoading(false); return; }
      navigate('/');
    } catch (err) {
      if (err.data?.needTurnstile) {
        setNeedTurnstile(true);
        setTurnstileToken(null);
        setTurnstileNonce((n) => n + 1); // 强制重新渲染 Turnstile
        setServerError(t('settings.turnstile'));
      } else {
        setServerError(err.message);
      }
    } finally { setLoading(false); }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setServerError('请输入 6 位验证码'); return; }
    setServerError(''); setLoading(true);
    try {
      await complete2FALogin(tempToken, code);
      navigate('/');
    } catch (err) {
      setServerError(err.message);
    } finally { setLoading(false); }
  };

  if (tempToken) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-center mb-2">双重验证</h1>
          <p className="text-sm text-gray-500 text-center mb-6">请输入身份验证器中的 6 位动态验证码</p>
          {serverError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{serverError}</div>}
          <form onSubmit={handle2FA} className="space-y-4">
            <input type="text" inputMode="numeric" autoComplete="one-time-code"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input text-center text-2xl tracking-[0.5em] font-mono" placeholder="000000" />
            <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full">
              {loading ? '验证中...' : '验证'}
            </button>
          </form>
          <button onClick={() => setTempToken(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 mt-4 text-center">
            返回上一步
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-center mb-6">{t('auth.loginTitle')}</h1>
        {serverError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{serverError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.username')}</label>
            <input ref={usernameRef} type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className={fieldClass('username')} placeholder="请输入用户名" />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input ref={passwordRef} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className={fieldClass('password')} placeholder="请输入密码" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <div className="flex items-start gap-2">
              <input ref={agreeRef} type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setAgreeError(''); }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-600 leading-relaxed">
                {t('auth.agreed')}
                <button type="button" onClick={() => setLegalType('privacy')} className="text-primary-600 hover:underline font-medium mx-0.5">{t('auth.privacy')}</button>
                与
                <button type="button" onClick={() => setLegalType('terms')} className="text-primary-600 hover:underline font-medium mx-0.5">{t('auth.terms')}</button>
              </span>
            </div>
            {agreeError && <p className="text-red-500 text-xs mt-1">{agreeError}</p>}
          </div>

          {needTurnstile && siteKey && (
            <div className="flex justify-center py-1">
              <TurnstileWidget key={turnstileNonce} siteKey={siteKey} onVerify={(tok) => setTurnstileToken(tok)} />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? t('common.loading') : t('auth.login')}</button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          还没有账号？<Link to="/register" className="text-primary-600 hover:text-primary-700">立即注册</Link>
        </p>
      </div>
      <LegalModal open={!!legalType} type={legalType} onClose={() => setLegalType(null)} />
    </div>
  );
}
