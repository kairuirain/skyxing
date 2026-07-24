import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { useAnimation } from '../context/AnimationContext';
import { useSync } from '../context/SyncContext';
import api from '../lib/api';
import {
  Palette, Languages, Sparkles, Sun, Moon, Globe, Smartphone, Settings,
  RefreshCw, Fingerprint, Trash2, MessageSquare, Send, Github,
  Download, Bug, Info, ArrowLeft, ChevronRight, ShieldCheck, ExternalLink, Check, Users,
} from 'lucide-react';

const APP_VERSION = '__APP_VERSION__';
const REPO_URL = 'https://github.com/kairuirain/skyxing-app';
const ISSUES_URL = 'https://github.com/kairuirain/skyxing-app/issues/new';

// ── helpers ──
function Toggle({ checked, onChange, disabled }) {
  return <label className={`sk-toggle ${disabled ? 'opacity-40 pointer-events-none' : ''}`}><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} /><span className="sk-toggle-track" /><span className="sk-toggle-thumb" /></label>;
}
function Seg({ value, onChange, options }) {
  return <div className="sk-seg">{options.map(o => <button key={o.value} onClick={() => onChange(o.value)} className={`sk-seg-item ${value === o.value ? 'active' : ''}`}>{o.label}</button>)}</div>;
}
function Confirm({ open, title, msg, onConfirm, onCancel }) {
  if (!open) return null;
  return <div className="sk-modal-overlay" onClick={onCancel}><div className="sk-modal" onClick={e => e.stopPropagation()}><div className="sk-modal-header"><h3 className="font-semibold text-[var(--text)]">{title}</h3></div><div className="sk-modal-body"><p className="text-sm text-[var(--text-secondary)] mb-4">{msg}</p><div className="flex gap-2"><button onClick={onConfirm} className="sk-btn sk-btn-primary flex-1">确认</button><button onClick={onCancel} className="sk-btn sk-btn-outline flex-1">取消</button></div></div></div></div>;
}
function Row({ label, value }) { return <div className="flex justify-between text-xs"><span className="text-[var(--text-tertiary)]">{label}</span><span className="font-medium text-[var(--text)]">{value}</span></div>; }

// ── Leaf screens ──
function LanguageScreen() {
  const { t, lang, setLang } = useI18n();
  const { pushSettings } = useSync();
  const handle = (v) => { setLang(v); pushSettings({ language: v }).catch(() => {}); };
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">选择界面显示语言</p><Seg value={lang} onChange={handle} options={[{ value: 'zh-CN', label: '简体中文' }, { value: 'en', label: 'English' }]} /></div>;
}
function AnimationScreen() {
  const { animationMode, setAnimationMode } = useAnimation();
  const { pushSettings } = useSync();
  const handle = (v) => { setAnimationMode(v); pushSettings({ animationMode: v }).catch(() => {}); };
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">控制界面动画强度</p><Seg value={animationMode} onChange={handle} options={[{ value: 'minimal', label: '极简' }, { value: 'normal', label: '标准' }, { value: 'rich', label: '丰富' }]} /></div>;
}
function ThemeScreen() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">选择界面配色</p><Seg value={theme} onChange={toggleTheme} options={[{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]} /></div>;
}
function TranslationScreen() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('bilingual');
  const [testResult, setTestResult] = useState('');
  const handleTest = () => { setTestResult(''); setTimeout(() => setTestResult(t('settings.translationComingSoon')), 800); };
  return (
    <div className="space-y-3">
      <div className="sk-card p-4"><label className="flex items-center justify-between cursor-pointer"><div><p className="text-sm font-medium text-[var(--text)]">{t('settings.translationToggle')}</p><p className="text-xs text-[var(--text-tertiary)]">{t('settings.translationToggleDesc')}</p></div><Toggle checked={enabled} onChange={() => setEnabled(!enabled)} disabled /></label></div>
      <div className={`sk-card p-4 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}><p className="text-xs text-[var(--text-secondary)] mb-2">{t('settings.translationDisplay')}</p><Seg value={mode} onChange={setMode} options={[{ value: 'translated', label: t('settings.translationDisplayTrans') }, { value: 'bilingual', label: t('settings.translationDisplayBilingual') }]} /></div>
      <div className={`sk-card p-4 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}><p className="text-xs text-[var(--text-secondary)] mb-1">{t('settings.translationTest')}</p><button onClick={handleTest} className="sk-btn sk-btn-outline sk-btn-sm w-full mt-2">测试</button>{testResult && <p className="text-xs text-amber-600 mt-2">{testResult}</p>}</div>
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs text-center dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">{t('settings.translationComingSoon')}</div>
    </div>
  );
}
function StatusBarScreen() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem('sk_statusbar') || '{}').enabled !== false; } catch { return true; } });
  const [height, setHeight] = useState(() => { try { const v = JSON.parse(localStorage.getItem('sk_statusbar') || '{}').height; return (typeof v === 'number' && v >= 0 && v <= 120) ? v : 28; } catch { return 28; } });
  useEffect(() => { document.documentElement.style.setProperty('--status-bar-padding', enabled ? height + 'px' : '0px'); try { localStorage.setItem('sk_statusbar', JSON.stringify({ enabled, height })); } catch {} }, [enabled, height]);
  return (
    <div className="space-y-3">
      <div className="sk-card p-4"><label className="flex items-center justify-between cursor-pointer"><div><p className="text-sm font-medium text-[var(--text)]">{t('settings.statusBarToggle')}</p><p className="text-xs text-[var(--text-tertiary)]">{t('settings.statusBarToggleDesc')}</p></div><Toggle checked={enabled} onChange={() => setEnabled(!enabled)} /></label></div>
      <div className="sk-card p-4"><div className="flex items-center justify-between mb-2"><p className="text-sm font-medium text-[var(--text)]">{t('settings.statusBarHeight')}</p><span className="font-mono font-semibold text-[var(--accent)]">{height}px</span></div><input type="range" min={0} max={120} value={height} onChange={e => setHeight(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
    </div>
  );
}
function SyncScreen() {
  const { t } = useI18n();
  const { syncNow, syncing } = useSync();
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">手动触发跨端数据同步</p><button onClick={syncNow} disabled={syncing} className="sk-btn sk-btn-primary sk-btn-sm">{syncing ? '同步中...' : t('settings.syncNow')}</button></div>;
}
function TwoFactorScreen() {
  const { t, user } = useAuth();
  const { pushSettings } = useSync();
  const [showConfirm, setShowConfirm] = useState(false);
  const handle = async () => {
    try { await api.disable2FA(); pushSettings({ totpEnabled: false }).catch(() => {}); alert('双重验证已关闭'); } catch (e) { alert(e.message); }
    setShowConfirm(false);
  };
  return (
    <div className="space-y-3">
      <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-2">双重验证（2FA）状态</p><p className={`text-sm font-semibold ${user?.totpEnabled ? 'text-green-600' : 'text-[var(--text-tertiary)]'}`}>{user?.totpEnabled ? '已启用' : '未启用'}</p></div>
      {user?.totpEnabled && (
        <div className="sk-card p-4">
          <p className="text-sm text-[var(--text-secondary)] mb-3">关闭双重验证后，登录只需密码。</p>
          <button onClick={() => setShowConfirm(true)} className="sk-btn sk-btn-danger sk-btn-sm">关闭双重验证</button>
        </div>
      )}
      <Confirm open={showConfirm} title={t('settings.confirmTitle')} msg={t('settings.confirmDisable2FA')} onConfirm={handle} onCancel={() => setShowConfirm(false)} />
    </div>
  );
}
function DeleteAccountScreen() {
  const { t, logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const handle = async () => {
    try { await api.deleteAccount(); await logout(); navigate('/'); } catch (e) { alert(e.message); }
    setShowConfirm(false);
  };
  return (
    <div className="space-y-3">
      <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">注销账号将永久删除所有数据，此操作不可撤销。</p><button onClick={() => setShowConfirm(true)} className="sk-btn sk-btn-danger sk-btn-sm">注销账号</button></div>
      <Confirm open={showConfirm} title={t('settings.confirmTitle')} msg={t('settings.confirmDeleteAccount')} onConfirm={handle} onCancel={() => setShowConfirm(false)} />
    </div>
  );
}
function GithubFeedbackScreen() {
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">在 GitHub Issues 提交反馈或建议。</p><a href={ISSUES_URL} target="_blank" rel="noopener" className="sk-btn sk-btn-outline sk-btn-sm inline-flex"><Github size={15} className="mr-1" /> GitHub Issues</a></div>;
}
function InAppFeedbackScreen() {
  const { t } = useI18n();
  const [type, setType] = useState('other');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const submit = async () => {
    if (!message.trim()) { setResult('请填写反馈内容'); return; }
    setSending(true); setResult('');
    try { const d = await api.submitFeedback({ type, message: message.trim(), contact: contact.trim() }); setResult(d.message || '提交成功'); setMessage(''); setContact(''); }
    catch (e) { setResult(e.message); }
    finally { setSending(false); }
  };
  return (
    <div className="sk-card p-4 space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">直接向我们发送反馈。</p>
      <Seg value={type} onChange={setType} options={[{ value: 'bug', label: '问题' }, { value: 'suggestion', label: '建议' }, { value: 'other', label: '其他' }]} />
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="描述你的问题或建议..." className="sk-input resize-none" />
      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="联系方式（选填）" className="sk-input" />
      <button onClick={submit} disabled={sending} className="sk-btn sk-btn-primary w-full">{sending ? '提交中...' : '提交反馈'}</button>
      {result && <p className="text-xs text-center text-[var(--text-secondary)]">{result}</p>}
    </div>
  );
}
function UpdateChannelScreen() {
  const [channel, setChannel] = useState(() => { try { return JSON.parse(localStorage.getItem('skyxing_settings') || '{}').updateChannel || 'stable'; } catch { return 'stable'; } });
  const save = (v) => { setChannel(v); try { const s = JSON.parse(localStorage.getItem('skyxing_settings') || '{}'); s.updateChannel = v; localStorage.setItem('skyxing_settings', JSON.stringify(s)); } catch {} };
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">稳定版经过充分测试，测试版包含最新功能但可能存在缺陷。</p><Seg value={channel} onChange={save} options={[{ value: 'stable', label: '稳定版' }, { value: 'beta', label: '测试版' }]} /></div>;
}
function UpdateSourceScreen() {
  const [source, setSource] = useState(() => { try { return JSON.parse(localStorage.getItem('skyxing_settings') || '{}').updateSource || 'github'; } catch { return 'github'; } });
  const save = (v) => { setSource(v); try { const s = JSON.parse(localStorage.getItem('skyxing_settings') || '{}'); s.updateSource = v; localStorage.setItem('skyxing_settings', JSON.stringify(s)); } catch {} };
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">官方源从 GitHub 下载，镜像源（ghfast）使用国内 CDN 加速。</p><Seg value={source} onChange={save} options={[{ value: 'github', label: '官方源 (GitHub)' }, { value: 'ghfast', label: '镜像源 (ghfast)' }]} /></div>;
}
function CheckUpdateScreen() {
  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });
  const check = async () => {
    setUpdate(u => ({ ...u, checking: true }));
    try { const data = await api.checkUpdate('web', APP_VERSION, 'stable'); setUpdate(u => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release })); }
    catch (e) { setUpdate(u => ({ ...u, checking: false, error: e.message })); }
  };
  useEffect(() => { check(); }, []);
  return (
    <div className="sk-card p-4 space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">手动检查新版本。</p>
      <button onClick={check} disabled={update.checking} className="sk-btn sk-btn-primary sk-btn-sm w-full">{update.checking ? '检查中...' : '检查更新'}</button>
      {update.hasUpdate && <div className="p-3 rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">新版本 v{update.latest.version} 可用</div>}
      {update.checked && !update.hasUpdate && !update.error && <p className="text-xs text-green-600">已是最新版本</p>}
      {update.error && <p className="text-xs text-red-500">{update.error}</p>}
    </div>
  );
}
function DebugScreen() {
  const [debugMode, setDebugMode] = useState(() => { try { return JSON.parse(localStorage.getItem('skyxing_settings') || '{}').debugMode || false; } catch { return false; } });
  const toggle = () => { const n = !debugMode; setDebugMode(n); try { const s = JSON.parse(localStorage.getItem('skyxing_settings') || '{}'); s.debugMode = n; localStorage.setItem('skyxing_settings', JSON.stringify(s)); } catch {} };
  return <div className="sk-card p-4"><label className="flex items-center justify-between cursor-pointer"><span className="text-sm text-[var(--text)]">调试模式</span><Toggle checked={debugMode} onChange={toggle} /></label></div>;
}
function DiagScreen() {
  const { user } = useAuth();
  return <div className="sk-card p-4"><p className="text-sm font-medium text-[var(--text)] mb-3">诊断信息</p><div className="space-y-2"><Row label="用户ID" value={user?.id || '—'} /><Row label="角色" value={user ? ({ user: '用户', admin: '管理员', official: '官方' }[user.role] || user.role) : '—'} /><Row label="版本" value={APP_VERSION} /></div></div>;
}
function ResetScreen() {
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">恢复所有本地设置到默认状态。</p><button onClick={() => { localStorage.removeItem('skyxing_settings'); window.location.reload(); }} className="sk-btn sk-btn-danger sk-btn-sm">恢复默认</button></div>;
}
function BackendScreen() {
  return <div className="sk-card p-4"><p className="text-sm text-[var(--text-secondary)] mb-3">基于 Cloudflare Workers + Hono + KV 构建。</p><div className="space-y-1.5"><Row label="架构" value="Cloudflare Workers" /><Row label="存储" value="Workers KV" /><Row label="版本" value={APP_VERSION} /></div></div>;
}
function AboutScreen() {
  return <div className="sk-card p-4"><div className="text-center"><p className="font-bold text-lg text-[var(--text)]">SkyXing</p><p className="text-xs text-[var(--text-tertiary)]">跨平台博客系统</p><p className="text-xs text-[var(--text-tertiary)] mt-2">版本 v{APP_VERSION}</p><div className="mt-3 flex justify-center gap-2"><a href={REPO_URL} target="_blank" rel="noopener" className="sk-btn sk-btn-ghost sk-btn-sm"><Github size={14} /></a></div></div></div>;
}
function TeamScreen() {
  return <div className="sk-card p-4 text-center"><p className="text-sm text-[var(--text-secondary)] py-6">敬请期待 · 独立开发 · 暂无团队</p></div>;
}

// ── Tree ──
function buildTree(t) {
  return [
    { key: 'personalize', label: t('settings.personalize'), icon: Palette, children: [
      { key: 'appearance', label: t('settings.appearance'), icon: Palette, children: [
        { key: 'animation', label: t('settings.animation'), icon: Sparkles, screen: AnimationScreen },
        { key: 'theme', label: t('settings.theme'), icon: Sun, screen: ThemeScreen },
      ]},
      { key: 'language', label: t('settings.language'), icon: Languages, children: [
        { key: 'lang', label: t('settings.language'), icon: Languages, screen: LanguageScreen },
        { key: 'translation', label: t('settings.translation'), icon: Globe, screen: TranslationScreen },
      ]},
      { key: 'statusBar', label: t('settings.statusBar'), icon: Smartphone, screen: StatusBarScreen },
    ]},
    { key: 'accountData', label: t('settings.accountData'), icon: RefreshCw, children: [
      { key: 'sync', label: t('settings.sync'), icon: RefreshCw, screen: SyncScreen },
      { key: 'manage', label: t('settings.account'), icon: Fingerprint, children: [
        { key: '2fa', label: t('settings.twoFactor'), icon: Fingerprint, screen: TwoFactorScreen },
        { key: 'delete', label: t('settings.deleteAccount'), icon: Trash2, screen: DeleteAccountScreen },
      ]},
    ]},
    { key: 'feedback', label: t('settings.feedback'), icon: MessageSquare, children: [
      { key: 'github', label: t('settings.githubFeedback'), icon: Github, screen: GithubFeedbackScreen },
      { key: 'inapp', label: t('settings.inAppFeedback'), icon: Send, screen: InAppFeedbackScreen },
    ]},
    { key: 'software', label: t('settings.software'), icon: Info, children: [
      { key: 'update', label: t('settings.update'), icon: Download, children: [
        { key: 'channel', label: t('settings.updateChannel'), icon: RefreshCw, screen: UpdateChannelScreen },
        { key: 'source', label: t('settings.updateSource'), icon: Download, screen: UpdateSourceScreen },
        { key: 'check', label: '检查更新', icon: Download, screen: CheckUpdateScreen },
      ]},
      { key: 'debug', label: t('settings.debug'), icon: Bug, children: [
        { key: 'log', label: '日志记录', icon: Bug, screen: DebugScreen },
        { key: 'terminal', label: '终端', icon: Bug, screen: DebugScreen },
        { key: 'diag', label: '调试信息', icon: Bug, screen: DiagScreen },
      ]},
      { key: 'about', label: t('settings.about'), icon: Info, children: [
        { key: 'reset', label: '重置', icon: RefreshCw, screen: ResetScreen },
        { key: 'backend', label: '关于后端 (SkyXing)', icon: Info, screen: BackendScreen },
        { key: 'app', label: '关于软件', icon: Info, screen: AboutScreen },
        { key: 'team', label: '关于团队', icon: Info, screen: TeamScreen },
      ]},
    ]},
  ];
}

// ── Navigator ──
export default function SettingsPage() {
  const { t } = useI18n();
  const [stack, setStack] = useState([{ root: true, items: buildTree(t) }]);
  const current = stack[stack.length - 1];
  const goBack = () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  const onTap = (child) => {
    if (child.children) setStack(s => [...s, { title: child.label, items: child.children }]);
    else if (child.screen) setStack(s => [...s, { title: child.label, screen: child.screen }]);
  };

  return (
    <div className="sk-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {!current.root && <button onClick={goBack} className="sk-btn sk-btn-ghost sk-btn-sm"><ArrowLeft size={18} /></button>}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white"><Settings size={20} /></div>
        <div><h1 className="text-xl font-bold text-[var(--text)]">{current.root ? t('nav.settings') : current.title}</h1></div>
      </div>

      {/* List */}
      {current.items && (
        <div className="space-y-2 animate-fadeInUp">
          {current.items.map(child => {
            const Icon = child.icon;
            return (
              <button key={child.key} onClick={() => onTap(child)} className="w-full flex items-center gap-3 px-4 py-3 sk-card sk-card-hover text-left">
                {Icon && <span className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] shrink-0"><Icon size={16} /></span>}
                <span className="flex-1 text-sm font-medium text-[var(--text)] truncate">{child.label}</span>
                <ChevronRight size={16} className="text-[var(--text-tertiary)] shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Leaf */}
      {current.screen && (
        <div className="animate-fadeInUp">
          <current.screen />
        </div>
      )}
    </div>
  );
}
