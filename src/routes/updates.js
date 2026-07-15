import { Hono } from 'hono';
import { kvGet, kvPut, kvDelete, PREFIX } from '../utils/kv.js';
import { adminRequired } from '../middleware/rbac.js';

const updates = new Hono();

const DEFAULT_CONFIG = {
  proxyPrefix: 'https://ghfast.top/',
  proxyCountries: ['CN'],
  cacheTtl: 300,
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
  if (!v) return [0];
  const cleaned = String(v).trim().replace(/^v/i, '').split(/[-+]/)[0];
  return cleaned.split('.').map((n) => parseInt(n, 10) || 0);
}

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

async function fetchReleases(env, repo, ttl) {
  const cacheKey = PREFIX.UPDATES + 'cache:' + repo;
  const cached = await kvGet(env, cacheKey);
  const now = Date.now();
  if (cached && cached.expireAt > now) return cached.data;
  const resp = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
    headers: { 'User-Agent': 'SkyXing-OTA', Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) { if (cached) return cached.data; throw new Error(`GitHub API ${resp.status}`); }
  const data = await resp.json();
  await kvPut(env, cacheKey, { data, expireAt: now + (ttl || 300) * 1000 });
  return data;
}

function pickRelease(releases, channel) {
  const list = (releases || []).filter((r) => !r.draft);
  if (channel === 'beta') return list[0] || null;
  return list.find((r) => !r.prerelease) || null;
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

async function buildLatestPayload(c, env, config, platform, channel) {
  const platConf = config.platforms[platform];
  if (!platConf) return { error: `Unknown platform: ${platform}`, status: 400 };
  const releases = await fetchReleases(env, platConf.repo, config.cacheTtl);
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
    const result = await buildLatestPayload(c, c.env, config, platform, channel);
    if (result.error) return c.json({ error: result.error }, result.status);
    const notices = await getActiveNotices(c.env, platform, current);
    return c.json({ ...result.payload, protocolVersion: 3, notices });
  } catch (e) {
    return c.json({ error: 'Failed to fetch update info', detail: String(e.message || e) }, 502);
  }
});

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
    const notices = await getActiveNotices(c.env, platform, current);
    return c.json({
      protocolVersion: 3, hasUpdate, current, latest: latest.version,
      channel, platform, release: hasUpdate ? latest : null, notices,
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
