import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TransitionContext = createContext(null);

export const NO_ANIMATION_ROUTES = ['/login', '/register', '/link'];

export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState(null);
  const originRectRef = useRef(null);
  const outletElRef = useRef(null);

  const registerOutlet = useCallback((el) => { outletElRef.current = el; }, []);

  const launch = useCallback((event, to) => {
    const el = event && event.currentTarget;
    if (!el) {
      navigate(to, { state: { __noPageAnim: true } });
      return;
    }
    const rect = el.getBoundingClientRect();
    originRectRef.current = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    setOverlay({ rect, to });
  }, [navigate]);

  const go = useCallback(
    (to, opts) => navigate(to, { ...opts, state: { ...(opts && opts.state), __noPageAnim: true } }),
    [navigate]
  );

  const goBack = useCallback(() => {
    const el = outletElRef.current;
    const origin = originRectRef.current;
    if (el && origin) {
      const r = el.getBoundingClientRect();
      const ix = origin.x + origin.w / 2;
      const iy = origin.y + origin.h / 2;
      const scrollParent = el.closest('[class*="overflow"]');
      if (scrollParent) scrollParent.style.overflow = 'visible';
      el.style.transformOrigin = `${ix - r.left}px ${iy - r.top}px`;
      const sx = origin.w / r.width;
      const sy = origin.h / r.height;
      const anim = el.animate(
        [
          { transform: 'scale(1,1)', opacity: 1 },
          { transform: `scale(${sx},${sy})`, opacity: 0.3 },
        ],
        { duration: 280, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'forwards' }
      );
      anim.onfinish = () => {
        if (scrollParent) scrollParent.style.overflow = '';
        originRectRef.current = null;
        navigate(-1);
      };
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

function TransitionOverlay({ overlay, onDone, navigate }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!overlay || !ref.current) return;
    const el = ref.current;
    const { rect, to } = overlay;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.max(vw / rect.width, vh / rect.height);

    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';

    void el.offsetWidth;

    const anim = el.animate(
      [
        { transform: 'scale(1)', borderRadius: '12px', opacity: 1 },
        { transform: `scale(${scale})`, borderRadius: '0px', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );

    anim.onfinish = () => {
      navigate(to, { state: { __noPageAnim: true } });
      setTimeout(() => {
        const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 150, easing: 'ease-out', fill: 'forwards',
        });
        fade.onfinish = () => onDone();
      }, 60);
    };
  }, [overlay, navigate, onDone]);

  if (!overlay) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[9000] will-change-transform pointer-events-none bg-gradient-to-br from-[#fb7299] to-[#00a1d6]"
      style={{ transformOrigin: 'center' }}
    />
  );
}

export function useTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransition must be used within TransitionProvider');
  return ctx;
}
