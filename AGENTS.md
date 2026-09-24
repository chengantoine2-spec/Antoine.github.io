# 项目：桌面式个人站

## 定位

把个人站做成一个**桌面**：桌面背景 + 任务栏 + 窗口。每个窗口是一个功能单元，个人博客是其中一个子项目。

- 已完成窗口：**设置**、**关于**
- 其余 6 个（项目 / 博客 / 技能 / 联系 / 终端 / 资产库）走 `AppPlaceholder` 占位

## 技术栈

Vite 5 + React 18 + TypeScript + Tailwind 3 + react-router-dom 6。
**无后端**：所有设置存浏览器 localStorage，不接任何服务端。

## 常用命令

```bash
npm run dev          # 本地开发，默认 http://localhost:5173
npm run build        # tsc --noEmit + vite build
npm run build:pages  # 追加生成 dist/404.html（GitHub Pages 深链兜底）
npm run verify       # Playwright 冒烟验证（需要 dev 已在跑）
npm run typecheck    # 只做类型检查
```

## 目录与文件边界

| 路径 | 职责 |
|---|---|
| `src/components/desktop/` | 桌面外壳：`DesktopShell`（布局+让位）、`Window`（窗口框）、`Dock`（任务栏）、`DockPositionMenu`、`StartMenu`、`AppIcon` |
| `src/components/program/` | **窗口内容一律放这里**（`AboutWindow`、`SettingsWindow`、`AppPlaceholder`） |
| `src/hooks/` | `useAppearance`（主题+壁纸）、`useDock`（任务栏）、`useWindows`（窗口状态与几何记忆） |
| `src/lib/` | `apps`（窗口登记表）、`dock`（任务栏几何）、`theme`（主题与壁纸清单）、`windowManager`（纯 reducer）、`windowStore`（几何持久化） |
| `src/styles/tokens.css` | 三套主题的**全部**色值与圆角变量 |
| `src/styles/globals.css` | 全局基础样式 + 自定义类（见下方"坑 1"） |
| `src/data/site.ts` | 站点文案，改「关于」窗口只动这里 |
| `tools/` | `verify.mjs`（冒烟验证）、`pages-postbuild.mjs`（404 兜底） |

## 窗口契约：加一个新窗口要动 4 个地方

1. `src/lib/apps.ts` 登记一行：`id / name / path / source / icon`，需要更大窗口再加 `defaultSize`
2. `src/components/program/<名字>Window.tsx` 写内容
3. `src/router.tsx` 的 `WINDOWS` 映射里挂上（不挂就自动走 `AppPlaceholder`）
4. 数据源写进 `apps.ts` 的 `source` —— 它是「窗口名 → 路由 → 数据源」的唯一登记处

## 主题令牌（硬规则）

组件**只读 CSS 变量**，可用类名：

```
bg-chrome / text-chrome-ink      任务栏底色与前景
bg-surface / bg-surface-2        窗口、卡片
border-edge                      所有边框
text-ink / text-dim              正文 / 次要文字
bg-accent / text-accent-ink      强调（当前项、主按钮）
bg-hover                         悬停底色
rounded-window / rounded-dock    圆角
```

**禁止写死颜色**（`#fff`、`rgb(...)`、`bg-white` 这类字面量一律不许出现在组件里）。
要加主题就在 `tokens.css` 里加一组变量块 —— 组件一行都不用改。

## localStorage 键

| 键 | 内容 |
|---|---|
| `desktop.theme` | `caramel` \| `linen` \| `night` |
| `desktop.wallpaper` | `gradient` \| `grid` \| `noise` \| `stripe` \| `image` |
| `desktop.wallpaperFit` | `cover` \| `contain` \| `repeat`（仅图片） |
| `desktop.wallpaperDim` | `0` \| `0.15` \| `0.3` \| `0.45` |
| `desktop.dock` | `{ position, length, thickness, iconSize, dockApps }` |
| `desktop.windows` | 窗口几何记忆；**关闭窗口不清除**，下次打开回到原处 |

读取一律走 `lib/` 里的 guard 函数，坏数据要能回默认值，不要让启动崩掉。

## 两个已经踩过的坑（别再踩）

**坑 1 · 自定义 CSS 不要放进 `@layer components`。**
Tailwind 会按 `content` 扫描结果裁剪 `@layer components` 里"扫描不到"的规则，而运行时拼出来的类名
（如 `desktop__wall--${wallpaper}`、`desktop__media--${fit}`）永远扫不到 → 整条规则被删，
表现为"功能切了没反应"。**自定义类一律写在 `@layer` 之外**（`globals.css` 已按此组织）。

**坑 2 · 滚动容器里不要在 `pointerdown` 就 `setPointerCapture`。**
指针一旦被容器捕获，`pointerup` 会改派到容器，里面按钮的 `click` 永远不触发 —— 表现是"按钮点不动"。
要等拖动位移超过阈值（现在用 4px）再抓指针。

## 验证

- 手动：`npm run dev` → http://localhost:5173
- 自动：`npm run verify`（复用 DSH 的 Playwright + 系统 Edge，不把 playwright 装进本项目；
  需要换位置就设 `PLAYWRIGHT_PKG`）
- 改动后至少跑一遍 `npm run build`；涉及交互的再跑 `npm run verify`

## 部署（已备好，未启用）

- `.github/workflows/deploy.yml`：推到 `main` 或手动触发，构建时用 `VITE_BASE` 注入子路径
- 项目站深链靠 `build:pages` 生成的 `dist/404.html` 兜底，路由 `basename` 取自 `import.meta.env.BASE_URL`
- **首次启用前**：到仓库 Settings → Pages 把 Source 设为 "GitHub Actions"
