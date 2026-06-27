var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/auth.js
var TOKEN_SECRET_KEY = "skyxing-auth-secret-v2";
function buf2hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(buf2hex, "buf2hex");
function textEncode(str) {
  return new TextEncoder().encode(str);
}
__name(textEncode, "textEncode");
async function hashPassword(password, salt) {
  if (!salt) {
    salt = buf2hex(crypto.getRandomValues(new Uint8Array(16)));
  }
  const data = textEncode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return { hash: buf2hex(digest), salt };
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}
__name(verifyPassword, "verifyPassword");
async function signToken(username, timestamp) {
  const payload = `${username}:${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncode(TOKEN_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncode(payload));
  const sigHex = buf2hex(signature).substring(0, 16);
  return btoa(`${payload}:${sigHex}`);
}
__name(signToken, "signToken");
var TOKEN_TTL = 7 * 24 * 60 * 60 * 1e3;
async function verifyToken(token) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(":");
    if (parts.length !== 3) {
      console.log("[Auth] verifyToken: invalid format, parts=" + parts.length);
      return null;
    }
    const [username, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      console.log("[Auth] verifyToken: invalid timestamp");
      return null;
    }
    if (Date.now() - timestamp > TOKEN_TTL) {
      console.log("[Auth] verifyToken: token expired, age=" + (Date.now() - timestamp) + "ms");
      return null;
    }
    const payload = `${username}:${timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      textEncode(TOKEN_SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedSig = await crypto.subtle.sign("HMAC", key, textEncode(payload));
    const expectedHex = buf2hex(expectedSig).substring(0, 16);
    if (signature !== expectedHex) {
      console.log("[Auth] verifyToken: signature mismatch expected=" + expectedHex + " got=" + signature);
      return null;
    }
    console.log("[Auth] verifyToken: OK, user=" + username + " age=" + (Date.now() - timestamp) + "ms");
    return { username, timestamp };
  } catch (e) {
    console.log("[Auth] verifyToken: error", e.message);
    return null;
  }
}
__name(verifyToken, "verifyToken");
function createSecureCookie(name, value, maxAgeSeconds = 7 * 24 * 60 * 60) {
  const attrs = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Strict"
  ];
  return attrs.join("; ");
}
__name(createSecureCookie, "createSecureCookie");
function extractToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "auth_token") return value;
    }
  }
  return null;
}
__name(extractToken, "extractToken");

// src/utils/kv.js
async function getJSON(kv, key, defaultValue = null) {
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`[KV] getJSON error for ${key}:`, e.message);
    return defaultValue;
  }
}
__name(getJSON, "getJSON");
async function getUser(kv, username) {
  return getJSON(kv, `user:${username}`);
}
__name(getUser, "getUser");

// src/core/monitor.js
var LOG_CAP = 500;
var METRIC_LATENCY_CAP = 200;
var ALERT_CAP = 50;
var KV_KEY = "monitor:snapshot";
var Monitor = class _Monitor {
  static {
    __name(this, "Monitor");
  }
  static #logs = [];
  static #alerts = [];
  static #startTime = Date.now();
  static #metrics = {
    requests: { total: 0, success: 0, failure: 0 },
    byEndpoint: {},
    latencies: [],
    lastCheck: Date.now()
  };
  static #lastPersist = 0;
  static #uuidCounter = 0;
  // ── 日志 ──────────────────────────────────
  static log(level, category, message, data) {
    const entry = {
      ts: Date.now(),
      level: level.toUpperCase(),
      category,
      message,
      data: data ?? null
    };
    _Monitor.#logs.push(entry);
    if (_Monitor.#logs.length > LOG_CAP) _Monitor.#logs.shift();
    if (level === "ERROR") console.error(`[${category}] ${message}`, data ?? "");
    else if (level === "WARN") console.warn(`[${category}] ${message}`);
  }
  static debug(c, m, d) {
    _Monitor.log("DEBUG", c, m, d);
  }
  static info(c, m, d) {
    _Monitor.log("INFO", c, m, d);
  }
  static warn(c, m, d) {
    _Monitor.log("WARN", c, m, d);
  }
  static error(c, m, d) {
    _Monitor.log("ERROR", c, m, d);
  }
  // ── 请求指标 ──────────────────────────────
  static recordRequest(endpoint, latencyMs, success) {
    const m = _Monitor.#metrics;
    m.requests.total++;
    success ? m.requests.success++ : m.requests.failure++;
    const ep = m.byEndpoint[endpoint] || (m.byEndpoint[endpoint] = { total: 0, success: 0, failure: 0 });
    ep.total++;
    success ? ep.success++ : ep.failure++;
    m.latencies.push(latencyMs);
    if (m.latencies.length > METRIC_LATENCY_CAP) m.latencies.shift();
    m.lastCheck = Date.now();
  }
  static #percentiles() {
    const arr = [..._Monitor.#metrics.latencies].sort((a, b) => a - b);
    if (!arr.length) return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
    const avg = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    const p = /* @__PURE__ */ __name((n) => arr[Math.ceil(arr.length * (n / 100)) - 1] || arr[arr.length - 1], "p");
    return { p50: p(50), p95: p(95), p99: p(99), avg, count: arr.length };
  }
  // ── 告警 ──────────────────────────────────
  static alert(severity, title, detail) {
    const entry = {
      id: `alert-${Date.now()}-${_Monitor.#uuidCounter++}`,
      severity,
      title,
      detail: detail ?? null,
      ts: Date.now()
    };
    _Monitor.#alerts.push(entry);
    if (_Monitor.#alerts.length > ALERT_CAP) _Monitor.#alerts.shift();
    if (severity === "critical") {
      console.error(`[ALERT][${severity}] ${title}`, detail ?? "");
    }
  }
  // ── 健康检查 ──────────────────────────────
  static healthCheck() {
    const m = _Monitor.#metrics;
    const errorRate = m.requests.total > 0 ? +(m.requests.failure / m.requests.total * 100).toFixed(1) : 0;
    let status = "healthy";
    if (errorRate > 10) status = "critical";
    else if (errorRate > 3) status = "degraded";
    return {
      status,
      uptime: Date.now() - _Monitor.#startTime,
      metrics: {
        requests: m.requests,
        errorRate: `${errorRate}%`,
        latencies: _Monitor.#percentiles(),
        topEndpoints: Object.entries(m.byEndpoint).sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([ep, stats]) => ({ endpoint: ep, ...stats }))
      },
      recentErrors: _Monitor.#logs.filter((l) => l.level === "ERROR").slice(-10),
      recentAlerts: _Monitor.#alerts.slice(-5),
      lastCheck: m.lastCheck
    };
  }
  // ── 快照 ──────────────────────────────────
  static getSnapshot() {
    return {
      metrics: _Monitor.#metrics,
      recentLogs: _Monitor.#logs.slice(-100),
      alerts: _Monitor.#alerts.slice(-20),
      uptime: Date.now() - _Monitor.#startTime
    };
  }
  static resetMetrics() {
    _Monitor.#metrics = {
      requests: { total: 0, success: 0, failure: 0 },
      byEndpoint: {},
      latencies: [],
      lastCheck: Date.now()
    };
  }
  // ── KV 持久化（崩溃恢复） ──────────────────
  static async persist(env) {
    try {
      await env.SkyXing.put(KV_KEY, JSON.stringify(_Monitor.getSnapshot()));
      _Monitor.#lastPersist = Date.now();
    } catch (e) {
    }
  }
  static async load(env) {
    try {
      const raw = await env.SkyXing.get(KV_KEY);
      if (raw) {
        const snap = JSON.parse(raw);
        _Monitor.#metrics = snap.metrics || _Monitor.#metrics;
        _Monitor.#logs = snap.recentLogs || [];
        _Monitor.#alerts = snap.alerts || [];
      }
    } catch (e) {
    }
  }
};
Monitor.wrapHandler = function(endpoint, handler) {
  return async function(request, env, ctx) {
    const start = Date.now();
    try {
      const response = await handler(request, env, ctx);
      const latency = Date.now() - start;
      Monitor.recordRequest(endpoint, latency, response.status < 400);
      return response;
    } catch (err) {
      const latency = Date.now() - start;
      Monitor.recordRequest(endpoint, latency, false);
      Monitor.error("api", `${endpoint} unhandled error`, { message: err.message, stack: err.stack?.substring(0, 200) });
      if (err.message !== "AUTH_FAILED") {
        Monitor.alert("warning", `API Error: ${endpoint}`, err.message);
      }
      return new Response(JSON.stringify({ success: false, message: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
};

// src/core/retry-circuit.js
var DEFAULT = {
  maxRetries: 3,
  baseDelay: 500,
  // ms
  maxDelay: 1e4,
  // ms
  circuitTimeout: 3e4,
  // 30s 后半开
  failureThreshold: 5
  // 连续 5 次失败 → 熔断
};
var RetryCircuit = class {
  static {
    __name(this, "RetryCircuit");
  }
  constructor(opts = {}) {
    this.opts = { ...DEFAULT, ...opts };
    this.circuits = {};
  }
  /**
   * 获取断路器状态
   * @returns {{state:'CLOSED'|'OPEN'|'HALF_OPEN', failures:number, lastFailure:number|null}}
   */
  getState(endpoint) {
    const c = this.circuits[endpoint];
    if (!c) return { state: "CLOSED", failures: 0, lastFailure: null };
    if (c.state === "OPEN" && Date.now() > c.nextProbeAt) {
      c.state = "HALF_OPEN";
      Monitor.info("circuit", `Circuit HALF_OPEN for ${endpoint}`);
    }
    return { state: c.state, failures: c.failures, lastFailure: c.lastFailure };
  }
  getAllStates() {
    return Object.entries(this.circuits).map(([ep, c]) => ({
      endpoint: ep,
      state: this.getState(ep).state,
      failures: c.failures,
      lastFailure: c.lastFailure ? new Date(c.lastFailure).toISOString() : null
    }));
  }
  reset(endpoint) {
    delete this.circuits[endpoint];
    Monitor.info("circuit", `Circuit RESET for ${endpoint}`);
  }
  // ── 核心执行器 ──────────────────────────
  /**
   * @param {Function} fn - 异步函数，返回 Response 或 throw
   * @param {string} context - 端点标识（用于断路器分组）
   * @param {Function} [fallback] - 降级函数，所有重试失败后调用
   * @returns {Promise<*>} fn 的返回值或 fallback 的返回值
   */
  async execute(fn, context, fallback) {
    const endpoint = context || "unknown";
    let c = this.circuits[endpoint];
    if (c && c.state === "OPEN") {
      if (Date.now() > c.nextProbeAt) {
        c.state = "HALF_OPEN";
        Monitor.info("circuit", `Circuit HALF_OPEN for ${endpoint}`);
      } else {
        Monitor.warn("circuit", `Circuit OPEN \u2014 rejecting ${endpoint}`, {
          retryAfter: Math.ceil((c.nextProbeAt - Date.now()) / 1e3) + "s"
        });
        if (fallback) return fallback();
        throw Object.assign(new Error("Circuit breaker OPEN"), {
          code: "CIRCUIT_OPEN",
          retryAfter: Math.ceil((c.nextProbeAt - Date.now()) / 1e3)
        });
      }
    }
    let lastError = null;
    const maxRetries = c?.state === "HALF_OPEN" ? 0 : this.opts.maxRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        this.#onSuccess(endpoint);
        return result;
      } catch (err) {
        lastError = err;
        if (err.message === "AUTH_FAILED") {
          this.#onFailure(endpoint);
          throw err;
        }
        if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
          this.#onFailure(endpoint);
          throw err;
        }
        if (attempt === maxRetries) break;
        const delay = Math.min(
          this.opts.baseDelay * Math.pow(2, attempt),
          this.opts.maxDelay
        );
        const jitter = delay * (0.8 + Math.random() * 0.4);
        Monitor.warn("retry", `Retry ${attempt + 1}/${maxRetries} for ${endpoint}`, {
          delay: Math.round(jitter),
          error: err.message
        });
        await new Promise((resolve) => setTimeout(resolve, Math.round(jitter)));
      }
    }
    this.#onFailure(endpoint);
    Monitor.error("retry", `All retries exhausted for ${endpoint}`, { attempts: maxRetries + 1, lastError: lastError?.message });
    if (fallback) {
      try {
        return await fallback();
      } catch (e) {
      }
    }
    throw lastError;
  }
  // ── 状态机 ──────────────────────────────
  #onSuccess(endpoint) {
    const c = this.circuits[endpoint];
    if (c) {
      c.state = "CLOSED";
      c.failures = 0;
      c.lastSuccess = Date.now();
      Monitor.info("circuit", `Circuit CLOSED for ${endpoint}`);
    }
  }
  #onFailure(endpoint) {
    let c = this.circuits[endpoint];
    if (!c) c = this.circuits[endpoint] = { state: "CLOSED", failures: 0, lastFailure: null, nextProbeAt: 0, lastSuccess: null };
    c.failures++;
    c.lastFailure = Date.now();
    if (c.failures >= this.opts.failureThreshold && c.state !== "OPEN") {
      c.state = "OPEN";
      c.nextProbeAt = Date.now() + this.opts.circuitTimeout;
      Monitor.alert(
        "critical",
        `Circuit OPEN for ${endpoint}`,
        `${c.failures} consecutive failures. Next probe in ${this.opts.circuitTimeout / 1e3}s`
      );
      Monitor.error("circuit", `Circuit OPEN for ${endpoint}`, { failures: c.failures });
    }
  }
};
var retryCircuit = new RetryCircuit();

// src/core/sync-broker.js
var VERSION_SUFFIX = ":version";
var WAL_KEY = "wal:log";
var WAL_CAP = 200;
async function checksum(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 8);
}
__name(checksum, "checksum");
var SyncBroker = class _SyncBroker {
  static {
    __name(this, "SyncBroker");
  }
  /**
   * 安全读取 + 验证
   * @returns {Promise<{data:*, version:number, timestamp:number, valid:boolean}>}
   */
  static async read(env, key) {
    try {
      const [raw, verRaw] = await Promise.all([
        env.SkyXing.get(key),
        env.SkyXing.get(`${key}${VERSION_SUFFIX}`)
      ]);
      let version = 0, timestamp = 0, storedChecksum = null;
      if (verRaw) {
        try {
          const v = JSON.parse(verRaw);
          version = v.version || 0;
          timestamp = v.timestamp || 0;
          storedChecksum = v.checksum || null;
        } catch (_) {
          Monitor.warn("sync", `Corrupt version entry for ${key}`);
        }
      }
      if (raw === null) return { data: null, version, timestamp, valid: true };
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        Monitor.error("sync", `Corrupt JSON for ${key}`);
        return { data: null, version, timestamp, valid: false };
      }
      if (storedChecksum) {
        const actual = await checksum(raw);
        if (actual !== storedChecksum) {
          Monitor.warn("sync", `Checksum mismatch for ${key}`);
          return { data, version, timestamp, valid: false };
        }
      }
      return { data, version, timestamp, valid: true };
    } catch (e) {
      Monitor.error("sync", `read error for ${key}`, e.message);
      return { data: null, version: 0, timestamp: 0, valid: false };
    }
  }
  /**
   * 原子写入（乐观锁）
   * @param {number} [expectedVersion] - 不传则强制写入
   * @returns {Promise<{ok:boolean, version:number, conflict?:boolean, error?:string}>}
   */
  static async write(env, key, data, expectedVersion) {
    try {
      const now = Date.now();
      const raw = JSON.stringify(data);
      const cs = await checksum(raw);
      if (expectedVersion != null) {
        const current = await _SyncBroker.read(env, key);
        if (current.version !== expectedVersion) {
          Monitor.warn("sync", `Version conflict for ${key}`, { expected: expectedVersion, actual: current.version });
          return { ok: false, version: current.version, conflict: true, error: "Version conflict" };
        }
      }
      const newVersion = expectedVersion != null ? expectedVersion + 1 : 1;
      const versionEntry = JSON.stringify({ version: newVersion, timestamp: now, checksum: cs });
      await Promise.all([
        env.SkyXing.put(key, raw),
        env.SkyXing.put(`${key}${VERSION_SUFFIX}`, versionEntry)
      ]);
      await _SyncBroker.#appendWAL(env, { key, operation: "WRITE", version: newVersion, timestamp: now, checksum: cs });
      Monitor.debug("sync", `Write OK: ${key} v${newVersion}`);
      return { ok: true, version: newVersion };
    } catch (e) {
      Monitor.error("sync", `Write error for ${key}`, e.message);
      return { ok: false, version: 0, error: e.message };
    }
  }
  /**
   * 删除（带版本号）
   */
  static async del(env, key, expectedVersion) {
    try {
      if (expectedVersion != null) {
        const current = await _SyncBroker.read(env, key);
        if (current.version !== expectedVersion) {
          return { ok: false, conflict: true, error: "Version conflict on delete" };
        }
      }
      await Promise.all([
        env.SkyXing.delete(key),
        env.SkyXing.delete(`${key}${VERSION_SUFFIX}`)
      ]);
      await _SyncBroker.#appendWAL(env, { key, operation: "DELETE", version: expectedVersion, timestamp: Date.now() });
      return { ok: true };
    } catch (e) {
      Monitor.error("sync", `Delete error for ${key}`, e.message);
      return { ok: false, error: e.message };
    }
  }
  // ── 一致性扫描 ──────────────────────────
  static async syncCheck(env, prefix) {
    try {
      const list = await env.SkyXing.list({ prefix });
      const results = { consistent: true, total: 0, inconsistent: [] };
      for (const key of list.keys.map((k) => k.name)) {
        if (key.endsWith(VERSION_SUFFIX)) continue;
        results.total++;
        const r = await _SyncBroker.read(env, key);
        if (!r.valid) {
          results.consistent = false;
          results.inconsistent.push({ key, issue: "data_corrupt", version: r.version });
        }
      }
      Monitor.info("sync", `SyncCheck ${prefix}: ${results.inconsistent.length}/${results.total} inconsistent`);
      return results;
    } catch (e) {
      Monitor.error("sync", "syncCheck error", e.message);
      return { consistent: false, total: 0, inconsistent: [{ key: prefix, issue: "scan_error" }] };
    }
  }
  // ── WAL ───────────────────────────────────
  static async #appendWAL(env, entry) {
    try {
      const raw = await env.SkyXing.get(WAL_KEY);
      const wal = raw ? JSON.parse(raw) : [];
      wal.push(entry);
      while (wal.length > WAL_CAP) wal.shift();
      await env.SkyXing.put(WAL_KEY, JSON.stringify(wal));
    } catch (e) {
      Monitor.warn("sync", "WAL append failed", e.message);
    }
  }
  static async getWAL(env, limit = 50) {
    try {
      const raw = await env.SkyXing.get(WAL_KEY);
      return raw ? JSON.parse(raw).slice(-limit) : [];
    } catch (e) {
      return [];
    }
  }
  static async compactWAL(env, olderThanMs = 7 * 24 * 60 * 60 * 1e3) {
    try {
      const raw = await env.SkyXing.get(WAL_KEY);
      if (!raw) return { removed: 0 };
      const wal = JSON.parse(raw);
      const cutoff = Date.now() - olderThanMs;
      const kept = wal.filter((e) => e.timestamp > cutoff);
      const removed = wal.length - kept.length;
      if (removed > 0) await env.SkyXing.put(WAL_KEY, JSON.stringify(kept));
      Monitor.info("sync", `WAL compact: removed ${removed} entries`);
      return { removed };
    } catch (e) {
      return { removed: 0, error: e.message };
    }
  }
  // ── 回滚 ──────────────────────────────────
  static async rollback(env, key, targetVersion) {
    try {
      const current = await _SyncBroker.read(env, key);
      if (current.version <= targetVersion) {
        return { ok: false, error: "Target version not older than current" };
      }
      const raw = await env.SkyXing.get(WAL_KEY);
      if (!raw) return { ok: false, error: "No WAL history" };
      const wal = JSON.parse(raw);
      const target = wal.find((e) => e.key === key && e.version === targetVersion);
      if (!target) return { ok: false, error: "Target version not found in WAL" };
      const versionEntry = JSON.stringify({ version: targetVersion, timestamp: target.timestamp, checksum: target.checksum });
      await env.SkyXing.put(`${key}${VERSION_SUFFIX}`, versionEntry);
      await _SyncBroker.#appendWAL(env, { key, operation: "ROLLBACK", version: targetVersion, timestamp: Date.now() });
      Monitor.info("sync", `Rollback ${key} to v${targetVersion}`);
      return { ok: true, version: targetVersion };
    } catch (e) {
      Monitor.error("sync", `Rollback error for ${key}`, e.message);
      return { ok: false, error: e.message };
    }
  }
};

// src/core/self-heal.js
var SelfHeal = class _SelfHeal {
  static {
    __name(this, "SelfHeal");
  }
  /**
   * 全量健康检查
   * @returns {Promise<{status:string, issues:Array, summary:object}>}
   */
  static async runFullCheck(env) {
    const issues = [];
    const startTime = Date.now();
    try {
      const userList = await env.SkyXing.list({ prefix: "user:" });
      for (const k of userList.keys) {
        const name = k.name;
        const r = await SyncBroker.read(env, name);
        if (!r.valid) {
          issues.push({ type: "corrupt_user", key: name, detail: "JSON parse error or checksum mismatch" });
        } else if (r.data && !r.data.username) {
          issues.push({ type: "invalid_user", key: name, detail: "Missing username field" });
        }
      }
    } catch (e) {
      issues.push({ type: "scan_error", detail: "Failed to scan users: " + e.message });
    }
    try {
      const tokenList = await env.SkyXing.list({ prefix: "token:" });
      let orphanCount = 0;
      for (const k of tokenList.keys) {
        const username = await env.SkyXing.get(k.name);
        if (username) {
          const userExists = await env.SkyXing.get(`user:${username}`);
          if (!userExists) {
            orphanCount++;
            issues.push({ type: "orphan_token", key: k.name, username, detail: "Referenced user does not exist" });
          }
        }
      }
      if (orphanCount > 0) Monitor.warn("selfheal", `${orphanCount} orphan token(s) found`);
    } catch (e) {
      issues.push({ type: "scan_error", detail: "Failed to scan tokens: " + e.message });
    }
    const globalKeys = ["blogs", "files", "users_list", "notifications_list", "messages_list"];
    for (const gk of globalKeys) {
      try {
        const raw = await env.SkyXing.get(gk);
        if (raw) JSON.parse(raw);
      } catch (e) {
        issues.push({ type: "corrupt_global", key: gk, detail: e.message });
      }
    }
    const duration = Date.now() - startTime;
    const status = issues.length === 0 ? "healthy" : issues.length <= 3 ? "degraded" : "critical";
    Monitor.info("selfheal", `Full check: ${status}`, { issues: issues.length, duration: duration + "ms" });
    return {
      status,
      duration,
      issues: issues.slice(0, 50),
      summary: { total: issues.length, corrupt: issues.filter((i) => i.type.includes("corrupt")).length, orphan: issues.filter((i) => i.type.includes("orphan")).length }
    };
  }
  /**
   * 自动修复
   * @returns {Promise<{fixed:Array, skipped:Array, errors:Array}>}
   */
  static async autoRepair(env) {
    const fixed = [], skipped = [], errors = [];
    const startTime = Date.now();
    try {
      const tokenList = await env.SkyXing.list({ prefix: "token:" });
      for (const k of tokenList.keys) {
        try {
          const username = await env.SkyXing.get(k.name);
          if (!username) continue;
          const userExists = await env.SkyXing.get(`user:${username}`);
          if (!userExists) {
            await env.SkyXing.delete(k.name);
            fixed.push({ type: "orphan_token", key: k.name, action: "deleted" });
          }
        } catch (e) {
          skipped.push({ type: "token_cleanup_error", key: k.name, detail: e.message });
        }
      }
    } catch (e) {
      errors.push("token cleanup: " + e.message);
    }
    try {
      const result = await SyncBroker.compactWAL(env, 7 * 24 * 60 * 60 * 1e3);
      if (result.removed > 0) fixed.push({ type: "wal_compact", action: `Removed ${result.removed} old entries` });
    } catch (e) {
      errors.push("wal compact: " + e.message);
    }
    try {
      const rlList = await env.SkyXing.list({ prefix: "ratelimit:" });
      const expireTime = Date.now() - 36e5;
      let rlCleanCount = 0;
      for (const k of rlList.keys) {
        try {
          const data = JSON.parse(await env.SkyXing.get(k.name));
          if (data && data.timestamp && data.timestamp < expireTime) {
            await env.SkyXing.delete(k.name);
            rlCleanCount++;
          }
        } catch (_) {
          await env.SkyXing.delete(k.name);
          rlCleanCount++;
        }
      }
      if (rlCleanCount > 0) fixed.push({ type: "rate_limit_cleanup", action: `Cleaned ${rlCleanCount} expired counters` });
    } catch (e) {
      errors.push("rate limit cleanup: " + e.message);
    }
    const globalKeys = ["blogs", "files"];
    for (const gk of globalKeys) {
      try {
        const r = await SyncBroker.read(env, gk);
        if (!r.valid && r.data) {
          const result = await SyncBroker.write(env, gk, r.data, r.version);
          if (result.ok) fixed.push({ type: "data_repair", key: gk, action: "Rewrote with existing data" });
          else skipped.push({ type: "data_repair_failed", key: gk, detail: result.error });
        }
      } catch (e) {
        errors.push(`${gk} repair: ` + e.message);
      }
    }
    const duration = Date.now() - startTime;
    Monitor.info("selfheal", `AutoRepair: fixed=${fixed.length} skipped=${skipped.length} errors=${errors.length}`, { duration: duration + "ms" });
    await Monitor.persist(env);
    return { fixed, skipped, errors, duration };
  }
  /**
   * 获取健康报告（供管理面板使用）
   */
  static async getHealthReport(env) {
    const health = Monitor.healthCheck();
    const check = await _SelfHeal.runFullCheck(env);
    return {
      timestamp: Date.now(),
      monitor: {
        status: health.status,
        uptime: health.uptime,
        errorRate: health.metrics.errorRate,
        latencies: health.metrics.latencies,
        recentErrors: health.recentErrors.length
      },
      data: {
        status: check.status,
        issues: check.issues.slice(0, 20),
        summary: check.summary
      }
    };
  }
};

// src/index.js
var ROLE = {
  ADMIN: "admin",
  FEATURE_ADMIN: "feature_admin",
  USER: "user",
  GUEST: "guest"
};
var FEATURES = {
  USERS: "users",
  // 用户管理（查看、创建、编辑、删除用户）
  BLOGS: "blogs",
  // 博客管理（查看、删除文章）
  FILES: "files",
  // 文件管理（查看、删除文件）
  SLZX: "slzx",
  // 双流中学管理（导入、编辑、删除成绩及内容）
  NOTIFICATIONS: "notifs",
  // 通知管理（查看、发送、删除通知）
  MESSAGES: "messages",
  // 私信管理（查看、删除对话）
  CONFIG: "config"
  // 网站配置管理（查看、修改站点配置）
};
var ADMIN_USERS = ["kairui2011120"];
var RATE_LIMITS = {
  "login": { window: 6e4, max: 10 },
  // 1分钟最多10次登录尝试
  "register": { window: 36e5, max: 5 },
  // 1小时最多5次注册
  "blog_create": { window: 6e4, max: 3 },
  // 1分钟最多3篇博客
  "file_upload": { window: 6e4, max: 10 },
  // 1分钟最多10个文件
  "message_send": { window: 6e4, max: 20 },
  // 1分钟最多20条私信
  "api_global": { window: 1e4, max: 60 }
  // 10秒全局最多60次API调用
};
async function serveAsset(request, env) {
  try {
    return await env.assets.fetch(request);
  } catch (e) {
    return new Response("Not Found", { status: 404 });
  }
}
__name(serveAsset, "serveAsset");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/admin") {
      const rawUrl = request.url;
      if (rawUrl.includes("?") && !url.search) {
        return new Response(null, {
          status: 301,
          headers: { "Location": "/admin" }
        });
      }
      if (url.search) {
        return new Response(null, {
          status: 301,
          headers: { "Location": "/admin" }
        });
      }
      try {
        const assetUrl = new URL("/admin.html", request.url);
        const assetReq = new Request(assetUrl.toString(), { method: "GET" });
        return await env.assets.fetch(assetReq);
      } catch (e) {
        return new Response(getUnauthorizedPage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
    if (path.startsWith("/api/")) {
      const rateCheck = await checkGlobalRateLimit(request, env);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", retryAfter: rateCheck.retryAfter }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(rateCheck.retryAfter) }
        });
      }
      return handleAPI(request, env, ctx);
    }
    return serveAsset(request, env);
  },
  // Cron 定时任务处理器：定期系统优化 + 自愈 + 监控持久化
  async scheduled(controller, env, ctx) {
    console.log("[Cron] \u7CFB\u7EDF\u7EF4\u62A4\u4EFB\u52A1\u5F00\u59CB...");
    try {
      await Monitor.load(env);
      const optimReport = await runSystemOptimization(env);
      console.log("[Cron] \u7CFB\u7EDF\u4F18\u5316:", JSON.stringify(optimReport));
      const healReport = await SelfHeal.autoRepair(env);
      console.log("[Cron] \u81EA\u6108\u4FEE\u590D:", JSON.stringify({ fixed: healReport.fixed.length, skipped: healReport.skipped.length }));
      await Monitor.persist(env);
      console.log("[Cron] \u7CFB\u7EDF\u7EF4\u62A4\u5B8C\u6210");
    } catch (err) {
      console.error("[Cron] \u7CFB\u7EDF\u7EF4\u62A4\u5931\u8D25:", err.message);
    }
  }
};
function getUnauthorizedPage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\u672A\u6388\u6743\u8BBF\u95EE - SkyXing</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 3rem;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #ff6b6b;
        }
        p {
            color: rgba(255,255,255,0.7);
            margin-bottom: 2rem;
        }
        .btn {
            display: inline-block;
            padding: 0.8rem 2rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 8px;
            color: #fff;
            text-decoration: none;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">\u{1F512}</div>
        <h1>\u672A\u6388\u6743\u8BBF\u95EE</h1>
        <p>\u60A8\u6CA1\u6709\u6743\u9650\u8BBF\u95EE\u7BA1\u7406\u540E\u53F0<br>\u8BF7\u4F7F\u7528\u7BA1\u7406\u5458\u8D26\u53F7\u767B\u5F55</p>
        <a href="/user/login.html" class="btn">\u524D\u5F80\u767B\u5F55</a>
    </div>
</body>
</html>
    `;
}
__name(getUnauthorizedPage, "getUnauthorizedPage");
async function handleAPI(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  try {
    if (path === "/api/user/register" && method === "POST") {
      return await registerUser(request, env);
    }
    if (path === "/api/user/login" && method === "POST") {
      return await loginUser(request, env);
    }
    if (path === "/api/user/me" && method === "GET") {
      return await getCurrentUser(request, env);
    }
    if (path === "/api/user/logout" && method === "POST") {
      const cookieHeader = request.headers.get("Cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(";");
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split("=");
          if (name === "auth_token") {
            await env.SkyXing.delete(`token:${value}`);
            break;
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "auth_token=; Path=/; Max-Age=0"
        }
      });
    }
    if (path === "/api/user/update" && method === "POST") {
      return await updateUser(request, env);
    }
    if (path === "/api/user/changepassword" && method === "POST") {
      return await changeUserPassword(request, env);
    }
    if (path === "/api/user/delete" && method === "POST") {
      return await deleteUser(request, env);
    }
    if (path === "/api/blog/create" && method === "POST") {
      return await createBlog(request, env);
    }
    if (path === "/api/blog/list" && method === "GET") {
      return await listBlogs(request, env);
    }
    if (path === "/api/blog/get" && method === "GET") {
      return await getBlog(request, env);
    }
    if (path === "/api/blog/update" && method === "POST") {
      return await updateBlog(request, env);
    }
    if (path === "/api/blog/delete" && method === "POST") {
      return await deleteBlog(request, env);
    }
    if (path === "/api/share/upload" && method === "POST") {
      return await uploadFile(request, env);
    }
    if (path === "/api/share/list" && method === "GET") {
      return await listFiles(request, env);
    }
    if (path === "/api/share/download" && method === "GET") {
      return await downloadFile(request, env);
    }
    if (path === "/api/share/delete" && method === "POST") {
      return await deleteFile(request, env);
    }
    if (path === "/api/admin/verify" && method === "POST") {
      return await adminVerify(request, env);
    }
    if (path === "/api/admin/debug-token" && method === "GET") {
      return await adminDebugToken(request, env);
    }
    if (path === "/api/admin/config" && method === "GET") {
      return await adminGetConfig(request, env);
    }
    if (path === "/api/admin/config" && method === "POST") {
      return await adminSaveConfig(request, env);
    }
    if (path === "/api/admin/export" && method === "GET") {
      return await adminExportData(request, env);
    }
    if (path === "/api/admin/clear" && method === "POST") {
      return await adminClearData(request, env);
    }
    if (path === "/api/admin/users" && method === "GET") {
      return await adminGetUsers(request, env);
    }
    if (path === "/api/admin/user/create" && method === "POST") {
      return await adminCreateUser(request, env);
    }
    if (path === "/api/admin/user/update" && method === "POST") {
      return await adminUpdateUser(request, env);
    }
    if (path === "/api/admin/user/reset-password" && method === "POST") {
      return await adminResetPassword(request, env);
    }
    if (path === "/api/admin/user/delete" && method === "POST") {
      return await adminDeleteUser(request, env);
    }
    if (path === "/api/admin/notifications" && method === "GET") {
      return await adminGetNotifications(request, env);
    }
    if (path === "/api/admin/notifications/send" && method === "POST") {
      return await adminSendNotification(request, env);
    }
    if (path === "/api/admin/notifications/delete" && method === "POST") {
      return await adminDeleteNotification(request, env);
    }
    if (path === "/api/admin/messages" && method === "GET") {
      return await adminGetMessages(request, env);
    }
    if (path === "/api/admin/messages/delete" && method === "POST") {
      return await adminDeleteMessage(request, env);
    }
    if (path === "/api/admin/blog/delete" && method === "POST") {
      return await adminDeleteBlog(request, env);
    }
    if (path === "/api/admin/permissions/list" && method === "GET") {
      return await adminGetPermissions(request, env);
    }
    if (path === "/api/admin/permissions/set" && method === "POST") {
      return await adminSetPermissions(request, env);
    }
    if (path === "/api/admin/permissions/revoke" && method === "POST") {
      return await adminRevokePermissions(request, env);
    }
    if (path === "/api/admin/optimization/run" && method === "POST") {
      return await adminRunOptimization(request, env);
    }
    if (path === "/api/admin/optimization/log" && method === "GET") {
      return await adminGetOptimizationLog(request, env);
    }
    if (path === "/api/slzx/content") {
      return await slzxContent(request, env);
    }
    if (path === "/api/slzx/scores" && method === "GET") {
      return await slzxGetScores(request, env);
    }
    if (path === "/api/slzx/scores/excel" && method === "POST") {
      return await slzxImportExcel(request, env);
    }
    if (path === "/api/slzx/scores/photo" && method === "POST") {
      return await slzxUploadPhoto(request, env);
    }
    if (path === "/api/slzx/scores/link" && method === "POST") {
      return await slzxAddLink(request, env);
    }
    if (path === "/api/slzx/scores/delete" && method === "POST") {
      return await slzxDeleteScore(request, env);
    }
    if (path === "/api/slzx/scores/update" && method === "POST") {
      return await slzxUpdateScore(request, env);
    }
    if (path === "/api/slzx/bindings" && method === "GET") {
      return await slzxGetBindings(request, env);
    }
    if (path === "/api/slzx/bindings/bind" && method === "POST") {
      return await slzxBindStudent(request, env);
    }
    if (path === "/api/slzx/bindings/unbind" && method === "POST") {
      return await slzxUnbindStudent(request, env);
    }
    if (path === "/api/user/logs" && method === "GET") {
      return await getUserLogs(request, env);
    }
    if (path === "/api/users/search" && method === "GET") {
      return await searchUsers(request, env);
    }
    if (path === "/api/notifications/list" && method === "GET") {
      return await getNotifications(request, env);
    }
    if (path === "/api/notifications/unread-count" && method === "GET") {
      return await getUnreadCount(request, env);
    }
    if (path === "/api/notifications/read" && method === "POST") {
      return await markNotificationRead(request, env);
    }
    if (path === "/api/notifications/read-all" && method === "POST") {
      return await markAllNotificationsRead(request, env);
    }
    if (path === "/api/notifications/delete" && method === "POST") {
      return await deleteNotification(request, env);
    }
    if (path === "/api/messages/list" && method === "GET") {
      return await getConversations(request, env);
    }
    if (path === "/api/messages/conversation" && method === "GET") {
      return await getConversation(request, env);
    }
    if (path === "/api/messages/send" && method === "POST") {
      return await sendMessage(request, env);
    }
    if (path === "/api/messages/delete" && method === "POST") {
      return await deleteConversation(request, env);
    }
    if (path === "/api/admin/monitor/health" && method === "GET") {
      return await monitorHealth(request, env);
    }
    if (path === "/api/admin/monitor/circuits" && method === "GET") {
      return await monitorCircuits(request, env);
    }
    if (path === "/api/admin/selfheal/check" && method === "POST") {
      return await selfHealCheck(request, env);
    }
    if (path === "/api/admin/selfheal/run" && method === "POST") {
      return await selfHealRun(request, env);
    }
    return new Response(JSON.stringify({ success: false, message: "API\u4E0D\u5B58\u5728" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleAPI, "handleAPI");
async function registerUser(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (username.length < 3 || username.length > 20) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u957F\u5EA6\u5E94\u4E3A3-20\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ success: false, message: "\u5BC6\u7801\u81F3\u5C116\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateCheck = await checkRateLimit(env, `register:${ip}`, RATE_LIMITS.register.window, RATE_LIMITS.register.max);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, message: "\u6CE8\u518C\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }
  const existingUser = await env.SkyXing.get(`user:${username}`);
  if (existingUser) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const role = ADMIN_USERS.includes(username) ? ROLE.ADMIN : ROLE.USER;
  const { hash, salt } = await hashPassword(password);
  const user = {
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    createdAt: Date.now(),
    lastLogin: Date.now()
  };
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  return new Response(JSON.stringify({
    success: true,
    message: "\u6CE8\u518C\u6210\u529F" + (role === ROLE.ADMIN ? "\uFF08\u7BA1\u7406\u5458\u8D26\u53F7\uFF09" : "")
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(registerUser, "registerUser");
async function loginUser(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const rateCheck = await checkRateLimit(env, `login:${username}`, RATE_LIMITS.login.window, RATE_LIMITS.login.max);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, message: "\u767B\u5F55\u5C1D\u8BD5\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  if (typeof user.password === "string" && !user.passwordHash) {
    if (user.password !== password) {
      return new Response(JSON.stringify({ success: false, message: "\u5BC6\u7801\u9519\u8BEF" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const { hash, salt } = await hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    delete user.password;
  } else {
    const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) {
      return new Response(JSON.stringify({ success: false, message: "\u5BC6\u7801\u9519\u8BEF" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (ADMIN_USERS.includes(username) && user.role !== ROLE.ADMIN) {
    user.role = ROLE.ADMIN;
  }
  user.lastLogin = Date.now();
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  const timestamp = Date.now();
  const token = await signToken(username, timestamp);
  await env.SkyXing.put(`token:${token}`, username);
  const redirectTarget = user.role === ROLE.ADMIN || user.role === ROLE.FEATURE_ADMIN ? "/admin" : "/";
  return new Response(JSON.stringify({
    success: true,
    message: "\u767B\u5F55\u6210\u529F",
    user: {
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    },
    token,
    redirect: redirectTarget
  }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": createSecureCookie("auth_token", token)
    }
  });
}
__name(loginUser, "loginUser");
async function getCurrentUser(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u672A\u767B\u5F55" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const stats = {
    blogCount: 0,
    fileCount: 0,
    downloadCount: 0
  };
  const blogs = await env.SkyXing.get("blogs");
  if (blogs) {
    const blogList = JSON.parse(blogs);
    stats.blogCount = blogList.filter((b) => b.author === user.username).length;
  }
  const files = await env.SkyXing.get("files");
  if (files) {
    const fileList = JSON.parse(files);
    stats.fileCount = fileList.filter((f) => f.uploader === user.username).length;
    stats.downloadCount = fileList.reduce((sum, f) => sum + (f.downloads || 0), 0);
  }
  return new Response(JSON.stringify({
    success: true,
    user: {
      username: user.username,
      role: user.role,
      isGlobalAdmin: user.role === ROLE.ADMIN,
      permissions: user.role === ROLE.ADMIN ? Object.values(FEATURES) : user.permissions || [],
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      email: user.email,
      bio: user.bio
    },
    stats
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getCurrentUser, "getCurrentUser");
async function updateUser(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const { email, bio } = await request.json();
  user.email = email || "";
  user.bio = bio || "";
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${user.username}`, JSON.stringify(user));
  return new Response(JSON.stringify({ success: true, message: "\u4FDD\u5B58\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(updateUser, "updateUser");
async function changeUserPassword(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (newPassword.length < 6) {
    return new Response(JSON.stringify({ success: false, message: "\u65B0\u5BC6\u7801\u81F3\u5C116\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let currentValid = false;
  if (typeof user.password === "string") {
    currentValid = user.password === currentPassword;
    if (currentValid) {
      const { hash: hash2, salt: salt2 } = await hashPassword(currentPassword);
      user.passwordHash = hash2;
      user.passwordSalt = salt2;
      delete user.password;
    }
  } else if (user.passwordHash) {
    currentValid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
  }
  if (!currentValid) {
    return new Response(JSON.stringify({ success: false, message: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const { hash, salt } = await hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  delete user.password;
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${user.username}`, JSON.stringify(user));
  return new Response(JSON.stringify({ success: true, message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(changeUserPassword, "changeUserPassword");
async function deleteUser(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.SkyXing.delete(`user:${user.username}`);
  const tokenList = await env.SkyXing.list({ prefix: "token:" });
  for (const key of tokenList.keys) {
    const username = await env.SkyXing.get(key.name);
    if (username === user.username) {
      await env.SkyXing.delete(key.name);
      break;
    }
  }
  const blogsJson = await env.SkyXing.get("blogs");
  if (blogsJson) {
    const blogs = JSON.parse(blogsJson).filter((b) => b.author !== user.username);
    await env.SkyXing.put("blogs", JSON.stringify(blogs));
  }
  const filesJson = await env.SkyXing.get("files");
  if (filesJson) {
    const files = JSON.parse(filesJson).filter((f) => f.uploader !== user.username);
    await env.SkyXing.put("files", JSON.stringify(files));
  }
  return new Response(JSON.stringify({ success: true, message: "\u8D26\u53F7\u5DF2\u6CE8\u9500" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteUser, "deleteUser");
async function getUserLogs(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const logType = url.searchParams.get("type") || "all";
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
  const exportAll = url.searchParams.get("export") === "1";
  const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
  const toTs = dateTo ? (/* @__PURE__ */ new Date(dateTo + "T23:59:59")).getTime() : Date.now();
  const entries = [];
  if (logType === "all" || logType === "notifications") {
    const notifData = await env.SkyXing.get(`notifications:${user.username}`);
    if (notifData) {
      const notifications = JSON.parse(notifData);
      for (const n of notifications) {
        if (n.createdAt >= fromTs && n.createdAt <= toTs) {
          entries.push({
            id: n.id || "",
            type: "\u901A\u77E5",
            category: n.type || "system",
            content: n.content || "",
            related: n.link || "",
            status: n.read ? "\u5DF2\u8BFB" : "\u672A\u8BFB",
            createdAt: n.createdAt
          });
        }
      }
    }
  }
  if (logType === "all" || logType === "messages") {
    const msgData = await env.SkyXing.get(`messages:${user.username}`);
    if (msgData) {
      const messages = JSON.parse(msgData);
      for (const m of messages) {
        if (m.createdAt >= fromTs && m.createdAt <= toTs) {
          entries.push({
            id: m.id || "",
            type: m.from === user.username ? "\u79C1\u4FE1-\u53D1\u51FA" : "\u79C1\u4FE1-\u6536\u5230",
            category: "message",
            content: m.content || "",
            related: m.from === user.username ? m.to : m.from,
            status: m.read ? "\u5DF2\u8BFB" : m.from === user.username ? "\u5DF2\u53D1\u9001" : "\u672A\u8BFB",
            createdAt: m.createdAt
          });
        }
      }
    }
  }
  entries.sort((a, b) => b.createdAt - a.createdAt);
  const total = entries.length;
  if (exportAll) {
    return new Response(JSON.stringify({
      success: true,
      entries,
      total
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const start = (page - 1) * limit;
  const paged = entries.slice(start, start + limit);
  return new Response(JSON.stringify({
    success: true,
    entries: paged,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getUserLogs, "getUserLogs");
async function adminDebugToken(request, env) {
  const token = extractToken(request);
  const result = {
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 20) + "..." : null,
    steps: []
  };
  if (!token) {
    result.steps.push({ step: "extract", status: "FAIL", detail: "No token in Authorization header or Cookie" });
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }
  result.steps.push({ step: "extract", status: "OK", detail: `token length=${token.length}` });
  try {
    const decoded = atob(token);
    const parts = decoded.split(":");
    result.steps.push({ step: "base64_decode", status: "OK", detail: `parts count=${parts.length}, raw="${decoded}"` });
    if (parts.length !== 3) {
      result.steps.push({ step: "format_check", status: "FAIL", detail: `Expected 3 parts, got ${parts.length}` });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }
    const [username, timestampStr, signature] = parts;
    result.username = username;
    result.timestampStr = timestampStr;
    result.signature = signature;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      result.steps.push({ step: "timestamp_parse", status: "FAIL", detail: `Invalid timestamp: "${timestampStr}"` });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }
    result.steps.push({ step: "timestamp_parse", status: "OK", detail: `timestamp=${timestamp}` });
    const age = Date.now() - timestamp;
    const ttl = 7 * 24 * 60 * 60 * 1e3;
    result.tokenAgeMs = age;
    result.tokenTtlMs = ttl;
    if (age > ttl) {
      result.steps.push({ step: "expiry_check", status: "FAIL", detail: `Expired: age=${(age / 1e3 / 3600).toFixed(1)}h > TTL=7d` });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }
    result.steps.push({ step: "expiry_check", status: "OK", detail: `Age ${(age / 1e3).toFixed(0)}s < TTL ${ttl / 1e3}s` });
    const payload = `${username}:${timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("skyxing-auth-secret-v2"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const computedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const computedHex = Array.from(new Uint8Array(computedSig)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
    result.computedSig = computedHex;
    result.sigMatch = signature === computedHex;
    if (signature !== computedHex) {
      result.steps.push({ step: "hmac_verify", status: "FAIL", detail: `Signature mismatch: expected="${computedHex}" got="${signature}"` });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }
    result.steps.push({ step: "hmac_verify", status: "OK", detail: `Signature matches: ${signature}` });
    const user = await getUser(env, username);
    if (!user) {
      result.steps.push({ step: "kv_user_lookup", status: "FAIL", detail: `User not found: user:${username}` });
    } else {
      result.userFound = true;
      result.userRole = user.role;
      result.steps.push({ step: "kv_user_lookup", status: "OK", detail: `user=${username} role=${user.role}` });
    }
    result.overall = user ? "PASS" : "FAIL (user not found)";
  } catch (e) {
    result.steps.push({ step: "exception", status: "ERROR", detail: e.message || String(e) });
    result.overall = "ERROR";
  }
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}
__name(adminDebugToken, "adminDebugToken");
async function verifyUser(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const token = extractToken(request);
  if (!token) {
    console.log("[Auth] verifyUser[" + path + "]: no token in request");
    return null;
  }
  console.log("[Auth] verifyUser[" + path + "]: token_len=" + token.length + " first4=" + token.substring(0, 4) + " last4=" + token.substring(Math.max(0, token.length - 4)));
  const payload = await verifyToken(token);
  if (payload) {
    console.log("[Auth] verifyUser[" + path + "]: stateless OK, user=" + payload.username);
    const user2 = await getUser(env, payload.username);
    if (user2) {
      console.log("[Auth] verifyUser[" + path + "]: PASS user=" + user2.username + " role=" + user2.role);
      return user2;
    }
    console.log("[Auth] verifyUser[" + path + "]: FAIL - user not found in KV: user:" + payload.username);
    return null;
  }
  console.log("[Auth] verifyUser[" + path + "]: stateless FAILED, fallback to KV");
  const username = await env.SkyXing.get(`token:${token}`);
  if (!username) {
    console.log("[Auth] verifyUser[" + path + "]: FAIL - both methods failed");
    return null;
  }
  const user = await getUser(env, username);
  console.log("[Auth] verifyUser[" + path + "]: PASS via KV, user=" + (user ? user.username : "null") + " role=" + (user ? user.role : "null"));
  return user;
}
__name(verifyUser, "verifyUser");
async function createBlog(request, env) {
  const authHeader = request.headers.get("Authorization");
  const cookie = request.headers.get("Cookie");
  if (!authHeader && !cookie) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const { title, content } = await request.json();
  if (!title || !content) {
    return new Response(JSON.stringify({ success: false, message: "\u6807\u9898\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u672A\u627E\u5230" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const rateCheck = await checkRateLimit(env, `blog_create:${user.username}`, RATE_LIMITS.blog_create.window, RATE_LIMITS.blog_create.max);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, message: "\u53D1\u5E03\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }
  const blog = {
    id: generateId(),
    title,
    content,
    author: user.username,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    views: 0
  };
  const blogsJson = await env.SkyXing.get("blogs");
  const blogs = blogsJson ? JSON.parse(blogsJson) : [];
  blogs.unshift(blog);
  await env.SkyXing.put("blogs", JSON.stringify(blogs));
  return new Response(JSON.stringify({ success: true, message: "\u53D1\u5E03\u6210\u529F", id: blog.id }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(createBlog, "createBlog");
async function listBlogs(request, env) {
  const blogsJson = await env.SkyXing.get("blogs");
  const blogs = blogsJson ? JSON.parse(blogsJson) : [];
  return new Response(JSON.stringify({
    success: true,
    articles: blogs
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(listBlogs, "listBlogs");
async function getBlog(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ success: false, message: "\u7F3A\u5C11\u6587\u7AE0ID" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const blogsJson = await env.SkyXing.get("blogs");
  const blogs = blogsJson ? JSON.parse(blogsJson) : [];
  const blog = blogs.find((b) => b.id === id);
  if (!blog) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u7AE0\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  blog.views = (blog.views || 0) + 1;
  await env.SkyXing.put("blogs", JSON.stringify(blogs));
  return new Response(JSON.stringify({ success: true, article: blog }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getBlog, "getBlog");
async function updateBlog(request, env) {
  const { id, title, content } = await request.json();
  const blogsJson = await env.SkyXing.get("blogs");
  const blogs = blogsJson ? JSON.parse(blogsJson) : [];
  const index = blogs.findIndex((b) => b.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u7AE0\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  blogs[index].title = title;
  blogs[index].content = content;
  blogs[index].updatedAt = Date.now();
  await env.SkyXing.put("blogs", JSON.stringify(blogs));
  return new Response(JSON.stringify({ success: true, message: "\u4FDD\u5B58\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(updateBlog, "updateBlog");
async function deleteBlog(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  const blogsJson = await env.SkyXing.get("blogs");
  const blogs = blogsJson ? JSON.parse(blogsJson) : [];
  const index = blogs.findIndex((b) => b.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u7AE0\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  blogs.splice(index, 1);
  await env.SkyXing.put("blogs", JSON.stringify(blogs));
  return new Response(JSON.stringify({ success: true, message: "\u5220\u9664\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteBlog, "deleteBlog");
async function uploadFile(request, env) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !file.name) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u9009\u62E9\u6587\u4EF6" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = await verifyUser(request, env);
  const uploader = user ? user.username : "\u533F\u540D\u7528\u6237";
  if (user) {
    const rateCheck = await checkRateLimit(env, `file_upload:${uploader}`, RATE_LIMITS.file_upload.window, RATE_LIMITS.file_upload.max);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ success: false, message: "\u4E0A\u4F20\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const fileId = generateId();
  const fileMeta = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploader,
    uploads: 1,
    downloads: 0,
    createdAt: Date.now()
  };
  const MAX_KV_FILE_SIZE = 25 * 1024 * 1024;
  if (file.size <= MAX_KV_FILE_SIZE) {
    const fileBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(fileBuffer);
    const chunkSize = 8192;
    let base64Data = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      base64Data += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunkSize)));
    }
    base64Data = btoa(base64Data);
    await env.SkyXing.put(`file:${fileId}`, base64Data);
    fileMeta.storage = "kv";
  } else if (env.SkyXing_FILES) {
    await env.SkyXing_FILES.put(fileId + "_" + file.name, file.stream());
    fileMeta.storage = "r2";
  } else {
    return new Response(JSON.stringify({
      success: false,
      message: "\u6587\u4EF6\u8FC7\u5927\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u914D\u7F6ER2\u5B58\u50A8"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const filesJson = await env.SkyXing.get("files");
  const files = filesJson ? JSON.parse(filesJson) : [];
  files.unshift(fileMeta);
  await env.SkyXing.put("files", JSON.stringify(files));
  return new Response(JSON.stringify({ success: true, message: "\u4E0A\u4F20\u6210\u529F", id: fileId }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(uploadFile, "uploadFile");
async function listFiles(request, env) {
  const filesJson = await env.SkyXing.get("files");
  const files = filesJson ? JSON.parse(filesJson) : [];
  return new Response(JSON.stringify({
    success: true,
    files
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(listFiles, "listFiles");
async function downloadFile(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ success: false, message: "\u7F3A\u5C11\u6587\u4EF6ID" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const filesJson = await env.SkyXing.get("files");
  const files = filesJson ? JSON.parse(filesJson) : [];
  const file = files.find((f) => f.id === id);
  if (!file) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  file.downloads = (file.downloads || 0) + 1;
  await env.SkyXing.put("files", JSON.stringify(files));
  if (file.storage === "kv") {
    const base64Data = await env.SkyXing.get(`file:${id}`);
    if (base64Data) {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Response(bytes, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`
        }
      });
    }
  } else if (env.SkyXing_FILES) {
    const fileObject = await env.SkyXing_FILES.get(id + "_" + file.name);
    if (fileObject) {
      return new Response(fileObject.body, {
        headers: {
          "Content-Type": fileObject.httpMetadata.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`
        }
      });
    }
  }
  return new Response(JSON.stringify({ success: false, message: "\u6587\u4EF6\u672A\u627E\u5230" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(downloadFile, "downloadFile");
async function deleteFile(request, env) {
  const id = new URL(request.url).searchParams.get("id");
  const filesJson = await env.SkyXing.get("files");
  const files = filesJson ? JSON.parse(filesJson) : [];
  const index = files.findIndex((f) => f.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const file = files[index];
  if (file.storage === "kv") {
    await env.SkyXing.delete(`file:${id}`);
  } else if (env.SkyXing_FILES) {
    await env.SkyXing_FILES.delete(id + "_" + file.name);
  }
  files.splice(index, 1);
  await env.SkyXing.put("files", JSON.stringify(files));
  return new Response(JSON.stringify({ success: true, message: "\u5220\u9664\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteFile, "deleteFile");
async function verifyAdmin(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return { authorized: false, message: "\u8BF7\u5148\u767B\u5F55" };
  }
  if (user.role !== ROLE.ADMIN) {
    return { authorized: false, message: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650" };
  }
  return { authorized: true, user };
}
__name(verifyAdmin, "verifyAdmin");
async function verifyFeatureAccess(request, env, feature) {
  const token = extractToken(request);
  if (!token) {
    return { authorized: false, message: "\u8BF7\u5148\u767B\u5F55", _reason: "no_token_in_request" };
  }
  const vtResult = await verifyToken(token);
  if (!vtResult) {
    return { authorized: false, message: "\u8BF7\u5148\u767B\u5F55", _reason: "verifyToken_failed", _tokenLen: token.length, _tokenPrefix: token.substring(0, 20) };
  }
  const user = await getUser(env, vtResult.username);
  if (!user) {
    return { authorized: false, message: "\u7528\u6237\u6570\u636E\u5F02\u5E38", _reason: "getUser_failed_for:" + vtResult.username };
  }
  if (user.role === ROLE.ADMIN) {
    return { authorized: true, user, isGlobalAdmin: true };
  }
  if (user.role === ROLE.FEATURE_ADMIN) {
    if (user.permissions && Array.isArray(user.permissions) && user.permissions.includes(feature)) {
      return { authorized: true, user, isGlobalAdmin: false };
    }
    return { authorized: false, message: "\u60A8\u6CA1\u6709\u6B64\u529F\u80FD\u6A21\u5757\u7684\u7BA1\u7406\u6743\u9650", _reason: "feature_admin_lacks_permission:" + feature };
  }
  return { authorized: false, message: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", _reason: "user_role_not_admin:" + (user.role || "undefined") };
}
__name(verifyFeatureAccess, "verifyFeatureAccess");
async function adminVerify(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  let passwordValid = false;
  if (typeof user.password === "string") {
    passwordValid = user.password === password;
  } else if (user.passwordHash) {
    passwordValid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  }
  if (!passwordValid) {
    return new Response(JSON.stringify({ success: false, message: "\u5BC6\u7801\u9519\u8BEF" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (user.role !== ROLE.ADMIN && user.role !== ROLE.FEATURE_ADMIN) {
    return new Response(JSON.stringify({ success: false, message: "\u60A8\u6CA1\u6709\u7BA1\u7406\u5458\u6743\u9650" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const timestamp = Date.now();
  const token = await signToken(username, timestamp);
  console.log("[Auth] adminVerify: token generated, len=" + token.length + " prefix=" + token.substring(0, 15));
  await env.SkyXing.put(`token:${token}`, username);
  console.log("[Auth] adminVerify: token stored in KV");
  return new Response(JSON.stringify({
    success: true,
    token,
    redirect: "/admin"
  }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": createSecureCookie("auth_token", token)
    }
  });
}
__name(adminVerify, "adminVerify");
async function adminGetConfig(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.CONFIG);
  if (!check.authorized) {
    const token = extractToken(request);
    return new Response(JSON.stringify({
      success: false,
      message: check.message,
      _diag: {
        hasToken: !!token,
        tokenLen: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 30) + "..." : null,
        reason: check._reason || "verifyUser returned null"
      }
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const config = await env.SkyXing.get("site_config");
  return new Response(JSON.stringify({
    success: true,
    config: config ? JSON.parse(config) : {}
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetConfig, "adminGetConfig");
async function adminSaveConfig(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.CONFIG);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { config, type } = await request.json();
  let existingConfig = {};
  const existing = await env.SkyXing.get("site_config");
  if (existing) {
    existingConfig = JSON.parse(existing);
  }
  const newConfig = { ...existingConfig, ...config };
  await env.SkyXing.put("site_config", JSON.stringify(newConfig));
  return new Response(JSON.stringify({ success: true, message: "\u4FDD\u5B58\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminSaveConfig, "adminSaveConfig");
async function adminExportData(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const blogs = await env.SkyXing.get("blogs");
  const files = await env.SkyXing.get("files");
  const config = await env.SkyXing.get("site_config");
  const users = [];
  const userList = await env.SkyXing.list({ prefix: "user:" });
  for (const key of userList.keys) {
    const userData = await env.SkyXing.get(key.name);
    if (userData) {
      const user = JSON.parse(userData);
      delete user.password;
      delete user.passwordHash;
      delete user.passwordSalt;
      users.push(user);
    }
  }
  return new Response(JSON.stringify({
    success: true,
    exportTime: (/* @__PURE__ */ new Date()).toISOString(),
    blogs: blogs ? JSON.parse(blogs) : [],
    files: files ? JSON.parse(files) : [],
    users,
    config: config ? JSON.parse(config) : {}
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminExportData, "adminExportData");
async function adminClearData(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.SkyXing.delete("blogs");
  await env.SkyXing.delete("files");
  const userList = await env.SkyXing.list({ prefix: "user:" });
  for (const key of userList.keys) {
    await env.SkyXing.delete(key.name);
  }
  const adminUser = {
    username: check.user.username,
    passwordHash: check.user.passwordHash,
    passwordSalt: check.user.passwordSalt,
    role: ROLE.ADMIN,
    createdAt: check.user.createdAt,
    lastLogin: Date.now()
  };
  await env.SkyXing.put(`user:${check.user.username}`, JSON.stringify(adminUser));
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u6E05\u7A7A\u6240\u6709\u6570\u636E\uFF08\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u6062\u590D\uFF09" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminClearData, "adminClearData");
async function searchUsers(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (!query || query.length < 1) {
    return new Response(JSON.stringify({ success: true, users: [] }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const userList = await env.SkyXing.list({ prefix: "user:" });
  const matched = [];
  for (const key of userList.keys) {
    const userData = await env.SkyXing.get(key.name);
    if (userData) {
      const user2 = JSON.parse(userData);
      const username = user2.username.toLowerCase();
      if (username.includes(query) && username !== user2.username.toLowerCase()) {
        matched.push({ username: user2.username });
      }
    }
  }
  const result = matched.slice(0, 8);
  return new Response(JSON.stringify({ success: true, users: result }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(searchUsers, "searchUsers");
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
__name(generateId, "generateId");
async function adminGetUsers(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userList = await env.SkyXing.list({ prefix: "user:" });
  const users = [];
  for (const key of userList.keys) {
    const userData = await env.SkyXing.get(key.name);
    if (userData) {
      const user = JSON.parse(userData);
      users.push({
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        email: user.email,
        bio: user.bio,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    }
  }
  users.sort((a, b) => b.createdAt - a.createdAt);
  return new Response(JSON.stringify({ success: true, users }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetUsers, "adminGetUsers");
async function adminCreateUser(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username, password, role } = await request.json();
  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (username.length < 3 || username.length > 20) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u957F\u5EA6\u5E94\u4E3A3-20\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ success: false, message: "\u5BC6\u7801\u81F3\u5C116\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const existingUser = await env.SkyXing.get(`user:${username}`);
  if (existingUser) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let userRole;
  let userPermissions = null;
  if (ADMIN_USERS.includes(username)) {
    userRole = ROLE.ADMIN;
  } else if (role === ROLE.FEATURE_ADMIN) {
    if (!check.isGlobalAdmin) {
      return new Response(JSON.stringify({ success: false, message: "\u53EA\u6709\u5168\u5C40\u7BA1\u7406\u5458\u624D\u80FD\u521B\u5EFA\u529F\u80FD\u7BA1\u7406\u5458" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    userRole = ROLE.FEATURE_ADMIN;
    userPermissions = [];
  } else if (role === ROLE.ADMIN) {
    if (!check.isGlobalAdmin) {
      return new Response(JSON.stringify({ success: false, message: "\u53EA\u6709\u5168\u5C40\u7BA1\u7406\u5458\u624D\u80FD\u521B\u5EFA\u5168\u5C40\u7BA1\u7406\u5458" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    userRole = ROLE.ADMIN;
  } else {
    userRole = ROLE.USER;
  }
  const { hash, salt } = await hashPassword(password);
  const user = {
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role: userRole,
    createdAt: Date.now(),
    lastLogin: Date.now()
  };
  if (userPermissions !== null) {
    user.permissions = userPermissions;
  }
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  return new Response(JSON.stringify({ success: true, message: "\u7528\u6237\u521B\u5EFA\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminCreateUser, "adminCreateUser");
async function adminUpdateUser(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username, role, permissions } = await request.json();
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  if (username === check.user.username && !check.isGlobalAdmin) {
    return new Response(JSON.stringify({ success: false, message: "\u4E0D\u80FD\u4FEE\u6539\u81EA\u5DF1\u7684\u7BA1\u7406\u5458\u89D2\u8272" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (ADMIN_USERS.includes(username)) {
    user.role = ROLE.ADMIN;
    delete user.permissions;
  } else if (role === ROLE.FEATURE_ADMIN) {
    if (!check.isGlobalAdmin) {
      return new Response(JSON.stringify({ success: false, message: "\u53EA\u6709\u5168\u5C40\u7BA1\u7406\u5458\u624D\u80FD\u8BBE\u7F6E\u529F\u80FD\u7BA1\u7406\u5458" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    user.role = ROLE.FEATURE_ADMIN;
    user.permissions = permissions && Array.isArray(permissions) ? permissions : [];
  } else if (role === ROLE.ADMIN) {
    if (!check.isGlobalAdmin) {
      return new Response(JSON.stringify({ success: false, message: "\u53EA\u6709\u5168\u5C40\u7BA1\u7406\u5458\u624D\u80FD\u8BBE\u7F6E\u5168\u5C40\u7BA1\u7406\u5458" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    user.role = ROLE.ADMIN;
    delete user.permissions;
  } else {
    user.role = ROLE.USER;
    delete user.permissions;
  }
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  if (user.role === ROLE.FEATURE_ADMIN) {
    const featureNames = user.permissions && user.permissions.length > 0 ? user.permissions.map((p) => getFeatureName(p)).join("\u3001") : "\u6682\u65E0";
    await createNotification(
      env,
      username,
      "system",
      `\u{1F389} \u529F\u80FD\u7BA1\u7406\u5458\u4EFB\u547D\u901A\u77E5

\u60A8\u597D\uFF01\u60A8\u5DF2\u88AB\u6B63\u5F0F\u4EFB\u547D\u4E3A SkyXing \u529F\u80FD\u7BA1\u7406\u5458\u3002

\u5F53\u524D\u6388\u6743\u6A21\u5757\uFF1A${featureNames}

\u8BF7\u79C9\u6301\u516C\u5E73\u3001\u516C\u6B63\u3001\u5BA2\u89C2\u7684\u539F\u5219\u884C\u4F7F\u7BA1\u7406\u804C\u8D23\uFF0C\u59A5\u5584\u4FDD\u7BA1\u8D26\u53F7\u5BC6\u7801\u3002\u5982\u6709\u7591\u95EE\u8BF7\u8054\u7CFB\u5168\u5C40\u7BA1\u7406\u5458\u3002`,
      "/user/profile.html",
      "\u7CFB\u7EDF"
    );
  }
  return new Response(JSON.stringify({ success: true, message: "\u7528\u6237\u66F4\u65B0\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminUpdateUser, "adminUpdateUser");
async function adminResetPassword(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username, newPassword } = await request.json();
  if (!username || !newPassword) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u540D\u548C\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (newPassword.length < 6) {
    return new Response(JSON.stringify({ success: false, message: "\u65B0\u5BC6\u7801\u81F3\u5C116\u4F4D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  const { hash, salt } = await hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  delete user.password;
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  return new Response(JSON.stringify({ success: true, message: "\u5BC6\u7801\u91CD\u7F6E\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminResetPassword, "adminResetPassword");
async function adminGetNotifications(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.NOTIFICATIONS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userList = await env.SkyXing.list({ prefix: "notifications:" });
  const allNotifs = [];
  for (const key of userList.keys) {
    const raw = await env.SkyXing.get(key.name);
    if (raw) {
      const notifs = JSON.parse(raw);
      const username = key.name.replace("notifications:", "");
      for (const n of notifs) {
        allNotifs.push({
          id: n.id || "",
          type: n.type || "system",
          content: n.content || "",
          username,
          link: n.link || "",
          read: !!n.read,
          createdAt: n.createdAt || 0
        });
      }
    }
  }
  allNotifs.sort((a, b) => b.createdAt - a.createdAt);
  return new Response(JSON.stringify({ success: true, notifications: allNotifs }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetNotifications, "adminGetNotifications");
async function adminSendNotification(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.NOTIFICATIONS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { to, type, content, link } = await request.json();
  if (!to || !content) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const targetUser = await env.SkyXing.get(`user:${to}`);
  if (!targetUser) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const notification = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: type || "system",
    content: content.trim(),
    link: link || "",
    read: false,
    createdAt: Date.now()
  };
  const key = `notifications:${to}`;
  const existing = await env.SkyXing.get(key);
  const notifications = existing ? JSON.parse(existing) : [];
  notifications.push(notification);
  await env.SkyXing.put(key, JSON.stringify(notifications));
  return new Response(JSON.stringify({ success: true, message: "\u901A\u77E5\u5DF2\u53D1\u9001" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminSendNotification, "adminSendNotification");
async function adminDeleteNotification(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.NOTIFICATIONS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { id, username } = await request.json();
  if (!id || !username) {
    return new Response(JSON.stringify({ success: false, message: "\u53C2\u6570\u4E0D\u5B8C\u6574" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const key = `notifications:${username}`;
  const raw = await env.SkyXing.get(key);
  if (!raw) {
    return new Response(JSON.stringify({ success: false, message: "\u65E0\u6570\u636E" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const notifications = JSON.parse(raw).filter((n) => n.id !== id);
  await env.SkyXing.put(key, JSON.stringify(notifications));
  return new Response(JSON.stringify({ success: true, message: "\u901A\u77E5\u5DF2\u5220\u9664" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminDeleteNotification, "adminDeleteNotification");
async function adminGetMessages(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.MESSAGES);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userList = await env.SkyXing.list({ prefix: "messages:" });
  const allMsgs = [];
  for (const key of userList.keys) {
    const raw = await env.SkyXing.get(key.name);
    if (raw) {
      const msgs = JSON.parse(raw);
      const username = key.name.replace("messages:", "");
      for (const m of msgs) {
        allMsgs.push({
          id: m.id || "",
          from: m.from || "",
          to: m.to || "",
          content: m.content || "",
          read: !!m.read,
          createdAt: m.createdAt || 0,
          owner: username
        });
      }
    }
  }
  allMsgs.sort((a, b) => b.createdAt - a.createdAt);
  return new Response(JSON.stringify({ success: true, messages: allMsgs }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetMessages, "adminGetMessages");
async function adminDeleteMessage(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.MESSAGES);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username1, username2 } = await request.json();
  if (!username1 || !username2) {
    return new Response(JSON.stringify({ success: false, message: "\u53C2\u6570\u4E0D\u5B8C\u6574" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  for (const username of [username1, username2]) {
    const key = `messages:${username}`;
    const raw = await env.SkyXing.get(key);
    if (raw) {
      const msgs = JSON.parse(raw).filter(
        (m) => !(m.from === username1 && m.to === username2 || m.from === username2 && m.to === username1)
      );
      await env.SkyXing.put(key, JSON.stringify(msgs));
    }
  }
  return new Response(JSON.stringify({ success: true, message: "\u5BF9\u8BDD\u5DF2\u5220\u9664" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminDeleteMessage, "adminDeleteMessage");
async function adminDeleteUser(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username } = await request.json();
  if (username === check.user.username) {
    return new Response(JSON.stringify({ success: false, message: "\u4E0D\u80FD\u5220\u9664\u81EA\u5DF1" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.SkyXing.delete(`user:${username}`);
  const tokenList = await env.SkyXing.list({ prefix: "token:" });
  for (const key of tokenList.keys) {
    const tokenUser = await env.SkyXing.get(key.name);
    if (tokenUser === username) {
      await env.SkyXing.delete(key.name);
      break;
    }
  }
  const blogsJson = await env.SkyXing.get("blogs");
  if (blogsJson) {
    const blogs = JSON.parse(blogsJson).filter((b) => b.author !== username);
    await env.SkyXing.put("blogs", JSON.stringify(blogs));
  }
  const filesJson = await env.SkyXing.get("files");
  if (filesJson) {
    const files = JSON.parse(filesJson).filter((f) => f.uploader !== username);
    await env.SkyXing.put("files", JSON.stringify(files));
  }
  return new Response(JSON.stringify({ success: true, message: "\u7528\u6237\u5220\u9664\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminDeleteUser, "adminDeleteUser");
async function adminGetPermissions(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userList = await env.SkyXing.list({ prefix: "user:" });
  const featureAdmins = [];
  for (const key of userList.keys) {
    const userData = await env.SkyXing.get(key.name);
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role === ROLE.FEATURE_ADMIN) {
        featureAdmins.push({
          username: user.username,
          role: user.role,
          permissions: user.permissions || [],
          createdAt: user.createdAt
        });
      }
    }
  }
  return new Response(JSON.stringify({
    success: true,
    featureAdmins,
    availableFeatures: Object.entries(FEATURES).map(([k, v]) => ({ id: v, name: getFeatureName(v) }))
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetPermissions, "adminGetPermissions");
async function adminSetPermissions(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username, permissions } = await request.json();
  if (!username || typeof username !== "string") {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u7528\u6237" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  if (user.role !== ROLE.FEATURE_ADMIN) {
    return new Response(JSON.stringify({ success: false, message: "\u53EA\u6709\u529F\u80FD\u7BA1\u7406\u5458\u53EF\u4EE5\u914D\u7F6E\u6A21\u5757\u6743\u9650" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const validFeatures = Object.values(FEATURES);
  const perms = Array.isArray(permissions) ? permissions.filter((p) => validFeatures.includes(p)) : [];
  user.permissions = perms;
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  const featureNames = perms.length > 0 ? perms.map((p) => getFeatureName(p)).join("\u3001") : "\u6682\u65E0";
  await createNotification(
    env,
    username,
    "system",
    `\u{1F4CB} \u7BA1\u7406\u6743\u9650\u53D8\u66F4\u901A\u77E5

\u60A8\u5728 SkyXing \u7684\u7BA1\u7406\u6743\u9650\u5DF2\u88AB\u66F4\u65B0\u3002

\u5F53\u524D\u6388\u6743\u6A21\u5757\uFF1A${featureNames}`,
    "/user/profile.html",
    "\u7CFB\u7EDF"
  );
  return new Response(JSON.stringify({
    success: true,
    message: "\u6743\u9650\u5DF2\u66F4\u65B0",
    username,
    permissions: perms
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminSetPermissions, "adminSetPermissions");
async function adminRevokePermissions(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { username } = await request.json();
  if (!username || typeof username !== "string") {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u7528\u6237" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const userData = await env.SkyXing.get(`user:${username}`);
  if (!userData) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = JSON.parse(userData);
  if (user.role !== ROLE.FEATURE_ADMIN) {
    return new Response(JSON.stringify({ success: false, message: "\u8BE5\u7528\u6237\u4E0D\u662F\u529F\u80FD\u7BA1\u7406\u5458" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (username === check.user.username) {
    return new Response(JSON.stringify({ success: false, message: "\u4E0D\u80FD\u64A4\u9500\u81EA\u5DF1\u7684\u7BA1\u7406\u5458\u6743\u9650" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  user.role = ROLE.USER;
  delete user.permissions;
  user.updatedAt = Date.now();
  await env.SkyXing.put(`user:${username}`, JSON.stringify(user));
  await createNotification(
    env,
    username,
    "system",
    `\u{1F4CC} \u7BA1\u7406\u5458\u89D2\u8272\u53D8\u66F4\u901A\u77E5

\u60A8\u7684\u529F\u80FD\u7BA1\u7406\u5458\u89D2\u8272\u5DF2\u88AB\u64A4\u9500\uFF0C\u8D26\u53F7\u5DF2\u6062\u590D\u4E3A\u666E\u901A\u7528\u6237\u3002\u5982\u6709\u7591\u95EE\u8BF7\u8054\u7CFB\u5168\u5C40\u7BA1\u7406\u5458\u3002`,
    "/user/profile.html",
    "\u7CFB\u7EDF"
  );
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u64A4\u9500 " + username + " \u7684\u529F\u80FD\u7BA1\u7406\u5458\u6743\u9650" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminRevokePermissions, "adminRevokePermissions");
function getFeatureName(id) {
  const map = {
    "users": "\u7528\u6237\u7BA1\u7406",
    "blogs": "\u535A\u5BA2\u7BA1\u7406",
    "files": "\u6587\u4EF6\u7BA1\u7406",
    "slzx": "\u53CC\u6D41\u4E2D\u5B66\u7BA1\u7406",
    "notifs": "\u901A\u77E5\u7BA1\u7406",
    "messages": "\u79C1\u4FE1\u7BA1\u7406",
    "config": "\u7CFB\u7EDF\u914D\u7F6E",
    "login": "\u767B\u5F55\u529F\u80FD",
    "register": "\u6CE8\u518C\u529F\u80FD"
  };
  return map[id] || id;
}
__name(getFeatureName, "getFeatureName");
async function checkGlobalRateLimit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return checkRateLimit(env, `global:${ip}`, RATE_LIMITS.api_global.window, RATE_LIMITS.api_global.max);
}
__name(checkGlobalRateLimit, "checkGlobalRateLimit");
async function checkRateLimit(env, key, windowMs, maxRequests) {
  const kvKey = `ratelimit:${key}`;
  const now = Date.now();
  const data = await env.SkyXing.get(kvKey);
  let counters = data ? JSON.parse(data) : [];
  counters = counters.filter((c) => c.timestamp > now - windowMs);
  if (counters.length >= maxRequests) {
    const oldest = counters[0];
    const retryAfter = Math.ceil((oldest.timestamp + windowMs - now) / 1e3);
    return { allowed: false, retryAfter: Math.max(1, retryAfter), count: counters.length };
  }
  counters.push({ timestamp: now });
  await env.SkyXing.put(kvKey, JSON.stringify(counters), { expirationTtl: Math.ceil(windowMs / 1e3) + 60 });
  return { allowed: true, count: counters.length, remaining: maxRequests - counters.length };
}
__name(checkRateLimit, "checkRateLimit");
async function runSystemOptimization(env) {
  const startTime = Date.now();
  const report = {
    timestamp: startTime,
    tasks: [],
    errors: [],
    summary: {}
  };
  try {
    let cleanedTokens = 0;
    const tokenList = await env.SkyXing.list({ prefix: "token:" });
    const now = Date.now();
    const MAX_TOKEN_AGE = 7 * 24 * 60 * 60 * 1e3;
    for (const key of tokenList.keys) {
      try {
        const token = key.name.replace("token:", "");
        const decoded = atob(token);
        const parts = decoded.split(":");
        if (parts.length >= 2) {
          const timestamp = parseInt(parts[parts.length - 1]);
          if (!isNaN(timestamp) && now - timestamp > MAX_TOKEN_AGE) {
            await env.SkyXing.delete(key.name);
            cleanedTokens++;
          }
        }
      } catch (e) {
        await env.SkyXing.delete(key.name);
        cleanedTokens++;
      }
    }
    report.tasks.push({ name: "\u6E05\u7406\u8FC7\u671FToken", status: "success", count: cleanedTokens });
  } catch (err) {
    report.tasks.push({ name: "\u6E05\u7406\u8FC7\u671FToken", status: "error", message: err.message });
    report.errors.push(`\u6E05\u7406\u8FC7\u671FToken\u5931\u8D25: ${err.message}`);
  }
  try {
    let cleanedNotifications = 0;
    const notifList = await env.SkyXing.list({ prefix: "notifications:" });
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1e3;
    for (const key of notifList.keys) {
      const data = await env.SkyXing.get(key.name);
      if (data) {
        const notifications = JSON.parse(data);
        const recent = notifications.filter((n) => n.createdAt > cutoff);
        if (recent.length === 0) {
          await env.SkyXing.delete(key.name);
          cleanedNotifications++;
        } else if (recent.length !== notifications.length) {
          await env.SkyXing.put(key.name, JSON.stringify(recent));
          cleanedNotifications++;
        }
      }
    }
    report.tasks.push({ name: "\u6E05\u7406\u65E7\u901A\u77E5", status: "success", count: cleanedNotifications });
  } catch (err) {
    report.tasks.push({ name: "\u6E05\u7406\u65E7\u901A\u77E5", status: "error", message: err.message });
    report.errors.push(`\u6E05\u7406\u65E7\u901A\u77E5\u5931\u8D25: ${err.message}`);
  }
  try {
    let cleanedRateLimits = 0;
    const rlList = await env.SkyXing.list({ prefix: "ratelimit:" });
    for (const key of rlList.keys) {
      await env.SkyXing.delete(key.name);
      cleanedRateLimits++;
    }
    report.tasks.push({ name: "\u6E05\u7406\u901F\u7387\u9650\u5236\u8BA1\u6570\u5668", status: "success", count: cleanedRateLimits });
  } catch (err) {
    report.tasks.push({ name: "\u6E05\u7406\u901F\u7387\u9650\u5236\u8BA1\u6570\u5668", status: "error", message: err.message });
    report.errors.push(`\u6E05\u7406\u901F\u7387\u9650\u5236\u8BA1\u6570\u5668\u5931\u8D25: ${err.message}`);
  }
  const duration = Date.now() - startTime;
  report.summary = {
    totalTasks: report.tasks.length,
    successfulTasks: report.tasks.filter((t) => t.status === "success").length,
    failedTasks: report.tasks.filter((t) => t.status === "error").length,
    totalErrors: report.errors.length,
    duration: `${duration}ms`,
    timestamp: new Date(startTime).toISOString()
  };
  let existingLogs = [];
  const logData = await env.SkyXing.get("system_optimization_log");
  if (logData) {
    existingLogs = JSON.parse(logData);
  }
  existingLogs.unshift(report);
  if (existingLogs.length > 50) {
    existingLogs.splice(50);
  }
  await env.SkyXing.put("system_optimization_log", JSON.stringify(existingLogs));
  return report;
}
__name(runSystemOptimization, "runSystemOptimization");
async function adminRunOptimization(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const report = await runSystemOptimization(env);
  return new Response(JSON.stringify({
    success: true,
    message: "\u7CFB\u7EDF\u4F18\u5316\u5B8C\u6210",
    report
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminRunOptimization, "adminRunOptimization");
async function adminGetOptimizationLog(request, env) {
  const check = await verifyAdmin(request, env);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const logData = await env.SkyXing.get("system_optimization_log");
  const logs = logData ? JSON.parse(logData) : [];
  return new Response(JSON.stringify({
    success: true,
    logs,
    total: logs.length
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminGetOptimizationLog, "adminGetOptimizationLog");
async function adminDeleteBlog(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.BLOGS);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { id } = await request.json();
  const blogsJson = await env.SkyXing.get("blogs");
  if (!blogsJson) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u7AE0\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const blogs = JSON.parse(blogsJson);
  const index = blogs.findIndex((b) => b.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ success: false, message: "\u6587\u7AE0\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  blogs.splice(index, 1);
  await env.SkyXing.put("blogs", JSON.stringify(blogs));
  return new Response(JSON.stringify({ success: true, message: "\u5220\u9664\u6210\u529F" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(adminDeleteBlog, "adminDeleteBlog");
async function createNotification(env, toUsername, type, content, link, from) {
  try {
    const key = `notifications:${toUsername}`;
    const existing = await env.SkyXing.get(key);
    const notifications = existing ? JSON.parse(existing) : [];
    const notification = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      // 'system' | 'blog' | 'share' | 'message' | 'admin'
      content,
      link: link || "",
      from: from || "\u7CFB\u7EDF",
      read: false,
      createdAt: Date.now()
    };
    notifications.unshift(notification);
    if (notifications.length > 100) {
      notifications.splice(100);
    }
    await env.SkyXing.put(key, JSON.stringify(notifications));
    return true;
  } catch (err) {
    console.error("\u521B\u5EFA\u901A\u77E5\u5931\u8D25:", err);
    return false;
  }
}
__name(createNotification, "createNotification");
async function getNotifications(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const key = `notifications:${user.username}`;
  const data = await env.SkyXing.get(key);
  let notifications = data ? JSON.parse(data) : [];
  let hasUnread = false;
  notifications.forEach((n) => {
    if (!n.read) {
      n.read = true;
      hasUnread = true;
    }
  });
  if (hasUnread) {
    await env.SkyXing.put(key, JSON.stringify(notifications));
  }
  return new Response(JSON.stringify({
    success: true,
    notifications,
    unreadCount: 0
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getNotifications, "getNotifications");
async function getUnreadCount(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, unreadCount: 0 }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const key = `notifications:${user.username}`;
  const data = await env.SkyXing.get(key);
  const notifications = data ? JSON.parse(data) : [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const msgKey = `messages:${user.username}`;
  const msgData = await env.SkyXing.get(msgKey);
  const messages = msgData ? JSON.parse(msgData) : [];
  const unreadMsgCount = messages.filter((m) => m.to === user.username && !m.read).length;
  return new Response(JSON.stringify({
    success: true,
    unreadNotifications: unreadCount,
    unreadMessages: unreadMsgCount,
    totalUnread: unreadCount + unreadMsgCount
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getUnreadCount, "getUnreadCount");
async function markNotificationRead(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { id } = await request.json();
  const key = `notifications:${user.username}`;
  const data = await env.SkyXing.get(key);
  if (!data) {
    return new Response(JSON.stringify({ success: false, message: "\u901A\u77E5\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const notifications = JSON.parse(data);
  const notif = notifications.find((n) => n.id === id);
  if (notif) {
    notif.read = true;
    await env.SkyXing.put(key, JSON.stringify(notifications));
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(markNotificationRead, "markNotificationRead");
async function markAllNotificationsRead(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const key = `notifications:${user.username}`;
  const data = await env.SkyXing.get(key);
  if (data) {
    const notifications = JSON.parse(data);
    notifications.forEach((n) => {
      n.read = true;
    });
    await env.SkyXing.put(key, JSON.stringify(notifications));
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(markAllNotificationsRead, "markAllNotificationsRead");
async function deleteNotification(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { id } = await request.json();
  const key = `notifications:${user.username}`;
  const data = await env.SkyXing.get(key);
  if (!data) {
    return new Response(JSON.stringify({ success: true, message: "\u5DF2\u5220\u9664" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const notifications = JSON.parse(data).filter((n) => n.id !== id);
  await env.SkyXing.put(key, JSON.stringify(notifications));
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u5220\u9664" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteNotification, "deleteNotification");
async function getConversations(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const msgKey = `messages:${user.username}`;
  const msgData = await env.SkyXing.get(msgKey);
  const messages = msgData ? JSON.parse(msgData) : [];
  const conversations = {};
  for (const msg of messages) {
    const partner = msg.from === user.username ? msg.to : msg.from;
    if (!conversations[partner] || conversations[partner].lastTime < msg.createdAt) {
      conversations[partner] = {
        username: partner,
        lastMessage: msg.content.substring(0, 50),
        lastTime: msg.createdAt,
        unreadCount: 0
      };
    }
    if (msg.to === user.username && !msg.read) {
      conversations[partner].unreadCount = (conversations[partner].unreadCount || 0) + 1;
    }
  }
  const list = Object.values(conversations).sort((a, b) => b.lastTime - a.lastTime);
  return new Response(JSON.stringify({
    success: true,
    conversations: list
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getConversations, "getConversations");
async function getConversation(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const partner = url.searchParams.get("with");
  if (!partner) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u5BF9\u8BDD\u5BF9\u8C61" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const msgKey = `messages:${user.username}`;
  const msgData = await env.SkyXing.get(msgKey);
  const allMessages = msgData ? JSON.parse(msgData) : [];
  const conversation = allMessages.filter(
    (m) => m.from === user.username && m.to === partner || m.from === partner && m.to === user.username
  ).sort((a, b) => a.createdAt - b.createdAt);
  let updated = false;
  for (const msg of conversation) {
    if (msg.to === user.username && !msg.read) {
      msg.read = true;
      updated = true;
    }
  }
  if (updated) {
    for (const msg of allMessages) {
      if (msg.to === user.username && msg.from === partner && !msg.read) {
        msg.read = true;
      }
    }
    await env.SkyXing.put(msgKey, JSON.stringify(allMessages));
    const partnerKey = `messages:${partner}`;
    const partnerData = await env.SkyXing.get(partnerKey);
    if (partnerData) {
      const partnerMsgs = JSON.parse(partnerData);
      for (const msg of partnerMsgs) {
        if (msg.from === user.username && msg.to === partner) {
        }
      }
      let partnerUpdated = false;
      for (const msg of partnerMsgs) {
        if (msg.from === user.username && msg.to === partner) {
        }
      }
    }
  }
  return new Response(JSON.stringify({
    success: true,
    messages: conversation,
    partner
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getConversation, "getConversation");
async function sendMessage(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55\u6216\u8D26\u53F7\u5DF2\u88AB\u5C01\u7981" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const rateCheck = await checkRateLimit(env, `message_send:${user.username}`, RATE_LIMITS.message_send.window, RATE_LIMITS.message_send.max);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, message: "\u53D1\u9001\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { to, content } = await request.json();
  if (!to || !content || !content.trim()) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const targetUser = await env.SkyXing.get(`user:${to}`);
  if (!targetUser) {
    return new Response(JSON.stringify({ success: false, message: "\u7528\u6237\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const message = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: user.username,
    to,
    content: content.trim(),
    read: false,
    createdAt: Date.now()
  };
  const senderKey = `messages:${user.username}`;
  const senderData = await env.SkyXing.get(senderKey);
  const senderMessages = senderData ? JSON.parse(senderData) : [];
  senderMessages.push(message);
  await env.SkyXing.put(senderKey, JSON.stringify(senderMessages));
  const receiverKey = `messages:${to}`;
  const receiverData = await env.SkyXing.get(receiverKey);
  const receiverMessages = receiverData ? JSON.parse(receiverData) : [];
  receiverMessages.push(message);
  await env.SkyXing.put(receiverKey, JSON.stringify(receiverMessages));
  await createNotification(
    env,
    to,
    "message",
    `${user.username} \u7ED9\u4F60\u53D1\u4E86\u4E00\u6761\u79C1\u4FE1`,
    `/user/messages?with=${user.username}`,
    user.username
  );
  return new Response(JSON.stringify({
    success: true,
    message: "\u53D1\u9001\u6210\u529F",
    data: message
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(sendMessage, "sendMessage");
async function slzxContent(request, env) {
  const raw = await env.SkyXing.get("slzx_content");
  const data = raw ? JSON.parse(raw) : { title: "\u53CC\u6D41\u4E2D\u5B66", content: "" };
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxContent, "slzxContent");
var SLZX_SCORE_KEY = "slzx_scores";
var SLZX_BINDING_KEY = "slzx_bindings";
var MAX_BINDINGS = 6;
async function slzxGetScores(request, env) {
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  const data = raw ? JSON.parse(raw) : { students: {}, photos: [] };
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxGetScores, "slzxGetScores");
async function slzxImportExcel(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.SLZX);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { scores } = await request.json();
  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return new Response(JSON.stringify({ success: false, message: "\u65E0\u6709\u6548\u6570\u636E" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  const data = raw ? JSON.parse(raw) : { students: {}, photos: [] };
  for (const item of scores) {
    const name = (item.name || item["\u59D3\u540D"] || "").trim();
    const total = parseInt(item.score || item["\u603B\u5206"]) || 0;
    if (name) {
      data.students[name] = total;
    }
  }
  await env.SkyXing.put(SLZX_SCORE_KEY, JSON.stringify(data));
  return new Response(JSON.stringify({ success: true, message: `\u5DF2\u5BFC\u5165 ${Object.keys(data.students).length} \u540D\u5B66\u751F` }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxImportExcel, "slzxImportExcel");
async function slzxUploadPhoto(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const items = body.items || (body.dataUrl ? [{ dataUrl: body.dataUrl, note: body.note }] : null);
  if (!items || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u9009\u62E9\u56FE\u7247" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  const data = raw ? JSON.parse(raw) : { students: {}, photos: [] };
  let added = 0;
  for (const item of items) {
    if (!item.dataUrl) continue;
    if (item.dataUrl.length > 5e5) continue;
    const ts = Date.now() + added;
    data.photos.push({
      id: ts + "_" + Math.random().toString(36).substr(2, 6),
      dataUrl: item.dataUrl,
      note: (item.note || "").substring(0, 200),
      createdAt: ts,
      uploadedBy: user.username
    });
    added++;
  }
  await env.SkyXing.put(SLZX_SCORE_KEY, JSON.stringify(data));
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u4E0A\u4F20 " + added + " \u5F20\u56FE\u7247", count: added }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxUploadPhoto, "slzxUploadPhoto");
async function slzxAddLink(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const items = body.items || (body.imageUrl ? [{ imageUrl: body.imageUrl, note: body.note }] : null);
  if (!items || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u586B\u5199\u94FE\u63A5" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  const data = raw ? JSON.parse(raw) : { students: {}, photos: [] };
  let added = 0;
  for (const item of items) {
    const url = item.imageUrl || item.link || "";
    if (!url) continue;
    const ts = Date.now() + added;
    data.photos.push({
      id: ts + "_" + Math.random().toString(36).substr(2, 6),
      dataUrl: url,
      note: (item.note || "").substring(0, 200),
      createdAt: ts,
      uploadedBy: user.username
    });
    added++;
  }
  await env.SkyXing.put(SLZX_SCORE_KEY, JSON.stringify(data));
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u6DFB\u52A0 " + added + " \u4E2A\u94FE\u63A5", count: added }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxAddLink, "slzxAddLink");
async function slzxDeleteScore(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { type, key: nameOrId } = await request.json();
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  if (!raw) {
    return new Response(JSON.stringify({ success: false, message: "\u65E0\u6570\u636E" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const data = JSON.parse(raw);
  if (type === "student") {
    delete data.students[nameOrId];
  } else if (type === "photo") {
    data.photos = data.photos.filter((p) => p.id !== nameOrId);
  }
  await env.SkyXing.put(SLZX_SCORE_KEY, JSON.stringify(data));
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u5220\u9664" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxDeleteScore, "slzxDeleteScore");
async function slzxUpdateScore(request, env) {
  const check = await verifyFeatureAccess(request, env, FEATURES.SLZX);
  if (!check.authorized) {
    return new Response(JSON.stringify({ success: false, message: check.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { student, score, newName } = await request.json();
  if (!student || typeof student !== "string" || !student.trim()) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u5B66\u751F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const name = student.trim();
  const renamed = newName && typeof newName === "string" && newName.trim() ? newName.trim() : null;
  const effectiveName = renamed && renamed !== name ? renamed : null;
  const newScore = parseInt(score);
  if (isNaN(newScore)) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u8F93\u5165\u6709\u6548\u5206\u6570" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const raw = await env.SkyXing.get(SLZX_SCORE_KEY);
  const data = raw ? JSON.parse(raw) : { students: {}, photos: [] };
  if (!data.students.hasOwnProperty(name)) {
    return new Response(JSON.stringify({ success: false, message: "\u5B66\u751F\u4E0D\u5B58\u5728" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (effectiveName && effectiveName !== name && data.students.hasOwnProperty(effectiveName)) {
    return new Response(JSON.stringify({ success: false, message: "\u300C" + effectiveName + "\u300D\u5DF2\u5B58\u5728\uFF0C\u4E0D\u80FD\u91CD\u540D" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (effectiveName) {
    data.students[effectiveName] = newScore;
    delete data.students[name];
    const bindings = await loadBindings(env);
    if (bindings[name]) {
      const owner = bindings[name];
      delete bindings[name];
      bindings[effectiveName] = owner;
      await saveBindings(env, bindings);
    }
  } else {
    data.students[name] = newScore;
  }
  await env.SkyXing.put(SLZX_SCORE_KEY, JSON.stringify(data));
  const displayName = effectiveName || name;
  return new Response(JSON.stringify({
    success: true,
    message: effectiveName ? "\u5DF2\u5C06\u300C" + name + "\u300D\u6539\u540D\u4E3A\u300C" + effectiveName + "\u300D\uFF0C\u5206\u6570\u66F4\u65B0\u4E3A " + newScore : "\u300C" + name + "\u300D\u5206\u6570\u5DF2\u66F4\u65B0\u4E3A " + newScore,
    student: displayName,
    oldName: effectiveName ? name : void 0,
    score: newScore
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxUpdateScore, "slzxUpdateScore");
function loadBindings(env) {
  return env.SkyXing.get(SLZX_BINDING_KEY).then((r) => r ? JSON.parse(r) : {});
}
__name(loadBindings, "loadBindings");
async function saveBindings(env, data) {
  await env.SkyXing.put(SLZX_BINDING_KEY, JSON.stringify(data));
}
__name(saveBindings, "saveBindings");
async function slzxGetBindings(request, env) {
  const user = await verifyUser(request, env);
  const bindings = await loadBindings(env);
  const myBindings = [];
  if (user) {
    for (const [student, owner] of Object.entries(bindings)) {
      if (owner === user.username) myBindings.push(student);
    }
  }
  return new Response(JSON.stringify({
    success: true,
    bindings,
    // { 学生: 用户名, ... }
    myBindings,
    // [学生1, ...]
    maxSlots: MAX_BINDINGS
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxGetBindings, "slzxGetBindings");
async function slzxBindStudent(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { student } = await request.json();
  if (!student || !String(student).trim()) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u9009\u62E9\u5B66\u751F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const name = String(student).trim();
  const bindings = await loadBindings(env);
  if (bindings[name]) {
    if (bindings[name] !== user.username) {
      return new Response(JSON.stringify({
        success: false,
        conflict: true,
        student: name,
        boundBy: bindings[name],
        message: "\u8BE5\u5B66\u751F\u5DF2\u88AB\u7528\u6237\u300C" + bindings[name] + "\u300D\u7ED1\u5B9A\uFF0C\u8BF7\u8054\u7CFB\u5BF9\u65B9\u89E3\u7ED1"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ success: false, message: "\u60A8\u5DF2\u7ED1\u5B9A\u8BE5\u5B66\u751F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  let myCount = 0;
  for (const [, owner] of Object.entries(bindings)) {
    if (owner === user.username) myCount++;
  }
  if (myCount >= MAX_BINDINGS) {
    return new Response(JSON.stringify({
      success: false,
      limit: true,
      message: "\u7ED1\u5B9A\u5DF2\u8FBE\u4E0A\u9650\uFF08" + MAX_BINDINGS + "\u540D\uFF09\uFF0C\u8BF7\u5148\u89E3\u7ED1\u540E\u518D\u64CD\u4F5C"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  bindings[name] = user.username;
  await saveBindings(env, bindings);
  return new Response(JSON.stringify({
    success: true,
    message: "\u5DF2\u7ED1\u5B9A\u300C" + name + "\u300D",
    count: myCount + 1,
    maxSlots: MAX_BINDINGS
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxBindStudent, "slzxBindStudent");
async function slzxUnbindStudent(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { student } = await request.json();
  if (!student) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u5B66\u751F" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const bindings = await loadBindings(env);
  if (!bindings[student] || bindings[student] !== user.username) {
    return new Response(JSON.stringify({ success: false, message: "\u65E0\u6743\u89E3\u7ED1\uFF0C\u8BE5\u5B66\u751F\u4E0D\u5F52\u60A8\u7BA1\u8F96" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  delete bindings[student];
  await saveBindings(env, bindings);
  return new Response(JSON.stringify({ success: true, message: "\u5DF2\u89E3\u7ED1\u300C" + student + "\u300D" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(slzxUnbindStudent, "slzxUnbindStudent");
async function deleteConversation(request, env) {
  const user = await verifyUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { with: partner } = await request.json();
  if (!partner) {
    return new Response(JSON.stringify({ success: false, message: "\u8BF7\u6307\u5B9A\u5BF9\u8BDD\u5BF9\u8C61" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const msgKey = `messages:${user.username}`;
  const msgData = await env.SkyXing.get(msgKey);
  if (msgData) {
    const messages = JSON.parse(msgData).filter(
      (m) => !(m.from === user.username && m.to === partner || m.from === partner && m.to === user.username)
    );
    await env.SkyXing.put(msgKey, JSON.stringify(messages));
  }
  return new Response(JSON.stringify({ success: true, message: "\u5BF9\u8BDD\u5DF2\u5220\u9664" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteConversation, "deleteConversation");
async function monitorHealth(request, env) {
  const user = await verifyUser(request, env);
  if (!user || user.role !== "admin" && user.role !== "feature_admin") {
    return new Response(JSON.stringify({ success: false, message: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const health = await SelfHeal.getHealthReport(env);
  return new Response(JSON.stringify({ success: true, health }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(monitorHealth, "monitorHealth");
async function monitorCircuits(request, env) {
  const user = await verifyUser(request, env);
  if (!user || user.role !== "admin" && user.role !== "feature_admin") {
    return new Response(JSON.stringify({ success: false, message: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({
    success: true,
    circuits: retryCircuit.getAllStates()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(monitorCircuits, "monitorCircuits");
async function selfHealCheck(request, env) {
  const user = await verifyUser(request, env);
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ success: false, message: "\u9700\u8981\u5168\u5C40\u7BA1\u7406\u5458\u6743\u9650" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const report = await SelfHeal.runFullCheck(env);
  return new Response(JSON.stringify({ success: true, ...report }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(selfHealCheck, "selfHealCheck");
async function selfHealRun(request, env) {
  const user = await verifyUser(request, env);
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ success: false, message: "\u9700\u8981\u5168\u5C40\u7BA1\u7406\u5458\u6743\u9650" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const report = await SelfHeal.autoRepair(env);
  return new Response(JSON.stringify({ success: true, ...report }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(selfHealRun, "selfHealRun");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
