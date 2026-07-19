import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { Bug, Sun, Moon, Trash2, Palette, Fingerprint, Copy, Check, ShieldCheck } from 'lucide-react';

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

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled || false);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const startSetup = async () => {
    setSetupLoading(true); setSetupError('');
    try {
      const data = await api.setup2FA();
      setSetupData(data);
      setVerifyCode('');
    } catch (err) { setSetupError(err.message); }
    finally { setSetupLoading(false); }
  };

  const submitSetup = async () => {
    if (verifyCode.length !== 6) { setSetupError('请输入 6 位验证码'); return; }
    setSetupLoading(true); setSetupError('');
    try {
      await api.verifySetup2FA(setupData.secret, verifyCode);
      setTotpEnabled(true);
      setSetupData(null);
      setVerifyCode('');
    } catch (err) { setSetupError(err.message); }
    finally { setSetupLoading(false); }
  };

  const disable2FA = async () => {
    if (!confirm('确定要关闭双重验证吗？')) return;
    setSetupLoading(true);
    try {
      await api.disable2FA();
      setTotpEnabled(false);
    } catch (err) { alert(err.message); }
    finally { setSetupLoading(false); }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = { user: '用户', admin: '管理员', official: '官方' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
        <p className="text-sm text-gray-500 mt-1">外观、安全与账号管理</p>
      </div>

      <Section icon={Palette} title="外观" desc="主题偏好">
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              theme === 'light' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}>
            <Sun size={16} /> 浅色
          </button>
          <button onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              theme === 'dark' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}>
            <Moon size={16} /> 深色
          </button>
        </div>
      </Section>

      {/* 2FA 双重验证 */}
      {user && (
        <Section icon={Fingerprint} title="2FA 双重验证" desc="登录时需额外输入动态验证码">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {totpEnabled ? '已启用' : '未启用'}
              </span>
            </div>

            {!totpEnabled && !setupData && (
              <button onClick={startSetup} disabled={setupLoading}
                className="btn-primary w-full">{setupLoading ? '准备中...' : '开启双重验证'}</button>
            )}

            {!totpEnabled && setupData && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  请使用 Google Authenticator / Authy 等应用扫描下方二维码，或手动输入密钥。
                </p>
                <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-200 dark:border-gray-600">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.uri)}`}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                    referrerPolicy="no-referrer"
                  />
                  <p className="text-[10px] text-gray-400 text-center leading-tight break-all">{setupData.uri}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <code className="text-sm font-mono flex-1 break-all select-all">{setupData.secret}</code>
                  <button onClick={copySecret} className="shrink-0 text-gray-400 hover:text-gray-600 p-1">
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <input type="text" inputMode="numeric" value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-xl tracking-[0.4em] font-mono" placeholder="输入 6 位验证码" />
                {setupError && <p className="text-xs text-red-500">{setupError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setSetupData(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200">取消</button>
                  <button onClick={submitSetup} disabled={setupLoading || verifyCode.length < 6}
                    className="flex-1 btn-primary">{setupLoading ? '验证中...' : '确认并启用'}</button>
                </div>
              </div>
            )}

            {totpEnabled && (
              <button onClick={disable2FA} disabled={setupLoading}
                className="btn-danger w-full">关闭双重验证</button>
            )}
          </div>
        </Section>
      )}

      <Section icon={Bug} title="调试" desc="账户诊断信息">
        <div className="space-y-4">
          {user ? (
            <div>
              <Row label="用户 ID" value={user.id} />
              <Row label="用户名" value={user.username} />
              <Row label="角色" value={roleLabel[user.role] || user.role} />
              <Row label="登录状态" value="已登录" />
              {totpEnabled && (
                <div className="flex items-center gap-1.5 pt-2 text-xs text-green-600">
                  <ShieldCheck size={14} /> 双重验证已启用
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">未登录</p>
          )}
        </div>
      </Section>

      {user ? (
        <Section icon={Trash2} title="账号管理" desc="注销后数据将被永久删除">
          <button onClick={handleDeleteAccount} disabled={deleting} className="btn-danger w-full">
            {deleting ? '注销中...' : '注销账号'}
          </button>
        </Section>
      ) : (
        <Section icon={Trash2} title="账号管理" desc="登录后可管理你的账号">
          <p className="text-sm text-gray-500">请先 <Link to="/login" className="text-primary-600 hover:underline">登录</Link> 以使用账号管理功能。</p>
        </Section>
      )}
    </div>
  );
}
