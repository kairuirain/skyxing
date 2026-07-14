import { Hono } from 'hono';
import { kvGet, kvPut, PREFIX } from '../utils/kv.js';
import { adminRequired } from '../middleware/rbac.js';

const updates = new Hono();

/**
 * OTA 更新配置（默认值，可由管理员通过 PUT /updates/config 覆盖并存入 KV）
 * - platforms: 各端对应的 GitHub 仓库与安装包资源匹配规则
 * - proxyPrefix: 面向指定国家/地区的 GitHub 下载加速代理前缀
 * - proxyCountries: 命中后走代理的国家码（由 Cloudflare 的 cf-ipcountry 头判定）
 */
const DEFAULT_CONFIG = {
  proxyPrefix: 'https://ghfast.top/',
  proxyCountries: ['CN'],
  cacheTtl: 300, // GitHub 结果缓存秒数，规避未认证接口 60 次/小时限制
  platforms: {
    android: { repo: 'kairuirain/skyxing-app', match: '\\.apk$' },
    windows: { repo: 'kairuirain/skyxing-app', match: '\\.(exe|msi)$' },
    app: { repo: 'kairuirain/skyxing-app', match: '\\.(exe|msi|dmg|AppImage|deb)$' },
    web: { repo: 'kairuirain/skyxing', match: null },
  },
};

// ---------- 内部辅助 ----------

async function getConfig(env) {
  const stored = await kvGet(env, PREFIX.UPDATES + 'config');
  if (!stored) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    platforms: { ...DEFAULT_CONFIG.platforms, ...(stored.platforms || {}) },
  };
}

/** 归一化版本号：去掉前缀 v，返回可比较的数字数组 */
function parseVersion(v) {
  if (!v) return [0];
  const cleaned = String(v).trim().replace(/^v/i, '').split(/[-+]/)[0];
  return cleaned.split('.').map((n) => parseInt(n, 10) || 0);
}

/** 语义化版本比较：a>b 返回 1，a<b 返回 -1，相等返回 0 */
function compareVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** 从 GitHub 拉取指定仓库的 releases（带 KV 缓存） */
async function fetchReleases(env, repo, ttl) {
  const cacheKey = PREFIX.UPDATES + 'cache:' + repo;
  const cached = await kvGet(env, cacheKey);
  const now = Date.now();
  if (cached && cached.expireAt > now) {
    return cached.data;
  }

  const resp = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
    headers: {
      'User-Agent': 'SkyXing-OTA',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!resp.ok) {
    // GitHub 出错时回退到过期缓存（若有）
    if (cached) return cached.data;
    throw new Error(`GitHub API ${resp.status}`);
  }
  const data = await resp.json();
  await kvPut(env, cacheKey, { data, expireAt: now + (ttl || 300) * 1000 });
  return data;
}

/** 依据渠道选出目标 release：stable 取最新正式版，beta 取最新（含预发布） */
function pickRelease(releases, channel) {
  const list = (releases || []).filter((r) => !r.draft);
  if (channel === 'beta') {
    return list[0] || null;
  }
  return list.find((r) => !r.prerelease) || null;
}

/** 从 release 资源中匹配平台安装包 */
function pickAsset(release, matchRegex) {
  if (!matchRegex || !release.assets) return null;
  const re = new RegExp(matchRegex, 'i');
  return release.assets.find((a) => re.test(a.name)) || null;
}

/** 是否对该请求应用下载代理（依据 Cloudflare 提供的国家码） */
function shouldProxy(c, config) {
  const country = c.req.header('cf-ipcountry') || '';
  return config.proxyCountries.includes(country.toUpperCase());
}

function buildDownload(asset, config, useProxy) {
  if (!asset) return null;
  const url = asset.browser_download_url;
  return {
    name: asset.name,
    size: asset.size,
    url,
    proxyUrl: config.proxyPrefix ? config.proxyPrefix + url : url,
    recommendedUrl: useProxy && config.proxyPrefix ? config.proxyPrefix + url : url,
    downloadCount: asset.download_count,
  };
}

async function buildLatestPayload(c, env, config, platform, channel) {
  const platConf = config.platforms[platform];
  if (!platConf) {
    return { error: `Unknown platform: ${platform}`, status: 400 };
  }

  const releases = await fetchReleases(env, platConf.repo, config.cacheTtl);
  const release = pickRelease(releases, channel);
  if (!release) {
    return { error: 'No release found', status: 404 };
  }

  const asset = pickAsset(release, platConf.match);
  const useProxy = shouldProxy(c, config);

  return {
    payload: {
      platform,
      channel,
      version: release.tag_name.replace(/^v/i, ''),
      tag: release.tag_name,
      name: release.name,
      notes: release.body || '',
      prerelease: release.prerelease,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      repo: platConf.repo,
      download: buildDownload(asset, config, useProxy),
      proxyApplied: useProxy && !!config.proxyPrefix,
    },
  };
}

// ---------- 公开路由 ----------

/**
 * GET /server/api/updates/latest?platform=android&channel=stable
 * 获取指定平台/渠道的最新版本信息与安装包下载地址
 */
updates.get('/latest', async (c) => {
  try {
    const config = await getConfig(c.env);
    const platform = (c.req.query('platform') || 'web').toLowerCase();
    const channel = (c.req.query('channel') || 'stable').toLowerCase();

    const result = await buildLatestPayload(c, c.env, config, platform, channel);
    if (result.error) return c.json({ error: result.error }, result.status);
    return c.json(result.payload);
  } catch (e) {
    return c.json({ error: 'Failed to fetch update info', detail: String(e.message || e) }, 502);
  }
});

/**
 * GET /server/api/updates/check?platform=android&current=1.1.2&channel=stable
 * 对比当前版本，返回是否有可用更新
 */
updates.get('/check', async (c) => {
  try {
    const config = await getConfig(c.env);
    const platform = (c.req.query('platform') || 'web').toLowerCase();
    const channel = (c.req.query('channel') || 'stable').toLowerCase();
    const current = c.req.query('current') || '0.0.0';

    const result = await buildLatestPayload(c, c.env, config, platform, channel);
    if (result.error) return c.json({ error: result.error }, result.status);

    const latest = result.payload;
    const hasUpdate = compareVersion(latest.version, current) > 0;
    return c.json({
      hasUpdate,
      current,
      latest: latest.version,
      channel,
      platform,
      release: hasUpdate ? latest : null,
    });
  } catch (e) {
    return c.json({ error: 'Failed to check update', detail: String(e.message || e) }, 502);
  }
});

// ---------- 管理路由 ----------

/**
 * GET /server/api/updates/config  （管理员）
 * 查看当前 OTA 配置
 */
/**
 * GET /server/api/updates/tauri?platform=windows&current=v1.2.0&channel=stable
 * Tauri 内置 Updater 专用端点，返回标准 JSON 格式：
 * { version, pub_date, url, signature }
 * {{current}} 由 Tauri 框架自动替换为当前应用版本
 */
updates.get('/tauri', async (c) => {
  try {
    const config = await getConfig(c.env);
    const platform = (c.req.query('platform') || 'windows').toLowerCase();
    const current = c.req.query('current') || 'v0.0.0';
    const channel = (c.req.query('channel') || 'stable').toLowerCase();

    const platConf = config.platforms[platform];
    if (!platConf) return c.json({ error: 'Unknown platform' }, 400);

    const releases = await fetchReleases(c.env, platConf.repo, config.cacheTtl);
    const release = pickRelease(releases, channel);
    if (!release) return c.json({ error: 'No release' }, 404);

    const tag = release.tag_name;
    const version = tag.replace(/^v/i, '');
    const pubDate = release.published_at || new Date().toISOString();

    // 匹配 build 产物：NSIS 压缩包优先（含 updater 签名），回退到常规 exe
    let url = null;
    const nsisMatch = release.assets?.find((a) => /\.nsis\.zip$/i.test(a.name));
    if (nsisMatch) {
      url = nsisMatch.browser_download_url;
    } else {
      const exeMatch = pickAsset(release, platConf.match);
      if (exeMatch) url = exeMatch.browser_download_url;
    }
    if (!url) return c.json({ error: 'No asset' }, 404);

    // 签名：优先从 KV 读取（管理员可通过 PUT /updates/config 写入），
    // 生产环境中由 `npx tauri signer generate` 生成密钥 + 构建后从 .sig 文件获取
    const storedSig = await kvGet(c.env, PREFIX.UPDATES + 'signature:' + tag);
    const signature = storedSig || '';

    return c.json({
      version,
      pub_date: pubDate,
      url,
      signature,
      notes: release.body || '',
    });
  } catch (e) {
    return c.json({ error: String(e.message || e) }, 502);
  }
});

  const config = await getConfig(c.env);
  return c.json({ config });
});

/**
 * PUT /server/api/updates/config  （管理员）
 * 更新 OTA 配置（仓库映射、代理前缀、代理国家、缓存时长）
 */
updates.put('/config', adminRequired, async (c) => {
  try {
    const body = await c.req.json();
    const current = await getConfig(c.env);
    const next = {
      ...current,
      ...body,
      platforms: { ...current.platforms, ...(body.platforms || {}) },
    };
    await kvPut(c.env, PREFIX.UPDATES + 'config', next);
    return c.json({ message: 'Config updated', config: next });
  } catch (e) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

export default updates;
