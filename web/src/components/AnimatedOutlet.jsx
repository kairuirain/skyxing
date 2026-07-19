import { useOutlet, useLocation } from 'react-router-dom';

// 详情 / 表单 / 设置类页面用「放大呈现」（小米式启动），其余用「上下滑动 + 模糊」
const SCALE_ROUTES = [
  '/settings', '/notifications', '/article', '/user', '/write', '/edit', '/admin',
];

function getTransition(pathname) {
  if (SCALE_ROUTES.some((p) => pathname.startsWith(p))) return 'animate-page-in-scale';
  return 'animate-page-in-slide';
}

// 以 pathname 为 key 重挂载，使每次路由切换都触发进入动画
export default function AnimatedOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const anim = getTransition(location.pathname);
  return (
    <div key={location.pathname} className={anim + ' will-change-transform'}>
      {outlet}
    </div>
  );
}
