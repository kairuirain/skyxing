import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LegalModal from '../components/LegalModal';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legalType, setLegalType] = useState(null); // 'privacy' | 'terms' | null

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
      setAgreeError('请先阅读并同意《SkyXing 隐私政策》与《SkyXing 服务条款》');
      if (!firstInvalid) firstInvalid = 'agree';
    } else {
      setAgreeError('');
    }

    if (firstInvalid) {
      if (firstInvalid === 'agree') {
        agreeRef.current?.focus();
      } else {
        const el = firstInvalid === 'username' ? usernameRef.current : passwordRef.current;
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-center mb-6">登录 SkyXing</h1>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((x) => { const n = { ...x }; delete n.username; return n; });
                if (serverError) setServerError('');
              }}
              className={fieldClass('username')}
              placeholder="请输入用户名"
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((x) => { const n = { ...x }; delete n.password; return n; });
                if (serverError) setServerError('');
              }}
              className={fieldClass('password')}
              placeholder="请输入密码"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

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
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          还没有账号？{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700">
            立即注册
          </Link>
        </p>
      </div>

      <LegalModal open={!!legalType} type={legalType} onClose={() => setLegalType(null)} />
    </div>
  );
}
