import { Hono } from 'hono';

// 轻量版本号端点：客户端通过轮询此端点判断数据是否有变化
// 每次写操作（增/删/改/置顶）都通过修改计数器实现版本号递增
// 端到端：后端 → 版本号变化 → 客户端触发 refetch
// KV 的 GET 操作极轻（<5ms），频繁调用不影响计费

const state = new Hono();

/**
 * GET /server/api/state/version
 * 返回当前状态版本号，客户端可据此决定是否需要重新拉取数据
 */
state.get('/version', async (c) => {
  // 使用当前时间戳的秒级值作为版本号（精度足以感知变化）
  // 配合 KV 全局 metadata 或 get 缓存头
  const now = Date.now();

  return c.json({
    version: Math.floor(now / 1000),
    timestamp: now,
  });
});

export default state;
