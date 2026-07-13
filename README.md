# SkyXing - 跨平台博客平台

一个具有完整用户系统的博客平台，支持文章撰写、发布和评论互动。

## 技术栈

- **后端**: Cloudflare Worker (Hono.js) + KV 存储
- **Web 前端**: React + Vite + TailwindCSS
- **Android 客户端**: React Native (Expo) + React Navigation
- **Windows 桌面客户端**: Electron + React + Vite + TailwindCSS
- **认证**: JWT (jose)

## 部署地址

- **API & Web**: https://skyxing.dpdns.org/
- **API 路径**: https://skyxing.dpdns.org/server/api

## 项目结构

```
├── src/                   # 后端源码 (Cloudflare Worker + Hono.js)
│   ├── index.js           # Worker 入口
│   ├── routes/            # API 路由 (auth, articles, comments, users, admin)
│   ├── middleware/         # 中间件 (CORS)
│   └── utils/             # 工具函数 (JWT, KV helpers, sanitize)
├── web/                   # Web 前端 (React + Vite + TailwindCSS)
│   └── src/
│       ├── components/    # 共享组件 (Layout)
│       ├── context/       # 状态管理 (AuthContext)
│       ├── lib/           # API 客户端 / XSS 防护
│       └── pages/         # 页面组件
├── clients/               # 客户端应用
│   ├── shared/            # 跨平台共享逻辑 (API 客户端 / 净化器)
│   ├── android/           # Android 客户端 (React Native + Expo)
│   │   ├── App.js
│   │   └── src/
│   │       ├── context/   # AuthContext / SettingsContext
│   │       ├── navigation/# 底部 Tab 导航 + Stack 导航
│   │       └── screens/   # 主页 / 播客 / 我的 / 文章 / 管理
│   └── windows/           # Windows 桌面客户端 (Electron + React + Vite)
│       ├── electron/      # Electron 主进程 (菜单栏 / IPC)
│       └── src/
│           ├── components/# Layout / SettingsModal
│           ├── context/   # AuthContext / SettingsContext
│           └── pages/     # 所有页面组件
├── public/                # Web 构建输出
├── wrangler.toml          # Cloudflare Workers 配置
└── package.json
```

## 本地开发

```bash
# 后端
npm install
npm run dev        # 启动 Worker 本地开发服务器

# Web 前端
cd web
npm install
npm run dev        # 启动 Web 前端开发服务器 (端口 3000)
npm run build      # 构建到 ../public/

# Android 客户端
cd clients/android
npm install
npx expo start     # 启动 Expo 开发服务器

# Windows 桌面客户端
cd clients/windows
npm install
npm run dev        # 启动 Electron + Vite 开发模式
npm run build:win  # 构建 Windows 安装包
```

## 部署

```bash
# 先构建前端
cd web && npm run build && cd ..

# 部署到 Cloudflare Workers
npx wrangler deploy
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /server/api/auth/register | 用户注册 |
| POST | /server/api/auth/login | 用户登录 |
| GET | /server/api/auth/me | 获取当前用户 |
| GET | /server/api/articles | 文章列表 (支持分页、搜索、标签过滤) |
| GET | /server/api/articles/:id | 文章详情 |
| POST | /server/api/articles | 创建文章 |
| PUT | /server/api/articles/:id | 更新文章 |
| DELETE | /server/api/articles/:id | 删除文章 |
| GET | /server/api/articles/tags | 获取所有标签 |
| GET | /server/api/comments?articleId= | 文章评论 |
| POST | /server/api/comments | 创建评论 |
| PUT | /server/api/comments/:id | 更新评论 |
| DELETE | /server/api/comments/:id | 删除评论 |
| GET | /server/api/users/:id | 用户资料 |
| PUT | /server/api/users/:id | 更新资料 |
| GET | /server/api/admin/stats | 管理统计 |
| GET | /server/api/admin/users | 用户管理 |
| GET | /server/api/admin/articles | 文章管理 |

## License

MIT
