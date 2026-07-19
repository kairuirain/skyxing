import Spinner from './Spinner';

// 全局加载占位：居中圆形 Spinner + 可选文案
export default function Loading({ label = '加载中...', className = '', size = 28 }) {
  return (
    <div className={'flex flex-col items-center justify-center gap-3 py-16 ' + className}>
      <Spinner size={size} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </div>
  );
}
