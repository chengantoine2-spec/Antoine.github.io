# 窗口框 / 多窗口 / 标签 / 合并 / 吸附 / 正文列宽（施工沿革）

> 从 `AGENTS.md` **搬出来**的长篇明细（2026-10-06：AGENTS.md 已超过工作区指令预算 64 KB，
> 尾部会被截断，下一个 agent 根本读不到）。**规则本身仍以 `AGENTS.md` 为准**，
> 这里放的是逐条沿革、实测数字与踩过的坑 —— 动手前读一遍能少踩雷。**信息一条没删。**

- 窗口那**一行**里是：**macOS 交通灯在最左（红黄绿三个圆点，字形平时隐藏、hover 才显）+ 标签行居中**
  （**整扇窗只有一行**）。右侧那套 `– □ ×` 已经在 2026-10-06「其他照 macOS 全改」时撤掉，别再往回加

- **桌面能同时开好几个窗口**（2026-10-05，用户要求"可叠加、像浏览器一样用标签栏切换"）：
  - 窗口列表（`useWindows` 的 `windows[]` + z 序）是唯一事实来源；**路由只表示当前聚焦的那个窗口**
    （`/blog` 打开并聚焦博客窗口、`/blog/17` 还会把它的子页面切到第 17 篇）。深链、刷新、前进后退照旧
  - 窗口内容从 `components/program/views.tsx` 的登记表拿（**不再靠 `<Outlet />`** ——
    一个 Outlet 装不下多窗口）；`router.tsx` 里的子路由是空壳，只负责"让路径匹配得到"
  - **一个窗口框（frame）装 1~N 个标签**（用户："窗口要可以合并，而不是单独显示，标签栏应该做在
    窗口的边框里面"）：`WindowState { key, tabs: [{id, param}], active, x/y/w/h/z, ... }`，
    reducer 有 `activate` / `closeTab`（关掉最后一个 = 关掉这个框）/ `merge` / `detach` / `reorder` / `hydrate`
  - **标签行与窗口按钮同一行**（用户 2026-10-05：「图一只有一行，为什么我们的有两行」
    → 改成浏览器那样的一行到底）：`components/desktop/FrameTabs.tsx` 就画在 `<header>`
    这一行里，右边紧挨着 `[data-window-controls]`（那三个按钮）。⚠️ 因此
    **别再按 `header button` 去数标题栏按钮**（标签的按钮也在里面了），要用 `[data-window-controls] button`；
    验证里那条检查也叫「整扇窗只有一行」并断言"**交通灯贴左、标签行与它同排**"
  - **交通灯（macOS，2026-10-06「其他照 macOS 全改」）**：左起 **红（关闭）→ 黄（最小化）→ 绿（最大化 / 还原）**，
    12px 圆点、间距 8px、距标题栏左边 8px；**字形平时隐藏、hover 到这一簇才显**（9px）。
    样式在 `globals.css` 的 `.traffic-lights` / `.traffic*`，尺寸与颜色全走令牌
    （`--traffic-size/-gap/-inset/-glyph`、`--c-traffic-close/min/max`）。
    ⚠️ **撤掉的旧做法，别往回加**：右侧的 `– □ ×`（连同 `MaximizeGlyph` 的引用）、
    关闭键的**红底** `hover:bg-[var(--c-danger)]`、以及"悬停显按钮形状"那套 `--c-control-hover`。
    `--c-danger` / `--c-danger-fg` **令牌仍然留着并有值**（给以后的破坏性操作，比如删除确认用），
    只是关闭键不再用它。标签上那个小 × 也跟着改成**中性淡底**（红色只属于交通灯里的关闭圆点）。
    ⚠️ **要抓标题栏拖动就抓右端的空白占位区**，别抓中点：标签行是居中的，正中间压着一个标签，
    拖它会变成"拖标签换顺序"（`verify.mjs` 那条"窗口位置被记住"就是这么踩到并改过来的）
  - ⚠️ **标题栏高度 = `--titlebar-h` = 24px**（macOS 值），所以标签压到 18px / 字号 11px。
    标签行靠 `justify-content: safe center`（`.frame-tabs`）**装得下居中、装不下退化成 start** ——
    别写裸 `center`（溢出时左边那半截滚不到，见坑 5）。
    右端有一颗**等宽占位**（宽 = 交通灯那一簇），这是让标签行**真正居中**用的，别删。
    ⚠️ DSH 内嵌那条断言量的 `topOffset` 因此从 36 变成 **24**
  - ⚠️ **`--c-hover` 是给任务栏那种深色面设计的浅色叠加**，放到浅色标签 / 标题行上几乎看不见 ——
    浅面上的小按钮悬停底用 `--c-control-hover`，别再退回 `bg-hover`
  - 手势：**拖标签左右 = 换顺序**（位移超 4px 才算拖动）、**竖直拖出框外 24px = 拆成独立窗口**、
    **拖标签右边的空白 = 移动窗口**、**拖一扇窗到另一扇上 = 合并**（目标框描一圈 `data-merge-target`，
    拖动的那个显示 `data-merge-drop`）。合并与吸附互斥：先判"落在别的框上"，没有再判边缘吸附
  - ⚠️ **标签按钮上绝不能在 pointerdown 就 `setPointerCapture`**（"合并之后标签点不动、
    切不回原来那个窗口"的元凶）：捕获之后浏览器把 `click` 派给被捕获的元素，里层按钮的 `onClick`
    永远不触发。要等位移超过阈值、确定是拖动了再抓（同「坑 2」）
  - ⚠️ **引擎盖下两条**：① `onMergeIn` 的参数是**目标框**、发起方是 `win.key` —— 写反就变成
    "并进自己"，reducer 一看 `fromKey === intoKey` 直接 no-op（表现："怎么拖都不合并"）；
    ② **新窗口按已开框数层叠错开 32/28**（`centerSpot` 第三个参数）—— 全都正居中时后开的大窗会把
    先开的小窗整个盖住，下面那扇的标题栏和标签全点不到（用户报的"点不到之前的窗口"有一半是这个）。
    被盖住时点任务栏图标把它抬到最上面是兜底入口
  - **桌面顶部那条全局悬浮标签栏已删除**（`WindowTabs.tsx` / `hooks/useTabs.tsx` / `lib/tabs.ts` /
    设置里那一栏都没了）：标签只活在各自的窗口框里
  - 会话记忆 `desktop.openWindows` 存「框 + 标签 + 几何」：`{ frames: [{ tabs, active, x, y, w, h, maximized }] }`，
    读到旧格式（一维数组）按"一框一标签"处理
  - **最小化 = `display:none`，不卸载窗口**：滚动位置、加载好的数据都留着，点任务栏 / 标签就回来
  - 关掉当前聚焦的窗口 → 焦点交给剩下最上面那个（URL 跟着走）；一个不剩就回桌面 `/`
  - 刷新后恢复上次开着的窗口（`desktop.openWindows`，顺序 = 标签栏顺序）
  - ⚠️ 详情页（`BlogDetailWindow` / `ProjectDetailWindow`）的参数**从 props 来**（`param`），
    不再用 `useParams` —— 一个窗口可以停在任意一页，而路由只代表当前窗口
  - ⚠️ 多窗口后，验证脚本里**全局选择器会串窗口**：`.width-handle[data-side="left"]` 同时命中
    博客文章页与 Wiki 的两条（一次选中 4 个，Playwright 直接报 strict mode violation）。
    `verify.mjs` 里备了 `closeAllWindows()`（程序化点关闭，不受遮挡影响），
    进入"只看某一个窗口"的小节前先清场

- **窗口吸附 / 平铺**（`lib/snap.ts` + `Window.tsx`，2026-10-05 用户要的"拖到屏幕边缘对半分屏"）：
  - 拖动标题行（标签右边的空白）时，指针离**屏幕**边缘 ≤22px（`SNAP_EDGE`）就命中吸附区，
    **拖动过程中给预览**（`[data-snap-preview="left"]` 那块半透明面板 + 文字说明），**松手才落位**
  - ⚠️ **基准是整个视口（`window.innerWidth/innerHeight`），不是 `.desktop__layer`**：
    层已经被任务栏让过位（实测层高 730 / 视口 800），拿它算的话"拖到底边"只能贴到**任务栏上沿** ——
    用户 2026-10-05 报的就是这个「吸附不到最底边，而是吸附到工具栏上面」。
    窗口的 left/top 是相对层的，所以算完要**减掉层的偏移**再落位
  - 分档：左/右 = 对半（通到底）、四角 = 四分之一、下边 = 下半屏（**贴到屏幕最底边**）、
    上边 = **铺满整个屏幕**（连任务栏那一带一起盖，和 □ 最大化一致）
  - 预览与落位用**同一个矩形**（`snap` action 直接收外壳算好的 rect），所以"看到哪就贴到哪"
  - 吸附时记下 `restore`（吸附前的矩形）；**拖动才解吸附**（只按一下不解 —— 否则双击解吸附会被
    第一次 pointerdown 提前吃掉，实测踩过），解吸附时按指针在标题栏上的相对位置把窗口摆回指针下，
    手感是"从指针那儿弹出来"；双击标题栏也能解吸附
  - 手动改大小（右下角拖）会清掉吸附状态
  - ⚠️ 拖动逻辑里"第一次移动只解吸附、不移动"这一帧是故意的：几何基准刚换，同一帧再算位移会跳

- **DSH 工具条再加两条**（2026-10-05 用户要的）：**50% 透明度**（`opacity-50 hover:opacity-100`，
  浮在 DSH 上不压内容、鼠标上去就看清）+ **点一下上边界就固定住**（`data-dsh-pinned`，
  再点取消；固定时永不自动收起）。热区 z 比工具条高（40 > 30），所以固定着也点得到。
  收起改成"延迟 180ms"（`wake` / `sleep`）：指针在热区与工具条之间移动时两个元素的 enter/leave
  会先后触发，立刻收会闪一下

- **浏览器级全屏**（连浏览器自己的窗口一起盖住，和"窗口最大化"不是一回事）**不在标题栏**，
  而是两处：任务栏右边固定的 ⛶、设置窗口里的「进入全屏」。两处共用
  `hooks/useFullscreen.ts` 与 `components/desktop/FullscreenButton.tsx`。
  状态听 `fullscreenchange`，所以按 Esc / F11 退出也能同步；进全屏时会顺手最大化当前窗口。
  ⚠️ 取舍：全屏后窗口盖住任务栏，那个 ⛶ 自己就点不到了 —— 退出靠 Esc / F11。
  想让"全屏时任务栏仍可点"，把 useFullscreen 里那一步最大化去掉即可

- **DSH 快捷入口**（`components/program/DshWindow.tsx`，本机专属）：**就地内嵌**，不跳出去。
  - 默认是说明卡（故意不立刻发请求），点「在窗口里打开 DSH」才挂 `iframe`，铺满正文区；
    工具条只占一行：状态 / 地址 / 保存 / 刷新 / 复位 / 独立窗口 / 返回。用户 2026-10-05 明确要求
    「展示在桌面站窗口之中，而不是在桌面站之外」+「控制条放最上面，让中间的主体足够大」
  - `localOnly: true` → 线上不挂载。`visibleApps()` 是唯一出口（任务栏、「所有项目」、路由都用它，
    **别再直接 `APPS.map`**）；线上打开 `/dsh` 会落到 `*` 兜底回桌面
  - **能不能嵌**：实测 DSH 不回 `X-Frame-Options`、也没有 `frame-ancestors` ——
    在 `127.0.0.1:5173` 页面里挂一个 `http://127.0.0.1:3080/` 的 iframe，`load` 事件照常触发、
    控制台没有「Refused to display」，只是内容是那行 401 提示。
    所以线上不能嵌**不是**对面拒绝，而是浏览器自己不让 HTTPS 页加载 `http://127.0.0.1`（混内容 + PNA）
  - ⚠️ **主机名必须一致**：DSH 的登录 Cookie 是 `HttpOnly; SameSite=Strict`
    （`@deepseek-ai/dsh-client-connection` 里写死的），而 `localhost` 与 `127.0.0.1` 在浏览器眼里
    是**两个站点** —— 一边登录、另一边内嵌，Cookie 不带过去，iframe 里只有一行
    `dsh web authentication required`。所以 `lib/dsh.ts` 的默认地址跟着 `location.hostname` 走，
    不一致时窗口里会提示并给一个「改成一致」
  - 首次登录：把 `dsh web` 启动时打印的带 `?token=…` 的地址整段粘到地址框 —— 登录在同一个窗口里完成
  - ⚠️ **内嵌视图的根容器高度是 `h-[calc(100%+2.5rem)]`（配 `-m-5`）**：窗口正文区是 `p-5`，
    只写 `h-full` 会矮 40px —— 表现就是"窗口底下一条白边"（用户报过，实测底缝 41px）
  - ⚠️ **工具条是浮层（`absolute`）+ 自动隐藏**（用户第二次要求："跟框融合、做大一点、
    给个自动隐藏，鼠标移动到上框边界时再显示"）：
    - 默认 `-translate-y-full` 缩在标题栏底下 → iframe 拿满整个正文区（实测 700 高的窗口里 662px）
    - 露出靠三件事：`data-dsh-hot` 那条 12px 热区（`pointerenter`，中间一条 3px 拉手做提示）、
      工具条自身 `pointerenter`、以及面板内 `focus`（键盘 Tab）；隐藏靠 `pointerleave`
      与"焦点跑到面板外"的 `blur`（`relatedTarget` 判断，否则点面板里的按钮会先把它弄没）
    - 底板与标题栏同一套底色 + 只留一条下边线：下来时看着就像标题栏加厚了一层（这就是"融合"）
    - 收起时 `pointer-events-none`，否则它会挡住 DSH 顶上那 49px；热区那 12px 是**故意**留的
      （等于给 DSH 顶部一条 12px 不可点区域），要更小就改 `h-3`
    - 这两条都进了 `verify.mjs`：默认收起的底 ≤ iframe 顶、热区一 hover 就露出来、且正文高度不变
  - 本地探活用 `fetch(url, { mode: 'no-cors' })`：DSH 不发 CORS 头，普通 fetch 一定被拦成 TypeError，
    分不清"没跑"还是"跨域"；no-cors 只要对面回了任何响应（哪怕 401）就算在线。
    ⚠️ iframe 的 `load` 对面是 401 也会触发，**别用 load 假装能判断登录态**（超时只提示"可能没起来"）
  - 地址存 `desktop.dshUrl`（`lib/dsh.ts`），窗口里能改能复位 —— `dsh web` 的 host/port 可改，
    官方桌面端更是用系统分配的端口，**不许写死**

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
   - 文件：`components/program/WidthHandle.tsx`（手柄，两个页面共用）、`hooks/useArticleWidth.ts`（测量与回调）、
     `lib/readingWidth.ts`（几何/钳制/让位规则）、`lib/columnWidth.ts`（存取与钳制，两个页面共用）、
     `globals.css` 的 `.width-handle` / `.width-handles` 与 `[data-rails]`

2. **右侧显示上下位置的那条**（= DSH 的自定义滚动条）：`globals.css` 里一套全局
   `::-webkit-scrollbar` 规则 —— 8px 宽、轨道透明、4px 圆角滑块、悬停变亮，
   颜色取 `--c-scroll-thumb` / `--c-scroll-thumb-hover`；Firefox 走 `@supports not selector(...)`
   退回 `scrollbar-width: thin` + `scrollbar-color`。DSH 就是在 `ui-theme` 里这么写的，照抄。
   ⚠️ 滚动条是浏览器原生绘制的：系统开了「自动隐藏滚动条」时 CSS 不生效，这属正常，
   验证脚本因此只断言样式表里落了这几条规则（不去量最终外观）。

3. **博客首页 + 饥荒 Wiki 窗口两侧的分隔条**（两个窗口共用一套）：打开 `useColumnRails`，
   中栏（内容列）始终 `1fr` 吃满剩余空间，所以拖的是**栏与栏的分界**：
   - `WidthHandle` 用 `scale={-1}`：分界跟着指针走，拖多少变多少（正文列那种 ×2 是对称居中才需要的）；
     `growKey` 指定哪个方向键算变宽（左条 → 右键、右条 → 左键）
   - 拖的是侧栏宽度（左条 → 分类栏、右条 → 速览/统计栏），中栏自己吃掉差额 → 整行永远贴齐，两端不留白
   - 抓取带就是**格子间距**（14px，写进 `.blog__grid` / `.wiki__grid` 的 `--width-handle-offset`），
     那 3px 长条按 `calc((带宽 - 3px) / 2)` 居中，所以两处带宽不同也不用改规则
   - 范围：左栏 132~360、右栏 168~420，且内容列至少留 300；<900 变两列时右条自动收起，
     只剩左条；再窄（<620）两条都没有。**没有那条栏的视图里也不显示**（Wiki 教程区就没左栏）
   - 文件：`hooks/useColumnRails.ts`（钩子）、`lib/columnRails.ts`（`RailSpec` 配置 + 几何/钳制）、
     `components/program/WidthHandle.tsx`（手柄）
   - 📌 **以后新窗口要加这套（三步）**：
     ① `lib/columnRails.ts` 里照 `BLOG_RAILS` 加一份配置（换键名 / CSS 变量名 / 选择器，
     几何数值直接展开 `RAIL_SHAPE`）；
     ② `globals.css` 里把网格列写成 `var(--xxx-nav-width, 默认值)` / `var(--xxx-aside-width, 默认值)`，
     容器加 `--width-handle-offset`（= 格子间距），内容列加 `position: relative`；
     ③ 组件里 `const rails = useColumnRails(XXX_RAILS)`，网格挂 `ref={rails.gridRef}`，
     内容列里放 `<div className="width-handles">` + 两条 `<WidthHandle scale={-1} .../>`。
     **前提是这个窗口真有"内容列 + 两侧栏"**：单列铺满的窗口（项目、关于）别硬加；
     博客创作窗口的"分屏"是分割比例、不是列宽，属于另一种交互，也别硬套

