import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useAnimation } from '../context/AnimationContext';
import { validateRegisterForm } from '../lib/validation';
import LegalModal from '../components/LegalModal';
import TurnstileWidget from '../components/TurnstileWidget';
import api from '../lib/api';

const FIELD_ORDER = ['username', 'email', 'displayName', 'password', 'confirmPassword'];

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, lang } = useI18n();
  const { animationMode } = useAnimation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  const [errors, setErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalType, setLegalType] = useState(null);
  // 人机验证（需求 7）
  const [siteKey, setSiteKey] = useState('');
  const [needTurnstile, setNeedTurnstile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);

  useEffect(() => {
    api.getConfig().then((d) => setSiteKey(d.turnstileSiteKey || '')).catch(() => {});
    api.getBotStatus().then((d) => { if (d.needTurnstile) setNeedTurnstile(true); }).catch(() => {});
  }, []);

  const inputRefs = useRef({});
  const agreeRef = useRef(null);

  const setRef = (field) => (el) => {
    inputRefs.current[field] = el;
  };

  const fieldClass = (field) =>
    `input ${errors[field] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) {
      const next = { ...errors };
      delete next[name];
      setErrors(next);
    }
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const { errors: fe, firstErrorField } = validateRegisterForm(form);
    setErrors(fe);

    let firstInvalid = firstErrorField;
    if (!agreed) {
      setAgreeError(t('auth.agreeRequired'));
      if (!firstInvalid) firstInvalid = 'agree';
    } else {
      setAgreeError('');
    }

    if (firstInvalid) {
      if (firstInvalid === 'agree') {
        agreeRef.current?.focus();
      } else {
        const el = inputRefs.current[firstInvalid];
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || form.username.trim(),
        agreedToTerms: agreed,
        language: lang,
        animationMode,
        turnstileToken: needTurnstile ? turnstileToken : undefined,
      });
      navigate('/');
    } catch (err) {
      if (err.data?.needTurnstile) {
        setNeedTurnstile(true);
        setTurnstileToken(null);
        setServerError(t('settings.turnstile'));
      } else {
        setServerError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field, label, type, placeholder, opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        ref={setRef(field)}
        type={type}
        name={field}
        value={form[field]}
        onChange={handleChange}
        className={fieldClass(field)}
        placeholder={placeholder}
        {...opts}
      />
      {errors[field] && (
        <p className="text-red-500 text-xs mt-1">{errors[field]}</p>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-center mb-6">{t('auth.registerTitle')}</h1>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {renderField('username', t('auth.username'), 'text', '3-30个字符', { minLength: 3, maxLength: 30 })}
          {renderField('email', t('auth.email'), 'email', 'your@email.com')}
          {renderField('displayName', t('auth.displayName'), 'text', '可选，默认使用用户名', { maxLength: 30 })}
          {renderField('password', t('auth.password'), 'password', '至少6位', { minLength: 6 })}
          {renderField('confirmPassword', t('auth.confirmPassword'), 'password', '再次输入密码')}

          <div>
            <div className="flex items-start gap-2">
              <input
                ref={agreeRef}
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked) setAgreeError('');
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                aria-invalid={!!agreeError}
              />
              <span className="text-sm text-gray-600 leading-relaxed">
                {t('auth.agreed')}
                <button
                  type="button"
                  onClick={() => setLegalType('privacy')}
                  className="text-primary-600 hover:underline font-medium mx-0.5"
                >
                  {t('auth.privacy')}
                </button>
                与
                <button
                  type="button"
                  onClick={() => setLegalType('terms')}
                  className="text-primary-600 hover:underline font-medium mx-0.5"
                >
                  {t('auth.terms')}
                </button>
              </span>
            </div>
            {agreeError && <p className="text-red-500 text-xs mt-1">{agreeError}</p>}
          </div>

          {needTurnstile && siteKey && (
            <div className="flex justify-center py-1">
              <TurnstileWidget siteKey={siteKey} onVerify={(tok) => setTurnstileToken(tok)} />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          已有账号？{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700">
            {t('auth.login')}
          </Link>
        </p>
      </div>

      <LegalModal open={!!legalType} type={legalType} onClose={() => setLegalType(null)} />
    </div>
  );
}
