import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateRegisterForm } from '../lib/validation';
import LegalModal from '../components/LegalModal';

const FIELD_ORDER = ['username', 'email', 'displayName', 'password', 'confirmPassword'];

export default function RegisterPage() {
  const { register } = useAuth();
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
  const [legalType, setLegalType] = useState(null); // 'privacy' | 'terms' | null

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
      setAgreeError('请先阅读并同意《SkyXing 隐私政策》与《SkyXing 服务条款》');
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
      });
      navigate('/');
    } catch (err) {
      setServerError(err.message);
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
        <h1 className="text-2xl font-bold text-center mb-6">注册 SkyXing</h1>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {renderField('username', '用户名', 'text', '3-30个字符', { minLength: 3, maxLength: 30 })}
          {renderField('email', '邮箱', 'email', 'your@email.com')}
          {renderField('displayName', '显示名称', 'text', '可选，默认使用用户名', { maxLength: 30 })}
          {renderField('password', '密码', 'password', '至少6位', { minLength: 6 })}
          {renderField('confirmPassword', '确认密码', 'password', '再次输入密码')}

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
                我已阅读并同意
                <button
                  type="button"
                  onClick={() => setLegalType('privacy')}
                  className="text-primary-600 hover:underline font-medium mx-0.5"
                >
                  《SkyXing 隐私政策》
                </button>
                与
                <button
                  type="button"
                  onClick={() => setLegalType('terms')}
                  className="text-primary-600 hover:underline font-medium mx-0.5"
                >
                  《SkyXing 服务条款》
                </button>
              </span>
            </div>
            {agreeError && <p className="text-red-500 text-xs mt-1">{agreeError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          已有账号？{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700">
            立即登录
          </Link>
        </p>
      </div>

      <LegalModal open={!!legalType} type={legalType} onClose={() => setLegalType(null)} />
    </div>
  );
}
