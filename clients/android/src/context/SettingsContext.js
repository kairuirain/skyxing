import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULTS = {
  fontSize: 'medium',        // small | medium | large
  imageQuality: 'auto',       // low | auto | high
  offlineCache: true,
  cacheSize: 0,               // bytes
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('skyxing_settings');
        if (stored) {
          setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch { /* use defaults */ }
      setLoaded(true);
    })();
  }, []);

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem('skyxing_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCache = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
    await updateSetting('cacheSize', 0);
  }, [updateSetting]);

  const getCacheSize = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('cache_'));
      let totalSize = 0;
      for (const key of cacheKeys) {
        const val = await AsyncStorage.getItem(key);
        if (val) totalSize += new Blob([val]).size;
      }
      await updateSetting('cacheSize', totalSize);
      return totalSize;
    } catch {
      return 0;
    }
  }, [updateSetting]);

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSetting, clearCache, getCacheSize }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
