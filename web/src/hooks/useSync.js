import { useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

const POLL_INTERVAL = 30000; // 30s

/**
 * useSync — 轻量实时同步 Hook
 * 基于轮询 + 可见性检测，当后端版本号变化时触发 refetch
 *
 * @param {Function} onRefresh - 版本号变化时回调（如 refetch 数据）
 * @param {Object} options
 * @param {number} options.interval - 轮询间隔（毫秒），默认 30000
 * @param {boolean} options.enabled - 是否启用，默认 true
 */
export default function useSync(onRefresh, options = {}) {
  const { interval = POLL_INTERVAL, enabled = true } = options;
  const lastVersion = useRef(0);
  const intervalRef = useRef(null);

  const checkVersion = useCallback(async () => {
    try {
      const data = await api.getStateVersion();
      const newVersion = data.version;

      if (lastVersion.current > 0 && newVersion !== lastVersion.current) {
        // 版本号变化，触发刷新
        onRefresh();
      }
      lastVersion.current = newVersion;
    } catch {
      // 忽略网络错误，下次重试
    }
  }, [onRefresh]);

  // 启动轮询
  useEffect(() => {
    if (!enabled) return;

    // 首次启动时获取版本号
    checkVersion();

    intervalRef.current = setInterval(checkVersion, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, checkVersion]);

  // 页面可见性变化时立即检查
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, checkVersion]);

  return { forceCheck: checkVersion };
}
