import { useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 30000;

export default function useSync(api, onRefresh, options = {}) {
  const { interval = POLL_INTERVAL, enabled = true } = options;
  const lastVersion = useRef(0);
  const intervalRef = useRef(null);

  const checkVersion = useCallback(async () => {
    try {
      const data = await api.getStateVersion();
      const newVersion = data.version;
      if (lastVersion.current > 0 && newVersion !== lastVersion.current) {
        onRefresh();
      }
      lastVersion.current = newVersion;
    } catch { /* ignore */ }
  }, [api, onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    checkVersion();
    intervalRef.current = setInterval(checkVersion, interval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [enabled, interval, checkVersion]);

  return { forceCheck: checkVersion };
}
