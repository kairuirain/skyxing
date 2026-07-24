import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Palette, Download, MessageSquare, Send, Info, RefreshCw, Sun, Moon, ExternalLink, Check,
  Bug, Fingerprint, Trash2, Languages, Sparkles, ShieldCheck, ChevronRight, Github,
  FileText, AlertTriangle, ArrowLeft, Globe, Smartphone,
} from 'lucide-react';

const APP_VERSION = '2.0.1';
const PLATFORM = 'windows';
const ISSUES_URL = 'https://github.com/kairuirain/skyxing-app/issues/new';
const REPO_URL = 'https://github.com/kairuirain/skyxing-app';
const SITE_URL = 'https://skyxing.dpdns.org';
const TERMS_URL = 'https://skyxing.dpdns.org/terms.html';
const PRIVACY_URL = 'https://skyxing.dpdns.org/privacy.html';

function Seg({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ' +
              (active ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')}>
            {o.icon && <o.icon size={14} />}
            {o.label}
            {active && <Check size={13} />}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ active, onClick }) {
  return (
    <div className="relative">
      <input type="checkbox" className="sr-only peer" checked={active} onChange={onClick} />
      <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-primary-600 transition-colors
        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
        after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5" />
    </div>
  );
}

function ConfirmDialog({ open, title, message, confirmText, cancelText, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
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

function Card({ children, className = '' }) {
  return <div className={'bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 space-y-3 ' + className}>{children}</div>;
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-gray-900 font-medium dark:text-gray-100 break-all text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// ── 叶子屏幕（均自行读取 context，保证状态实时）──
function ThemeScreen() {
  const { settings, updateSetting } = useSettings();
  return (
    <Card>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">主题</p>
      <div className="flex items-center gap-3">
        {[{ key: 'light', label: '浅色', icon: Sun }, { key: 'dark', label: '深色', icon: Moon }].map((opt) => {
          const Icon = opt.icon;
          const active = (settings.theme || 'dark') === opt.key;
          return (
            <button key={opt.key} onClick={() => updateSetting('theme', opt.key)}
              className={'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ' +
                (active ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')}>
              <Icon size={16} /> {opt.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── 叶子屏幕：翻译（敬请期待）──
function TranslationScreen() {
  const { settings, updateSetting } = useSettings();
  const enabled = !!settings.translationEnabled;
  const displayMode = settings.translationDisplayMode || 'bilingual';
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult('');
    setTimeout(() => { setTestResult('翻译功能敬请期待'); setTesting(false); }, 800);
  };

  return (
    <div className="space-y-3">
      <Card>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">启用翻译</p>
            <p className="text-xs text-gray-500 mt-0.5">在文章等内容区域显示翻译按钮</p>
          </div>
          <Toggle active={enabled} onClick={() => updateSetting('translationEnabled', !enabled)} />
        </label>
      </Card>
      <Card className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">显示模式</p>
        <Seg value={displayMode} onChange={(v) => updateSetting('translationDisplayMode', v)} options={[
          { value: 'translated', label: '纯译文' },
          { value: 'bilingual', label: '双语对照' },
        ]} />
      </Card>
      <Card className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">服务测试</p>
        <p className="text-xs text-gray-500 mb-2">点击测试微软翻译服务是否可用</p>
        <button onClick={handleTest} disabled={testing}
          className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {testing ? '测试中...' : '测试翻译服务'}
        </button>
        {testResult && <p className="text-xs text-amber-600 mt-2">{testResult}</p>}
      </Card>
      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs text-center">
        翻译功能正在开发中，敬请期待！
      </div>
    </div>
  );
}

// ── 叶子屏幕：状态栏 ──
function StatusBarScreen() {
  const { settings, updateSetting } = useSettings();
  const enabled = settings.statusBarEnabled !== false;
  const height = (typeof settings.statusBarHeight === 'number' && settings.statusBarHeight >= 0 && settings.statusBarHeight <= 120) ? settings.statusBarHeight : 28;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--status-bar-padding', enabled ? height + 'px' : '0px');
  }, [enabled, height]);

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  return (
    <div className="space-y-3">
      {!isAndroid && (
        <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
          此设置主要影响 Android 设备。
        </div>
      )}
      <Card>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">状态栏适配</p>
            <p className="text-xs text-gray-500 mt-0.5">页面顶部留出状态栏安全区域</p>
          </div>
          <Toggle active={enabled} onClick={() => updateSetting('statusBarEnabled', !enabled)} />
        </label>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">状态栏高度</p>
            <p className="text-xs text-gray-500 mt-0.5">自定义状态栏占用高度</p>
          </div>
          <span className="text-base font-mono font-semibold text-primary-600">{height}px</span>
        </div>
        <input type="range" min={0} max={120} value={height}
          onChange={(e) => updateSetting('statusBarHeight', Number(e.target.value))}
          className="w-full accent-primary-600" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>0px</span>
          <span>28px</span>
          <span>60px</span>
          <span>120px</span>
        </div>
      </Card>
    </div>
  );
}

function AccountManageScreen({ onClose }) {
  const { user, logout } = useAuth();
  const handleLogout = () => { logout(); onClose(); window.location.href = '/'; };
  return (
    <Card>
      {user ? (
        <div className="space-y-1">
          <Link to={`/user/${user.id}`} onClick={onClose} className="flex items-center gap-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
            <Fingerprint size={18} /> 我的主页
          </Link>
          {user.role === 'admin' && (
            <Link to="/admin" onClick={onClose} className="flex items-center gap-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
              <ShieldCheck size={18} /> 管理后台
            </Link>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 py-2.5 text-sm text-red-600 hover:text-red-700">
            <Trash2 size={18} /> 退出登录
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">请先 <Link to="/login" onClick={onClose} className="text-primary-600 hover:underline">登录</Link> 以使用账号管理功能。</p>
      )}
    </Card>
  );
}

function GithubFeedbackScreen() {
  return (
    <Card>
      <p className="text-xs text-gray-500 mb-3">遇到问题或有建议？欢迎到 GitHub 提交 Issue。</p>
      <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-gray-700 dark:text-gray-200 font-medium text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <Github size={15} /> 前往 GitHub 提交反馈
      </a>
    </Card>
  );
}

function InAppFeedbackScreen() {
  const { api, user } = useAuth();
  const [type, setType] = useState('bug');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!message.trim()) { setError('请填写反馈内容'); return; }
    setSubmitting(true); setError('');
    try { await api.submitFeedback({ type, message: message.trim(), contact: contact.trim() }); setDone(true); }
    catch (err) { setError(err.message || '提交失败'); }
    finally { setSubmitting(false); }
  };
  if (done) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center"><Check size={24} className="text-green-500" /></div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">反馈已提交，感谢你的支持！</p>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5"><Send size={14} /> 反馈类型</p>
        <Seg value={type} onChange={setType} options={[{ value: 'bug', label: '问题反馈' }, { value: 'suggestion', label: '功能建议' }, { value: 'other', label: '其他' }]} />
      </div>
      <div className="mb-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">联系方式（选填）</p>
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={user ? user.username : ''} className="input" />
      </div>
      <div className="mb-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">反馈内容</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} placeholder="请描述你遇到的问题或建议……" className="input resize-none" />
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <button onClick={submit} disabled={submitting} className="btn-primary w-full disabled:opacity-50">{submitting ? '提交中...' : '提交反馈'}</button>
    </Card>
  );
}

function UpdateScreen() {
  const { settings, updateSetting } = useSettings();
  const { api } = useAuth();
  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });
  const channel = settings.updateChannel || 'stable';
  const source = settings.updateSource || 'github';
  const autoUpdate = settings.autoUpdate !== false;

  const checkUpdate = useCallback(async (ch = channel) => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try {
      const data = await api.checkUpdate(PLATFORM, APP_VERSION, ch);
      setUpdate((u) => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release }));
    } catch (e) { setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' })); }
  }, [api, channel]);

  useEffect(() => { if (autoUpdate) checkUpdate(); }, []);

  const handleDownload = () => {
    const dl = update.latest?.download;
    if (!dl) return;
    const url = source === 'ghfast' ? (dl.proxyUrl || dl.url) : dl.url;
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2"><Info size={15} /> <span>当前版本 v{APP_VERSION} · {channel === 'beta' ? '测试版' : '稳定版'}</span></div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">更新渠道</p>
        <Seg value={channel} onChange={(v) => { updateSetting('updateChannel', v); checkUpdate(v); }} options={[{ value: 'stable', label: '稳定版' }, { value: 'beta', label: '测试版' }]} />
      </Card>
      <Card>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">更新源</p>
        <Seg value={source} onChange={(v) => updateSetting('updateSource', v)} options={[{ value: 'github', label: '官方源 (GitHub)' }, { value: 'ghfast', label: '镜像源 (ghfast)' }]} />
      </Card>
      <Card>
        <label className="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">自动检查更新</span>
            <p className="text-xs text-gray-500 mt-0.5">启动时自动检测新版本</p>
          </div>
          <Toggle active={autoUpdate} onClick={() => updateSetting('autoUpdate', !autoUpdate)} />
        </label>
        <button onClick={() => checkUpdate()} disabled={update.checking}
          className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {update.checking ? '检查中...' : '检查更新'}
        </button>
        {update.error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">检查失败：{update.error}</div>}
        {update.checked && !update.error && !update.hasUpdate && <div className="text-sm text-green-600 bg-green-50 rounded-lg p-3">已是最新版本</div>}
        {update.hasUpdate && update.latest && (
          <div className="border border-primary-200 rounded-lg p-4 bg-primary-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">发现新版本 v{update.latest.version}</div>
              {update.latest.prerelease && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">预发布</span>}
            </div>
            <div className="text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">{update.latest.notes || '（无更新说明）'}</div>
            {update.latest.proxyApplied && <div className="text-xs text-primary-600">已启用下载加速代理，下载将自动走代理地址。</div>}
            <button onClick={handleDownload} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors">下载更新</button>
          </div>
        )}
      </Card>
    </div>
  );
}

function DebugScreen() {
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  const [confirmDebug, setConfirmDebug] = useState(false);
  const [pending, setPending] = useState(false);
  const debugMode = !!settings.debugMode;
  const onToggle = () => { setPending(!debugMode); setConfirmDebug(true); };
  const confirm = () => { updateSetting('debugMode', pending); setConfirmDebug(false); };
  const roleLabel = { user: '用户', admin: '管理员', official: '官方' };
  return (
    <Card>
      <label className="flex items-center justify-between py-1 cursor-pointer">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">终端界面显示</span>
          <p className="text-xs text-gray-500 mt-0.5">在窗口底部显示日志终端</p>
        </div>
        <Toggle active={!!settings.terminalOpen} onClick={() => updateSetting('terminalOpen', !settings.terminalOpen)} />
      </label>
      <label className="flex items-center justify-between py-1 cursor-pointer border-t border-gray-200 dark:border-gray-600">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">调试模式</span>
          <p className="text-xs text-gray-500 mt-0.5">输出详细调试日志</p>
        </div>
        <Toggle active={debugMode} onClick={onToggle} />
      </label>
      <div className="border-t border-gray-200 dark:border-gray-600 pt-3 text-sm">
        <Row label="用户 ID" value={user?.id || '—'} />
        <Row label="角色" value={user ? (roleLabel[user.role] || user.role) : '—'} />
        <Row label="登录状态" value={user ? '已登录' : '未登录'} />
      </div>
      <ConfirmDialog open={confirmDebug} title="请确认"
        message={pending ? '开启调试模式会输出详细日志，是否继续？' : '关闭调试模式后将不再输出详细日志，是否继续？'}
        confirmText="继续" onConfirm={confirm} onCancel={() => setConfirmDebug(false)} />
    </Card>
  );
}

function AboutScreen() {
  const { settings, clearCache, setStartup } = useSettings();
  const [cacheInfo, setCacheInfo] = useState({ cacheSize: 0, lastCleanTime: null });
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (window.electronAPI) window.electronAPI.getCacheInfo().then(setCacheInfo).catch(() => {});
  }, []);

  const formatSize = (bytes) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const handleClear = async () => {
    setClearing(true);
    try { await clearCache(); if (window.electronAPI) { const info = await window.electronAPI.getCacheInfo(); setCacheInfo(info); } } finally { setClearing(false); }
  };
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white font-bold shadow-md">S</div>
        <div>
          <div className="text-[15px] font-bold text-gray-900 dark:text-gray-100">SkyXing 桌面客户端</div>
          <div className="text-xs text-gray-500">版本 v{APP_VERSION}</div>
        </div>
      </div>
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <ExternalLink size={14} /> 访问网站
      </a>
      <div className="flex gap-2">
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><FileText size={13} /> 服务条款</a>
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><FileText size={13} /> 隐私政策</a>
      </div>
      <label className="flex items-center justify-between py-2 cursor-pointer border-t border-gray-200 dark:border-gray-600">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">开机自动启动</span>
          <p className="text-xs text-gray-500 mt-0.5">系统启动时自动运行 SkyXing</p>
        </div>
        <Toggle active={!!settings.startOnBoot} onClick={() => setStartup(!settings.startOnBoot)} />
      </label>
      <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">当前缓存大小</span>
          <span className="text-sm text-gray-900 dark:text-gray-100">{formatSize((cacheInfo?.cacheSize) || 0)}</span>
        </div>
        {cacheInfo?.lastCleanTime && <p className="text-xs text-gray-400 px-1">上次清理: {new Date(cacheInfo.lastCleanTime).toLocaleString('zh-CN')}</p>}
        <button onClick={handleClear} disabled={clearing}
          className="w-full mt-2 py-2.5 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {clearing ? '清理中...' : '清除缓存数据'}
        </button>
      </div>
    </Card>
  );
}

// ── L4 介绍屏幕 ──
function UpdateChannelIntro() {
  const { settings, updateSetting } = useSettings();
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white"><RefreshCw size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">更新渠道</p>
            <p className="text-xs text-gray-500">选择更新发布的渠道</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          更新渠道决定了你接收软件更新的版本类型。稳定版提供经过充分测试的正式版本；测试版提供最新的开发中版本，可优先体验新功能。
        </p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">当前设置</p>
        <Seg value={settings.updateChannel || 'stable'} onChange={(v) => updateSetting('updateChannel', v)} options={[
          { value: 'stable', label: '稳定版' }, { value: 'beta', label: '测试版' },
        ]} />
      </Card>
    </div>
  );
}
function UpdateSourceIntro() {
  const { settings, updateSetting } = useSettings();
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white"><Download size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">下载源</p>
            <p className="text-xs text-gray-500">选择下载来源</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          官方源直接从 GitHub 下载，适合海外用户。镜像源（ghfast）使用国内 CDN 加速，适合中国大陆地区用户。
        </p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">当前设置</p>
        <Seg value={settings.updateSource || 'github'} onChange={(v) => updateSetting('updateSource', v)} options={[
          { value: 'github', label: '官方源 (GitHub)' }, { value: 'ghfast', label: '镜像源 (ghfast)' },
        ]} />
      </Card>
    </div>
  );
}
function CheckUpdateIntro() {
  const { settings, updateSetting } = useSettings();
  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });
  const checkUpdate = useCallback(async () => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try { const data = await api.checkUpdate('windows', APP_VERSION, settings.updateChannel || 'stable'); setUpdate((u) => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release })); }
    catch (e) { setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' })); }
  }, []);
  useEffect(() => { checkUpdate(); }, [checkUpdate]);
  const handleDownload = () => {
    const dl = update.latest?.download;
    if (!dl) return;
    const url = (settings.updateSource || 'github') === 'ghfast' ? (dl.proxyUrl || dl.url) : dl.url;
    if (url) window.open(url, '_blank', 'noopener');
  };
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white"><Download size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">检查更新</p>
            <p className="text-xs text-gray-500">手动检查并安装新版本</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          点击下方按钮手动检查软件是否有新版本可用。如果有新版本，可以一键下载安装包进行升级。
        </p>
      </Card>
      <Card>
        <button onClick={() => checkUpdate()} disabled={update.checking}
          className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
          {update.checking ? '检查中...' : '检查更新'}
        </button>
        {update.hasUpdate && update.latest && (
          <div className="mt-3 border border-primary-200 rounded-lg p-4 bg-primary-50/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">新版本 v{update.latest.version} 可用</p>
            <button onClick={handleDownload} className="w-full py-1.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700">下载安装包</button>
          </div>
        )}
        {update.checked && !update.hasUpdate && !update.error && <p className="text-xs text-green-600 mt-3">已是最新版本</p>}
        {update.error && <p className="text-xs text-red-500 mt-3">{update.error}</p>}
      </Card>
    </div>
  );
}
function DebugLogIntro() {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white"><Bug size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">日志记录</p>
            <p className="text-xs text-gray-500">查看和导出应用运行日志</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">开启调试模式以记录更详细的日志，帮助开发团队快速定位和修复问题。</p>
      </Card>
    </div>
  );
}
function TerminalIntro() {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-500 to-gray-500 flex items-center justify-center text-white"><Bug size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">终端</p>
            <p className="text-xs text-gray-500">在应用内显示日志终端</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">终端面板可以在应用底部显示实时日志输出，方便监控应用运行状态。</p>
      </Card>
    </div>
  );
}
function DiagIntro() {
  const { user } = useAuth();
  const roleLabel = { user: '用户', admin: '管理员', official: '官方' };
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white"><Bug size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">调试信息</p>
            <p className="text-xs text-gray-500">查看当前应用的诊断信息</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">显示诊断信息，包括用户 ID、角色、登录状态等。</p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">当前诊断信息</p>
        <div className="text-sm space-y-2">
          <Row label="用户 ID" value={user?.id || '—'} />
          <Row label="角色" value={user ? (roleLabel[user.role] || user.role) : '—'} />
          <Row label="登录状态" value={user ? '已登录' : '未登录'} />
        </div>
      </Card>
    </div>
  );
}
function ResetIntro() {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white"><RefreshCw size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">重置</p>
            <p className="text-xs text-gray-500">恢复应用的默认设置</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">将所有本地设置恢复到默认状态，不会影响账号数据或已发布的文章。</p>
      </Card>
      <Card>
        <button onClick={() => { localStorage.removeItem('skyxing_settings'); location.reload(); }}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">
          恢复默认设置
        </button>
      </Card>
    </div>
  );
}
function BackendIntro() {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white"><Info size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">关于后端 (SkyXing)</p>
            <p className="text-xs text-gray-500">了解 SkyXing 后端服务</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">基于 Cloudflare Workers 构建，采用 Hono 框架和 KV 存储，部署在全球边缘节点。</p>
      </Card>
    </div>
  );
}
function TeamIntro() {
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#fb7299] to-[#00a1d6] flex items-center justify-center text-white"><Users size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">关于团队</p>
            <p className="text-xs text-gray-500">SkyXing 开发团队</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-center py-6">
          敬请期待 · 独立开发 · 暂无团队
        </p>
      </Card>
    </div>
  );
}

// ── 设置树（Windows）──
function buildTree(onClose) {
  return [
    { key: 'personalize', label: '个性化', icon: Palette, children: [
      { key: 'appearance', label: '外观', icon: Palette, children: [
        { key: 'theme', label: '主题', icon: Sun, screen: ThemeScreen },
      ] },
      { key: 'language', label: '语言', icon: Languages, children: [
        { key: 'lang', label: '语言', icon: Languages, screen: () => <div>语言设置</div> },
        { key: 'translation', label: '翻译', icon: Globe, screen: TranslationScreen },
      ] },
      { key: 'statusBar', label: '状态栏', icon: Smartphone, screen: StatusBarScreen },
    ] },
    { key: 'accountData', label: '账号数据', icon: RefreshCw, children: [
      { key: 'manage', label: '账号管理', icon: Fingerprint, children: [
        { key: 'account', label: '账号管理', icon: Fingerprint, screen: () => <AccountManageScreen onClose={onClose} /> },
      ] },
    ] },
    { key: 'feedback', label: '反馈', icon: MessageSquare, children: [
      { key: 'github', label: 'GitHub 反馈', icon: Github, screen: GithubFeedbackScreen },
      { key: 'inapp', label: '提交反馈', icon: Send, screen: InAppFeedbackScreen },
    ] },
    { key: 'software', label: '软件', icon: Info, children: [
      { key: 'update', label: '更新', icon: Download, children: [
        { key: 'channel', label: '更新渠道', icon: RefreshCw, screen: UpdateChannelIntro },
        { key: 'source', label: '下载源', icon: Download, screen: UpdateSourceIntro },
        { key: 'check', label: '检查更新', icon: Download, screen: CheckUpdateIntro },
      ] },
      { key: 'debug', label: '调试', icon: Bug, children: [
        { key: 'log', label: '日志记录', icon: Bug, screen: DebugLogIntro },
        { key: 'terminal', label: '终端', icon: Bug, screen: TerminalIntro },
        { key: 'diag', label: '调试信息', icon: Bug, screen: DiagIntro },
      ] },
      { key: 'about', label: '关于软件', icon: Info, children: [
        { key: 'reset', label: '重置', icon: RefreshCw, screen: ResetIntro },
        { key: 'backend', label: '关于后端 (SkyXing)', icon: Info, screen: BackendIntro },
        { key: 'app', label: '关于软件', icon: Info, screen: AboutScreen },
        { key: 'team', label: '关于团队', icon: Info, screen: TeamIntro },
      ] },
    ] },
  ];
}

export default function SettingsModal() {
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [stack, setStack] = useState([{ title: '设置', items: [], root: true }]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-settings-modal', handler);
    return () => window.removeEventListener('open-settings-modal', handler);
  }, []);

  // 打开时重置导航栈
  useEffect(() => {
    if (isOpen) setStack([{ title: '设置', items: buildTree(setIsOpen), root: true }]);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = stack[stack.length - 1];
  const goBack = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const onTap = (child) => {
    if (child.children) setStack((s) => [...s, { title: child.label, items: child.children }]);
    else if (child.screen) setStack((s) => [...s, { title: child.label, screen: child.screen }]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          {!current.root && (
            <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="返回">
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{current.title}</h2>
          <button onClick={() => setIsOpen(false)} className="ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-2 overflow-y-auto">
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
      </div>
    </div>
  );
}
