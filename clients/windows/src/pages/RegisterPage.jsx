import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setError('请填写所有必填字段');
      return;
    }
    if (form.username.trim().length < 3) {
      setError('用户名至少 3 个字符');
      return;
    }
    if (form.password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || form.username.trim(),
      });
      navigate('/');
    } catch (err) {
      setError(err.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">注册 SkyXing</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
            <input type="text" value={form.username} onChange={update('username')} className="input" placeholder="3-30 个字符" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 *</label>
            <input type="email" value={form.email} onChange={update('email')} className="input" placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
            <input type="text" value={form.displayName} onChange={update('displayName')} className="input" placeholder="可选，默认为用户名" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 *</label>
            <input type="password" value={form.password} onChange={update('password')} className="input" placeholder="至少 6 位" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">确认密码 *</label>
            <input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} className="input" placeholder="再次输入密码" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          已有账号？
          <Link to="/login" className="text-primary-600 hover:text-primary-700 ml-1">去登录</Link>
        </p>
      </div>
    </div>
  );
}
