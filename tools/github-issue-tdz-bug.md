### 标题
```
[Bug] Tauri 生产构建后启动白屏：ReferenceError: Cannot access 'I' before initialization
```

### Labels
`bug`, `critical`, `build`

---

## 问题描述

Tauri APP（Windows 和 Android）生产构建后，启动即白屏，仅显示 ErrorBoundary 的错误页面。开发模式（`npm run dev`）下无此问题。

## 错误信息

```
SkyXing - Application Error
An error occurred while rendering the application.

ReferenceError: Cannot access 'I' before initialization
    at Og (http://tauri.localhost/assets/index-BjBmO29n.js:240:9498)
    at fp (http://tauri.localhost/assets/index-BjBmO29n.js:60:4271)
    ...
```

## 影响范围

- 平台：Tauri APP（Windows 桌面端 + Android）
- 版本：v1.2.2 ~ v1.2.3（引入 `useSync` hook 后）
- 构建方式：`npm run tauri:build:windows` / `npm run tauri:build:android`

## 根因分析

### 问题代码（`app/src/pages/HomePage.jsx`）

```jsx
// 错误：loadArticles 是 const，不会提升
useEffect(() => { loadArticles(); }, [page, selectedTag]);
useSync(loadArticles, { enabled: !selectedTag && !search });

// ... 其他 hooks ...

const loadArticles = async () => {  // ← 声明在调用之后！
  ...
};
```

JavaScript 的 `const` 声明存在 **Temporal Dead Zone（TDZ）**：在初始化之前访问会抛出 `ReferenceError`。

`useSync(I, ...)` 在组件渲染时立即执行，参数 `I`（即 `loadArticles`）被求值。而此时 `const loadArticles` 尚未执行到初始化语句，引擎抛出 TDZ 错误。

### 编译差异

- **开发模式**（Vite dev server）：模块热替换、按需编译，组件首次渲染时 `const` 已初始化
- **生产构建**（Vite build + esbuild 压缩）：代码被压缩打包，执行顺序被优化器重新排列，TDZ 被触发

### 受影响文件

| 文件 | 问题 |
|---|---|
| `app/src/pages/HomePage.jsx` | `useSync(loadArticles)` 在 `const loadArticles` 之前 |
| `web/src/pages/HomePage.jsx` | `useSync(loadArticles)` 在 `const loadArticles` 之前 |
| `web/src/pages/BlogPage.jsx` | `useEffect(() => loadArticles())` 在 `const loadArticles` 之前 |

## 修复方案

将 `const loadArticles` 和 `const loadTags` 的声明移到所有引用它们的 hooks **之前**：

```jsx
// 函数声明必须先于 hooks
const loadArticles = async () => { ... };
const loadTags = async () => { ... };

useEffect(() => { loadArticles(); loadTags(); }, [page, selectedTag]);
useSync(loadArticles, { enabled: !selectedTag && !search });
```

或者改用 `function` 声明（会被提升）：

```jsx
function loadArticles() { ... }
```

## 修复提交

- app 仓库：`ab57bee` - `fix: 将loadArticles提到hooks前解决const TDZ崩溃`
- 主仓库：`37c14d7` - `fix: 各端HomePage/BlogPage的const loadArticles提到hooks前`

## 预防措施

- 代码审查时注意 `const`/`let` 声明的**使用必须在声明之后**
- 考虑引入 ESLint 规则 `no-use-before-define` 来静态检测此类问题
- React 组件内建议将函数声明（`function foo() {}`）提到 hooks 之前，或使用 `useCallback` 并在 deps 中引用
