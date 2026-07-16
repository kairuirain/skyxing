import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, ShieldAlert } from 'lucide-react';

const SITE_HOSTNAMES = new Set(['skyxing.dpdns.org', 'www.skyxing.dpdns.org']);

function isSameSiteLink(url) {
  try {
    const u = new URL(url);
    return SITE_HOSTNAMES.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export default function LinkRedirect() {
  const [searchParams] = useSearchParams();
  const targetUrl = searchParams.get('url') || '';
  const [confirmed, setConfirmed] = useState(false);

  // 如果是同站链接，直接跳转，不显示安全提示页
  useEffect(() => {
    if (targetUrl) {
      const decodedUrl = decodeURIComponent(targetUrl);
      if (isSameSiteLink(decodedUrl)) {
        window.location.href = decodedUrl;
      }
    }
  }, [targetUrl]);

  if (!targetUrl) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-gray-500 text-lg">缺少链接参数</p>
        <Link to="/" className="btn-primary mt-4 inline-block">返回首页</Link>
      </div>
    );
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  const hostname = (() => {
    try { return new URL(decodedUrl).hostname; } catch { return '未知域名'; }
  })();

  // 如果属于同站链接，不渲染安全提示（会由 useEffect 自动跳转）
  if (isSameSiteLink(decodedUrl)) {
    return null;
  }

  const handleConfirm = () => {
    setConfirmed(true);
    window.open(decodedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-lg mx-auto py-12">
      <div className="card p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-6">
          <ShieldAlert size={32} />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">外部链接提醒</h1>
        <p className="text-gray-500 text-sm mb-6">
          您即将离开 SkyXing 平台，前往以下外部链接：
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-xs text-gray-400 mb-1">目标链接</p>
          <p className="text-sm font-mono text-gray-700 break-all">{decodedUrl}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-left text-sm text-amber-800">
          <p className="font-medium mb-1">⚠️ 安全提醒</p>
          <ul className="text-xs space-y-1 text-amber-700">
            <li>• 目标域名：<strong>{hostname}</strong> — 非 SkyXing 官方域名</li>
            <li>• 本平台无法验证该链接的内容和安全性</li>
            <li>• 请勿在未知网站输入您的 SkyXing 账号密码</li>
            <li>• 请谨慎访问，注意防范钓鱼风险</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-outline">
            <ArrowLeft size={16} className="mr-1.5" />
            返回首页
          </Link>
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="btn-primary"
          >
            <ExternalLink size={16} className="mr-1.5" />
            {confirmed ? '已打开' : '继续访问'}
          </button>
        </div>
      </div>
    </div>
  );
}
