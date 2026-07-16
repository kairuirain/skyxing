import { Hono } from 'hono';
import { kvGet, kvPut, kvDelete, PREFIX } from '../utils/kv.js';
import { adminRequired } from '../middleware/rbac.js';

const updates = new Hono();

const DEFAULT_CONFIG = {
  proxyPrefix: 'https://ghfast.top/',
  proxyCountries: ['CN'],
  cacheTtl: 60,
  platforms: {
    android: { repo: 'kairuirain/skyxing-app', match: '\\.apk$' },
    windows: { repo: 'kairuirain/skyxing-app', match: '\\.(exe|msi)$' },
    app: { repo: 'kairuirain/skyxing-app', match: '\\.(exe|msi|dmg|AppImage|deb)$' },
    web: { repo: 'kairuirain/skyxing', match: null },
  },
};

async function getConfig(env) {
  const stored = await kvGet(env, PREFIX.UPDATES + 'config');
  if (!stored) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...stored, platforms: { ...DEFAULT_CONFIG.platforms, ...(stored.platforms || {}) } };
}

function parseVersion(v) {
  if (!v) return { nums: [0], pre: [] };
  const cleaned = String(v).trim().replace(/^v/i, '');
  const parts = cleaned.split(/[-+]/);
  const nums = parts[0].split('.').map((n) => parseInt(n, 10) || 0);
  const pre = parts[1] ? parts[1].split('.') : [];
  return { nums, pre };
}

function compareVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  // 比较主版本号数字部分
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i++) {
    const x = pa.nums[i] || 0;
    const y = pb.nums[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  // 数字部分相等时比较 prerelease
  // semver 规则：正式版 > 预发布版（无 prerelease > 有 prerelease）
  if (pa.pre.length === 0 && pb.pre.length > 0) return 1;
  if (pa.pre.length > 0 && pb.pre.length === 0) return -1;
  const plen = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < plen; i++) {
    const x = pa.pre[i] || '';
    const y = pb.pre[i] || '';
    if (x === y) continue;
    const xn = parseInt(x, 10);
    const yn = parseInt(y, 10);
    if (!isNaN(xn) && !isNaN(yn)) return xn > yn ? 1 : -1;
    return x > y ? 1 : -1;
  }
  return 0;
}

async function fetchReleases(env, repo, ttl, forceRefresh = false) {
  const cacheKey = PREFIX.UPDATES + 'cache:' + repo;
  if (!forceRefresh) {
    const cached = await kvGet(env, cacheKey);
    const now = Date.now();
    if (cached && cached.expireAt > now) return cached.data;
  }
  const resp = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
    headers: { 'User-Agent': 'SkyXing-OTA', Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) { if (!forceRefresh) { const c = await kvGet(env, cacheKey); if (c) return c.data; } throw new Error(`GitHub API ${resp.status}`); }
  const data = await resp.json();
  // 缓存时间 60s（开发测试友好），生产可调大
  await kvPut(env, cacheKey, { data, expireAt: Date.now() + (ttl || 60) * 1000 });
  return data;
}

/**
 * 判断一个发布是否为预发布（测试版）
 * 通过两个条件判断：
 * 1. GitHub UI 上勾选了 "This is a pre-release" 复选框（r.prerelease === true）
 * 2. 标签名包含测试版后缀：-a, -b, -rc, -alpha, -beta, -preview
 */
function isPrerelease(r) {
  if (r.prerelease) return true;
  if (/-[a-z]/i.test(r.tag_name)) return true;
  return false;
}

/**
 * 按渠道筛选对应类型的最新发布
 * - stable: 仅返回非预发布版本（正式版）
 * - beta: 仅返回预发布版本（测试版）
 */
function pickRelease(releases, channel) {
  const list = (releases || []).filter((r) => !r.draft);
  if (channel === 'beta') {
    // 测试版渠道：仅返回预发布版本
    return list.find((r) => isPrerelease(r)) || null;
  }
  // 稳定版渠道（默认）：仅返回正式版本
  return list.find((r) => !isPrerelease(r)) || null;
}

function pickAsset(release, matchRegex) {
  if (!matchRegex || !release.assets) return null;
  const re = new RegExp(matchRegex, 'i');
  return release.assets.find((a) => re.test(a.name)) || null;
}

function shouldProxy(c, config) {
  const country = c.req.header('cf-ipcountry') || '';
  return config.proxyCountries.includes(country.toUpperCase());
}

function buildDownload(asset, config, useProxy) {
  if (!asset) return null;
  const url = asset.browser_download_url;
  return {
    name: asset.name, size: asset.size, url,
    proxyUrl: config.proxyPrefix ? config.proxyPrefix + url : url,
    recommendedUrl: useProxy && config.proxyPrefix ? config.proxyPrefix + url : url,
    downloadCount: asset.download_count,
  };
}

async function buildLatestPayload(c, env, config, platform, channel, forceRefresh = false) {
  const platConf = config.platforms[platform];
  if (!platConf) return { error: `Unknown platform: ${platform}`, status: 400 };
  const releases = await fetchReleases(env, platConf.repo, config.cacheTtl, forceRefresh);
  const release = pickRelease(releases, channel);
  if (!release) return { error: 'No release found', status: 404 };
  const asset = pickAsset(release, platConf.match);
  const useProxy = shouldProxy(c, config);
  return {
    payload: {
      platform, channel,
      version: release.tag_name.replace(/^v/i, ''),
      tag: release.tag_name, name: release.name, notes: release.body || '',
      prerelease: release.prerelease, publishedAt: release.published_at,
      htmlUrl: release.html_url, repo: platConf.repo,
      download: buildDownload(asset, config, useProxy),
      proxyApplied: useProxy && !!config.proxyPrefix,
    },
  };
}

async function getActiveNotices(env, platform, currentVersion) {
  const all = await kvGet(env, PREFIX.UPDATES + 'notices');
  if (!all || !Array.isArray(all)) return [];
  return all.filter((n) => {
    if (n.platform !== 'all' && n.platform !== platform) return false;
    if (n.minVersion && compareVersion(currentVersion, n.minVersion) < 0) return false;
    if (n.maxVersion && compareVersion(currentVersion, n.maxVersion) > 0) return false;
    return true;
  });
}

// ====== 公开路由 ======

updates.get('/latest', async (c) => {
  try {
    const config = await getConfig(c.env);
    const platform = (c.req.query('platform') || 'web').toLowerCase();
    const channel = (c.req.query('channel') || 'stable').toLowerCase();
    const current = c.req.query('current') || '0.0.0';
    const forceRefresh = c.req.query('nocache') === 'true';
    const result = await buildLatestPayload(c, c.env, config, platform, channel, forceRefresh);
    if (result.error) return c.json({ error: result.error }, result.status);
    const notices = await getActiveNotices(c.env, platform, current);
    return c.json({ ...result.payload, protocolVersion: 3, notices });
  } catch (e) {
    return c.json({ error: 'Failed to fetch update info', detail: String(e.message || e) }, 502);
  }
});

/**
 * 从版本号检测渠道：含 -a / -b / -rc 等后缀的为测试版
 */
function detectVersionChannel(ver) {
  return /-[a-z]/i.test(ver) ? 'beta' : 'stable';
}

updates.get('/check', async (c) => {
  try {
    const config = await getConfig(c.env);
    const platform = (c.req.query('platform') || 'web').toLowerCase();
    const channel = (c.req.query('channel') || 'stable').toLowerCase();
    const current = c.req.query('current') || '0.0.0';
    const forceRefresh = c.req.query('nocache') === 'true';
    const result = await buildLatestPayload(c, c.env, config, platform, channel, forceRefresh);
    if (result.error) return c.json({ error: result.error }, result.status);
    const latest = result.payload;
    const hasUpdate = compareVersion(latest.version, current) > 0;

    // 检测渠道切换
    const currentChannel = detectVersionChannel(current);
    let channelSwitch = null;
    if (currentChannel !== channel) {
      channelSwitch = { from: currentChannel, to: channel };
    }

    const notices = await getActiveNotices(c.env, platform, current);
    return c.json({
      protocolVersion: 3, hasUpdate, current, latest: latest.version,
      channel, platform, release: hasUpdate ? latest : null, notices,
      channelSwitch,
    });
  } catch (e) {
    return c.json({ error: 'Failed to check update', detail: String(e.message || e) }, 502);
  }
});

updates.get('/notice', async (c) => {
  try {
    const platform = (c.req.query('platform') || 'web').toLowerCase();
    const current = c.req.query('current') || '0.0.0';
    const notices = await getActiveNotices(c.env, platform, current);
    return c.json({ protocolVersion: 3, notices });
  } catch (e) {
    return c.json({ error: String(e.message || e) }, 502);
  }
});

// ====== 管理路由 ======

updates.get('/config', adminRequired, async (c) => {
  const config = await getConfig(c.env);
  return c.json({ config });
});

updates.put('/config', adminRequired, async (c) => {
  try {
    const body = await c.req.json();
    const current = await getConfig(c.env);
    const next = { ...current, ...body, platforms: { ...current.platforms, ...(body.platforms || {}) } };
    await kvPut(c.env, PREFIX.UPDATES + 'config', next);
    return c.json({ message: 'Config updated', config: next });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

updates.put('/notice', adminRequired, async (c) => {
  try {
    const notice = await c.req.json();
    if (!notice.id || !notice.title || !notice.body) {
      return c.json({ error: 'id, title, body are required' }, 400);
    }
    const all = (await kvGet(c.env, PREFIX.UPDATES + 'notices')) || [];
    const idx = all.findIndex((n) => n.id === notice.id);
    if (idx >= 0) { all[idx] = { ...all[idx], ...notice }; }
    else { all.push({ ...notice, createdAt: new Date().toISOString() }); }
    await kvPut(c.env, PREFIX.UPDATES + 'notices', all);
    return c.json({ message: 'Notice saved', notices: all });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

updates.delete('/notice', adminRequired, async (c) => {
  try {
    const id = c.req.query('id');
    if (!id) return c.json({ error: 'id query param required' }, 400);
    const all = (await kvGet(c.env, PREFIX.UPDATES + 'notices')) || [];
    const next = all.filter((n) => n.id !== id);
    await kvPut(c.env, PREFIX.UPDATES + 'notices', next);
    return c.json({ message: 'Notice deleted', notices: next });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

export default updates;
