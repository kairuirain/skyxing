import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DEFAULTS = {
  startOnBoot: false,
  autoUpdate: true,
  cacheSize: 0,
  lastCleanTime: null,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI) {
          const electronSettings = await window.electronAPI.getSettings();
          setSettings(prev => ({ ...prev, ...electronSettings }));
        }
      } catch { /* use defaults */ }
      setLoaded(true);
    })();

    // 监听菜单"设置"点击
    if (window.electronAPI) {
      const unsub = window.electronAPI.onOpenSettings(() => {
        window.dispatchEvent(new CustomEvent('open-settings-modal'));
      });
      return () => { if (unsub) unsub(); };
    }
  }, []);

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (window.electronAPI) {
        window.electronAPI.setSetting(key, value);
      }
      return next;
    });
  }, []);

  const clearCache = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.clearCache();
        if (result.success) {
          setSettings(prev => ({
            ...prev,
            cacheSize: 0,
            lastCleanTime: new Date().toISOString(),
          }));
        }
        return result;
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const setStartup = useCallback(async (enable) => {
    if (window.electronAPI) {
      await window.electronAPI.setStartup(enable);
      setSettings(prev => ({ ...prev, startOnBoot: enable }));
    }
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings, loaded, updateSetting, clearCache, setStartup,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
