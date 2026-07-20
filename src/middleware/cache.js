/**
 * 缓存控制辅助（需求 5：通信优化 / 正确使用缓存控制头）
 * Cloudflare Workers 默认自动压缩（gzip/brotli），此处仅补充 Cache-Control。
 */

/**
 * 生成静态/公开数据的缓存头（public + stale-while-revalidate）
 */
export function publicCache(seconds = 60, stale = 30) {
  return {
    'Cache-Control': `public, max-age=${seconds}, stale-while-revalidate=${stale}`,
  };
}

/**
 * 为响应附加缓存头
 */
export function applyCache(c, seconds = 60, stale = 30) {
  c.header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${stale}`);
}
