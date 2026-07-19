import { useOutlet, useLocation } from 'react-router-dom';
import { NO_ANIMATION_ROUTES } from '../context/TransitionContext';

// 详情 / 表单 / 设置类页面用「放大呈现」（小米式启动），其余用「上下滑动 + 模糊」
const SCALE_ROUTES = [
  '/settings', '/notifications', '/article', '/user', '/write', '/edit', '/admin',
];

function getTransition(pathname) {
  if (SCALE_ROUTES.some((p) => pathname.startsWith(p))) return 'animate-page-in-scale';
  return 'animate-page-in-slide';
}

// 特定界面（登录/注册/外链）及由按钮启动过渡跳转而来的页面，不播放进入动画
function isNoAnim(pathname, state) {
  if (state && state.__noPageAnim) return true;
  return NO_ANIMATION_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// 以 pathname 为 key 重挂载，使每次路由切换都触发进入动画
export default function AnimatedOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const noAnim = isNoAnim(location.pathname, location.state);
  const anim = noAnim ? '' : getTransition(location.pathname);
  return (
    <div key={location.pathname} className={anim + ' will-change-transform'}>
      {outlet}
    </div>
  );
}
