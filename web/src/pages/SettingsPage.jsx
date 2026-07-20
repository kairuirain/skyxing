import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { useAnimation } from '../context/AnimationContext';
import { useSync } from '../context/SyncContext';
import { detectOSLanguage } from '../lib/i18n';
import api from '../lib/api';
import { Bug, Sun, Moon, Trash2, Palette, Fingerprint, Copy, Check, ShieldCheck, RefreshCw, Activity } from 'lucide-react';

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

function Seg({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            value === o.value
              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { animationMode, setAnimationMode, debugEnabled, setDebugEnabled } = useAnimation();
  const { syncNow, syncing, conflict, pushSettings } = useSync();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);

  // 2FA
  const [show2FA, setShow2FA] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copied, setCopied] = useState(false);

  // 语言偏好（'auto' | 'zh' | 'en'）
  const [langPref, setLangPref] = useState(() => {
    try {
      const v = localStorage.getItem('skyxing_lang');
      return v === 'zh' || v === 'en' ? v : 'auto';
    } catch { return 'auto'; }
  });

  useEffect(() => { refreshUser(); }, []);

  const totpEnabled = !!user?.totpEnabled;

  const handleLang = (l) => {
    setLangPref(l);
    if (l === 'auto') {
      try { localStorage.removeItem('skyxing_lang'); } catch { /* ignore */ }
      setLang(detectOSLanguage());
    } else {
      setLang(l);
    }
    pushSettings({ language: l === 'auto' ? null : l }).catch(() => {});
  };

  const handleAnim = (m) => {
    setAnimationMode(m);
    pushSettings({ animationMode: m }).catch(() => {});
  };

  const handleDebug = (v) => {
    setDebugEnabled(v);
    pushSettings({ debugEnabled: v }).catch(() => {});
  };

  const handleSync = async () => {
    try { await syncNow(); setSyncedAt(Date.now()); } catch { /* ignore */ }
  };

  const handleHealth = () => window.open('/health', '_blank');

  const handleDeleteAccount = async () => {
    if (!confirm(t('settings.deleteAccount') + '？')) return;
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

  // ── 2FA 流程 ──
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
      await refreshUser();
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
      await refreshUser();
      setShow2FA(false);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      {conflict && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          设置已在其他设备更新，已自动同步为最新状态。
        </div>
      )}

      {/* 外观：语言 / 动画模式 / 主题 */}
      <Section icon={Palette} title={t('settings.appearance')} desc="语言与视觉风格">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('settings.language')}</p>
            <Seg
              value={langPref}
              onChange={handleLang}
              options={[
                { value: 'auto', label: '跟随系统' },
                { value: 'zh', label: '简体中文' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('settings.animation')}</p>
            <Seg
              value={animationMode}
              onChange={handleAnim}
              options={[
                { value: 'minimal', label: t('settings.anim.minimal') },
                { value: 'normal', label: t('settings.anim.normal') },
                { value: 'rich', label: t('settings.anim.rich') },
              ]}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('settings.theme')}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  theme === 'light' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}>
                <Sun size={16} /> {t('settings.light')}
              </button>
              <button onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}>
                <Moon size={16} /> {t('settings.dark')}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* 数据同步（需求 13） */}
      <Section icon={RefreshCw} title={t('settings.sync')} desc={t('settings.syncDesc')}>
        <div className="flex items-center justify-between gap-3">
          <button onClick={handleSync} disabled={syncing}
            className="btn-primary">{syncing ? t('common.loading') : t('settings.syncNow')}</button>
          {syncedAt && !syncing && (
            <span className="text-xs text-green-600">{t('settings.syncDone')} · {new Date(syncedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </Section>

      {/* 服务状态检测（需求 3） */}
      <Section icon={Activity} title={t('settings.health')} desc={t('settings.healthDesc')}>
        <button onClick={handleHealth} className="btn-outline w-full">
          <Activity size={16} className="mr-1.5" /> {t('settings.health')}
        </button>
      </Section>

      {/* 2FA 双重验证（需求 4：窗口化） */}
      {user && (
        <Section icon={Fingerprint} title={t('settings.twoFactor')} desc={t('settings.twoFactorDesc')}>
          <div className="flex items-center justify-between">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {totpEnabled ? '已启用' : '未启用'}
            </span>
            <button onClick={() => setShow2FA(true)} className="text-sm text-primary-600 hover:underline font-medium">
              管理
            </button>
          </div>
        </Section>
      )}

      <Section icon={Bug} title={t('settings.debug')} desc={t('settings.debugDesc')}>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('settings.debugToggle')}</span>
            <input type="checkbox" checked={debugEnabled} onChange={(e) => handleDebug(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          </label>
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
        <Section icon={Trash2} title={t('settings.account')} desc="注销后数据将被永久删除">
          <button onClick={handleDeleteAccount} disabled={deleting} className="btn-danger w-full">
            {deleting ? '注销中...' : t('settings.deleteAccount')}
          </button>
        </Section>
      ) : (
        <Section icon={Trash2} title={t('settings.account')} desc="登录后可管理你的账号">
          <p className="text-sm text-gray-500">请先 <Link to="/login" className="text-primary-600 hover:underline">登录</Link> 以使用账号管理功能。</p>
        </Section>
      )}

      {/* 2FA 模态窗口（需求 4） */}
      {show2FA && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !setupLoading && setShow2FA(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Fingerprint size={18} className="text-primary-600" /> {t('settings.twoFactor')}
              </h3>
              <button onClick={() => !setupLoading && setShow2FA(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {!totpEnabled && !setupData && (
              <button onClick={startSetup} disabled={setupLoading} className="btn-primary w-full">
                {setupLoading ? '准备中...' : '开启双重验证'}
              </button>
            )}

            {!totpEnabled && setupData && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">请使用身份验证器扫描二维码，或手动输入密钥。</p>
                <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-200 dark:border-gray-600">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.uri)}`}
                    alt="2FA QR Code" className="w-48 h-48" referrerPolicy="no-referrer" />
                  <p className="text-[10px] text-gray-400 text-center leading-tight break-all">{setupData.uri}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
                  <code className="text-sm font-mono flex-1 break-all select-all">{setupData.secret}</code>
                  <button onClick={copySecret} className="shrink-0 text-gray-400 hover:text-gray-600 p-1">
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <input type="text" inputMode="numeric" value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-xl tracking-[0.4em] font-mono" placeholder="输入 6 位验证码" />
                {setupError && <p className="text-xs text-red-500">{setupError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setSetupData(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200">取消</button>
                  <button onClick={submitSetup} disabled={setupLoading || verifyCode.length < 6} className="flex-1 btn-primary">
                    {setupLoading ? '验证中...' : '确认并启用'}
                  </button>
                </div>
              </div>
            )}

            {totpEnabled && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">双重验证已启用，登录时需输入动态验证码。</p>
                <button onClick={disable2FA} disabled={setupLoading} className="btn-danger w-full">关闭双重验证</button>
                <button onClick={() => setShow2FA(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">关闭</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-gray-900 font-medium dark:text-gray-100 break-all text-right max-w-[60%]">{value}</span>
    </div>
  );
}
