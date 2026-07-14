import { Mic, Headphones, Play, Clock } from 'lucide-react';

const EPISODES = [
  {
    id: 'ep-001',
    title: 'SkyXing 平台诞生记：从想法到全端发布',
    desc: '主理人讲述 SkyXing 博客平台从构思到落地的完整历程，涵盖技术选型、跨端挑战与社区反馈。',
    duration: '38:24',
    date: '2026-07-01',
    cover: '🎙️',
  },
  {
    id: 'ep-002',
    title: 'Cloudflare Workers + Hono：边缘应用实战',
    desc: '聊聊我们如何用 Cloudflare Workers 和 Hono.js 搭建 SkyXing 后端，以及 KV 存储的取舍。',
    duration: '45:10',
    date: '2026-06-15',
    cover: '☁️',
  },
  {
    id: 'ep-003',
    title: 'React Native 跨端开发踩坑实录',
    desc: 'Android 客户端从 Expo 起步到原生构建的踩坑总结，附性能调优经验。',
    duration: '52:08',
    date: '2026-05-28',
    cover: '📱',
  },
  {
    id: 'ep-004',
    title: 'Tauri vs Electron：桌面端框架如何抉择',
    desc: '对比 Tauri 2 与 Electron，从包体积、内存占用、原生能力等多维度评估，给出选型建议。',
    duration: '41:36',
    date: '2026-05-10',
    cover: '🖥️',
  },
  {
    id: 'ep-005',
    title: '用 GitHub Releases 做 OTA 更新：最简方案',
    desc: '介绍 SkyXing 的 OTA 更新实现：版本管理、KV 缓存、国内代理与渠道分发。',
    duration: '29:52',
    date: '2026-04-20',
    cover: '🚀',
  },
];

export default function PodcastPage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white mb-4">
          <Mic size={28} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">SkyXing 播客</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          记录技术、产品与社区故事的音频节目。每月更新，欢迎订阅。
        </p>
      </div>

      {/* Latest featured */}
      <div className="card p-6 mb-8 bg-gradient-to-br from-primary-50 to-white border-primary-100">
        <div className="flex items-center gap-2 text-xs text-primary-700 font-semibold mb-2">
          <Headphones size={14} /> 最新一期
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{EPISODES[0].title}</h2>
        <p className="text-gray-600 mb-4">{EPISODES[0].desc}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <button className="btn-primary btn-sm">
            <Play size={14} className="mr-1.5" /> 播放
          </button>
          <span className="flex items-center gap-1">
            <Clock size={14} /> {EPISODES[0].duration}
          </span>
          <span>{EPISODES[0].date}</span>
        </div>
      </div>

      {/* Episode list */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">往期节目</h2>
      <div className="space-y-3">
        {EPISODES.slice(1).map((ep) => (
          <div key={ep.id} className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-2xl">
              {ep.cover}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{ep.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-1">{ep.desc}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {ep.duration}
                </span>
                <span>{ep.date}</span>
              </div>
            </div>
            <button className="flex-shrink-0 p-2 rounded-full text-primary-600 hover:bg-primary-50 transition-colors">
              <Play size={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-400 mt-10">
        音频托管与订阅功能正在筹备中，敬请期待。
      </div>
    </div>
  );
}
