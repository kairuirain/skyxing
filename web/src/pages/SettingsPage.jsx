import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { useAnimation } from '../context/AnimationContext';
import { useSync } from '../context/SyncContext';
import { detectOSLanguage } from '../lib/i18n';
import api from '../lib/api';
import {
  Palette, Download, MessageSquare, Send, Info, RefreshCw, Sun, Moon, ExternalLink, Check,
  Bug, Fingerprint, Copy, Trash2, Languages, Sparkles, ShieldCheck, ChevronRight, Github,
  FileText, AlertTriangle, ArrowLeft,
} from 'lucide-react';

const APP_VERSION = '2.0.1';
const ISSUES_URL = 'https://github.com/kairuirain/skyxing-app/issues/new';
const REPO_URL = 'https://github.com/kairuirain/skyxing-app';
const TERMS_URL = 'https://skyxing.dpdns.org/terms.html';
const PRIVACY_URL = 'https://skyxing.dpdns.org/privacy.html';

// ── 通用小组件 ──
function Seg({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ' +
              (active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')}>
            {o.icon && <o.icon size={14} />}
            {o.label}
            {active && <Check size={13} />}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={onChange}
      className={'relative w-11 h-6 rounded-full transition-colors shrink-0 ' + (checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600') + (disabled ? ' opacity-50' : '')}>
      <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-5' : '')} />
    </button>
  );
}

function ConfirmDialog({ open, title, message, confirmText, cancelText, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className={'w-9 h-9 rounded-full flex items-center justify-center ' + (danger ? 'bg-red-500/15' : 'bg-primary-50 dark:bg-primary-900/30')}>
            <AlertTriangle size={18} className={danger ? 'text-red-500' : 'text-primary-600'} />
          </div>
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            {cancelText || '取消'}
          </button>
          <button onClick={onConfirm} className={'flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-90 ' + (danger ? 'bg-red-500' : 'bg-primary-600')}>
            {confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreenCard({ children, className = '' }) {
  return (
    <section className={'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 ' + className}>
      {children}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-gray-900 font-medium dark:text-gray-100 break-all text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// ── 叶子屏幕 ──
function LanguageScreen() {
  const { t, setLang } = useI18n();
  const { pushSettings } = useSync();
  const [langPref, setLangPref] = useState(() => {
    try { const v = localStorage.getItem('skyxing_lang'); return v === 'zh' || v === 'en' ? v : 'auto'; } catch { return 'auto'; }
  });
  const handleLang = (l) => {
    setLangPref(l);
    if (l === 'auto') { try { localStorage.removeItem('skyxing_lang'); } catch { /* ignore */ } setLang(detectOSLanguage()); }
    else { setLang(l); }
    pushSettings({ language: l === 'auto' ? null : l }).catch(() => {});
  };
  return (
    <ScreenCard>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5"><Languages size={14} /> {t('settings.language')}</p>
      <Seg value={langPref} onChange={handleLang} options={[
        { value: 'auto', label: '跟随系统' }, { value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' },
      ]} />
    </ScreenCard>
  );
}

function AnimationScreen() {
  const { t } = useI18n();
  const { animationMode, setAnimationMode } = useAnimation();
  const { pushSettings } = useSync();
  const handle = (m) => { setAnimationMode(m); pushSettings({ animationMode: m }).catch(() => {}); };
  return (
    <ScreenCard>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5"><Sparkles size={14} /> {t('settings.animation')}</p>
      <Seg value={animationMode} onChange={handle} options={[
        { value: 'minimal', label: t('settings.anim.minimal') }, { value: 'normal', label: t('settings.anim.normal') }, { value: 'rich', label: t('settings.anim.rich') },
      ]} />
    </ScreenCard>
  );
}

function ThemeScreen() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <ScreenCard>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('settings.theme')}</p>
      <div className="flex items-center gap-3">
        {[{ key: 'light', label: t('settings.light'), icon: Sun }, { key: 'dark', label: t('settings.dark'), icon: Moon }].map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.key;
          return (
            <button key={opt.key} onClick={() => setTheme(opt.key)}
              className={'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ' +
                (active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')}>
              <Icon size={16} /> {opt.label}
            </button>
          );
        })}
      </div>
    </ScreenCard>
  );
}

function SyncScreen() {
  const { t } = useI18n();
  const { syncNow, syncing, conflict } = useSync();
  const [syncedAt, setSyncedAt] = useState(null);
  const handle = async () => { try { await syncNow(); setSyncedAt(Date.now()); } catch { /* ignore */ } };
  return (
    <ScreenCard>
      {conflict && <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm mb-3">设置已在其他设备更新，已自动同步为最新状态。</div>}
      <div className="flex items-center justify-between gap-3">
        <button onClick={handle} disabled={syncing} className="btn-primary">{syncing ? t('common.loading') : t('settings.syncNow')}</button>
        {syncedAt && !syncing && <span className="text-xs text-green-600">{t('settings.syncDone')} · {new Date(syncedAt).toLocaleTimeString()}</span>}
      </div>
    </ScreenCard>
  );
}

function TwoFactorScreen() {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  useEffect(() => { refreshUser(); }, []);
  const totpEnabled = !!user?.totpEnabled;
  return (
    <ScreenCard>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.twoFactor')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('settings.twoFactorDesc')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="text-sm text-primary-600 hover:underline font-medium shrink-0 ml-2">
          {totpEnabled ? '管理' : '开启'}
        </button>
      </div>
      {totpEnabled && <div className="flex items-center gap-1.5 pt-2 text-xs text-green-600"><ShieldCheck size={14} /> {t('settings.twoFactorEnabled')}</div>}
      {showModal && <TwoFactorModal onClose={() => setShowModal(false)} />}
    </ScreenCard>
  );
}

function TwoFactorModal({ onClose }) {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const totpEnabled = !!user?.totpEnabled;

  const startSetup = async () => {
    setLoading(true); setError('');
    try { const data = await api.setup2FA(); setSetupData(data); setVerifyCode(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const submitSetup = async () => {
    if (verifyCode.length !== 6) { setError('请输入 6 位验证码'); return; }
    setLoading(true); setError('');
    try { await api.verifySetup2FA(setupData.secret, verifyCode); await refreshUser(); setSetupData(null); setVerifyCode(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const disable2FA = async () => {
    setLoading(true);
    try { await api.disable2FA(); await refreshUser(); setConfirmDisable(false); onClose(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };
  const copySecret = () => { navigator.clipboard?.writeText(setupData.secret); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !loading && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Fingerprint size={18} className="text-primary-600" /> {t('settings.twoFactor')}</h3>
          <button onClick={() => !loading && onClose()} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {!totpEnabled && !setupData && (
          <button onClick={startSetup} disabled={loading} className="btn-primary w-full">{loading ? '准备中...' : '开启双重验证'}</button>
        )}
        {!totpEnabled && setupData && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">请使用身份验证器扫描二维码，或手动输入密钥。</p>
            <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-200 dark:border-gray-600">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.uri)}`} alt="2FA QR Code" className="w-48 h-48" referrerPolicy="no-referrer" />
              <p className="text-[10px] text-gray-400 text-center leading-tight break-all">{setupData.uri}</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2">
              <code className="text-sm font-mono flex-1 break-all select-all">{setupData.secret}</code>
              <button onClick={copySecret} className="shrink-0 text-gray-400 hover:text-gray-600 p-1">{copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}</button>
            </div>
            <input type="text" inputMode="numeric" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input text-center text-xl tracking-[0.4em] font-mono" placeholder="输入 6 位验证码" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setSetupData(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200">取消</button>
              <button onClick={submitSetup} disabled={loading || verifyCode.length < 6} className="flex-1 btn-primary">{loading ? '验证中...' : '确认并启用'}</button>
            </div>
          </div>
        )}
        {totpEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">双重验证已启用，登录时需输入动态验证码。</p>
            <button onClick={() => setConfirmDisable(true)} disabled={loading} className="btn-danger w-full">关闭双重验证</button>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-700">关闭</button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmDisable} title={t('settings.confirmTitle')} message={t('settings.confirmDisable2FA')} confirmText="关闭" danger onConfirm={disable2FA} onCancel={() => setConfirmDisable(false)} />
    </div>
  );
}

function DeleteAccountScreen() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const doDelete = async () => {
    setShowConfirm(false); setDeleting(true);
    try { await api.deleteAccount(); await logout(); navigate('/'); }
    catch (err) { alert(err.message || '注销失败'); setDeleting(false); }
  };
  if (!user) {
    return (
      <ScreenCard>
        <p className="text-sm text-gray-500">请先 <Link to="/login" className="text-primary-600 hover:underline">登录</Link> 以使用账号管理功能。</p>
      </ScreenCard>
    );
  }
  return (
    <ScreenCard>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">注销后您的文章、评论与账号数据将被永久删除，且无法恢复。</p>
      <button onClick={() => setShowConfirm(true)} disabled={deleting} className="btn-danger w-full">{deleting ? '注销中...' : t('settings.deleteAccount')}</button>
      <ConfirmDialog open={showConfirm} title={t('settings.confirmTitle')} message={t('settings.confirmDeleteAccount')} confirmText="注销" danger onConfirm={doDelete} onCancel={() => setShowConfirm(false)} />
    </ScreenCard>
  );
}

function GithubFeedbackScreen() {
  const { t } = useI18n();
  return (
    <ScreenCard>
      <p className="text-xs text-gray-500 mb-3">遇到问题或有建议？欢迎到 GitHub 提交 Issue。</p>
      <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-gray-700 dark:text-gray-200 font-medium text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <Github size={15} /> 前往 GitHub 提交反馈
      </a>
    </ScreenCard>
  );
}

function InAppFeedbackScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [type, setType] = useState('bug');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!message.trim()) { setError(t('settings.feedbackRequired')); return; }
    setSubmitting(true); setError('');
    try { await api.submitFeedback({ type, message: message.trim(), contact: contact.trim() }); setDone(true); }
    catch (err) { setError(err.message || '提交失败'); }
    finally { setSubmitting(false); }
  };
  if (done) {
    return (
      <ScreenCard>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center"><Check size={24} className="text-green-500" /></div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.feedbackSubmitted')}</p>
        </div>
      </ScreenCard>
    );
  }
  return (
    <ScreenCard>
      <div className="mb-4">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5"><Send size={14} /> {t('settings.feedbackType')}</p>
        <Seg value={type} onChange={setType} options={[
          { value: 'bug', label: t('settings.feedbackBug') }, { value: 'suggestion', label: t('settings.feedbackSuggestion') }, { value: 'other', label: t('settings.feedbackOther') },
        ]} />
      </div>
      <div className="mb-4">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">{t('settings.feedbackContact')}</p>
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={user ? user.username : ''} className="input" />
      </div>
      <div className="mb-4">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">{t('settings.feedbackMessage')}</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} placeholder={t('settings.feedbackPlaceholder')} className="input resize-none" />
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <button onClick={submit} disabled={submitting} className="btn-primary w-full disabled:opacity-50">{submitting ? t('common.loading') : t('settings.feedbackSubmit')}</button>
    </ScreenCard>
  );
}

function UpdateScreen() {
  const { t } = useI18n();
  const [channel, setChannel] = useState('stable');
  const [source, setSource] = useState('github');
  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });

  const checkUpdate = useCallback(async () => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try {
      const data = await api.checkUpdate('windows', APP_VERSION, channel);
      setUpdate((u) => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release }));
    } catch (e) { setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' })); }
  }, [channel]);

  useEffect(() => { checkUpdate(); }, [checkUpdate]);

  const handleDownload = () => {
    const dl = update.latest?.download;
    if (!dl) return;
    const url = source === 'ghfast' ? (dl.proxyUrl || dl.url) : dl.url;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="space-y-4">
      <ScreenCard>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2"><Info size={15} /> <span>当前版本 v{APP_VERSION} · {channel === 'beta' ? t('settings.channelBeta') : t('settings.channelStable')}</span></div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">{t('settings.updateChannel')}</p>
        <Seg value={channel} onChange={setChannel} options={[{ value: 'stable', label: t('settings.channelStable') }, { value: 'beta', label: t('settings.channelBeta') }]} />
      </ScreenCard>
      <ScreenCard>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">{t('settings.updateSource')}</p>
        <Seg value={source} onChange={setSource} options={[{ value: 'github', label: t('settings.sourceGithub') }, { value: 'ghfast', label: t('settings.sourceGhfast') }]} />
      </ScreenCard>
      <ScreenCard>
        <div className="flex items-center justify-between mb-3">
          <button onClick={checkUpdate} disabled={update.checking} className="btn-outline">{update.checking ? '检查中...' : '检查更新'}</button>
        </div>
        {update.hasUpdate && update.latest && (
          <div className="p-3 rounded-lg bg-primary-50/40 border border-primary-200 dark:border-primary-800 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">新版本 v{update.latest.version} 可用</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-600 text-white font-medium">OTA</span>
            </div>
            <button onClick={handleDownload} className="w-full py-1.5 rounded-lg text-white text-xs font-medium bg-primary-600 hover:bg-primary-700 transition-colors">下载安装包</button>
          </div>
        )}
        {update.checked && !update.hasUpdate && !update.error && <p className="text-xs text-green-600">已是最新版本</p>}
        {update.error && <p className="text-xs text-red-500">{update.error}</p>}
      </ScreenCard>
    </div>
  );
}

function DebugScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { debugEnabled, setDebugEnabled } = useAnimation();
  const { pushSettings } = useSync();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const onToggle = () => { setPending(!debugEnabled); setShowConfirm(true); };
  const confirm = () => { setDebugEnabled(pending); pushSettings({ debugEnabled: pending }).catch(() => {}); setShowConfirm(false); };
  const roleLabel = { user: '用户', admin: '管理员', official: '官方' };
  return (
    <ScreenCard>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-gray-900 dark:text-gray-100">{t('settings.debugToggle')}</span>
        <Toggle checked={debugEnabled} onChange={onToggle} />
      </label>
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 text-sm">
        <Row label={t('settings.userID')} value={user?.id || '—'} />
        <Row label={t('settings.role')} value={user ? (roleLabel[user.role] || user.role) : '—'} />
        <Row label={t('settings.loginStatus')} value={user ? t('settings.loggedIn') : t('settings.notLoggedIn')} />
        {!!user?.totpEnabled && <div className="flex items-center gap-1.5 pt-1 text-xs text-green-600"><ShieldCheck size={14} /> {t('settings.twoFactorEnabled')}</div>}
      </div>
      <ConfirmDialog open={showConfirm} title={t('settings.confirmTitle')} message={pending ? t('settings.confirmEnableDebug') : t('settings.confirmDisableDebug')} confirmText="继续" onConfirm={confirm} onCancel={() => setShowConfirm(false)} />
    </ScreenCard>
  );
}

function AboutScreen() {
  const { t } = useI18n();
  return (
    <ScreenCard>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white font-bold shadow-md">S</div>
        <div>
          <div className="text-[15px] font-bold text-gray-900 dark:text-gray-100">SkyXing</div>
          <div className="text-xs text-gray-500">跨平台博客 · 全端同步</div>
        </div>
      </div>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <ExternalLink size={14} /> {t('settings.openSource')}
      </a>
      <div className="flex gap-2">
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><FileText size={13} /> 服务条款</a>
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><FileText size={13} /> 隐私政策</a>
      </div>
      <p className="text-center text-[11px] text-gray-400 mt-1">版本 v{APP_VERSION} · MIT License</p>
    </ScreenCard>
  );
}

function buildTree(t) {
  return [
    { key: 'personalize', label: t('settings.personalize'), icon: Palette, children: [
      { key: 'appearance', label: t('settings.appearance'), icon: Palette, children: [
        { key: 'language', label: t('settings.language'), icon: Languages, screen: LanguageScreen },
        { key: 'animation', label: t('settings.animation'), icon: Sparkles, screen: AnimationScreen },
        { key: 'theme', label: t('settings.theme'), icon: Sun, screen: ThemeScreen },
      ] },
    ] },
    { key: 'accountData', label: t('settings.accountData'), icon: RefreshCw, children: [
      { key: 'sync', label: t('settings.sync'), icon: RefreshCw, screen: SyncScreen },
      { key: 'manage', label: t('settings.account'), icon: Fingerprint, children: [
        { key: '2fa', label: t('settings.twoFactor'), icon: Fingerprint, screen: TwoFactorScreen },
        { key: 'delete', label: t('settings.deleteAccount'), icon: Trash2, screen: DeleteAccountScreen },
      ] },
    ] },
    { key: 'feedback', label: t('settings.feedback'), icon: MessageSquare, children: [
      { key: 'github', label: t('settings.githubFeedback'), icon: Github, screen: GithubFeedbackScreen },
      { key: 'inapp', label: t('settings.inAppFeedback'), icon: Send, screen: InAppFeedbackScreen },
    ] },
    { key: 'software', label: t('settings.software'), icon: Info, children: [
      { key: 'update', label: t('settings.update'), icon: Download, screen: UpdateScreen },
      { key: 'debug', label: t('settings.debug'), icon: Bug, screen: DebugScreen },
      { key: 'about', label: t('settings.about'), icon: Info, screen: AboutScreen },
    ] },
  ];
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { conflict } = useSync();
  const tree = buildTree(t);
  const [stack, setStack] = useState([{ title: t('settings.title'), items: tree, root: true }]);

  useEffect(() => {
    setStack((s) => {
      if (!s[0].root) return s;
      const next = s.slice();
      next[0] = { title: t('settings.title'), items: tree, root: true };
      return next;
    });
  }, [t, tree]);

  const current = stack[stack.length - 1];
  const goBack = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const onTap = (child) => {
    if (child.children) setStack((s) => [...s, { title: child.label, items: child.children }]);
    else if (child.screen) setStack((s) => [...s, { title: child.label, screen: child.screen }]);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        {!current.root && (
          <button onClick={goBack} className="p-2 -ml-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="返回">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{current.title}</h1>
          {current.root && <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>}
        </div>
      </div>

      {current.root && conflict && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">设置已在其他设备更新，已自动同步为最新状态。</div>
      )}

      {current.items && (
        <div className="space-y-2">
          {current.items.map((child) => {
            const Icon = child.icon;
            return (
              <button key={child.key} onClick={() => onTap(child)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                {Icon && <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shrink-0"><Icon size={16} /></span>}
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{child.label}</span>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {current.screen && (
        <div>
          <current.screen />
        </div>
      )}
    </div>
  );
}
