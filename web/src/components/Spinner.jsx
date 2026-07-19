// 全局圆形加载动画（圆环 + 旋转）
export default function Spinner({ size = 24, className = '' }) {
  return (
    <span
      role="status"
      aria-label="加载中"
      className={
        'inline-block rounded-full border-2 border-gray-200 border-t-primary-600 animate-spin ' +
        className
      }
      style={{ width: size, height: size }}
    />
  );
}
