# 项目：桌面式个人站

## 红线（每次开工先读这一段）

1. **PAT 绝不进仓库**：不写任何文件（含 `.env`／文档／注释）、不 `git add`、不进提交信息、`git config`。
   自查：`git log -p origin/main..HEAD | Select-String "github_pat_|ghp_"`（应无输出）。
2. **版权红线**：不许打包 SF Pro / Avenir 等商业字体文件；不许用 Apple 原版壁纸 / 系统图标；
   抄了 MIT 代码必须在本文记明出处与 license（只取数值**不算**抄代码）。详见 `MACOS-BRIEF.md` 第 5 节。
3. **终端服务三条底线**：必须带启动 token、只接受 localhost/127.0.0.1 页面（Origin 白名单）、绝不放到公网。
4. **不引依赖**；颜色只用主题令牌（不许写死 `#fff` / `rgb()` / `bg-white`）；自定义 CSS 写在 `@layer` 之外。
5. **本机服务只监听 127.0.0.1**；要越出这条线必须先问站主。

## 定位

把个人站做成一个**桌面**：桌面背景 + 任务栏 + 窗口。每个窗口是一个功能单元，个人博客是其中一个子项目。

- 已完成窗口：**设置**、**关于**、**项目**、**博客**、**博客创作**、**终端**、**饥荒 Wiki**、**塔罗牌**
- 其余 3 个（技能 / 联系 / 资产库）走 `AppPlaceholder` 占位
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
  所以 `apps.ts` 里博客窗口默认给到 1000 宽。
  中栏与两侧栏之间的**分界可以拖**（和文章页同款的白条，见「正文列宽拖动条 / 滚动条」一节）：
  中栏始终 `1fr` 吃满剩余空间，所以拖的是分界 —— 拖多少变多少，整行永远贴齐。
  **右栏统计与左栏角标同源**：都只认「已发布」那一份（`openPosts`），切分类 / 搜索 / 点标签都不许变；
  角标必须加得出「全部」（没打 daily/project/wiki 标签的文章会落到 `other`，得在左栏列出来）；
  「文章」写「N 篇已发布」= 真总数，教程分流那一句在下面说明，免得看着像少了几篇。
  统计项：文章 / 字数 / 标签 / 建站（`SITE.since` → 第几天）/ 最近更新
- 博客搜索是本地即时筛选，匹配标题 + 正文 + 标签；**索引和查询都过 `normalizeForSearch`**
  （抹掉空白与标点），所以「焦糖 布丁」也能命中「焦糖布丁」。
  两边规则一旦拆开写就会出现"正文搜不到"，别再改回去
- 文章详情页（`/blog/:id`）同样按窗口宽度加栏：≥940px 出右栏（目录 + 更多文章）、
  ≥1160px 再出左栏（文内信息）。**正文列默认 88ch（约 720px）、不跟着窗口拉长**，多出来的宽度给两栏；
  拖左右两条「白色长条」可以改这个宽度（复刻 DSH 会话页，见「正文列宽拖动条 / 滚动条」一节）。
  右栏断点别写成 960 —— 博客窗口默认 1000 宽，扣掉内边距只剩 958，卡在 960 上就永远看不到右栏。
  目录 id 由标题文字推导（`lib/toc.ts`），`Markdown.tsx` 给 h2/h3 挂同一个 id，两边不共享计数器
- 窗口框 / 多窗口 / 标签 / 合并 / 吸附 / 正文列宽拖动条 / 全屏 / DSH 相关：**见 `ARCH-WINDOW.md`**
- 任务栏（图标区两种模式 / 回弹 / 放大 / 拖拽 / 长度下限 / 折行居中）：**见 `ARCH-DOCK.md`**
- 主题令牌 / 两套配色 / 字体红线 / 48 张菜图的用法 / 日月时钟 / 站名与菜名：**见 `ARCH-THEME.md`**
- 验证体系与历次断言的来龙去脉（哪条为哪个 bug 立的）：**见 `ARCH-VERIFY.md`**
- 顶部菜单栏（macOS P2 那一单：规格 / 实测数字 / 踩坑）：**见 `ARCH-MENUBAR.md`**

> 上面四个文件是从本文搬出去的长篇明细；**规则以本文为准**，那里放沿革、实测数字与踩坑。
- **下一步（方案已定，未开工）**：手机端走 **PWA/WebAPK**（零 SDK）+ 声音入口 L1
  （助手短语打开应用 → 应用内语音输入）；手机连电脑走 **Tailscale 私有网络**；
  落到 DSH 用官方 `@deepseek-ai/dsh-webhook`（把外部 HTTP 请求变成真实 Session，
  当前 profile 里**尚未挂载**）。本机服务仍然只监听 127.0.0.1 —— 要越出这条线必须先问用户

## 分工：饥荒 Wiki 窗口（多人 / 多 agent 同时改时看这里）

这个仓库可能同时有**两个 agent** 在改，边界如下：

| 谁 | 负责 | 能动哪些文件 |
|---|---|---|
| **主管** | 全站 UI / 交互 / 内容标准：桌面外壳、任务栏、窗口框架、主题令牌、路由、部署、验证脚本 | 除右边那两处以外的**全部** |
| **wiki 负责人** | 只管「饥荒 Wiki」窗口的**内容与呈现** | `src/components/program/DstWikiWindow.tsx`、`DstWikiContent.tsx`、`src/data/dst/**`、`src/lib/dst/**`、`tools/verify-dst.mjs`、`docs/**` |
| ~~图标设计负责人~~（2026-10-05 开工，**2026-10-06 解职**） | 图标美术**已收归主管**；他原来的任务书 `design/ICON-BRIEF.md` 只作历史参考，**别再按它派活** | 现由主管改：`src/components/icons/**`、`design/**`、彩色 App 图标 `design/icons-app/**` + `src/lib/appIcons.ts` |

⚠️ **原「图标设计负责人」已解职（2026-10-06），图标职责收归主管** —— 接线照旧：
`AppIcon.tsx` 只查 `ICON_SET` 表，换美术**不需要动外壳、任务栏、窗口**；
`ICON_SET` 的键名不许改（两个验证脚本都靠 `button[aria-label=…]` 找按钮）。
⚠️ 站标 `public/logo.svg`（焦糖布丁）**站主明确要求不动**，别被"全套新图标"顺手换掉。

**执行者编制与分组规则见 `TEAM.md`**（站主 2026-10-06 定规：子智能体 ≤ **20** 个、按 **A~E** 组分类、
**优先复用**旧执行者而不是新开；派活时要写明组别）。

**插件工程师**（2026-10-05 上岗）做的是 **DSH 插件**：`dsh-celery-farm`「芹菜耕地」面板
（侧栏图标 + 主区嵌桌面站）与 `dsh-product-assistant`「产品助理」面板（事件 → 追问 → 一键推断三件事）。
他的任务书与**交流渠道**是根目录的 **`PLUGIN-BRIEF.md`**（评审意见 / 验收清单 / 交接记录表都在里面）。
他的地盘只有 `~/.dsh/profiles/desktop/node_modules/dsh-*` 与 profile 的 `cordis.patch.yml` 里那几行 ——
**不碰本仓库**；需要网站侧配合（例如"从桌面站点一下切到某面板"）写进那份文档，由主管改。
两个插件当前状态（2026-10-05 实测）：已装、`enabled: true`、`fiberPhase: active`、零依赖零构建。

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
  （踩过一次，见 `docs/dst-wiki.md` 的「踩过的坑」）。另外角标要能加出「全部」：
  没打 daily / project / wiki 标签的文章会落到 `other`，左栏得把它列出来（主管补过这一档）
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
   ⚠️ **已经用户批准的两个例外**：
   ① 为了让教程能"以博客文章（wiki 标签）呈现"，wiki 负责人改过三个共享文件 ——
   `src/lib/github.ts`（`CATEGORIES` 加 `wiki` + `isWikiGuide()`）、`BlogWindow.tsx`（教程分流）、
   `WriteWindow.tsx`（Draft 类型 + 分类按钮）；
   ② 主管给这个窗口加了**栏宽分隔条**（用户点名要的）：`DstWikiContent.tsx` 里只加了
   `useColumnRails(WIKI_RAILS)`、两处 `ref={rails.gridRef}`、`data-view="guide"` 与内容列里的
   `<div className="width-handles">`，**没动任何条目 / 搜索 / 配方逻辑**；
   `globals.css` 的 `.wiki__*` 里把网格列改成 CSS 变量，并**补掉教程区那条 176px 空轨道**。
   这类跨边界改动以后仍然要先说明。
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
npm run verify:tarot # 塔罗牌专属校验：牌表 + 78 张牌图 + 抽牌逻辑 + 窗口流程（需要 dev 已在跑）
npm run tarot:assets # 塔罗素材流水线：源图 → public/tarot/cards/（要 python + Pillow，见 docs/tarot.md 第九节）
npm run typecheck    # 只做类型检查
```

## 目录与文件边界

| 路径 | 职责 |
|---|---|
| `src/components/desktop/` | 桌面外壳：`DesktopShell`（布局+让位+多窗口+路由对齐）、`Window`（窗口框：**一行** = 标签 + 窗口按钮）、`FrameTabs`（框里的标签行 / 拖拽排序 / 拖出拆帧）、`Dock`（任务栏）、`DockPositionMenu`、`StartMenu`、`AppIcon`（**只查表**：把 `IconName` 翻成图标组件）、`FullscreenButton`（全屏按钮）、`CelestialClock`（日月时钟挂件） |
| `src/components/icons/` | **全站图标美术**（换图标只改这里）：`base.ts`（统一几何：24 网格 / 线宽 1.6 / currentColor）、一个图标一个文件、`index.ts` 的 `ICON_SET` 登记表、`glyphs/`（外壳字形：所有项目 / 全屏 / 最大化 / 任务栏位置）。**归主管**（原图标设计负责人已于 2026-10-06 解职，见 `TEAM.md`） |
| `src/components/program/` | **窗口内容一律放这里**（`AboutWindow`、`SettingsWindow`、`DshWindow`＝DSH 就地内嵌窗口、`AppPlaceholder`、`WidthHandle`＝正文列宽拖动条），以及 **`views.tsx`＝「窗口 id → 装什么」的登记表** |
| `src/hooks/` | `useAppearance`（主题+壁纸）、`useDock`（任务栏）、`useWindows`（窗口状态与几何记忆）、`useFullscreen`（浏览器级全屏）、`useArticleWidth`（正文列宽）、`useColumnRails`（内容列两侧栏的宽度，博客首页与 Wiki 共用） |
| `src/lib/` | `apps`（窗口登记表 + `visibleApps()` + `matchWindowRoute()` / `pathOf()`，含每窗口的 `veggie` 菜名与 `localOnly`）、`celestial`（日月弧线 / 颜色档位 / 月相）、`columnRails`（`RailSpec` 配置 + 栏宽几何与钳制）、`columnWidth`（列宽存取与钳制）、`dsh`（DSH 地址存取与守卫，`desktop.dshUrl`）、`dock`（任务栏几何）、`readingWidth`（正文列宽几何与让位规则）、`snap`（吸附/平铺的分区几何与预览矩形）、`theme`（主题与壁纸清单）、`windowManager`（纯 reducer）、`windowStore`（几何 + 会话记忆持久化）、`veggies`（48 张菜图的登记表与查表：`veggieOfName()` / `dishRows()`） |
| `src/styles/tokens.css` | **macOS 浅 / 深两套**主题的**全部**色值与尺寸变量（含交通灯、标题栏高度、字体栈） |
| `src/styles/globals.css` | 全局基础样式 + 自定义类（见下方"坑 1"） |
| `src/data/` | 站点文案与项目列表（`site.ts`、`projects.ts`）；`dst/` 是饥荒 Wiki 的数据，**归 wiki 负责人** |
| `src/lib/github.ts` | 博客数据源与写入：Issues 读/写 + 图片上传（img 分支）+ 各自缓存与限流回退 |
| `public/` | 原样拷进构建产物的静态文件：站标 `logo.svg`（矢量源，标签页图标 + 站内品牌）+ `logo.png`（512 位图，iOS 主屏图标）。**站内引用一律走 `SITE.logo`**（它拼了 `BASE_URL`）；别在组件里写死 `/logo.svg`——`src` 里的字符串 Vite 不会改写 base，子路径部署会 404 |
| `tools/` | `verify.mjs`（全站冒烟验证）、`verify-dst.mjs`（饥荒 Wiki 专属校验，归 wiki 负责人）、`verify-tarot.mjs`（塔罗牌专属校验）、`pages-postbuild.mjs`（404 兜底）、`make-logo.mjs`（把 `logo.svg` 渲染成 PNG）、`term-server.mjs`（本机终端服务，只监听 127.0.0.1）。⚠️ **唯一一个非 Node 的**：`tarot-assets.py`（塔罗素材流水线，`npm run tarot:assets`）—— Node 内置模块编不出 WebP 而不能引依赖，所以借 Pillow；**只在换素材时用，不进构建**，要求 `python` 在 PATH 上且有 Pillow（见 `docs/tarot.md` 第九节） |
| `docs/` | `dst-wiki.md`（饥荒 Wiki 的实现说明：数据模型 / 打分规则 / chunk 拆分 / 踩坑）、`dst-guides/`（3 篇新手教程稿件 + 发布脚本 + 说明），**归 wiki 负责人** |
| `design/` | 设计稿与任务书：`ICON-BRIEF.md`（给「UI 平面设计」那个对话的自包含任务书）、`icons/*.svg`、`preview.html`、`veggies/*.svg`（48 张菜图）、`veggies.html`、两个 `build-*.mjs`（生成预览页）。**除了 `veggies/*.svg`（被 `lib/veggies.ts` 引用）与 `icons-app/*.svg`（被 `lib/appIcons.ts` 引用）进构建、且都不内联以外，其余不参与构建**，归主管 |

## 窗口契约：加一个新窗口要动 4 个地方

1. `src/lib/apps.ts` 登记一行：`id / name / path / source / icon`，需要更大窗口再加 `defaultSize`
2. `src/components/program/<名字>Window.tsx` 写内容
3. `src/components/program/views.tsx` 的 `VIEWS` 表里挂上（不挂就自动走 `AppPlaceholder`）
4. 数据源写进 `apps.ts` 的 `source` —— 它是「窗口名 → 路由 → 数据源」的唯一登记处

要带子页面（像 `/blog/:id`）：给 `VIEWS` 的那个工厂函数用 `param`（窗口状态里带着它），
**别用 `useParams`** —— 路由只代表当前聚焦的那个窗口，别的窗口的页面参数路由里没有。

## 正文列宽拖动条 / 滚动条（复刻 DSH 会话页）

文章正文两侧的白色拖动条、全局自定义滚动条、博客首页与 Wiki 两侧的分栏拖动条 ——
**实现细节、几何数值与踩坑见 `ARCH-WINDOW.md`**（那一节原文已整段搬过去）。
要点：拖动中只改 CSS 变量（**不进 React 状态**）、居中不能用裸 `center`（见坑 5）、双击复位。

## 主题令牌（硬规则）

组件**只读 CSS 变量**，可用类名：

```
bg-chrome / text-chrome-ink      任务栏底色与前景
bg-surface / bg-surface-2        窗口、卡片
border-edge                      所有边框
text-ink / text-dim              正文 / 次要文字
bg-accent / text-accent-ink      强调（当前项、主按钮）
bg-hover                         悬停底色（**给任务栏那种深色面用**）
bg-[var(--c-control-hover)]      浅面上小按钮（含标签上那个小 ×）悬停时的淡底色
bg-[var(--c-danger)]             ⚠️ **关闭键已经不用它了**（macOS 交通灯自带红黄绿）。令牌仍然有值，
                                 留给以后的破坏性操作（删除确认之类）；别拿它去做普通关闭键的悬停底
--traffic-size/-gap/-inset       交通灯：**14px** 圆点 / **9px** 间距 / 距标题栏左边 8px
--traffic-glyph(-size)           交通灯字形色与字号（平时 opacity:0；hover 到那一簇才显，**11px、0.85**）
--c-traffic-close/min/max        交通灯三色（红 / 黄 / 绿；取自 playground-macos 用的 Tailwind 500 档）
--titlebar-h                     标题栏高度 = 24px（macOS 值，标签行跟着压到 18px）
--shadow-window                  窗口投影（macOS 的 shadow-lg + black/30）
--focus-ring                     焦点环（macOS primary 的 3px 半透明外环）
--font-sans                      字体栈：-apple-system → Inter → Helvetica → 系统中文黑体
                                 ⚠️ **不许把字体文件打进仓库**（SF Pro / Avenir 都是红线，见 MACOS-BRIEF 第 5 节）
rounded-window / rounded-dock    圆角
logo-mark                        站标：读 --logo-shadow，给透明底图形托一层轻投影
变宽拖动条 / 滚动条滑块           读 --c-scroll-thumb（滑块）、--c-scroll-thumb-hover（悬停与拖动条）
日月时钟                         读 --c-celestial-{night,dawn,noon,dusk}（四档主色）
                                 + --c-celestial-moon / --c-celestial-moon-shade（月亮亮面/暗面）
```

**禁止写死颜色**（`#fff`、`rgb(...)`、`bg-white` 这类字面量一律不许出现在组件里）。
要加主题就在 `tokens.css` 里加一组变量块 —— 组件一行都不用改。
站标的投影同理：**两套主题**各有一个 `--logo-shadow`，加主题时别忘了补上它。
滚动条那两个同理：**加新主题时必须一起补 `--c-scroll-thumb` / `--c-scroll-thumb-hover`**，
不然滚动条滑块会变成透明（读不到变量）。

⚠️ **主题现在是 macOS 浅 / 深两套**（2026-10-06「一切以 macOS 为准」，规格见 **`MACOS-BRIEF.md` 第 2 节**，
数值来源是 `PuruVJ/macos-web` 与 `Renovamen/playground-macos` 两个 **MIT** 项目的源码正文 ——
**只取了数值，没有抄代码**，所以不需要在仓库里附它们的 LICENSE；真要抄代码就必须在这里记明出处与 license）：
- 浅：`hsl(240,24%,100%)` 面 + 灰阶 + 强调蓝 `hsl(211,100%,50%)`；深：`hsl(240,3%,11%)` 面 + 强调蓝 `#0a85ff`
- 圆角 8px（最大化 0）、描边 `1px rgba(107,114,128,.3)`、投影 = macOS 的 `shadow-lg + black/30`
- **`data-theme` 的正名就是 `light` / `dark`**（2026-10-06 改完的）：`ThemeId` 在 `src/types/desktop.ts`。
  老存档（`caramel` / `linen` / `night`）由 `lib/theme.ts` 的 **`normalizeTheme()`** 迁移
  （caramel / linen → light，night → dark），`tokens.css` 里也留着老键名的**别名选择器**兜底 ——
  **这两处都不许删**（删了老用户会掉回默认浅色）。
- ⚠️ 暖色（焦糖 / 亚麻那套）是"菜地"的身份色，按总原则**让位**给 macOS 冷灰；
  菜地的名字与 48 张菜图**留在代码里备着**（`SITE.name` / `AppDef.veggie` / `lib/veggies.ts` 一个字没删）

## localStorage 键

| 键 | 内容 |
|---|---|
| `desktop.theme` | **两套**：`light`（macOS 浅色，**默认**）\| `dark`（macOS 深色）。⚠️ 老存档里的 `caramel` / `linen` / `night` 由 `normalizeTheme()` 迁移（前两个 → light、night → dark），`tokens.css` 的别名选择器也还兜着 |
| `desktop.wallpaper` | `gradient` \| `grid` \| `noise` \| `stripe` \| `image` |
| `desktop.wallpaperFit` | `cover` \| `contain` \| `repeat`（仅图片） |
| `desktop.wallpaperDim` | `0` \| `0.15` \| `0.3` \| `0.45` |
| `desktop.dock` | `{ position, length, thickness, iconSize, dockApps, mode }`；`mode` = `wheel`（**图标区 + 回弹**，**默认**，读不到就是它）\| `wrap`（旧的折行）；`dockApps` 的**顺序就是显示顺序**（图标区里拖拽换位会写回这里）。设置里那个按钮的 `aria-label` 是「任务栏图标区：回弹」（2026-10-06 从"循环轮盘"改的名，`SettingsWindow.tsx` 与 `verify.mjs` 同步改过） |
| `desktop.windows` | 窗口几何记忆；**关闭窗口不清除**，下次打开回到原处 |
| `desktop.openWindows` | **会话记忆**：刷新前开着哪些框（`{ frames: [{ tabs: [{id, param?}], active, x, y, w, h, maximized }] }`，顺序 = 框的 z 序）。启动时照着开回来（合并过的框仍是一框多标签）；坏数据/已下线的应用会被丢掉 |
| `desktop.blog` | 博客列表缓存 `{ posts, fetchedAt }`，TTL 10 分钟（GitHub 未认证限流 60 次/小时） |
| `desktop.ghToken` | **博客创作窗口用的 GitHub PAT**。只存本机浏览器，绝不进仓库/代码；同源脚本可读，别在公共电脑上填 |
| `desktop.imgTree` | img 分支图片清单缓存，TTL 10 分钟（浏览图库不需要 Token） |
| `desktop.draft` | 编辑中的草稿（自动保存，发布/取消后清除），防止误关窗口丢内容 |
| `desktop.termPort` | 终端服务端口，默认 5180 |
| `desktop.termToken` | **终端服务的 token**（`npm run term` 启动时打印）。只存本机浏览器；有了它才能在网页里跑本机命令 |
| `desktop.articleWidth` | 文章正文列宽（px）。拖过正文两侧的拖动条才有；**双击拖动条 = 删掉这个键**，回到 88ch 自适应 |
| `desktop.blogNavWidth` / `desktop.blogAsideWidth` | 博客首页左栏（分类）/ 右栏的宽度（px）。拖过分隔条才有；**双击分隔条 = 删掉对应那个键**，回到该断点的默认宽度 |
| `desktop.wikiNavWidth` / `desktop.wikiAsideWidth` | 饥荒 Wiki 窗口左栏（分类）/ 速览栏的宽度（px），规则同上 |
| `desktop.dshUrl` | DSH 快捷入口指向的地址（`lib/dsh.ts`）。**默认跟着页面的主机名走**：页面是 `127.0.0.1` 就默认 `http://127.0.0.1:3080`，是 `localhost` 就默认 `http://localhost:3080`（DSH 的登录 Cookie 是 SameSite=Strict，主机名不一致就带不过去）。只在窗口里改过才写；**复位 = 删掉这个键** |
| `desktop.tarot` | 塔罗牌窗口的占卜记录：`{ history: [{ at, seed, spreadId, question, cards: [{ id, reversed }] }] }`，最多 30 条、最近的在最前。**只存牌 id 不存图片**；回顾时按存的牌 id 重建，`seed` 留着是为了"能精确复现当时的随机"（`lib/tarot/history.ts` 的 guard 逐条校验，坏数据回空列表） |

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
> **站主已决定（2026-10-05）**：PAT 只留在会话记录与本机浏览器（desktop.ghToken），按「测试阶段、暂不处理安全」办 —— **agent 不必再提醒、也不要当成待办事项**。
> **唯一硬线（每次交付前守一遍）**：**PAT 绝不许进仓库** —— 不写任何文件（含 .env／文档／注释）、不 git add、不进提交信息、不写 git config。自查一行：git log -p origin/main..HEAD | Select-String github_pat_（应无输出）。
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

## 验证（怎么跑）

- 手动：`npm run dev` → http://localhost:5173
- 自动：`npm run verify`（复用 DSH 的 Playwright + 系统 Edge，**不把 playwright 装进本项目**；换位置设 `PLAYWRIGHT_PKG`）
- 饥荒 Wiki 专属：`npm run verify:dst`（21 项，归 wiki 负责人）
- ⚠️ **地址要显式给它，而且两个都试一下**：`npm run verify -- http://localhost:5173`。
  本机实测过两种情形 —— 有时只有 `127.0.0.1` 通、有时只有 `localhost` 通（dev server 只绑一个）。
- 改完**至少**跑 `npm run build`；涉及交互再跑 `npm run verify`。**当前 `verify.mjs` 共 151 项。**
- ⚠️ 上面这个项数**会随断言增删过期**，别当圣旨：跑完看结尾那行 `N/N 通过` 最准，
  只想快速核一遍就 `Select-String -Path tools/verify.mjs -Pattern '^\s*check\('` 数一下（改了断言顺手更新这里）。
- ⚠️ **换皮 / 重构时那些断言是"改写"不是"删掉"** —— 每条改写都要写清"原断言 → 新断言 + 为什么"。
- ⚠️ 博客那几条会**随机红**（GitHub 文章数读到 0 的瞬时抖动）：重跑一次再判，别当自己的锅。
- ⚠️ **dev server 一改文件就没了的真凶**：Vite 的 watcher 会去 watch 原子写留下的临时目录
  （`.X.tsx.<pid>.<guid>.tmpdir/X.tsx.tmp`），一被锁住 / 删掉就抛 `EBUSY` 并**直接结束进程**。
  `vite.config.ts` 里已忽略 `**/.*.tmpdir/**` 与 `**/*.tmp`，**别再删掉那两条**。
- ⚠️ 改完先确认 dev server 真在服**新模块**（touch 改过的文件或重启）再跑，别拿旧转译结果当绿。

**各批断言分别钉的是哪个 bug**（逐条清单，含原断言 → 新断言的对应关系）：**见 `ARCH-VERIFY.md`**。

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
