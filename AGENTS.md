# 项目：桌面式个人站

## 定位

把个人站做成一个**桌面**：桌面背景 + 任务栏 + 窗口。每个窗口是一个功能单元，个人博客是其中一个子项目。

- 已完成窗口：**设置**、**关于**、**项目**、**博客**、**博客创作**、**终端**、**饥荒 Wiki**
- 其余 2 个（技能 / 联系 / 资产库）走 `AppPlaceholder` 占位
- **终端**窗口跑的是**真命令**：浏览器只当屏幕，命令在本机执行。为此需要一个本地服务
  `npm run term`（`tools/term-server.mjs`，只用 Node 内置模块，不引依赖）。
  ⚠️ 它的安全面比那个 GitHub PAT 大得多 —— 等价于把本机 shell 开给这个页面，所以三条底线：
  **必须带启动时打印的 token**、**只接受来自 localhost / 127.0.0.1 页面的请求**（Origin 白名单）、
  **绝不放到公网**。部署到 GitHub Pages 上时它只会如实报「服务未运行」，这是设计如此
- 编辑中/未完成的功能宁可写"待接入"，也不要给一个点了没反应的按钮（终端服务、全屏按钮都按这条办）
- **博客创作**窗口用本机 PAT 直接增改 GitHub Issues（= 博客文章），并上传/浏览 img 分支里的图片；
  没有 PAT 的访客只能浏览图片，写入能力拿不到
- 编辑器能力：**分屏实时预览**（编辑 / 分屏 / 预览三档）、markdown 工具栏
  （标题、加粗、斜体、删除线、行内代码、代码块、引用、列表、表格、链接）、
  快捷键 Ctrl+B / Ctrl+I / Ctrl+K / **Ctrl+S 保存**、草稿自动保存、图库点图即插入光标处
- **博客**窗口是贴吧式三栏：左（分类 / 标签，带计数）、中（搜索 + 卡片流）、右（站标 / 最新 / 统计）。
  栏数跟着**窗口宽度**走（`globals.css` 里 `.blog` 那段容器查询）：窄于 620px 一列、≥620px 两列、≥900px 三列，
  所以 `apps.ts` 里博客窗口默认给到 1000 宽
- 博客搜索是本地即时筛选，匹配标题 + 正文 + 标签；**索引和查询都过 `normalizeForSearch`**
  （抹掉空白与标点），所以「焦糖 布丁」也能命中「焦糖布丁」。
  两边规则一旦拆开写就会出现"正文搜不到"，别再改回去
- 文章详情页（`/blog/:id`）同样按窗口宽度加栏：≥940px 出右栏（目录 + 更多文章）、
  ≥1160px 再出左栏（文内信息）。**正文列默认 88ch（约 720px）、不跟着窗口拉长**，多出来的宽度给两栏；
  拖左右两条「白色长条」可以改这个宽度（复刻 DSH 会话页，见「正文列宽拖动条 / 滚动条」一节）。
  右栏断点别写成 960 —— 博客窗口默认 1000 宽，扣掉内边距只剩 958，卡在 960 上就永远看不到右栏。
  目录 id 由标题文字推导（`lib/toc.ts`），`Markdown.tsx` 给 h2/h3 挂同一个 id，两边不共享计数器
- 窗口标题栏是 `– □ ×`：最小化 / 最大化（铺满视口，含任务栏）/ 关闭
- 任务栏图标边长：设置里 6 档（跟随厚度 / 32 / 40 / 48 / 56 / 64）。「跟随厚度」时自动值上限 64
  （`Dock.tsx` 的 `BTN_MAX`），再厚就折成最多 3 行；手选的档位会被 clamp 到 32~64。
  **拖长或加厚之后图标组必须居中**：bar 用 `justify-center`；滚动视口里再套一层用 `m-auto`
  （居中**不能**写在滚动容器上，见坑 5），装不下时两端都要滚得到。
  **长度下限是算出来的**（`btn * 4 + GAP * 3 + 内边距 + 边框`）—— 至少要装得下两端三个固定按钮
  （开始 / 全屏 / 位置）+ 一个图标，否则拖到最小时它们会被顶出任务栏边界；
  **厚度下限同样跟着固定图标尺寸走**（`lib/dock.ts` 的 `minDockThickness` = 图标 + 内边距/边框）——
  原来写死的 48 只按默认图标算，选 64 的图标再把厚度拖薄，图标会被裁掉一截。
  下限在 `useDock` 里收口成 `minThickness` / `effectiveThickness`，**任务栏渲染与窗口「让位」共用**，
  免得一边被图标撑高、另一边还按旧厚度让位；
  多行折行的尺寸约束要**一直**加在内层，不能只在 `length === null` 时加，
  否则拖过长度的任务栏就不再折行，只能在一条里滚
- **浏览器级全屏**（连浏览器自己的窗口一起盖住，和"窗口最大化"不是一回事）**不在标题栏**，
  而是两处：任务栏右边固定的 ⛶、设置窗口里的「进入全屏」。两处共用
  `hooks/useFullscreen.ts` 与 `components/desktop/FullscreenButton.tsx`。
  状态听 `fullscreenchange`，所以按 Esc / F11 退出也能同步；进全屏时会顺手最大化当前窗口。
  ⚠️ 取舍：全屏后窗口盖住任务栏，那个 ⛶ 自己就点不到了 —— 退出靠 Esc / F11。
  想让"全屏时任务栏仍可点"，把 useFullscreen 里那一步最大化去掉即可

## 分工：饥荒 Wiki 窗口（多人 / 多 agent 同时改时看这里）

这个仓库可能同时有**两个 agent** 在改，边界如下：

| 谁 | 负责 | 能动哪些文件 |
|---|---|---|
| **主管** | 全站 UI / 交互 / 内容标准：桌面外壳、任务栏、窗口框架、主题令牌、路由、部署、验证脚本 | 除右边那两处以外的**全部** |
| **wiki 负责人** | 只管「饥荒 Wiki」窗口的**内容与呈现** | `src/components/program/DstWikiWindow.tsx`、`DstWikiContent.tsx`、`src/data/dst/**`、`src/lib/dst/**`、`tools/verify-dst.mjs`、`docs/**` |

**当前进度（2026-09-29 更新）**：这个窗口已经**做完并接好线**，不再是种子状态。

- 数据：`src/data/dst/` 拆成 `characters`（18 角色）/ `creatures`(8) / `items`（64 物品 + 9 料理）/
  `world`(5) / `recipes`（40 配方）；`index.ts` 是唯一入口，做类型再导出、**按 id 去重**、
  以及 `recipesFor` / `recipesUsing` / `entryName` 反查
- 契约：`src/lib/dst/types.ts`（**唯一一份**）。判别字段是 **`category`** 而不是 `kind` ——
  组件按 category 分栏，不需要知道具体是角色还是物品
- 搜索：`src/lib/dst/search.ts`（索引 + 打分）+ `src/lib/dst/pinyin.ts`（拼音 / 多音字覆盖）。
  支持中文 / 别名 / 英文 / 全拼 / **首字母**（`jft` → 金斧头）
- 界面：`DstWikiWindow.tsx` 只是轻量外壳，实现全在 `DstWikiContent.tsx`（懒加载，见下）
- 校验：`npm run verify:dst`（21 项：引用完整性 / 搜索回归 / 配方反查 / 教程区）
- 教程：带 `wiki` 标签的博客文章，已经用 `docs/dst-guides/publish.mjs` 发布为
  **issue #14 / #15 / #16**（标签 `wiki` + `新手教程`）。Wiki 窗口的「新手教程」区按标签筛；
  **博客列表会把它们分流出去**（`src/lib/github.ts` 的 `isWikiGuide()`），选中「饥荒 Wiki」分类才显示。
  ⚠️ 博客窗口的**分类角标要统计全部已发布文章**，不能统计筛选后的列表 —— 否则切分类时角标会跳成 0
  （踩过一次，见 `docs/dst-wiki.md` 的「踩过的坑」）
- 详细实现说明（数据模型、打分规则、chunk 拆分原因、踩过的坑）：**`docs/dst-wiki.md`**

⚠️ 提交前**必须** `npm run typecheck` 通过：曾经出现 `characters.ts` 里
`import … from '../types'` 指向不存在的路径，`npm run build` 直接失败（一推就炸 CI）。
路径是 `'../../lib/dst/types'`（数据文件在 `src/data/dst/`，契约在 `src/lib/dst/`）。

⚠️ `router.tsx` 静态 import 的 `DstWikiWindow.tsx` **必须保持轻量**：它只 import react，
真正的实现与数据在 `DstWikiContent.tsx` 里由 `lazy()` 拉。一旦让外壳静态 import 数据或
`pinyin.ts`，几百 KB 会折进桌面首屏 chunk（实测首屏 +120 KB gzip）。改完请看构建产物的 chunk 大小。

wiki 负责人的硬约束：

1. **改的范围以归属表为准**。窗口外壳（`Window.tsx` / `Dock.tsx`）、登记表（`lib/apps.ts`）、
   路由（`router.tsx`）、主题（`tokens.css`、`globals.css` 的共享部分）、验证脚本（`tools/verify.mjs`）
   都归主管 —— 需要新能力（条目要独立路由 `/wiki/:id`、要新图标、要新令牌）就提出来，别自己动。
   ⚠️ **已有一个经用户批准的例外**：为了让教程能"以博客文章（wiki 标签）呈现"，
   wiki 负责人改过三个共享文件 —— `src/lib/github.ts`（`CATEGORIES` 加 `wiki` + `isWikiGuide()`）、
   `BlogWindow.tsx`（教程分流，一行 filter）、`WriteWindow.tsx`（Draft 类型 + 分类按钮）。
   三处都是**纯增量**，可单独撤回。以后这类跨边界改动要先说明。
2. 颜色**只用主题令牌类**（`text-ink` / `bg-surface-2` / `border-edge` / `text-dim` / `bg-accent` …），
   不许写死 `#fff` / `rgb()` / `bg-white`（见「主题令牌」一节）
3. 版式用现成的三栏模式 `.wiki__*`（`globals.css`），栏数跟着窗口宽度走；正文行宽别超过 `68ch`
4. **新增依赖要先登记**：用户的规矩是「批准，但要记录并提示」—— `npm install` 之后必须在
   「依赖清单」表里加一行（写清为什么需要），并在回复里说出来。重的别引：
   markdown 渲染器、UI 组件库、状态管理库都免谈
5. 改完必须 `npm run build` 通过；涉及交互再跑 `npm run verify`（需要 dev server 在跑）。
   `verify` 里有针对这个窗口的检查，**别改测试去迁就实现** —— 那是主管的文件
6. 新窗口该有的登记（`apps.ts` 一行、`router.tsx` 映射、图标、`source`、默认尺寸）已由主管完成，
   你直接在组件与数据里填内容即可

**两个人的操作纪律（血的教训，都踩过）**：

- **提交时只 `git add <自己改的路径>`，绝对不要 `git add -A`**。两边并发时，
  `add -A` 会把对方**进行中**的改动一起提交进来（主管已经踩了两次：一次卷进对方的 WIP，
  一次把对方的删除与重写记进了自己的提交），提交说明与实际内容对不上，排查起来很费劲
- **提交前先 `git status` 看一眼**：如果扫到对方的文件被改/被删，那多半是他正在重构，
  **不要去"修"他的半成品**，也不要把它提交掉；先做自己的、或等一会儿
- 重构期间 `npm run typecheck` **会短暂变红**（比如拆模块时新模块还没落地）。
  红的时候谁都不要 push —— 推上去 Actions 会构建失败
- 拿不准归属就问：主管的文件是「除 wiki 窗口以外的一切」，wiki 负责人的是
  `DstWikiWindow.tsx` + `src/data/dst/**` + `src/lib/dst/**`

## 技术栈

Vite 5 + React 18 + TypeScript + Tailwind 3 + react-router-dom 6。
**站点本身没有后端**：所有设置存浏览器 localStorage；博客正文来自 GitHub Issues。
唯一的服务端是**可选的本机终端服务**（`npm run term`），只监听 127.0.0.1、只服务本机页面。

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
| `pinyin-pro` 3.29 | 饥荒 Wiki 窗口的拼音匹配 / 排序（中文条目名按拼音搜） | 饥荒 Wiki 窗口（wiki 负责人加入，主管已登记） |

**故意不装的**：`@tailwindcss/typography`（用 `.md` 自定义规则代替）、`playwright`（验证脚本复用 DSH 那份）、任何 UI 组件库。

## 常用命令

```bash
npm run dev          # 本地开发，默认 http://localhost:5173
npm run term         # 本机终端服务（终端窗口用；只监听 127.0.0.1，启动时打印 token）
npm run build        # tsc --noEmit + vite build
npm run build:pages  # 追加生成 dist/404.html（GitHub Pages 深链兜底）
npm run verify       # Playwright 冒烟验证（需要 dev 已在跑）
npm run verify:dst   # 饥荒 Wiki 专属校验：数据完整性 + 搜索回归 + 配方反查（需要 dev 已在跑）
npm run typecheck    # 只做类型检查
```

## 目录与文件边界

| 路径 | 职责 |
|---|---|
| `src/components/desktop/` | 桌面外壳：`DesktopShell`（布局+让位）、`Window`（窗口框）、`Dock`（任务栏）、`DockPositionMenu`、`StartMenu`、`AppIcon`、`FullscreenButton`（全屏按钮） |
| `src/components/program/` | **窗口内容一律放这里**（`AboutWindow`、`SettingsWindow`、`AppPlaceholder`、`WidthHandle`＝正文列宽拖动条） |
| `src/hooks/` | `useAppearance`（主题+壁纸）、`useDock`（任务栏）、`useWindows`（窗口状态与几何记忆）、`useFullscreen`（浏览器级全屏）、`useArticleWidth`（正文列宽） |
| `src/lib/` | `apps`（窗口登记表）、`dock`（任务栏几何）、`readingWidth`（正文列宽几何与让位规则）、`theme`（主题与壁纸清单）、`windowManager`（纯 reducer）、`windowStore`（几何持久化） |
| `src/styles/tokens.css` | 三套主题的**全部**色值与圆角变量 |
| `src/styles/globals.css` | 全局基础样式 + 自定义类（见下方"坑 1"） |
| `src/data/` | 站点文案与项目列表（`site.ts`、`projects.ts`）；`dst/` 是饥荒 Wiki 的数据，**归 wiki 负责人** |
| `src/lib/github.ts` | 博客数据源与写入：Issues 读/写 + 图片上传（img 分支）+ 各自缓存与限流回退 |
| `public/` | 原样拷进构建产物的静态文件：站标 `logo.svg`（矢量源，标签页图标 + 站内品牌）+ `logo.png`（512 位图，iOS 主屏图标）。**站内引用一律走 `SITE.logo`**（它拼了 `BASE_URL`）；别在组件里写死 `/logo.svg`——`src` 里的字符串 Vite 不会改写 base，子路径部署会 404 |
| `tools/` | `verify.mjs`（全站冒烟验证）、`verify-dst.mjs`（饥荒 Wiki 专属校验，归 wiki 负责人）、`pages-postbuild.mjs`（404 兜底）、`make-logo.mjs`（把 `logo.svg` 渲染成 PNG）、`term-server.mjs`（本机终端服务，只监听 127.0.0.1） |
| `docs/` | `dst-wiki.md`（饥荒 Wiki 的实现说明：数据模型 / 打分规则 / chunk 拆分 / 踩坑）、`dst-guides/`（3 篇新手教程稿件 + 发布脚本 + 说明），**归 wiki 负责人** |

## 窗口契约：加一个新窗口要动 4 个地方

1. `src/lib/apps.ts` 登记一行：`id / name / path / source / icon`，需要更大窗口再加 `defaultSize`
2. `src/components/program/<名字>Window.tsx` 写内容
3. `src/router.tsx` 的 `WINDOWS` 映射里挂上（不挂就自动走 `AppPlaceholder`）
4. 数据源写进 `apps.ts` 的 `source` —— 它是「窗口名 → 路由 → 数据源」的唯一登记处

## 正文列宽拖动条 / 滚动条（复刻 DSH 会话页）

用户在 DSH 的对话页看到两样东西，要求复刻进博客，现在都在：

1. **左右两条白色拉伸长条**（文章详情页 `– □ ×` 窗口里的正文列两侧）：拖动改正文列宽。
   实现照搬 DSH 的 `WidthHandle`：
   - 抓取带 24px 宽、不占位，正好落在正文列与窄栏之间的空隙里；那 3px 长条是 CSS 的 `::after`，
     平时透明，悬停/拖动/键盘聚焦时才显形，并用 `--width-handle-pointer-y` **跟着指针上下渐隐**
   - **对称位移 ×2**：正文列居中，往右拖 40px = 两侧各出去 40px = 列宽 +80px，手柄黏在指针下
   - 拖动走 pointer capture + rAF 节流，**过程中只改 CSS 变量、不进 React 状态**（否则长文章每帧重渲）
   - 窄的 480 ~（容器 − 48）宽；拖动/键盘（方向键 24px，Shift 96px）松手才落盘；**双击复位**回 88ch
   - **拖宽到窄栏放不下时窄栏让位**：先让左栏、留住目录，再全让；拖回去自己回来。
     判定只看「列宽 + 栏占位 ≤ 容器」，与栏当前是否显示无关（见坑 6 的稳定基准）
   - 没存过偏好时不写 `data-rails`，栏数照旧由容器查询决定 —— 默认观感一点没变
   - 文件：`components/program/WidthHandle.tsx`（手柄）、`hooks/useArticleWidth.ts`（测量与回调）、
     `lib/readingWidth.ts`（几何/钳制/让位规则）、`globals.css` 的 `.width-handle` 与 `[data-rails]`

2. **右侧显示上下位置的那条**（= DSH 的自定义滚动条）：`globals.css` 里一套全局
   `::-webkit-scrollbar` 规则 —— 8px 宽、轨道透明、4px 圆角滑块、悬停变亮，
   颜色取 `--c-scroll-thumb` / `--c-scroll-thumb-hover`；Firefox 走 `@supports not selector(...)`
   退回 `scrollbar-width: thin` + `scrollbar-color`。DSH 就是在 `ui-theme` 里这么写的，照抄。
   ⚠️ 滚动条是浏览器原生绘制的：系统开了「自动隐藏滚动条」时 CSS 不生效，这属正常，
   验证脚本因此只断言样式表里落了这几条规则（不去量最终外观）。

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
logo-mark                        站标：读 --logo-shadow，给透明底图形托一层轻投影
变宽拖动条 / 滚动条滑块           读 --c-scroll-thumb（滑块）、--c-scroll-thumb-hover（悬停与拖动条）
```

**禁止写死颜色**（`#fff`、`rgb(...)`、`bg-white` 这类字面量一律不许出现在组件里）。
要加主题就在 `tokens.css` 里加一组变量块 —— 组件一行都不用改。
站标的投影同理：三套主题各有一个 `--logo-shadow`，加主题时别忘了补上它。
滚动条那两个同理：**加新主题时必须一起补 `--c-scroll-thumb` / `--c-scroll-thumb-hover`**，
不然滚动条滑块会变成透明（读不到变量）。

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
| `desktop.termPort` | 终端服务端口，默认 5180 |
| `desktop.termToken` | **终端服务的 token**（`npm run term` 启动时打印）。只存本机浏览器；有了它才能在网页里跑本机命令 |
| `desktop.articleWidth` | 文章正文列宽（px）。拖过正文两侧的拖动条才有；**双击拖动条 = 删掉这个键**，回到 88ch 自适应 |

读取一律走 `lib/` 里的 guard 函数，坏数据要能回默认值，不要让启动崩掉。

## 数据约定（GitHub 仓库即后端）

- **文章 = Issues**：分类用 `daily` / `project` / `wiki` 标签，其余标签当 tag；封面取正文里第一张图。
  - **增 / 改**：`POST /issues`、`PATCH /issues/{n}`
  - **删**：REST 没有删 issue 的接口，只能走 GraphQL `deleteIssue`（需要 issue 的 `node_id`，列表接口会给）
  - **下架 = close**：公开博客列表只显示 `state=open`，下架的仍能在创作窗口看到并「重新显示」
  - **`wiki` = 饥荒 Wiki 的教程**：这类文章归 Wiki 窗口的「新手教程」区，
    **博客列表会把它们分流出去**（免得几十篇教程淹掉日常 / 项目），选中「饥荒 Wiki」分类才显示。
    判定统一走 `src/lib/github.ts` 的 `isWikiGuide()`，两个窗口共用，别各写一份。
    教程稿件与批量发布脚本见 `docs/dst-guides/`。
- **图片 = `img` 分支**：路径 `YYYY/MM/<随机16位>.<ext>`，对外地址
  `https://cdn.jsdelivr.net/gh/chengantoine2-spec/Antoine.github.io@img/<路径>`（jsDelivr 加速）。
  上传走 Contents API（`PUT /contents/<path>` + `branch: 'img'`），需要 Token；
  **浏览图库是公开读取，不需要 Token**。
- 写操作一律浏览器直连 `api.github.com`，Token 只在本机 localStorage。

> ⚠️ **测试期标注（2026-09）**：验证时用过一次真实 PAT，该 Token 已出现在会话记录里。
> 现在按"测试阶段、暂不处理安全"处理，**正式上线前必须撤销并重建**。
> 影响范围：`desktop.ghToken` 泄露 = 该仓库的 Issues 与 Contents 写入权限。

## 六个已经踩过的坑（别再踩）

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

**坑 4 · Vite dev server 会缓存旧模块导出。**
改了某个模块的导出（例如给 `lib/github.ts` 加 `deleteIssue`）后，浏览器可能报
`The requested module '…' does not provide an export named 'X'`，而 `tsc --noEmit` 和 `vite build` 都是通过的。
**重启 dev server 即可**（别去改源码，源码没错）。

**坑 5 · 别在可滚动容器上写 `justify-content: center`。**
内容一旦超出，超出的那一侧会落到**滚动原点之外** —— 滚轮和拖动都永远够不到。
任务栏小的时候"最左 / 最上的图标怎么滚都看不见"就是这个：滚动区 94px、内容 243px 时，
最左图标在 `scrollLeft = 0` 处的偏移是 **−149**，滚到头还是 −298。
正确做法是让**内层**用 `margin: auto`：有富余空间时它居中，真超出时自动解析成 0，
内容从滚动原点开始，两端都够得到（Dock 的 `.no-scrollbar` 视口 + 内层 `m-auto` 就是这个模式）。

**坑 6 · 拖动中的宽度不能被「按存档重贴」覆盖。**
正文列宽是**不进 React 状态**的（拖动每帧只改 CSS 变量）。但那个 `ResizeObserver` 回调会重贴一次
「存下来的偏好」—— 没存过偏好时它的动作是**把变量摘掉**。拖宽到窄栏让位时，内容高矮一变、
滚动条一进一出，观察器立刻回调 → 正在拖的宽度当场被抹掉，表现是"拖到一半弹回去"；
在滚动条占位的机器（Windows 默认就是）上必现。对策：hook 里放一个 `dragging` ref，
`onStart` 置位、`onEnd` 复位，**拖动期间 `publish()` 直接 return**。
同理，窄栏让位的判定要用**稳定基准**（`容器可用宽 + 滚动条占位`），不能直接用会被滚动条改变的那个宽度，
否则还会多一种"栏藏起来 → 滚动条消失 → 容器变宽 → 栏又回来"的横跳。

## 验证

- 手动：`npm run dev` → http://localhost:5173
- 自动：`npm run verify`（复用 DSH 的 Playwright + 系统 Edge，不把 playwright 装进本项目；
  需要换位置就设 `PLAYWRIGHT_PKG`）
- 饥荒 Wiki 专属：`npm run verify:dst` —— 引用完整性 / 搜索回归 / 配方反查 / 教程区（21 项）。
  它**独立于** `verify.mjs`：条目之间的引用只存 id，**页面不会因为引用写错而报错**，
  只会安静地少渲染一个按钮，所以那类问题必须单独验。改这个窗口的数据或搜索后一定要跑。
- 改动后至少跑一遍 `npm run build`；涉及交互的再跑 `npm run verify`
- 正文列宽那套在 `verify.mjs` 里有 4 项：拖动条位置、**拖 40px = +80px 且落盘**、
  窄栏让位与双击复位、宽窗下先让左栏留住目录。改 `lib/readingWidth.ts` 的常量后一定要跑

## 工作流约定（重要）

- **新功能一律先在本地验证**，`git commit` 只落在本地；**推送远端要等明确指令**。
- 本仓库 `origin` 指向 `chengantoine2-spec/Antoine.github.io`（就是线上站点）。
  `main` 已启用 push 触发 → **一推就上线**，所以别顺手 push。
- 旧站（WinXP 桌面那版）的远端备份分支 `legacy-xp-desktop` 已在清理时删除；
  现在只剩本机同级目录 `..\网页任务` 那个旧克隆里还有。

## 部署

- `.github/workflows/deploy.yml`：推到 `main` 或手动触发，构建时用 `VITE_BASE` 注入子路径
- 项目站深链靠 `build:pages` 生成的 `dist/404.html` 兜底，路由 `basename` 取自 `import.meta.env.BASE_URL`
- Pages 的 Source 必须设为 "GitHub Actions"（仓库 Settings → Pages）
