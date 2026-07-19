import { useOutlet, useLocation } from 'react-router-dom';
import { useRef, useLayoutEffect } from 'react';
import { useTransition } from '../context/TransitionContext';

// 全屏二级菜单路由容器：从右侧滑入，覆盖整个 App（含导航栏）
export default function SlideOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const { registerSlidePage } = useTransition();
  const ref = useRef(null);

  useLayoutEffect(() => {
    registerSlidePage(ref.current);
  }, [registerSlidePage]);

  return (
    <div
      ref={ref}
      key={location.pathname}
      className="fixed inset-0 z-[8000] bg-white dark:bg-gray-900 overflow-y-auto animate-slide-in-right"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif' }}
    >
      {outlet}
    </div>
  );
}
