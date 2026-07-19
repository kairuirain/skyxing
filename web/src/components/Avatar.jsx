// 通用头像组件：有头像显示图片，无头像显示首字母占位
export default function Avatar({
  src,
  name,
  className = 'w-16 h-16 rounded-full',
  initialClass = 'bg-primary-100 text-primary-600',
  textSize = 'text-xl',
  imgClassName = 'w-full h-full object-cover',
}) {
  const initial = (name || '?').toString().trim().charAt(0).toUpperCase() || '?';
  if (src) {
    return (
      <div className={`shrink-0 overflow-hidden ${className}`}>
        <img src={src} alt="" className={imgClassName} />
      </div>
    );
  }
  return (
    <div className={`shrink-0 flex items-center justify-center font-bold ${initialClass} ${textSize} ${className}`}>
      {initial}
    </div>
  );
}
