import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bug } from 'lucide-react';

function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
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
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">调试</p>
      </div>

      {/* 仅保留：调试 */}
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
    </div>
  );
}
