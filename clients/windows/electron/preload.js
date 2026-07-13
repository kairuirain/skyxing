const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getCacheInfo: () => ipcRenderer.invoke('get-cache-info'),
  getStartupConfig: () => ipcRenderer.invoke('get-startup-config'),
  setStartup: (enable) => ipcRenderer.invoke('set-startup', enable),

  // 事件监听
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
    return () => ipcRenderer.removeAllListeners('open-settings');
  },
  onCacheCleared: (callback) => {
    ipcRenderer.on('cache-cleared', () => callback());
    return () => ipcRenderer.removeAllListeners('cache-cleared');
  },
});
