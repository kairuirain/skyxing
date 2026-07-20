import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AnimationContext = createContext(null);

export const ANIM_MODES = ['minimal', 'normal', 'rich'];

/**
 * 动画模式与调试开关（需求 6 / 13）
 * - minimal：最简动效（基本仅淡入淡出）
 * - normal：一般模式（默认）
 * - rich：高级模式（更丰富动效）
 * 通过在 <html> 设置 data-anim 属性，由 CSS 全局控制动效强度。
 */
export function AnimationProvider({ children }) {
  const [animationMode, setAnimationModeState] = useState(() => {
    try {
      const v = localStorage.getItem('skyxing_anim');
      return ANIM_MODES.includes(v) ? v : 'normal';
    } catch { return 'normal'; }
  });
  const [debugEnabled, setDebugEnabledState] = useState(() => {
    try { return localStorage.getItem('skyxing_debug') === '1'; } catch { return false; }
  });

  const setAnimationMode = useCallback((m) => {
    if (!ANIM_MODES.includes(m)) return;
    setAnimationModeState(m);
    try { localStorage.setItem('skyxing_anim', m); } catch { /* ignore */ }
  }, []);

  const setDebugEnabled = useCallback((v) => {
    setDebugEnabledState(v);
    try { localStorage.setItem('skyxing_debug', v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.anim = animationMode;
  }, [animationMode]);

  return (
    <AnimationContext.Provider value={{ animationMode, setAnimationMode, debugEnabled, setDebugEnabled }}>
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimation() {
  const ctx = useContext(AnimationContext);
  if (!ctx) throw new Error('useAnimation must be used within AnimationProvider');
  return ctx;
}
