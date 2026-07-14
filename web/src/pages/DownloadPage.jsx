import {
  Download, Smartphone, Monitor, Globe, Apple, ExternalLink,
  CheckCircle2, Star, Sparkles, Github,
} from 'lucide-react';

const PLATFORMS = [
  {
    id: 'windows',
    name: 'Windows',
    icon: Monitor,
    desc: 'Tauri 桌面客户端，体积小、性能优，支持 Windows 10/11 (x64)。',
    file: 'SkyXing_1.1.4_x64-setup.exe',
    size: '~12 MB',
    href: 'https://github.com/kairuirain/skyxing-app/releases/latest',
  },
  {
    id: 'android',
    name: 'Android',
    icon: Smartphone,
    desc: 'Universal APK，兼容 arm64-v8a / armeabi-v7a / x86_64。',
    file: 'skyxing-1.1.4-android.apk',
    size: '~65 MB',
    href: 'https://github.com/kairuirain/skyxing-app/releases/latest',
  },
  {
    id: 'web',
    name: 'Web',
    icon: Globe,
    desc: '无需安装，浏览器即开即用，地址：skyxing.dpdns.org。',
    file: '直接访问网站',
    size: '在线使用',
    href: '/',
    internal: true,
  },
  {
    id: 'ios-mac',
    name: 'iOS / macOS',
    icon: Apple,
    desc: '暂未提供原生客户端，可使用 Web 版获得完整体验。',
    file: '暂未发布',
    size: '敬请期待',
    href: null,
  },
];

const FEATURES = [
  { title: '多端同步', desc: '文章、评论、私信云端同步，多设备无缝衔接' },
  { title: '极速加载', desc: 'Cloudflare Workers + 边缘缓存，全球访问毫秒级响应' },
  { title: '安全可靠', desc: 'PBKDF2 密码哈希 + 加密 JWT，传输与存储全链路安全' },
  { title: '持续更新', desc: 'OTA 增量升级，新功能第一时间触达用户' },
];

export default function DownloadPage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white mb-4">
          <Download size={28} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">下载 SkyXing</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          跨平台博客平台 · 全端覆盖 · 开源透明
        </p>
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
          <Github size={14} />
          <a
            href="https://github.com/kairuirain/skyxing-app"
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:underline"
          >
            查看源码
          </a>
        </div>
      </div>

      {/* Platform download cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const Card = p.href ? 'a' : 'div';
          const cardProps = p.href
            ? (p.internal ? { to: p.href } : { href: p.href, target: '_blank', rel: 'noreferrer' })
            : {};
          const isInternal = p.internal;
          return isInternal ? (
            <a
              key={p.id}
              href={p.href}
              className="card p-5 block hover:shadow-md transition-shadow cursor-pointer"
            >
              <PlatformCardBody p={p} Icon={Icon} />
            </a>
          ) : p.href ? (
            <a
              key={p.id}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="card p-5 block hover:shadow-md transition-shadow cursor-pointer"
            >
              <PlatformCardBody p={p} Icon={Icon} />
            </a>
          ) : (
            <div key={p.id} className="card p-5 opacity-60 cursor-not-allowed">
              <PlatformCardBody p={p} Icon={Icon} />
            </div>
          );
        })}
      </div>

      {/* Features */}
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles size={20} className="text-primary-600" />
        核心特性
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
              <CheckCircle2 size={16} className="text-primary-600" />
              {f.title}
            </div>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Latest release info */}
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-white border-primary-100">
        <div className="flex items-center gap-2 text-xs text-primary-700 font-semibold mb-2">
          <Star size={14} /> 最新版本
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">v1.1.4</h2>
        <p className="text-sm text-gray-600 mb-3">
          安全加固（PBKDF2 哈希、JWT 外置）、性能优化（评论索引、缓存头）、OTA 全端支持。
        </p>
        <a
          href="https://github.com/kairuirain/skyxing-app/releases/tag/v1.1.4"
          target="_blank"
          rel="noreferrer"
          className="btn-primary btn-sm"
        >
          <ExternalLink size={14} className="mr-1.5" />
          查看 Release Notes
        </a>
      </div>
    </div>
  );
}

function PlatformCardBody({ p, Icon }) {
  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{p.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2">{p.desc}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <span className="truncate font-mono">{p.file}</span>
        <span className="flex-shrink-0 ml-2">{p.size}</span>
      </div>
    </>
  );
}
