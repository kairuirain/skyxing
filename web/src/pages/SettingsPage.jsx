import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { Bug, Sun, Moon, Trash2, Palette } from 'lucide-react';

function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center dark:bg-primary-900/40">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-gray-900 font-medium dark:text-gray-100">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirm('确定要注销账号吗？此操作不可恢复，你的账号、文章与私信将被删除。')) return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
      navigate('/');
    } catch (err) {
      alert(err.message || '注销失败');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
        <p className="text-sm text-gray-500 mt-1">外观、调试与账号</p>
      </div>

      {/* 外观：深色 / 浅色模式 */}
      <Section icon={Palette} title="外观" desc="主题偏好将通过 Cookie 保存">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Sun size={16} /> 浅色
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Moon size={16} /> 深色
          </button>
        </div>
      </Section>

      {/* 调试 */}
      <Section icon={Bug} title="调试" desc="账户诊断信息">
        <div className="space-y-4">
          {user ? (
            <div>
              <Row label="用户 ID" value={user.id} />
              <Row label="用户名" value={user.username} />
              <Row label="角色" value={{ user: '用户', author: '作者', admin: '管理员' }[user.role] || user.role} />
              <Row label="登录状态" value="已登录" />
            </div>
          ) : (
            <p className="text-sm text-gray-500">未登录</p>
          )}
        </div>
      </Section>

      {/* 账号管理：仅登录后可见 */}
      {user ? (
        <Section icon={Trash2} title="账号管理" desc="注销后数据将被永久删除">
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="btn-danger w-full"
          >
            {deleting ? '注销中...' : '注销账号'}
          </button>
        </Section>
      ) : (
        <Section icon={Trash2} title="账号管理" desc="登录后可管理你的账号">
          <p className="text-sm text-gray-500">
            请先{' '}
            <Link to="/login" className="text-primary-600 hover:underline">登录</Link>{' '}
            以使用注销账号等账号管理功能。
          </p>
        </Section>
      )}
    </div>
  );
}
