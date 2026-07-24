# SkyXing 长期记忆

## 项目架构
- 后端：Cloudflare Worker（Hono）+ KV。入口 `src/index.js`，路由在 `src/routes/`，工具在 `src/utils/`。
- 前端 Web：`web/`（React + Vite + Tailwind）。上下文 Providers 顺序：Theme > Auth > I18n > Animation > Sync > Transition。
- 客户端：Windows(Electron) / Android(RN) 共用 `clients/shared/api.js`。

## 关键设计决策
- 人机验证：Cloudflare Turnstile。后端 `TURNSTILE_SECRET_KEY`（wrangler secret），前端站点密钥经 `/server/api/config` 的 `turnstileSiteKey` 下发（env `TURNSTILE_SITE_KEY`）。未配密钥时自动放行。
- 跨端同步（需求 13）：基于用户同步版本号（`sync:<userId>` KV 计数器）。`GET /sync` 拉快照、`PUT /sync` 上报变更（baseVersion 冲突检测，以后端为准）、`GET /sync/version?since=` 轻量轮询。通知已读会 bump 版本号。
- 用户设置字段（存于 user 对象）：`agreedToTerms`, `language`(null=跟随系统), `animationMode`(minimal/normal/rich), `debugEnabled`。
- OTA：阈值 2.0.1-beta.1，比较时忽略前缀 v（已实现于 `routes/updates.js`）。
- 动画模式：`<html data-anim="minimal|normal|rich">` + CSS 控制全局动效（见 `web/src/index.css`）。
- 设置页三级/四级层级（三端统一，2026-07-21）：`app/src/pages/SettingsPage.jsx`、`web/src/pages/SettingsPage.jsx`、`clients/windows/src/components/SettingsModal.jsx` 均使用「导航栈」模式。结构：设置 → {个性化, 账号数据, 反馈, 软件}(L2) → L3 项；含>1 子项者展开 L4（外观→语言/动画/主题；账号管理→2FA/注销）。叶子屏幕在 App/Web 直接用组件引用 `<screen/>`（随 context 实时刷新）；Windows 叶子屏幕自行 `useSettings/useAuth`（避免 props 烘焙导致状态陈旧）。重要切换（注销、关 2FA、调试）走 `ConfirmDialog` 二次确认。更新下载按 `updateSource`(github/ghfast) 选 `url`/`proxyUrl`。
- 系统内反馈：后端 `src/routes/feedback.js`（`PREFIX.FEEDBACK='feedback:'` 存 KV 数组），`api.submitFeedback()` 已实现于 `app/src/lib/api.js` 与 `web/src/lib/api.js`。

## 已修复的重要 bug
- `src/routes/users.js` PUT 个人资料原用 JWT 载荷覆盖完整用户对象，会丢失 passwordHash/totpSecret/设置字段；现已改为基于完整对象更新。
- `src/index.js` `/lookup/:username` 读取用户名索引漏传 `false`（kvGet 默认 parseJson=true 对原始字符串 id 会解析失败返回 null），导致用户查询永远 404；已改为 `kvGet(env, idx, false)`。
- `src/utils/turnstile.js` 与 `src/routes/verify.js` 曾被 `write_to_file` 创建为空文件（0 字节），导致 worker 启动报 "Cannot read properties of undefined (reading 'map')"；已重写补齐 `verifyTurnstile` 导出。

## 关键坑位（务必留意）
- `kvGet(env, key)` 默认 `parseJson=true`：仅对 JSON 值安全。**用户名索引 / 邮箱索引存的是原始字符串 id**，读取时必须显式传 `false`（如 `kvGet(env, PREFIX.USERNAME_INDEX + x, false)`），否则 `JSON.parse` 抛错被吞 → 返回 null。notification 索引存的是数组（合法 JSON），可不加 `false`。
- `write_to_file` 创建的新文件有概率落盘为空（0 字节）。新建文件后务必用 `read_file` 复核内容是否真正写入。

## 部署注意
- 后端 `TURNSTILE_SECRET_KEY` 经 `wrangler secret put` 配置（已配，生产启用）。**wrangler v4 没有 `wrangler variable put` CLI**，公开站点密钥必须写在 `wrangler.toml` 的 `[vars] TURNSTILE_SITE_KEY`（已配并提交）。未配密钥时 Turnstile 自动放行（开发友好）。
- 项目实际访问域名是 `skyxing.dpdns.org`（非 workers.dev）；API_BASE/README/markdown 均指向它，Turnstile 主机名也填它。
- 生产 Turnstile 已启用（托管模式，secret + [vars] 均已配，部署版本 a47f9e51）。`JWT_SECRET` 已在生产 secret 中，无需改动。
- 本机当前可联网：`node fetch('https://skyxing.dpdns.org')` 返回 200，`wrangler deploy` 可成功上传 web(`public/`) 与 worker(`src/`)。之前"沙箱无外网出口"的结论已不再成立（网络状态可能变化，务必以实际测试为准）。部署是否生效以 wrangler 回执的绑定列表 + 线上实测为准。

## 待办 / 注意
- Web 端 i18n 已接入登录/注册/设置/导航；其余页面（博客、文章、消息等）文本仍多为硬编码，需后续逐步接入 `useI18n`。
- App 端（Windows/Android Tauri）UI 层已集成 i18n/sync/turnstile/动画模式（详见 2026-07-20「App 端补齐四项功能」）；版本号已升 2.0.1（`app/package.json`、`src-tauri/tauri.conf.json`、`Cargo.toml`）。源改完待下次构建验证。
