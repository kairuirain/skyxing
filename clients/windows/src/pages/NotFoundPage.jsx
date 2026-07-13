import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-20">
      <p className="text-8xl font-bold text-gray-200 mb-4">404</p>
      <p className="text-xl text-gray-500 mb-6">页面不存在</p>
      <Link to="/" className="btn-primary">返回首页</Link>
    </div>
  );
}
