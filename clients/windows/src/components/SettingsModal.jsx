import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export default function SettingsModal() {
  const { settings, updateSetting, clearCache, setStartup } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ cacheSize: 0, lastCleanTime: null });

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

  if (!isOpen) return null;

  const formatSize = (bytes) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setIsOpen(false)}
      />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">软件设置</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 设置项 */}
        <div className="p-6 space-y-6">
          {/* 启动项 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">启动项</h3>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <span className="text-sm font-medium text-gray-700">开机自动启动</span>
                <p className="text-xs text-gray-500 mt-0.5">系统启动时自动运行 SkyXing</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.startOnBoot || false}
                  onChange={(e) => setStartup(e.target.checked)}
                />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-primary-600 transition-colors
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
                  after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5"
                />
              </div>
            </label>
          </div>

          {/* 缓存管理 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">缓存管理</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">当前缓存大小</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatSize(cacheInfo.cacheSize || 0)}
                  </p>
                </div>
              </div>
              {cacheInfo.lastCleanTime && (
                <p className="text-xs text-gray-400 px-1">
                  上次清理: {new Date(cacheInfo.lastCleanTime).toLocaleString('zh-CN')}
                </p>
              )}
              <button
                onClick={handleClearCache}
                disabled={clearing}
                className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium
                  hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? '清理中...' : '清除缓存数据'}
              </button>
            </div>
          </div>

          {/* 自动更新 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">更新</h3>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <span className="text-sm font-medium text-gray-700">自动检查更新</span>
                <p className="text-xs text-gray-500 mt-0.5">启动时自动检查新版本</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.autoUpdate !== false}
                  onChange={(e) => updateSetting('autoUpdate', e.target.checked)}
                />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-primary-600 transition-colors
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full
                  after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5"
                />
              </div>
            </label>
          </div>

          {/* 关于 */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">SkyXing 桌面客户端</span>
                <p className="text-xs text-gray-500 mt-0.5">版本 1.0.0</p>
              </div>
              <a
                href="https://skyxing.dpdns.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                访问网站
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
