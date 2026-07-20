import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import { useAnimation } from './AnimationContext';

const SyncContext = createContext(null);

/**
 * 数据同步与通知一致性（需求 13）
 * - 登录后拉取最新设置/通知状态；
 * - 定时轮询 /sync/version，版本变化时重新拉取（增量同步，仅传输变更）；
 * - 关键操作（改设置、标记已读）即时上报，冲突时以后端为准并提示。
 */
export function SyncProvider({ children }) {
  const { user } = useAuth();
  const { setLang } = useI18n();
  const { setAnimationMode, setDebugEnabled } = useAnimation();

  const [version, setVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const versionRef = useRef(0);
  const timerRef = useRef(null);

  const applySettings = useCallback((settings) => {
    if (!settings) return;
    if (settings.language) setLang(settings.language);
    if (settings.animationMode) setAnimationMode(settings.animationMode);
    if (settings.debugEnabled !== undefined) setDebugEnabled(settings.debugEnabled);
  }, [setLang, setAnimationMode, setDebugEnabled]);

  const pull = useCallback(async () => {
    const data = await api.getSync();
    versionRef.current = data.version;
    setVersion(data.version);
    applySettings(data.settings);
    return data;
  }, [applySettings]);

  // 登录后拉取 + 每 15s 轻量轮询
  useEffect(() => {
    if (!user) {
      versionRef.current = 0;
      setVersion(0);
      return undefined;
    }
    let active = true;
    pull().catch(() => {});
    timerRef.current = setInterval(async () => {
      try {
        const r = await api.getSyncVersion(versionRef.current);
        if (!active) return;
        if (r.changed) pull().catch(() => {});
      } catch { /* ignore */ }
    }, 15000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, pull]);

  const pushSettings = useCallback(async (partial) => {
    setSyncing(true);
    setConflict(false);
    try {
      const res = await api.putSync({ baseVersion: versionRef.current, settings: partial });
      versionRef.current = res.version;
      setVersion(res.version);
      applySettings(res.settings);
      return res;
    } catch (e) {
      if (e.message === 'conflict') {
        setConflict(true);
        await pull();
      }
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [applySettings, pull]);

  const markNotifications = useCallback(async (readIds, unreadIds) => {
    try {
      const res = await api.putSync({ baseVersion: versionRef.current, readIds, unreadIds });
      versionRef.current = res.version;
      setVersion(res.version);
    } catch (e) {
      if (e.message === 'conflict') await pull();
    }
  }, [pull]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try { await pull(); } catch { /* ignore */ }
    finally { setSyncing(false); }
  }, [pull]);

  return (
    <SyncContext.Provider value={{ version, syncing, conflict, pull, pushSettings, markNotifications, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
