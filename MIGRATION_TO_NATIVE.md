# SkyXing 全平台原生重构 · 行动总纲 (MIGRATION_TO_NATIVE)

> 本文件是「从旧版客户端（当前为 Electron / React Native-Expo / React Web，统一后端 Cloudflare Worker + KV）全面转向 Windows / Android / Web 三端原生、共享 Rust 核心库」的唯一权威指引。
> 起点版本：**2.0.0-beta.1**（Cargo/semver 要求预发布标识符无前导零；**产品/OTA 标签仍可使用 `2.0.0-beta.01`**，GitHub 标签不受 semver 校验）。

---

## 0. 现状核对（开工前必读）

开工前对照了当前仓库 `e:/SkyXingDev`，与原始规划假设存在以下**事实差异**，已按现实修正：

| 主题 | 原始规划假设 | 仓库实际 | 处理 |
|------|------|------|------|
| Windows 客户端 | WinUI 3 + Rust DLL（**来自 Tauri**） | **Electron + React + Vite**（非 Tauri） | 目标栈仍是 WinUI 3，但起点是 Electron，无 Tauri 容器可增量 |
| Android 客户端 | Jetpack Compose + Kotlin | **React Native + Expo** | 目标栈仍是 Compose |
| Web | React + WASM(Rust) | React + Vite（无 WASM） | 目标栈增加 WASM 核心 |
| 私信 / 博客 | 有博客 + 私信 | `src/routes/messages.js`（私信）、`articles.js`（博客）**已实现** | 直接复用契约 |
| OTA | v1→v3 历史，目标 v4 | `src/routes/updates.js` 已是 **`protocolVersion: 3`**，走 GitHub Release（`kairuirain/skyxing-app`） | `OtaEngine` 的 v3 分支直接对接现有 `/server/api/updates/check` |
| API 版本 | v1 + v2 并存 | 当前**未版本化**，全部挂在 `/server/api` | Rust `v1` 客户端精确对接 `/server/api/*`；`v2` 指向未来的 `/api/v2/*` |
| Rust 核心库 | 三端共享 | **不存在**（全 JS/TS） | 本次新建 `app/core`（Milestone 1，已完成初版并编译通过） |

**结论**：原规划是一份「未来愿景」，当前仓库是 JS 单体。本重构按规划方向推进，但 `v1` 客户端必须兼容**现有线上契约**（见 `OtaEngine`/`ApiV1Client`）。

---

## 一、整体架构

```
┌──────────────────────────────────────┐
│         Platform UI Layer           │
│  Win:    WinUI 3 (C#)               │
│  Android: Jetpack Compose (Kotlin)  │
│  Web:    React/Vue + WASM           │
└───────────────┬──────────────────────┘
                │ FFI (C-ABI via UniFFI)
┌───────────────▼──────────────────────┐
│        Shared Rust Core (app/core)  │
│  ApiClient(v2+v1 自动降级)  OtaEngine │
│  Local Cache  Migrator   Models      │
└───────────────┬──────────────────────┘
                │ HTTPS / WebSocket
    ┌───────────▼──────────────┐
    │  Cloudflare Workers       │
    │  /server/api/*  (现有 v1) │
    │  /api/v2/*       (新增)   │
    │  KV Namespace             │
    └───────────────────────────┘
```

核心原则（不变）：
- 业务逻辑 / 网络 / 缓存 / OTA 全部集中在 `app/core` 的 Rust 核心库。
- UI 层只展示与交互，通过 UniFFI 调用核心。
- 核心库同时实现 API v2 与 v1，并能按服务端/配置自适应。
- OTA 引擎内置版本协商，可理解旧版本清单并映射到最新升级路径。

---

## 二、API 版本兼容（v1 → v2）

### 2.1 服务端
- 现有 `/server/api/*`（v1）**保持不变**，旧客户端继续可用。
- 新增 `/api/v2/*`：批量 `/api/v2/batch`、游标分页、字段精简、`Accept: application/msgpack`、私信增量同步 token。
- v2 响应含 `"version": 2` 字段。

### 2.2 Rust 核心（已实现于 `app/core/src/api`）
```rust
pub struct ApiClient {            // UniFFI 导出对象
    v2: ApiV2Client,              // 对接 /api/v2/*
    v1: ApiV1Client,              // 对接 /server/api/*（现有契约）
    strategy: ApiStrategy,        // V2First | V2Only | V1Only
}
```
- 默认 `V2First`：先发 v2 请求，遇 `404`/未部署（`V2_NOT_DEPLOYED`）自动降级 v1 并记录日志。
- `v1` 客户端字段与现有 Worker JSON（`camelCase`）严格对应（见 `models.rs`）。
- 首次启动若检测到旧版导出数据，`Migrator::migrate_v1_to_v2` 将 v1 格式升级为 v2 并剔除密码等敏感字段。

---

## 三、OTA 更新系统 v4（含历史兼容，已实现于 `app/core/src/ota.rs`）

`OtaEngine::check_update(platform, channel, current)` 三级协商：
1. 试 `/api/v2/ota/check`（未来 v4）。
2. 404 则回退 `/server/api/updates/check`（**现有 v3，protocolVersion 3**）。
3. 再失败则直接解析 GitHub Releases（`kairuirain/skyxing-app`），按 `stable`/`beta` 通道与版本比较挑选升级包。

- 版本比较逻辑（`version.rs`）与现有 Worker `compareVersion` 完全一致（release > prerelease，prerelease 数字比较，多段标识符更长者更新）。
- 双轨发布：Worker 按 `channel=stable|beta` 返回对应通道最高版本；测试版用户在设置中切换通道。
- 仅「从旧容器（Electron/RN）迁移到原生」需下载完整安装包（无法增量），UI 需明确引导备份。

---

## 四、各平台实现要点（骨架待建）

| 平台 | 技术栈 | 核心库集成 | 当前状态 |
|------|------|------|------|
| Windows | WinUI 3 + Rust `cdylib` (UniFFI 生成 C#) | `cargo build --release` → `skyxing_core.dll` | 待建（`app/windows`） |
| Android | Compose + Rust `.so` (JNI/UniFFI 生成 Kotlin) | 交叉编译 `aarch64-linux-android` 等 | 待建（`app/android`） |
| Web | React + `wasm-pack` | `wasm-pack build --target web` → `app/web/core-pkg` | 待建（`app/web`） |

启动速度目标：Win <800ms、Android <600ms、Web <1.5s。手段：延迟初始化非首屏模块、数据库预热、本地缓存优先渲染、Rust 异步 FFI（UniFFI `async_runtime = "tokio"`）。

---

## 五、数据迁移（Tauri/Electron → 原生）

1. 旧客户端末版导出用户数据为通用 JSON（去除密码）。
2. 原生应用首次启动检测导入文件，由 `Migrator` 转换并删除旧文件。
3. Web 端可从服务端临时存储取回（消耗少量 KV 次数，需限制导出频率）。

---

## 六、CI/CD（GitHub Actions，已实现于 `.github/workflows/build-and-release.yml`）

- 触发：推送任意 `v*` tag（如 `v2.0.0-beta.01`）。
- 矩阵：`build-core`(测试+编译) → 并行 `build-windows` / `build-android` / `build-web` → `release` 收集产物并发布到 `kairuirain/skyxing-app` 的 GitHub Release（含 `beta`/`alpha` 自动标记 `prerelease`）。
- 后端联动：Worker 直接通过 GitHub API 读取该 Release 信息完成 OTA 闭环，**前端 CI 完全独立于 `skyxing` 后端仓库**，不触碰其自动部署。

---

## 七、里程碑

- ✅ **里程碑 1（进行中）**：Rust 核心库 `app/core` —— 双版本 API 客户端、OTA 引擎、本地缓存、数据迁移、领域模型。**已编译通过 + 单测通过**。
- ⬜ 里程碑 2：Windows 原生版跑通基本流程，OTA 自升级。
- ⬜ 里程碑 3：Android 版完成数据迁移，从旧 APK 升级至新 APK。
- ⬜ 里程碑 4：Web 版发布，与原生版共享同一后端。
- 终态：三端齐发，下线旧 Worker 路由（保留 v1 直至所有用户迁移完毕）。

---

## 八、本次会话已落地产物

```
app/
  core/                 # Rust 共享核心库（已编译 + 单测通过）
    Cargo.toml  uniffi.toml  .gitignore
    src/lib.rs  error.rs  version.rs  models.rs
        cache.rs  api/{mod,v1,v2}.rs  ota.rs  migrate.rs
  windows/  android/  web/   # 平台骨架说明（待建实际工程）
  README.md
.github/workflows/build-and-release.yml
MIGRATION_TO_NATIVE.md   # 本文件
```

> 下一步建议：先不删除现有 JS 客户端，待某一端原生版达到里程碑 2/3 后再切换；核心库已可在三端复用，可优先在 Web 端用 `wasm-pack` 验证 FFI 绑定流程。
