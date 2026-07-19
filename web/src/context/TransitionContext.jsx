import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TransitionContext = createContext(null);

// 进入这些路由时不播放进入动画（特定界面无返回动画）
export const NO_ANIMATION_ROUTES = ['/login', '/register', '/link'];

export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState(null); // { rect, bg, radius, to }
  const originRectRef = useRef(null); // 启动动画来源的按钮位置（用于反向缩回）
  const outletElRef = useRef(null); // 当前页面容器，用于返回动画

  const registerOutlet = useCallback((el) => { outletElRef.current = el; }, []);

  // 由按钮点击触发：原按钮缓慢放大铺满，覆盖全屏后跳转目标页
  const launch = useCallback((event, to) => {
    const el = event && event.currentTarget;
    if (!el) {
      navigate(to, { state: { __noPageAnim: true } });
      return;
    }
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const bg =
      cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
        ? cs.backgroundColor
        : cs.backgroundImage && cs.backgroundImage !== 'none'
          ? cs.backgroundImage
          : 'linear-gradient(135deg,#fb7299,#00a1d6)';
    const radius = cs.borderRadius || '14px';
    originRectRef.current = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    setOverlay({ rect, bg, radius, to });
  }, [navigate]);

  const go = useCallback(
    (to, opts) => navigate(to, { ...opts, state: { ...(opts && opts.state), __noPageAnim: true } }),
    [navigate]
  );

  // 返回：当前页面反向缩回来源按钮位置（无来源时直接返回）
  const goBack = useCallback(() => {
    const el = outletElRef.current;
    const origin = originRectRef.current;
    if (el && origin) {
      const rect = el.getBoundingClientRect();
      const ix = origin.x + origin.w / 2;
      const iy = origin.y + origin.h / 2;
      const ox = ix - (rect.left + rect.width / 2);
      const oy = iy - (rect.top + rect.height / 2);
      const sx = origin.w / rect.width;
      const sy = origin.h / rect.height;
      el.style.transformOrigin = `${ix - rect.left}px ${iy - rect.top}px`;
      const anim = el.animate(
        [
          { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 },
          { transform: `translate(${ox}px,${oy}px) scale(${sx},${sy})`, opacity: 0.35 },
        ],
        { duration: 300, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'forwards' }
      );
      anim.onfinish = () => { originRectRef.current = null; navigate(-1); };
      return;
    }
    originRectRef.current = null;
    navigate(-1);
  }, [navigate]);

  return (
    <TransitionContext.Provider value={{ launch, go, goBack, registerOutlet }}>
      {children}
      <TransitionOverlay overlay={overlay} onDone={() => setOverlay(null)} navigate={navigate} />
    </TransitionContext.Provider>
  );
}

// 进入动画：以来源按钮的视觉（背景/圆角）从原位置放大铺满全屏
function TransitionOverlay({ overlay, onDone, navigate }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!overlay || !ref.current) return;
    const el = ref.current;
    const { rect, bg, radius, to } = overlay;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.max(vw / rect.width, vh / rect.height); // 恰好覆盖全屏

    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.background = bg;
    el.style.borderRadius = radius;

    const anim = el.animate(
      [
        { transform: 'scale(1)', borderRadius: radius, opacity: 1 },
        { transform: `scale(${scale})`, borderRadius: '0px', opacity: 1 },
      ],
      { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );

    anim.onfinish = () => {
      navigate(to, { state: { __noPageAnim: true } });
      setTimeout(() => {
        const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 200,
          easing: 'ease-out',
          fill: 'forwards',
        });
        fade.onfinish = () => onDone();
      }, 80);
    };
  }, [overlay, navigate, onDone]);

  if (!overlay) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[9000] will-change-transform pointer-events-none"
      style={{ transformOrigin: 'center' }}
    />
  );
}

export function useTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransition must be used within TransitionProvider');
  return ctx;
}
