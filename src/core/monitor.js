/**
 * Monitor - 结构化日志 & 指标收集
 * 环形缓冲区 + 延迟统计 + 健康检查
 */
class Monitor {
    static #instance = null;
    static get instance() {
        if (!Monitor.#instance) Monitor.#instance = new Monitor();
        return Monitor.#instance;
    }

    constructor() {
        this.logs = [];          // 环形缓冲区: 500条
        this.maxLogs = 500;
        this.metrics = {};       // endpoint -> { total, success, failure, latencies[] }
        this.latencySamples = 200;
        this.startTime = Date.now();
        this.healthStatus = 'healthy';
    }

    log(level, source, message, data = null) {
        const entry = { time: Date.now(), level, source, message, data };
        if (this.logs.length >= this.maxLogs) this.logs.shift();
        this.logs.push(entry);
        if (level === 'ERROR') {
            console.error(`[${source}] ${message}`, data || '');
        } else if (level === 'WARN') {
            console.warn(`[${source}] ${message}`, data || '');
        } else {
            console.log(`[${source}] ${message}`, data || '');
        }
    }

    debug(source, msg, data) { this.log('DEBUG', source, msg, data); }
    info(source, msg, data) { this.log('INFO', source, msg, data); }
    warn(source, msg, data) { this.log('WARN', source, msg, data); }
    error(source, msg, data) { this.log('ERROR', source, msg, data); }

    recordRequest(endpoint, duration, success) {
        if (!this.metrics[endpoint]) {
            this.metrics[endpoint] = { total: 0, success: 0, failure: 0, latencies: [], lastAccess: 0 };
        }
        const m = this.metrics[endpoint];
        m.total++;
        m.lastAccess = Date.now();
        if (success) m.success++; else m.failure++;
        m.latencies.push(duration);
        if (m.latencies.length > this.latencySamples) m.latencies.shift();
    }

    getHealth() {
        const now = Date.now();
        const uptime = Math.floor((now - this.startTime) / 1000);
        let totalReq = 0, totalErr = 0;
        const endpoints = {};

        for (const [ep, m] of Object.entries(this.metrics)) {
            totalReq += m.total;
            totalErr += m.failure;
            const sorted = [...m.latencies].sort((a, b) => a - b);
            endpoints[ep] = {
                total: m.total, success: m.success, failure: m.failure,
                avg: m.latencies.length ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length) : 0,
                p50: sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0,
                p95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0,
                p99: sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0,
                lastAccess: m.lastAccess
            };
        }

        const recentErrors = this.logs.filter(l => l.level === 'ERROR').slice(-20).map(l => ({ time: l.time, source: l.source, message: l.message }));

        return {
            status: this.healthStatus,
            uptime,
            errorRate: totalReq ? (totalErr / totalReq * 100).toFixed(2) + '%' : '0%',
            totalRequests: totalReq,
            endpoints,
            recentErrors,
            logCount: this.logs.length
        };
    }

    getCircuits() {
        return RetryCircuit.getAllStates ? RetryCircuit.getAllStates() : {};
    }

    async persist(env) {
        try {
            const snapshot = {
                time: Date.now(),
                metrics: this.metrics,
                logSample: this.logs.slice(-100)
            };
            await env.SkyXing.put('monitor:snapshot', JSON.stringify(snapshot), { expirationTtl: 86400 });
        } catch (e) {
            console.error('[Monitor] 持久化失败:', e.message);
        }
    }

    async load(env) {
        try {
            const raw = await env.SkyXing.get('monitor:snapshot');
            if (raw) {
                const snapshot = JSON.parse(raw);
                this.metrics = snapshot.metrics || {};
            }
        } catch (e) { /* ignore */ }
    }

    // 包装 handler，自动记录请求
    wrapHandler(endpoint, handler) {
        const self = this;
        return async function (request, env, ctx) {
            const start = Date.now();
            try {
                const response = await handler(request, env, ctx);
                self.recordRequest(endpoint, Date.now() - start, response.status < 400);
                return response;
            } catch (e) {
                self.recordRequest(endpoint, Date.now() - start, false);
                self.error(endpoint, e.message);
                throw e;
            }
        };
    }
}

// ── Circuit Breaker ──
const STATE = { CLOSED:'closed', OPEN:'open', HALF_OPEN:'half_open' };

class RetryCircuit {
    static #instances = {};

    static get(key) {
        if (!RetryCircuit.#instances[key]) {
            RetryCircuit.#instances[key] = new RetryCircuit(key);
        }
        return RetryCircuit.#instances[key];
    }

    static getAllStates() {
        const states = {};
        for (const [k, v] of Object.entries(RetryCircuit.#instances)) {
            states[k] = { state: v.state, failures: v.failures, lastFailure: v.lastFailure, lastSuccess: v.lastSuccess };
        }
        return states;
    }

    constructor(name) {
        this.name = name;
        this.state = STATE.CLOSED;
        this.failures = 0;
        this.failureThreshold = 5;
        this.circuitTimeout = 30000; // 30s 断开后重试
        this.lastFailure = 0;
        this.lastSuccess = 0;
    }

    async execute(fn, fallback = null) {
        if (this.state === STATE.OPEN) {
            if (Date.now() - this.lastFailure > this.circuitTimeout) {
                this.state = STATE.HALF_OPEN;
                Monitor.instance.info('Circuit', `${this.name}: HALF_OPEN (probing)`);
            } else if (fallback) {
                return fallback();
            } else {
                throw new Error(`Circuit ${this.name} is OPEN`);
            }
        }

        try {
            const result = await fn();
            if (this.state === STATE.HALF_OPEN) {
                this.state = STATE.CLOSED;
                this.failures = 0;
                Monitor.instance.info('Circuit', `${this.name}: CLOSED (recovered)`);
            }
            this.lastSuccess = Date.now();
            return result;
        } catch (e) {
            this.failures++;
            this.lastFailure = Date.now();
            Monitor.instance.warn('Circuit', `${this.name}: failure #${this.failures} - ${e.message}`);
            if (this.failures >= this.failureThreshold) {
                this.state = STATE.OPEN;
                Monitor.instance.error('Circuit', `${this.name}: OPEN (${this.failures} failures)`);
            }
            if (fallback) return fallback();
            throw e;
        }
    }
}

// ── Sync Broker ──
class SyncBroker {
    static async read(env, key) {
        const raw = await env.SkyXing.get(key);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }

    static async write(env, key, data, expectedVersion) {
        // 乐观锁：先生成版本号
        const version = Date.now().toString(36);
        const wrapper = { data, version, ts: Date.now() };

        if (expectedVersion) {
            const current = await env.SkyXing.get(key);
            if (current) {
                try {
                    const cur = JSON.parse(current);
                    if (cur.version && cur.version !== expectedVersion) {
                        return { ok: false, conflict: true, currentVersion: cur.version };
                    }
                } catch (e) { /* overwrite */ }
            }
        }
        await env.SkyXing.put(key, JSON.stringify(wrapper));
        return { ok: true, version };
    }
}

// ── Self Heal ──
class SelfHeal {
    static async run(env) {
        const report = { fixed: [], skipped: [] };
        const m = Monitor.instance;

        try {
            // 1. 扫描并清理过期 token
            const tokenList = await env.SkyXing.list({ prefix: 'token:' });
            const now = Date.now();
            for (const k of tokenList.keys) {
                try {
                    const username = await env.SkyXing.get(k.name);
                    if (!username) { await env.SkyXing.delete(k.name); report.fixed.push('orphan_token:' + k.name); continue; }
                    const user = await SyncBroker.read(env, `user:${username}`);
                    if (!user) { await env.SkyXing.delete(k.name); report.fixed.push('orphan_token:' + k.name); }
                } catch (e) { report.skipped.push(k.name); }
            }

            // 2. 清理过期速率限制 key
            const rlList = await env.SkyXing.list({ prefix: 'rl:' });
            for (const k of rlList.keys) report.skipped.push('rl_skip:' + k.name); // 有 ttl 自动过期

            // 3. 压缩博客/文件列表（超过1000条）
            for (const key of ['blogs', 'files']) {
                const raw = await env.SkyXing.get(key);
                if (raw) {
                    try {
                        const list = JSON.parse(raw);
                        if (Array.isArray(list) && list.length > 1000) {
                            list.length = 1000;
                            await env.SkyXing.put(key, JSON.stringify(list));
                            report.fixed.push(`trim_${key}:${list.length}`);
                        }
                    } catch (e) { report.skipped.push(`corrupt_${key}`); }
                }
            }
        } catch (e) {
            m.error('SelfHeal', '执行失败: ' + e.message);
        }
        return report;
    }
}

export { Monitor, RetryCircuit, SyncBroker, SelfHeal };
