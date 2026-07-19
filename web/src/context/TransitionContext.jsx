import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TransitionContext = createContext(null);

// 进入这些路由时不播放进入动画（特定界面无返回动画）
export const NO_ANIMATION_ROUTES = ['/login', '/register', '/link'];

// 点击按钮触发的「放大 + 模糊」启动式过渡：
// 从按钮位置生成品牌渐变遮罩，逐渐放大并增加模糊，覆盖全屏后跳转目标页并淡出揭示。
export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState(null); // { rect, to }

  // 由按钮点击触发：从按钮位置放大模糊至全屏，再跳转
  const launch = useCallback(
    (event, to) => {
      const el = event && event.currentTarget;
      if (!el) {
        navigate(to, { state: { __noPageAnim: true } });
        return;
      }
      const rect = el.getBoundingClientRect();
      setOverlay({ rect, to });
    },
    [navigate]
  );

  // 普通编程式跳转（保留 API，便于需要时携带无动画标记）
  const go = useCallback(
    (to, opts) => navigate(to, { ...opts, state: { ...(opts && opts.state), __noPageAnim: true } }),
    [navigate]
  );

  return (
    <TransitionContext.Provider value={{ launch, go }}>
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
    const scale = Math.max(vw / rect.width, vh / rect.height) * 1.6;

    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';

    const anim = el.animate(
      [
        { transform: 'scale(1)', borderRadius: '9999px', filter: 'blur(0px)', opacity: 1 },
        { transform: `scale(${scale})`, borderRadius: '0px', filter: 'blur(14px)', opacity: 1 },
      ],
      { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );

    anim.onfinish = () => {
      navigate(to, { state: { __noPageAnim: true } });
      setTimeout(() => {
        const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 220,
          easing: 'ease-out',
          fill: 'forwards',
        });
        fade.onfinish = () => onDone();
      }, 90);
    };
  }, [overlay, navigate, onDone]);

  if (!overlay) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[9000] bg-gradient-to-br from-[#fb7299] to-[#00a1d6] will-change-transform pointer-events-none"
      style={{ transformOrigin: 'center' }}
    />
  );
}

export function useTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransition must be used within TransitionProvider');
  return ctx;
}
