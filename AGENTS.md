# 项目：桌面式个人站

## 定位

把个人站做成一个**桌面**：桌面背景 + 任务栏 + 窗口。每个窗口是一个功能单元，个人博客是其中一个子项目。

- 已完成窗口：**设置**、**关于**、**项目**、**博客**、**博客创作**
- 其余 3 个（技能 / 联系 / 终端 / 资产库）走 `AppPlaceholder` 占位
- **博客创作**窗口用本机 PAT 直接增改 GitHub Issues（= 博客文章），并上传/浏览 img 分支里的图片；
  没有 PAT 的访客只能浏览图片，写入能力拿不到
- 编辑器能力：**分屏实时预览**（编辑 / 分屏 / 预览三档）、markdown 工具栏
  （标题、加粗、斜体、删除线、行内代码、代码块、引用、列表、表格、链接）、
  快捷键 Ctrl+B / Ctrl+I / Ctrl+K / **Ctrl+S 保存**、草稿自动保存、图库点图即插入光标处

## 技术栈

Vite 5 + React 18 + TypeScript + Tailwind 3 + react-router-dom 6。
**无后端**：所有设置存浏览器 localStorage；博客正文来自 GitHub Issues。

## 依赖清单（**新增依赖必须记在这里，并在回复里当场提示用户**）

> 约定：每加一个依赖，都要写清「为什么需要」。

| 依赖 | 用途 | 加入时机 |
|---|---|---|
| `react` / `react-dom` 18 | UI 框架 | 初始 |
| `react-router-dom` 6 | 路由：一个窗口一条真实路由 | 初始 |
| `vite` / `@vitejs/plugin-react` | 构建与开发服务器 | 初始 |
| `typescript` | 类型检查（`build` 里跑 `tsc --noEmit`） | 初始 |
| `tailwindcss` / `postcss` / `autoprefixer` | 样式 | 初始 |
| `react-markdown` 9 | 博客正文 markdown 渲染 | 博客窗口 |
| `remark-gfm` 4 | GFM 语法：表格、任务列表、删除线 | 博客窗口 |
| `rehype-highlight` 7 | 代码块语法高亮（配色不引第三方 CSS，用主题令牌写在 `globals.css`） | 博客窗口 |

**故意不装的**：`@tailwindcss/typography`（用 `.md` 自定义规则代替）、`playwright`（验证脚本复用 DSH 那份）、任何 UI 组件库。

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
| `src/data/` | 站点文案与项目列表（`site.ts`、`projects.ts`） |
| `src/lib/github.ts` | 博客数据源与写入：Issues 读/写 + 图片上传（img 分支）+ 各自缓存与限流回退 |
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
| `desktop.blog` | 博客列表缓存 `{ posts, fetchedAt }`，TTL 10 分钟（GitHub 未认证限流 60 次/小时） |
| `desktop.ghToken` | **博客创作窗口用的 GitHub PAT**。只存本机浏览器，绝不进仓库/代码；同源脚本可读，别在公共电脑上填 |
| `desktop.imgTree` | img 分支图片清单缓存，TTL 10 分钟（浏览图库不需要 Token） |
| `desktop.draft` | 编辑中的草稿（自动保存，发布/取消后清除），防止误关窗口丢内容 |

读取一律走 `lib/` 里的 guard 函数，坏数据要能回默认值，不要让启动崩掉。

## 数据约定（GitHub 仓库即后端）

- **文章 = Issues**：分类用 `daily` / `project` 标签，其余标签当 tag；封面取正文里第一张图。
- **图片 = `img` 分支**：路径 `YYYY/MM/<随机16位>.<ext>`，对外地址
  `https://cdn.jsdelivr.net/gh/chengantoine2-spec/Antoine.github.io@img/<路径>`（jsDelivr 加速）。
  上传走 Contents API（`PUT /contents/<path>` + `branch: 'img'`），需要 Token；
  **浏览图库是公开读取，不需要 Token**。
- 写操作一律浏览器直连 `api.github.com`，Token 只在本机 localStorage。

> ⚠️ **测试期标注（2026-09）**：验证时用过一次真实 PAT，该 Token 已出现在会话记录里。
> 现在按"测试阶段、暂不处理安全"处理，**正式上线前必须撤销并重建**。
> 影响范围：`desktop.ghToken` 泄露 = 该仓库的 Issues 与 Contents 写入权限。

## 三个已经踩过的坑（别再踩）

**坑 1 · 自定义 CSS 不要放进 `@layer components`。**
Tailwind 会按 `content` 扫描结果裁剪 `@layer components` 里"扫描不到"的规则，而运行时拼出来的类名
（如 `desktop__wall--${wallpaper}`、`desktop__media--${fit}`）永远扫不到 → 整条规则被删，
表现为"功能切了没反应"。**自定义类一律写在 `@layer` 之外**（`globals.css` 已按此组织）。

**坑 2 · 滚动容器里不要在 `pointerdown` 就 `setPointerCapture`。**
指针一旦被容器捕获，`pointerup` 会改派到容器，里面按钮的 `click` 永远不触发 —— 表现是"按钮点不动"。
要等拖动位移超过阈值（现在用 4px）再抓指针。

**坑 3 · 懒加载组件 + 同步更新 = 整页变错误界面。**
markdown 那块是 `React.lazy` 的。如果在**同步**的 `setState` / `navigate` 里让它第一次挂载，React 18 会抛
`A component suspended while responding to synchronous input`，React Router 直接把整页替换成错误页。
对策（两招一起用）：`startTransition(() => navigate/setState(...))`，并在窗口挂载时 `void import('./Markdown')` 预热。
以后再加 lazy 组件，照这个模式来。

## 验证

- 手动：`npm run dev` → http://localhost:5173
- 自动：`npm run verify`（复用 DSH 的 Playwright + 系统 Edge，不把 playwright 装进本项目；
  需要换位置就设 `PLAYWRIGHT_PKG`）
- 改动后至少跑一遍 `npm run build`；涉及交互的再跑 `npm run verify`

## 工作流约定（重要）

- **新功能一律先在本地验证**，`git commit` 只落在本地；**推送远端要等明确指令**。
- 本仓库 `origin` 指向 `chengantoine2-spec/Antoine.github.io`（就是线上站点）。
  `main` 已启用 push 触发 → **一推就上线**，所以别顺手 push。
- 旧站（WinXP 桌面那版）备份在远端分支 `legacy-xp-desktop` 与本机 `网页任务` 克隆里。

## 部署

- `.github/workflows/deploy.yml`：推到 `main` 或手动触发，构建时用 `VITE_BASE` 注入子路径
- 项目站深链靠 `build:pages` 生成的 `dist/404.html` 兜底，路由 `basename` 取自 `import.meta.env.BASE_URL`
- Pages 的 Source 必须设为 "GitHub Actions"（仓库 Settings → Pages）
