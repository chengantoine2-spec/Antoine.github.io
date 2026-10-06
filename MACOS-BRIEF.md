# macOS 观感改造 · 调研与对比报告

> 本文是**调研文档**，不含任何第三方源码或素材副本，只写结论与路径引用。
> 数据来源：GitHub REST API（license / star / 最近推送 / 体量）+ jsDelivr 镜像读取的**源码正文**（能读到原文的项已注明）。
> 抓取时间：**2026-10-06**（star / 推送时间是那一刻的读数）。

---

## 0. 总原则（站主 2026-10-06 拍板，一切结论都由它推导）

> **「跟随 macOS 改成回弹，一切以 macOS 为准」**

可执行的四条：

1. **凡"我们自己的做法"与 macOS 不一致 → 一律改成 macOS 的做法**，不留折中方案。
2. 本站原有偏好（Dock 循环、菜地身份等）**只在"不影响 macOS 观感"的前提下**留在代码里当备选；一旦与观感冲突，**以 macOS 为准**。
3. 与本原则直接冲突、**必须改**的已知项（本文第 4 节逐条给结论）：
   **Dock 的"循环" → "有头有尾 + 橡皮筋回弹"**、窗口最小化（genie）、窗口圆角/阴影、交通灯 hover、
   Dock 底板（半透明 + 边框 + 圆角 + 运行指示点）、顶部菜单栏。
4. 硬约束不变：**不复制第三方源码/素材进仓库**（只写路径与结论）；**不用 SF Pro 字体、不用 Apple 原版壁纸/系统图标**；`MACOS-BRIEF.md` 单独提交；**不 push**。

---

## 1. 六个仓库的横向对比

| 仓库 | LICENSE（API 实名，附原文链接） | star | 语言 / 栈 | 最近推送 | 体量 | 能不能直接搬 |
|---|---|---|---|---|---|---|
| [Renovamen/playground-macos](https://github.com/Renovamen/playground-macos) | **MIT** · [LICENSE](https://github.com/Renovamen/playground-macos/blob/main/LICENSE) | 3500 | **TS / React + Vite + UnoCSS + Zustand + framer-motion + react-rnd** | 2024-05-02 | 36 MB | ✅ **能直接抄组件**（UnoCSS 语法≈Tailwind，需少量改写） |
| [PuruVJ/macos-web](https://github.com/PuruVJ/macos-web) | **MIT** · [LICENSE](https://github.com/PuruVJ/macos-web/blob/main/LICENSE) | 2675 | Svelte + Vite + TS | **2026-07-05** | 83 MB | ⚠️ 只能当**视觉/交互规格**（Svelte 要重写）；但它的**设计令牌 CSS 可整段翻译** |
| [DustinBrett/daedalOS](https://github.com/DustinBrett/daedalOS) | **MIT** · [LICENSE](https://github.com/DustinBrett/daedalOS/blob/main/LICENSE) | 13045 | JS / React + TS + **Next.js** | **2026-10-06（今天）** | **406 MB** | ⚠️ 架构参考（Next.js 与本站 Vite 不同构）；**外观是 Win 味，别抄视觉** |
| [lukehorvat/react-osx-dock](https://github.com/lukehorvat/react-osx-dock) | **MIT** · [LICENSE](https://github.com/lukehorvat/react-osx-dock/blob/master/LICENSE) | 186 | TS / React | 2024-06-09 | 1.1 MB | ✅ **放大算法可直接搬**（就 6 个小文件） |
| [blueedgetechno/win11React](https://github.com/blueedgetechno/win11React) | **CC0-1.0**（公共领域） · [LICENSE](https://github.com/blueedgetechno/win11React/blob/master/LICENSE) | 9662 | JS / React + Redux | 2024-08-11 · **已 archived** | 93 MB | ✅ 法律上最宽松（连署名都不用），但**已停维护**、Windows 味 |
| [StarKnightt/macos-web](https://github.com/StarKnightt/macos-web) | **MIT** · [LICENSE](https://github.com/StarKnightt/macos-web/blob/main/LICENSE) | 22 | 纯 HTML 单文件 | 2026-07-28 | 3 MB | ⚠️ 权威性低，当"一个文件怎么搭起来"的读物 |

**版权结论：六个仓库全是 MIT / CC0，没有 GPL/AGPL、没有"无 license"** →
"直接拿来用"**法律上成立**（MIT 需保留版权声明与许可文本；CC0 无义务）。
⚠️ 但 **MIT 只覆盖"仓库作者写的代码"**，**不覆盖仓库里可能夹带的第三方素材**（见第 5 节）。

### 各家"值得读的具体文件"

**① playground-macos（首选施工参考，React + TS + MIT）**
| 看什么 | 路径 |
|---|---|
| 窗口框（交通灯 / 标题栏 / 拖拽 / 缩放 / 最大化 / 最小化动画入口） | `src/components/AppWindow.tsx` |
| Dock 容器（底板 / 间距 / 高度 / 模糊） | `src/components/dock/Dock.tsx` |
| **Dock 放大曲线（核心数）** | `src/components/dock/DockItem.tsx` |
| 菜单栏下拉 / 状态菜单 | `src/components/menus/` |
| Spotlight（全局搜索） | `src/components/Spotlight.tsx` |
| 启动台 | `src/components/Launchpad.tsx` |
| **令牌与快捷类（配色 / 圆角 / 阴影 / 模糊）** | `unocss.config.ts` |
| 窗口与 Dock 的补充 CSS（阴影、tooltip 定位、交通灯 hover） | `src/styles/component.css` |
| 字体声明（⚠️ 见第 5 节红线） | `src/styles/font.css` |

**② macos-web（PuruVJ，视觉规格最正）**
| 看什么 | 路径 |
|---|---|
| **系统配色 / 字体栈 / 灰阶 / 焦点环 / 光标** | `src/css/theme.css` ← 最值钱的一个文件 |
| Dock 与 DockItem（放大动画的**原始出处**，playground-macos 在注释里点名抄的它） | `src/components/Dock/Dock.svelte`、`DockItem.svelte` |
| 顶部菜单栏 | `src/components/TopBar/` |
| 控制中心 / 通知等系统 UI | `src/components/SystemUI/` |
| 桌面（壁纸 / 桌面图标 / 右键菜单） | `src/components/Desktop/` |

**③ daedalOS（架构与工程化参考）**
`components/system/Window/`（窗口管理器）、`components/system/Taskbar/`、`components/system/Menu/`、
`components/system/StartMenu/`、`components/system/Desktop/`、`components/system/Files/`、
`contexts/`（状态怎么分）、`hooks/`、`e2e/` + `playwright.config.ts` + `__tests__/`（**它的验证体系值得抄思路**）。

**④ react-osx-dock（就 6 个文件，全是 Dock 放大）**
`lib/Dock.tsx`（半径/强度/宽度计算）、`lib/DockItemsContainer.tsx`（方向对齐）、
`lib/DockItem.tsx`、`lib/DockOffset.tsx`、`lib/DockBackground.tsx`、`lib/MagnifyDirection.ts`。

**⑤ win11React（窗口交互与动画思路）**
`src/components/taskbar/`、`src/components/start/`、`src/components/menu/`、`src/components/shared/`、
`src/containers/`、`src/reducers/`、`src/index.css`。

**⑥ StarKnightt/macos-web**：整个仓库就是一个 HTML 文件（读它看"最小实现"长什么样）。

---

## 2. 可直接抄的数（规格数据，均来自源码正文）

### 2.1 配色（来源：`PuruVJ/macos-web@main:src/css/theme.css`，MIT）

| 令牌 | 浅色 | 深色 |
|---|---|---|
| 强调色 primary | `hsl(211, 100%, 50%)` | `#0a85ff`（等价 `hsl(210,100%,52%)`） |
| primary 文字对比色 | `hsl(240, 24%, 100%)` | `hsl(210, 92%, 5%)` |
| 窗口/浅面 | `hsl(240, 24%, 100%)`（≈纯白，带一点冷） | `hsl(240, 3%, 11%)`（≈ `#1b1b1d`） |
| 深面 | `hsl(240, 3%, 11%)` | `hsl(240, 24%, 100%)` |
| 焦点环 | `0 0 0 3px hsla(211,100%,50%,0.5)` | 同（用 primary） |
| 灰阶 | `#fafafa #f5f5f5 #eeeeee #e0e0e0 #bdbdbd #9e9e9e #757575 #616161 #424242 #212121` | 同（明暗靠变量互换） |

> 本站落地建议：这三套（caramel / linen / night）里 **night 就是 macOS 深色**；浅色建议直接采用上表
> 「浅面 `hsl(240,24%,100%)` + 灰阶」这一套，别再用现在的暖米色 —— 暖色是"菜地"的身份色，与 macOS 观感冲突（按总原则 2 让位）。

### 2.2 圆角 / 阴影 / 模糊（来源：`playground-macos@main:unocss.config.ts` + `src/styles/component.css` + `AppWindow.tsx`）

| 部件 | 值 | 出处 |
|---|---|---|
| 窗口圆角 | **8px**（`rounded-lg`）；最大化时 `rounded-none` | AppWindow.tsx |
| 窗口描边 | `1px solid rgba(107,114,128,0.3)`（`border border-gray-500/30`） | AppWindow.tsx |
| 窗口投影 | `shadow-lg` + `shadow-black/30` | AppWindow.tsx |
| 标题栏高度 | **24px**（`h-6`），内容区 `calc(100% - 1.5rem)` | AppWindow.tsx / component.css |
| 交通灯尺寸 | **12px**（`size-3`）圆点，间距 8px（`space-x-2`），距左 8px（`pl-2`） | unocss.config.ts（`window-btn`） |
| 交通灯字形 | **平时隐藏、hover 才显示**：`.traffic-lights .icon{display:none}` + `:hover .icon{display:block}`；字号 9~10px | component.css |

> ⚠️ **这两行是"参考项目用多少"，不是本站规格**：站主 2026-10-06 看过之后加码了两条，本站实现已经更大更明显 ——
> 圆点 **14px**、间距 **9px**、字形 **11px**、hover opacity **0.85**、字形色 **0.95（浅）/ 1.0（深）**
> （实测字形压在圆点上的对比度 4.97 / 8.91 / 7.69:1，全过 WCAG 4.5）。本站规格以 `ARCH-WINDOW.md` 与
> `tokens.css` 为准。
| Dock 底板 | `backdrop-blur-2xl`（**40px 模糊**）+ `bg-white/20` + `border 1px rgba(160,160,170,0.4)` + `rounded-xl`（12px） | dock/Dock.tsx |
| Dock 高度 | 图标边长 **+ 15px** | dock/Dock.tsx |
| Dock 内间距 | 图标之间 **8px**、左右内边距 **8px** | dock/Dock.tsx |
| Dock 投影 | `0 0 20px rgba(0,0,0,0.17)` | component.css |
| Dock 运行指示点 | **4px 圆点**（`size-1 rounded-full bg-c-800`），未打开时 `invisible`（**占位不位移**） | dock/DockItem.tsx |
| Dock tooltip | `rounded-md bg-c-300/80 px-3 py-1 text-sm`，位于 `top: calc(-100% - 10px)` | DockItem.tsx / component.css |
| 菜单栏下拉面板 | 顶部偏移 **34px**（`top-8.5`）+ `rounded-lg` + `bg-c-200/90` + `border-gray-500/50` + `shadow-md shadow-black/25`（深色 `/50`） | unocss.config.ts（`menu-box` / `shadow-menu` / `border-menu`） |
| 控制中心面板 | `rounded-xl`（12px）+ `backdrop-blur-2xl` + `bg-c-200/80` + `box-shadow: 0 1px 5px rgba(0,0,0,.3)` | unocss.config.ts（`cc-grid` / `cc-grid-shadow`） |
| Spotlight 面板 | 宽 **660px**（`w-165`）、`top: 25%` 再上移 64px、`rounded-lg` + `backdrop-blur-2xl` + `shadow-2xl shadow-black/40` + `bg-c-100/80` | component.css |
| 窗口最小尺寸 | 200 × 150 | AppWindow.tsx |

### 2.3 字体（⚠️ 这一节含红线）

- **macos-web 的做法（推荐照抄）**：`--system-font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`
  —— 即 **优先用用户系统字体**（Mac 上就是 SF Pro，**由系统提供、不随站点分发**），Web 端兜底用 **Inter**。
  ✅ 这条完全合规：SF Pro 是"调用系统已有字体"，不是打包分发。
- **playground-macos 的做法（❌ 不要照抄）**：它把 **Avenir Next LT Pro** 的 4 个 `.woff` 打进仓库
  （`src/styles/font.css` + `src/styles/fonts/`）。**Avenir 是商业字体**，MIT 只覆盖它的代码，
  **不覆盖字体文件** → 我们不能复制这些 woff。
- **本站建议**（可商用）：字体栈 `-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif`；
  若要 Web 端统一，引入 **Inter**（SIL OFL 1.1，免费商用），字重 400 / 500 / 600，
  字距：标题 `-0.01em`、正文 `0`、窗口标题 `-0.005em`（**这三个字距值是我按 macOS 观感的建议，本轮未从任何仓库核实**）。

### 2.4 Dock 放大：三家参数 vs 本站现状

| | **react-osx-dock** | **playground-macos**（原出处 macos-web） | **本站现状** |
|---|---|---|---|
| 影响半径 | `itemWidth × 3`（40px 图标 → **120px**） | `dockSize × 6`（→ **240px**） | 视口**可见区**内按距离衰减（dMax = 最外那个可见图标） |
| 衰减形状 | **线性**：`s = max(1 − d/R, 0)`，`w = item × (1 + s·mag)` | 折线（7 个控制点）→ 弹簧插值 | `scale = 2 − 1.2·u^1.5`（u 归一化距离） |
| 最大值 | 由 `magnification` 决定（示例里常见 1.2~2） | `dockSize × dockMag` | **2.0×**（正中） |
| 最小值 | **1.0×**（到半径外不再缩） | **1.0×**（`widthOutput` 两端都是 `dockSize`） | **0.8×**（最外侧主动缩小） |
| 生长方式 | 按方向 `alignItems: end/start/center`，**从基线往外长** | 图片 `width` 变化（布局） | `transform: scale` + **贴栏那侧为原点**（凸出 33px，实测） |
| 是否改变邻居位置 | 是（两侧各留 offset，把邻居**推开**、整条 Dock 变宽） | 是（宽度变了，邻居被推） | 否（scale 不影响布局，邻居位置不动） |
| 实现代价 | 每次 mousemove `setState` → React 重渲 | framer-motion MotionValue + rAF（**不重渲**） | ref + rAF 直接改 transform（**不重渲**，最省） |
| 弹簧参数 | 无 | **stiffness 1700 / damping 90**（`useSpring`） | 吸附 `150ms` 缓动 |

**本站该学谁（按总原则推导）**：
- **放大曲线**：学 **playground-macos 的 7 控制点 + 弹簧**（比我们的幂函数更"macOS"，
  它的控制点数值：`[-6S, -6S/(mag·0.65), -6S/(mag·0.85), 0, +…]` → 尺寸 `[S, 0.55·mag·S, 0.75·mag·S, mag·S, …]`）。
  它的**最小值是 1.0×** → 按总原则，我们那个"最外侧缩到 0.8×"**要撤掉**（macOS 的 Dock 不会把边缘图标缩小）。
- **弹性参数**：`stiffness 1700 / damping 90` 是**已验证的仓库数值**，可直接作为我们放大回弹的手感基准。
- **不要学 react-osx-dock 的实现方式**（它自己的 `FIXME` 承认"只在单侧加 offset 是 bad 的、少于 5 个图标就不work"，
  而且每次 mousemove 都 `setState`）；**只借它的"半径 = 3 格"这个量级**。
- **本站比它们强的地方要保住**：我们**不重渲**（ref + rAF）、**凸出栏边**（放宽溢出）、**不改变邻居位置**（少抖动）。

### 2.5 壁纸 / 图标

- **未核实（如实交代）**：我**没有**检查任何仓库的 `public/` 目录内容，因此**无法判定**它们是否打包了 Apple 原版壁纸或系统图标。
  → 施工时**不要从这些仓库取任何图片资源**（第 5 节红线）。
- 可用替代：**自己生成**浅/深两套渐变壁纸（CSS `linear-gradient` / `radial-gradient` 即可，零文件、
  与主题令牌联动最方便）；图标用**本站自己的 ICON_SET**（`src/components/icons/**`，归图标设计负责人）
  或另找 **CC0 / OFL** 图标集。**不要用 Apple 的系统图标**。

---

## 3. "取长补短"结论：每一项学谁、为什么、放弃谁

| 项 | 学谁（理由） | 放弃谁（理由） |
|---|---|---|
| **窗口框** | **playground-macos `AppWindow.tsx`**：数值全、结构清楚、React+TS 可直接搬 | 放弃 **react-rnd 依赖**（本站已有自己的 reducer 窗口管理，引它等于两套几何打架）；放弃 daedalOS 的 Next.js 版本 |
| **Dock 放大** | **playground-macos `DockItem.tsx`**（弹簧 + 7 控制点，且不重渲） | 放弃 react-osx-dock（自认实现有问题 + 每次 mousemove 重渲）；放弃它"最小值 1.0×"以外的部分 |
| **设计令牌（色/圆角/阴影/字体栈）** | **macos-web `theme.css`**：唯一一份"系统级"变量表，且字体栈**合规** | 放弃 playground-macos 的字体方案（**商业字体**，见红线） |
| **菜单栏 / 控制中心 / Spotlight** | **playground-macos**（尺寸与模糊值都在 `unocss.config.ts` 里，可直接抄数） | 放弃自己发明的"时钟挂件 + 工具条"那套外观（按总原则并进菜单栏） |
| **工程化与验证体系** | **daedalOS**（Playwright + Jest + e2e 目录组织方式） | 放弃它的 Next.js 结构与 Windows 外观 |
| **窗口贴边 / 动画思路** | **win11React**（CC0，抄动画不用署名） | 放弃它的 Redux 架构与 Win 视觉 |
| **最小实现参照** | **StarKnightt/macos-web**（一个文件看完整体） | 权威性低，不作为规范来源 |

---

## 4. 按总原则逐条推导：冲突点与整改结论

### 4.1 Dock：**循环 → 有头有尾 + 橡皮筋回弹**（站主点名）

**先说一个必须讲清的事实**：**macOS 的 Dock 本身不滚动**（图标多了会自动**缩小**，不会滚，也不会回弹）。
"橡皮筋回弹"是 **macOS/iOS 滚动视图**的行为（elastic scrolling）。所以严格按"以 macOS 为准"，
Dock 的终态应该是"**装不下就整体缩小、永不滚动**"；站主要的是"**改成回弹**"，那就是把 Dock 当滚动视图做：
**两端有终点 + 越界阻尼 + 松手弹回**（这是 macOS 滚动视图的真实行为，不算折中）。

**要拆掉的东西（都是为"循环"写的）**
1. **两份背靠背列表**（正本 + `aria-hidden` / `tabIndex={-1}` 的副本）→ 只留一份。
2. **`offset` 取模归一化到 `[0, N*step)`** → 改成**被夹在 `[0, maxOffset]`**（两端是硬边界 + 阻尼）。
3. **`dMax` 里"只算可见那一段图标"的那套排他逻辑**（它本来就是为副本共存服务的）。
4. 副本带来的那两条特殊约定：*"只有正本带 aria-label"*、*"副本 aria-hidden"*。

**新增的实现要点**
- `maxOffset = max(0, N*step − viewLength)`（装得下就是 0，直接不可拖）。
- **越界阻尼（建议值）**：苹果滚动视图的经典橡皮筋公式
  `f(x, d, c) = (1 − 1/(x·c/d + 1)) · d`，其中 `x` = 越界拉动距离、`d` = 该方向的尺寸、`c = 0.55`（阻尼常数）。
  → 本站取值建议：`d = 视口长度的 25%`（480px 视口 → 120px），`c = 0.55`；
  效果是**越拉越沉**，永远拉不到 `x + d` 那么远。
  ⚠️ **这个公式与 c=0.55 来自公开通行资料，我本轮没有抓到原始出处页面核实**（本轮我只核实了仓库源码里的数）。
  落地时用实测手感校准：建议先实现后量"拉 100px 实际位移多少"，再决定要不要调 c。
- **松手回弹**：用弹簧而不是固定时长缓动，参数直接用 **playground-macos 已验证的 `stiffness 1700 / damping 90`**
  （同一家、同一个 Dock 场景，风险最低）；越界回弹可以更"弹"一点（如 `stiffness 500 / damping 35`，**未验证，待实测**）。
- **不要**做成"到端点整条 Dock 变宽/变短"（react-osx-dock 那种）——macOS 底板尺寸恒定。

**要改写的验证断言（`tools/verify.mjs` 里 14c/14f/14g 那几组，逐条对应）**

| 现有断言（为循环写） | 改成（为回弹写） |
|---|---|
| 渲染两份列表（`copies === 2`） | **只渲染一份**（应用按钮数 == `dockApps` 条数） |
| 只有正本带 `aria-label`；副本 `aria-hidden` | 删掉这两条（没有副本了） |
| 连拖约 2.5 个 cycle **不到头** | **拖到右端会被夹住**：`offset === maxOffset`（±1px），继续拖**不越界** |
| 偏移归一化回一个 cycle 内（`|tx| ≤ cycle`） | **越界时位移被阻尼**：再拉 100px 实际位移 **< 100px** 且**单调递减增量**（越拉越沉） |
| （无） | **松手后回弹**：300ms 内 `offset` 回到 `[0, maxOffset]` 内的端点值（±1px） |
| （无） | **装得下时不可拖**：`maxOffset === 0` 时拖动后 `offset` 恒为 0（macOS：装得下就不滚） |

### 4.2 其余冲突点（同一原则，逐条给结论）

| 冲突点 | 本站现状 | macOS 的做法 | 结论 |
|---|---|---|---|
| **Dock 图标** | 菜图（48 张 SVG） | 系统/App 的**圆角方形图标**（macOS Big Sur+ 统一为 squircle 图标） | ⚠️ **菜图与 macOS 观感冲突 → 按总原则 2 让位**：Dock 里换回**功能图标**（`src/components/icons/**`，图标设计负责人），菜图只留在"关于窗口 / 开始菜单"这类**不影响桌面观感**的地方 |
| **Dock 底板** | 自有圆角 + 主题令牌底色 | `bg-white/20 + backdrop-blur-2xl + 1px 半透明边框 + 12px 圆角 + 0 0 20px 阴影` | **改成 macOS 数值**（第 2.2 节，全部已验证） |
| **运行指示点** | 自有点（`bg-chrome-ink`/`bg-accent-ink`） | **4px 圆点**，未运行不占位（`invisible`） | **改成 4px + invisible**（已验证） |
| **放大最小值** | 最外侧 **0.8×** | **1.0×**（不缩小） | **撤掉 0.8×**，最小值改回 1.0× |
| **窗口圆角** | 自有（`rounded-window`） | **8px**；最大化 **0px** | 改成 8px / 0px（已验证） |
| **窗口描边 + 阴影** | 自有令牌 | `1px rgba(107,114,128,.3)` + `shadow-lg + black/30` | 照 macOS 值 |
| **标题栏** | 标签行 + `– □ ×` 在**右** | **交通灯在左**（红黄绿，12px，间距 8px）+ **标题居中** | **交通灯移到左边**、标题居中；`– □ ×` 那三个按钮**撤掉**（与 macOS 冲突）；⚠️ 与本站"一框多标签"合并：建议**标签行放在标题下方/标题右侧的紧凑区**，别和交通灯抢左上角 |
| **交通灯 hover** | 悬停变色块（红底删除） | **平时无字形，hover 才显示字形**（9~10px） | 照 macOS（已验证 CSS 写法）；红色删除那套交互**撤掉** |
| **最小化动画** | `display:none` 直接消失 | **genie（精灵）缩进 Dock** | ⚠️ **六个仓库里没有一家实现了 genie**（playground-macos 只是 `opacity 0 + duration 300ms` 淡出）→ 这条**没有可抄的对象，要自研**：建议"向 Dock 图标位置做二次曲线收缩 + 透明度 + 轻微 skew"，先做**简化版**（纯 `transform` + 300ms），不要上 SVG filter 那种重方案 |
| **菜单栏** | 无（右上角有时钟挂件） | 顶部**全局菜单栏**：左=应用名+菜单，右=状态区+时钟，下拉面板 `top 34px / rounded-lg / bg-200/90 / shadow-md+black/25` | **新增**（按总原则 4 必做）；现有**时钟挂件并进菜单栏右侧**；工具条/开始菜单等原生外观让位 |
| **主题** | caramel / linen / night 三套暖色 | 浅+深两套冷灰 + `hsl(211,100%,50%)` 蓝 | **改成 macOS 两套**（第 2.1 节）；暖色主题降级为"备选主题"（不影响默认观感的前提才保留） |

---

## 5. 版权红线（施工前必读）

1. **字体**
   - ❌ **不许**打包 **SF Pro / SF Compact / SF Mono**（只授权 Apple 平台使用与分发）。
   - ❌ **不许**复制 playground-macos 的 `src/styles/fonts/*.woff`（**Avenir Next LT Pro 是商业字体**，
     MIT 只覆盖代码，不覆盖字体）。
   - ✅ 允许：`-apple-system` / `BlinkMacSystemFont` **按名字引用**（让 Mac 用户用系统字体，不分发）；
     ✅ 允许：**Inter**（SIL OFL 1.1）作为跨平台兜底。
2. **壁纸与系统图标**
   - ❌ **不许**使用 Apple 原版壁纸（Big Sur/Sonoma 等）与 Apple 系统图标/应用图标。
   - ⚠️ 我**没有**核实这六个仓库是否夹带 Apple 素材（未检查它们的 `public/`）→
     **一律不从这些仓库取任何图片/字体/SVG 素材**，只取"数值与做法"。
   - ✅ 替代：自己生成渐变壁纸（CSS，零文件）；图标用本站 `src/components/icons/**` 或 CC0/OFL 图标集。
3. **代码**
   - ✅ MIT / CC0 的代码**可以抄**（MIT 需在仓库保留版权声明与 LICENSE 文本；CC0 无义务）。
     对本项目意味着：**若真抄了某段实现，要在 `AGENTS.md` 记一条"这段来自 X（MIT）"**。
   - ❌ 不许整文件照搬 **react-rnd / framer-motion** 这类第三方依赖的实现（要用就装依赖，但本项目**不引新依赖**）。
   - ❌ 不许把第三方源码以"参考副本"名义放进本仓库（本次报告只写路径，不落代码）。
4. **仓库卫生**：本次只提交 `MACOS-BRIEF.md` 一个文件；**不 push**。

---

## 6. 我没能核实的项（不许当成已核实）

1. **橡皮筋公式与 `c = 0.55`**：来自公开通行资料，本轮**未抓到出处页面**核实；建议以实测手感校准。
2. **`d = 视口 25%`、`stiffness 500 / damping 35`、Inter 的三个字距值**：我的**建议值**，未实测、未核实。
3. **Apple 原版交通灯色值**（常见为 `#ff5f57 / #febc2e / #28c840`）：本轮**未从仓库核实**；
   已核实的是 playground-macos 用的是 Tailwind `red-500 / yellow-500 / green-500`（`#ef4444 / #eab308 / #22c55e`）。
4. **六个仓库的 `public/` 里有没有 Apple 素材**：**未检查**（因此给出"一律不取素材"的一刀切结论）。
5. **daedalOS / macos-web / win11React 的窗口与 Dock 实现细节**：只看了**目录结构**，没有读它们的源码正文
   （本轮源码正文只读了 playground-macos 的 Dock/AppWindow/component.css/font.css/unocss.config.ts
   与 react-osx-dock 的 Dock.tsx/DockItemsContainer.tsx、macos-web 的 theme.css）。
6. **playground-macos 的菜单栏下拉 / Spotlight / Launchpad 内部实现**：只看了 CSS 与文件存在性，未读组件源码。
7. **star / 推送时间**：2026-10-06 的 API 读数，会变。
