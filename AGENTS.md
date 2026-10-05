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
- 窗口那**一行**里是：标签们 + `– □ ×` 三个按钮（浏览器那样，**整扇窗只有一行**）
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
    验证里那条检查也叫「整扇窗只有一行」并断言"标签行与窗口按钮同一水平线"
  - **悬停态**：最小化 / 最大化 = 淡按钮形状 `hover:bg-[var(--c-control-hover)]`；
    **关闭键（标题行的 × 和标签上那个小 ×）悬停是红底** `hover:bg-[var(--c-danger)]` +
    `hover:text-[var(--c-danger-fg)]` —— 用户 2026-10-05：「删除键要改成红色背景」（破坏性操作给红底，
    和真桌面一致），同时要求「颜色不用那么深」所以红值是压过的（三套主题各一份，不是纯正红）。
    ⚠️ 非悬停时关闭键仍是淡色（标签上那个还是 60% 不透明度），一排标签不会到处是红点。
    字形尺寸是**原来的 12px**（`–` / `×` 走 `text-xs`，最大化图形用 `MaximizeGlyph` 的默认尺寸）——
    中途先放大到 14px 又被用户改回来了，别自作主张再放大。
    ⚠️ 要调大小就在 `Window.tsx` 传 `className`，**别去改 `components/icons/**`**（那是图标负责人的）
  - ⚠️ **`--c-hover` 是给任务栏那种深色面设计的浅色叠加**，放到浅色标签 / 标题行上几乎看不见 ——
    给浅色面上的小按钮做悬停底，用 `--c-control-hover`（三套主题各一份），别再退回 `bg-hover`
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
- **48 张菜图已经用起来了**（2026-10-05，用户："UI平面设计把图画好了，你来应用"）：
  - 画在 `design/veggies/*.svg`（设计负责人的），登记表在 **`lib/veggies.ts`**：
    `VEGGIES`（48 条：文件名 / 中文名 / 分组）、`veggieOfName()`、`dishRows()`、`otherVeggies()`
  - **对应关系只有一份**：`AppDef.veggie` 存中文菜名 → `veggieOfName()` 查图。
    `dishRows()` 直接按 `visibleApps()` 生成（顺序 = 任务栏顺序），别再手写第二份表
  - 用在哪：**「所有项目」菜单**（每行右侧：菜图 + 菜名）、**关于窗口的「这块地里的菜」**
    （11 张卡片，点一下就把那扇窗开到最上面）+ 折叠区里的另外 37 张（备着以后加窗口）
  - ⚠️ **图片不内联**：`vite.config.ts` 里 `build.assetsInlineLimit` 把 `/design/veggies/` 排除了 ——
    默认会把 48 张折成 data URI 塞进主包（实测首屏 gzip 101 → 111 KB），
    排除后只多 2.6 KB（= 48 个地址字符串），图按需加载
  - ⚠️ 菜图是**身份层**（哪个窗口是哪样菜），功能图标仍然在 `components/icons/` 里 —— 两套别混
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
- **桌面挂件：日月时钟**（右上角，`components/desktop/CelestialClock.tsx`）。天空条里的圆盘
  按正弦弧走（6:00 出、18:00 落；入夜换成同一条弧的月亮），**颜色随时刻变** ——
  组件只算「哪两档 + 前者的权重」，混色交给 CSS 的 `color-mix`，色值在
  `tokens.css` 的 `--c-celestial-{night,dawn,noon,dusk}`；入夜按**日期**显示月相
  （`lib/celestial.ts` 的 `moonPhase`：八相名 + 照亮百分比，形状用「外缘半圆 + 明暗界线椭圆弧」画）。
  ⚠️ 圆盘位置那两个百分比区间（17%~83% / 29%~71%）是照着「44px 圆盘 + 84px 天空条」留的边距，
  改尺寸要一起改，否则日出日落时圆盘会被天空条裁掉一块（`verify.mjs` 有一条专门量这个余量）。
  ⚠️ 挂件 z-5、窗口层 z-10、最大化 z-60：窗口盖住它是**预期**的，和真桌面挂件一样。
  ⚠️ **走时用「对齐整秒的自调度 `setTimeout`」，别改回 `setInterval`**：后台标签页节流、
  Edge 的"睡眠标签页"、电脑睡一觉回来，`setInterval` 会长时间不触发甚至停掉，
  表现就是"时间停在那一刻，点刷新才对"（用户报过一次）。另外挂了
  `visibilitychange` / `focus` / `pageshow` 三个兜底，任何一次唤醒都立刻重新对表。
  HH:MM 是大字、秒是小一号的次要色 —— 让"表在走"一眼可见
- **浏览器级全屏**（连浏览器自己的窗口一起盖住，和"窗口最大化"不是一回事）**不在标题栏**，
  而是两处：任务栏右边固定的 ⛶、设置窗口里的「进入全屏」。两处共用
  `hooks/useFullscreen.ts` 与 `components/desktop/FullscreenButton.tsx`。
  状态听 `fullscreenchange`，所以按 Esc / F11 退出也能同步；进全屏时会顺手最大化当前窗口。
  ⚠️ 取舍：全屏后窗口盖住任务栏，那个 ⛶ 自己就点不到了 —— 退出靠 Esc / F11。
  想让"全屏时任务栏仍可点"，把 useFullscreen 里那一步最大化去掉即可
- **站名「芹菜耕地」+ 每个窗口一样菜**（2026-10-05 改名）：`SITE.name` 一处改，
  窗口标题栏 / 关于窗口 / 博客右栏都跟着变；每样菜写在 `AppDef.veggie`（`lib/apps.ts`），
  只出现在**任务栏的 title 与悬浮提示**、以及「所有项目」里。
  ⚠️ **菜名千万别塞进 `aria-label`**：`verify.mjs` 与 `verify-dst.mjs` 都按
  `button[aria-label="博客"]` 这类选择器点任务栏按钮，label 一旦变成"博客 · 玉米"，
  两个脚本立刻一起炸（改的时候踩过，当场回滚成"无障碍名 = 窗口名"）
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
| **图标设计负责人**（2026-10-05 开工） | 只管**图标美术**：11 个应用图标 + 4 个外壳字形 | `src/components/icons/**`、`design/**` |

**图标设计负责人**的任务书是 **`design/ICON-BRIEF.md`**（自包含，直接丢给新对话即可）。
接线已经做完：`AppIcon.tsx` 现在只查 `ICON_SET` 表，画全在 `src/components/icons/` 里 ——
换美术**不需要动外壳、任务栏、窗口**。他的硬约束（不许写死颜色、不许改 `aria-label`、
不许引依赖、不许改验证脚本、`ICON_SET` 的 11 个键不许改名）都写在任务书里。
⚠️ 站标 `public/logo.svg`（焦糖布丁）**站主明确要求不动**，别被"全套新图标"顺手换掉。

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
npm run typecheck    # 只做类型检查
```

## 目录与文件边界

| 路径 | 职责 |
|---|---|
| `src/components/desktop/` | 桌面外壳：`DesktopShell`（布局+让位+多窗口+路由对齐）、`Window`（窗口框：**一行** = 标签 + 窗口按钮）、`FrameTabs`（框里的标签行 / 拖拽排序 / 拖出拆帧）、`Dock`（任务栏）、`DockPositionMenu`、`StartMenu`、`AppIcon`（**只查表**：把 `IconName` 翻成图标组件）、`FullscreenButton`（全屏按钮）、`CelestialClock`（日月时钟挂件） |
| `src/components/icons/` | **全站图标美术**（换图标只改这里）：`base.ts`（统一几何：24 网格 / 线宽 1.6 / currentColor）、一个图标一个文件、`index.ts` 的 `ICON_SET` 登记表、`glyphs/`（外壳字形：所有项目 / 全屏 / 最大化 / 任务栏位置）。**归图标设计负责人** |
| `src/components/program/` | **窗口内容一律放这里**（`AboutWindow`、`SettingsWindow`、`DshWindow`＝DSH 就地内嵌窗口、`AppPlaceholder`、`WidthHandle`＝正文列宽拖动条），以及 **`views.tsx`＝「窗口 id → 装什么」的登记表** |
| `src/hooks/` | `useAppearance`（主题+壁纸）、`useDock`（任务栏）、`useWindows`（窗口状态与几何记忆）、`useFullscreen`（浏览器级全屏）、`useArticleWidth`（正文列宽）、`useColumnRails`（内容列两侧栏的宽度，博客首页与 Wiki 共用） |
| `src/lib/` | `apps`（窗口登记表 + `visibleApps()` + `matchWindowRoute()` / `pathOf()`，含每窗口的 `veggie` 菜名与 `localOnly`）、`celestial`（日月弧线 / 颜色档位 / 月相）、`columnRails`（`RailSpec` 配置 + 栏宽几何与钳制）、`columnWidth`（列宽存取与钳制）、`dsh`（DSH 地址存取与守卫，`desktop.dshUrl`）、`dock`（任务栏几何）、`readingWidth`（正文列宽几何与让位规则）、`snap`（吸附/平铺的分区几何与预览矩形）、`theme`（主题与壁纸清单）、`windowManager`（纯 reducer）、`windowStore`（几何 + 会话记忆持久化）、`veggies`（48 张菜图的登记表与查表：`veggieOfName()` / `dishRows()`） |
| `src/styles/tokens.css` | 三套主题的**全部**色值与圆角变量 |
| `src/styles/globals.css` | 全局基础样式 + 自定义类（见下方"坑 1"） |
| `src/data/` | 站点文案与项目列表（`site.ts`、`projects.ts`）；`dst/` 是饥荒 Wiki 的数据，**归 wiki 负责人** |
| `src/lib/github.ts` | 博客数据源与写入：Issues 读/写 + 图片上传（img 分支）+ 各自缓存与限流回退 |
| `public/` | 原样拷进构建产物的静态文件：站标 `logo.svg`（矢量源，标签页图标 + 站内品牌）+ `logo.png`（512 位图，iOS 主屏图标）。**站内引用一律走 `SITE.logo`**（它拼了 `BASE_URL`）；别在组件里写死 `/logo.svg`——`src` 里的字符串 Vite 不会改写 base，子路径部署会 404 |
| `tools/` | `verify.mjs`（全站冒烟验证）、`verify-dst.mjs`（饥荒 Wiki 专属校验，归 wiki 负责人）、`pages-postbuild.mjs`（404 兜底）、`make-logo.mjs`（把 `logo.svg` 渲染成 PNG）、`term-server.mjs`（本机终端服务，只监听 127.0.0.1） |
| `docs/` | `dst-wiki.md`（饥荒 Wiki 的实现说明：数据模型 / 打分规则 / chunk 拆分 / 踩坑）、`dst-guides/`（3 篇新手教程稿件 + 发布脚本 + 说明），**归 wiki 负责人** |
| `design/` | 设计稿与任务书：`ICON-BRIEF.md`（给「UI 平面设计」那个对话的自包含任务书）、`icons/*.svg`、`preview.html`、`veggies/*.svg`（48 张菜图）、`veggies.html`、两个 `build-*.mjs`（生成预览页）。**除了 `veggies/*.svg` 被 `lib/veggies.ts` 引用（进构建）以外，其余不参与构建**，归图标设计负责人 |

## 窗口契约：加一个新窗口要动 4 个地方

> 现有 12 个窗口：about / write / projects / blog / wiki / skills / contact / terminal / **assistant（产品助理）** /
> assets / settings / dsh。⚠️ **`assistant` 的图标是临时借 `dsh` 的** ——
> `components/icons/**` 是图标设计负责人的地盘，第 12 个图标（产品助理）还没做，
> 所以 `AppId` 放宽成了 `IconName | 'assistant'`（窗口 id 通常等于图标名，但等图标时可以单独列）。
> **他补上图标后**：`ICON_SET` 加一个键、`apps.ts` 的 `icon` 换成新键、`types/desktop.ts` 里把
> `'assistant'` 从 `AppId` 的并集里去掉。

1. `src/lib/apps.ts` 登记一行：`id / name / path / source / icon`，需要更大窗口再加 `defaultSize`
2. `src/components/program/<名字>Window.tsx` 写内容
3. `src/components/program/views.tsx` 的 `VIEWS` 表里挂上（不挂就自动走 `AppPlaceholder`）
4. 数据源写进 `apps.ts` 的 `source` —— 它是「窗口名 → 路由 → 数据源」的唯一登记处

要带子页面（像 `/blog/:id`）：给 `VIEWS` 的那个工厂函数用 `param`（窗口状态里带着它），
**别用 `useParams`** —— 路由只代表当前聚焦的那个窗口，别的窗口的页面参数路由里没有。

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

## 主题令牌（硬规则）

组件**只读 CSS 变量**，可用类名：

```
bg-chrome / text-chrome-ink      任务栏底色与前景
bg-surface / bg-surface-2        窗口、卡片
border-edge                      所有边框
text-ink / text-dim              正文 / 次要文字
bg-accent / text-accent-ink      强调（当前项、主按钮）
bg-hover                         悬停底色（**给任务栏那种深色面用**）
bg-[var(--c-control-hover)]      窗口标题行小按钮 / 标签上小 × 悬停时的「淡按钮形状」（浅色面用这个）
bg-[var(--c-danger)]             关闭 / 删除这类破坏性按钮**悬停时的红底**（配 --c-danger-fg 当字色）
rounded-window / rounded-dock    圆角
logo-mark                        站标：读 --logo-shadow，给透明底图形托一层轻投影
变宽拖动条 / 滚动条滑块           读 --c-scroll-thumb（滑块）、--c-scroll-thumb-hover（悬停与拖动条）
日月时钟                         读 --c-celestial-{night,dawn,noon,dusk}（四档主色）
                                 + --c-celestial-moon / --c-celestial-moon-shade（月亮亮面/暗面）
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
  （当前 `verify.mjs` **共 82 项**；跑的时候把地址显式给它：`npm run verify -- http://127.0.0.1:5173`，
  bare `localhost` 在有些机器上解析成 `::1` 会连不上）
- **「产品助理」任务栏入口**有 2 项（用户 2026-10-05：「我想把这个工具放到任务栏中」，
  同时明确「不要做到 DSH」= **不在 DSH 窗口里加按钮**）：① 任务栏里有 `button[aria-label="产品助理"]`；
  ② 点开是一扇独立窗口、停在 `/assistant`、默认是说明卡（和 DSH 那一窗同一套组件）。
  ⚠️ 它靠 `DshWindow` 的 `panel` 参数在 iframe `onLoad` 时给 DSH 页面发
  `postMessage({type:'dsh:panel',panel},'*')` —— **targetOrigin 必须是 `'*'`**：
  桌面端 DSH 页面跑在 `dsh-app://`（`location.origin === "null"`），拿它当 targetOrigin 会直接抛错。
  插件侧只认回环/同页来源、只会 `selectPanel`，拿不到数据（协议见 `PLUGIN-BRIEF.md` 第 8 节）。
- ⚠️ **dev server 一改文件就没了的真凶**（排查过两次）：Vite 的 watcher 会去 watch
  **原子写留下的临时目录**（`.X.tsx.<pid>.<guid>.tmpdir/X.tsx.tmp`），它一被锁住/删掉就抛
  `EBUSY: resource busy or locked` 并**直接结束进程**。`vite.config.ts` 里已经忽略
  `**/.*.tmpdir/**` 与 `**/*.tmp`，别再删掉那两条
- **吸附 / 平铺**有 4 项：拖到左边缘**先出预览**、松手贴成左半边；拖到上边缘**铺满整个屏幕**；
  **拖到底边 = 下半屏且 `innerHeight - win.bottom === 0`**（这条就是"吸附不到最底边"那个 bug 的回归，
  实测窗口层底边在 730 时窗口仍能贴到 800）；吸附后再拖开 = 解吸附（不再是贴边形状、`data-snap` 清空）；
  **任务栏不挡窗口**（贴底那一刻量 `layerZ > dockZ`，且任务栏中心点最上面那个元素属于窗口）。
  ⚠️ 拖动目标框之前先点任务栏图标把它抬到最上面 —— 窗口叠着时被盖住的那个，标题行按不到
- **合并 / 标签**有 7 项：两个框各一标签 → 拖标题行空白处到另一扇上合并成一框两标签（拖动时给提示）、
  **整扇窗只有一行（标签行与窗口按钮同排）**、拖标签换顺序、点标签切页面（URL 跟着）、
  把标签拖出框外拆成两个框、关掉一个标签帧还在（焦点交给同帧另一个标签）、刷新后合并过的框仍是多标签。
  ⚠️ 顺序有讲究：**先测拆帧再测关标签**（关掉之后那框只剩一个标签，没得拆）；抓标题行要抓
  **标签右边的空白区**（左边按在标签上那是"拖标签换顺序"，`width - 90` 那一带又是 `– □ ×` 按钮组）
- **多窗口**还有：窗口能一路拖到 (0, 0)（用户报过的"不能超过最左边和最上面"）、
  **刷新后把上次开着的窗口都开回来**、`closeAllWindows()` 清场后再跑"只看某一个窗口"的小节
  ⚠️ 小节之间要先清场：全局选择器会串窗口，而且"会话记忆"会把上一节的窗口开回来
- **站名 / 菜名**有 1 项：页面标题、关于窗口、任务栏 `title` 都要是「芹菜耕地」与「X · 菜名」
  （同一条里也钉住了「无障碍名 = 窗口名」这条，见上方菜名那段）
- **DSH 快捷入口**有 4 项：① 任务栏里能找到 `DSH · 芹菜`（本机才挂载）；
  ② 点开后窗口出现、地址可改、探活结果落在 `online` / `offline`（**不要求 `online`** ——
  验证机不一定开着 DSH），且**默认是说明卡、还没挂 iframe**；
  ③ 点「在窗口里打开 DSH」后 iframe 真的挂在窗口**里面**、占满整个正文（四周缝 ≤2px、底面不许有白边）、
  工具条是浮层且**默认收起**（收起时它的底 ≤ iframe 顶）；
  ④ 鼠标移到窗口上边界那条热区 → 工具条滑下来，而且**正文高度不变**（证明它是浮层、不占位）。
  跑完必须切回「关于」再继续，因为它会离开 `/about`
- ⚠️ **任务栏不许挡住窗口**（用户 2026-10-05）：窗口层平时在任务栏**下面**（z-10 < 任务栏 50），
  这样开始菜单 / 位置菜单那些长在任务栏里的弹出层压得住窗口；
  **有窗口伸到任务栏那一条上**（最大化、或吸附到屏幕真正的边缘）时，`DesktopShell` 给窗口层加
  `desktop__layer--over`（z-60）把它提到任务栏之上，否则那种窗口会被任务栏挡掉一截。
  判断在 `overlapsDock` 里：最大化单列一档（几何还是还原尺寸），其余按矩形是否越出窗口层。
  ⚠️ 别图省事把 `.desktop__layer` 的 z 直接写死 60：那样开始菜单会被整层盖住、点不动（踩过）
- 正文列宽那套在 `verify.mjs` 里有 4 项：拖动条位置、**拖 40px = +80px 且落盘**、
  窄栏让位与双击复位、宽窗下先让左栏留住目录。改 `lib/readingWidth.ts` 的常量后一定要跑
- 博客首页的分隔条有 5 项：两条都在、**正好落在栏间空隙里（不压侧栏/不压卡片）**、
  拖左条 40px → 左栏 +40 中栏 −40 且整行贴齐、拖右条同理、双击复位且清掉 localStorage。
  改 `lib/columnRails.ts` 的 `RAIL_SHAPE` 后一定要跑
- 饥荒 Wiki 的分隔条有 3 项：资料区两条都在且左栏贴最左、拖左条 40px 落盘 `desktop.wikiNavWidth`、
  **教程区只剩右边那条且不留空轨道**
- 博客首页的统计/角标有 4 项：右栏「文章」= 左栏「全部」= 已发布总数、角标加得出「全部」、
  **切分类时角标与统计一个都不变**、统计里确实有「建站 N 天」与「字数」
- 日月时钟在 `verify.mjs` 里有 6 项：读数与系统时间**精确到秒**一致、**自己会跳秒（不刷新也在走）**、
  昼夜换日月、月相与照亮百分比自洽、三个时刻颜色两两不同，以及**拿已知天象验月相**
  （2024-04-08 日全食→新月、2024-03-25 半影月食→满月）。
  后两条用 `addInitScript` 把 `Date` 换成固定时刻另开页面来跑 —— 加天象相关的功能照这个办法测

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
