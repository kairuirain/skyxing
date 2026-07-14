import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const APP_VERSION = '1.1.0';
const PLATFORM = 'windows';

export default function SettingsModal() {
  const { settings, updateSetting, clearCache, setStartup } = useSettings();
  const { user, logout, api } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ cacheSize: 0, lastCleanTime: null });

  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-settings-modal', handler);
    return () => window.removeEventListener('open-settings-modal', handler);
  }, []);

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.getCacheInfo().then(setCacheInfo);
    }
  }, [isOpen]);

  // 打开时若开启自动检查更新，则自动检测一次
  useEffect(() => {
    if (isOpen && settings.autoUpdate) checkUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await clearCache();
      if (window.electronAPI) {
        const info = await window.electronAPI.getCacheInfo();
        setCacheInfo(info);
      }
    } finally {
      setClearing(false);
    }
  };

  const checkUpdate = async () => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try {
      const data = await api.checkUpdate(PLATFORM, APP_VERSION, settings.updateChannel || 'stable');
      setUpdate((u) => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release }));
    } catch (e) {
      setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' }));
    }
  };

  const handleDownload = () => {
    const url = update.latest?.download?.recommendedUrl || update.latest?.download?.url;
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    window.location.href = '/';
  };

  if (!isOpen) return null;

  const formatSize = (bytes) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const Toggle = ({ active, onClick }) => (
    <div className="relative">
      <input type="checkbox" className="sr-only peer" checked={active} onChange={onClick} />
      <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-primary-600 transition-colors
        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
        after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5" />
    </div>
  );

  const SectionTitle = ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-900 mb-3">{children}</h3>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">设置</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* 调试 */}
          <section>
            <SectionTitle>调试</SectionTitle>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-gray-700">终端界面显示</span>
                  <p className="text-xs text-gray-500 mt-0.5">在窗口底部显示日志终端</p>
                </div>
                <Toggle active={settings.terminalOpen} onClick={() => updateSetting('terminalOpen', !settings.terminalOpen)} />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-gray-700">主题选择（明暗）</span>
                  <p className="text-xs text-gray-500 mt-0.5">切换浅色 / 深色界面</p>
                </div>
                <Toggle active={settings.theme === 'dark'} onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark')} />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-gray-700">调试模式</span>
                  <p className="text-xs text-gray-500 mt-0.5">输出详细调试日志</p>
                </div>
                <Toggle active={settings.debugMode} onClick={() => updateSetting('debugMode', !settings.debugMode)} />
              </label>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">更新通道</span>
                  <p className="text-xs text-gray-500 mt-0.5">切换稳定版 / 测试版</p>
                </div>
                <div className="flex gap-1">
                  {['stable', 'beta'].map((ch) => (
                    <button
                      key={ch}
                      onClick={() => updateSetting('updateChannel', ch)}
                      className={
                        'px-3 py-1 rounded-md text-xs font-medium border transition-colors ' +
                        ((settings.updateChannel || 'stable') === ch
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50')
                      }
                    >
                      {ch === 'stable' ? '稳定版' : '测试版'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 更新 */}
          <section>
            <SectionTitle>更新</SectionTitle>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">当前版本</span>
                  <p className="text-xs text-gray-500 mt-0.5">v{APP_VERSION} · {settings.updateChannel === 'beta' ? '测试版' : '稳定版'}</p>
                </div>
              </div>
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-gray-700">自动检查更新</span>
                  <p className="text-xs text-gray-500 mt-0.5">启动时自动检测新版本</p>
                </div>
                <Toggle active={settings.autoUpdate !== false} onClick={() => updateSetting('autoUpdate', settings.autoUpdate === false ? true : false)} />
              </label>

              <button
                onClick={checkUpdate}
                disabled={update.checking}
                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {update.checking ? '检查中...' : '检查更新'}
              </button>

              {update.error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">检查失败：{update.error}</div>
              )}
              {update.checked && !update.error && !update.hasUpdate && (
                <div className="text-sm text-green-600 bg-green-50 rounded-lg p-3">已是最新版本</div>
              )}
              {update.hasUpdate && update.latest && (
                <div className="border border-primary-200 rounded-lg p-4 bg-primary-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">发现新版本 v{update.latest.version}</div>
                    {update.latest.prerelease && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">预发布</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {update.latest.notes || '（无更新说明）'}
                  </div>
                  {update.latest.proxyApplied && (
                    <div className="text-xs text-primary-600">已启用下载加速代理，下载将自动走代理地址。</div>
                  )}
                  <button
                    onClick={handleDownload}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    下载更新
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* 关于软件 */}
          <section className="pt-2 border-t border-gray-200">
            <SectionTitle>关于软件</SectionTitle>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">SkyXing 桌面客户端</span>
                  <p className="text-xs text-gray-500 mt-0.5">版本 v{APP_VERSION}</p>
                </div>
                <a href="https://skyxing.dpdns.org" target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700">
                  访问网站
                </a>
              </div>

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <span className="text-sm font-medium text-gray-700">开机自动启动</span>
                  <p className="text-xs text-gray-500 mt-0.5">系统启动时自动运行 SkyXing</p>
                </div>
                <Toggle active={settings.startOnBoot} onClick={() => setStartup(!settings.startOnBoot)} />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">当前缓存大小</span>
                    <p className="text-xs text-gray-500 mt-0.5">{formatSize(cacheInfo.cacheSize || 0)}</p>
                  </div>
                </div>
                {cacheInfo.lastCleanTime && (
                  <p className="text-xs text-gray-400 px-1">上次清理: {new Date(cacheInfo.lastCleanTime).toLocaleString('zh-CN')}</p>
                )}
                <button
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearing ? '清理中...' : '清除缓存数据'}
                </button>
              </div>

              {user && (
                <div className="pt-1 border-t border-gray-100 space-y-1">
                  <Link to={`/user/${user.id}`} onClick={() => setIsOpen(false)} className="flex items-center gap-3 py-2.5 text-sm text-gray-700 hover:text-gray-900">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    我的主页
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setIsOpen(false)} className="flex items-center gap-3 py-2.5 text-sm text-gray-700 hover:text-gray-900">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      管理后台
                    </Link>
                  )}
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 py-2.5 text-sm text-red-600 hover:text-red-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
