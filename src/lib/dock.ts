import type { DockPosition } from '../types/desktop'

/** 任务栏默认厚度：图标 40 + 内边距 12 + 边框 2 */
export const DOCK_THICKNESS = 54
/** 厚度下限（再薄就装不下默认尺寸的按钮） */
export const DOCK_MIN_THICKNESS = 48

/* 任务栏内部几何：Dock 组件与下面的厚度下限共用，改一处即可。
   ⚠️ GAP = **8px** 是 macOS 的 Dock 图标间距（原先 4px）——2026-10-06「一切以 macOS 为准」。
   它是 `dockStep()` 的一半，所以改它会连带放大/吸附/长度下限的几何，别单独在组件里写死别的间距。 */
export const DOCK_GAP = 5
export const DOCK_PAD = 6
export const DOCK_BORDER = 1

/**
 * 厚度下限：手动定了**固定图标尺寸**时，任务栏至少要装得下那个图标 + 内边距与边框。
 * 否则把厚度拖到最小时图标会被裁掉一截（`DOCK_MIN_THICKNESS` 只按默认图标算，不够用）。
 * ⚠️ `wheel`（循环轮盘）**永远单行**，厚度只跟图标走；折行模式（`wrap`）的"按行数算厚度"
 * 在 `wrapThicknessFloor()` 里，两者别混。
 */
export function minDockThickness(iconSize: number | null): number {
  if (iconSize === null) return DOCK_MIN_THICKNESS
  return Math.max(DOCK_MIN_THICKNESS, iconSize + (DOCK_PAD + DOCK_BORDER) * 2)
}

/* ── 图标区（mode: 'wheel'，2026-10-06 起改成 macOS 的观感与行为）────────────────
   放大是**指针驱动**的（谁被指针正对谁最大），不是"钉在中间的固定鱼眼"。

   ⚠️ 2026-10-06 站主的口径**改过两次**，最终是 **macOS 的"波浪/鱼眼"**：
   > 「想要 macOS 那种指针扫过时的"波浪"，越想 macOS 越好，最好一模一样」
   （中间那条"只有正对那个变大 + 紧邻只 1.08 + 更外侧恒 1.0"的**三档模型已被否**。）
   波浪的规则：
   1. **峰值在指针正对那个图标**：`scale = 1 + (PEAK − 1) · wave(d)`，`d` = 离指针的**格数**（连续值）；
   2. `wave(d) = (1 + cos(π · min(d / RADIUS, 1))) / 2` —— **两端导数为 0 的平滑曲线**，
      没有台阶、没有平台；相邻图标的差值在峰附近变化快、远处趋平（这就是"波"的感觉）；
   3. `MAGNIFY_RADIUS_SLOTS` 格外回到 **1.0×**（站主口径"大约 4~6 格"）；
   4. **整排铺开**：每个图标按"指针到它之间所有图标的单侧增量之和"向两边位移 ——
      指针那个几乎原地不动，整排从指针处推开；**邻居绝不许重叠**（`verify.mjs` 有这条）。
   `MAGNIFY_PEAK` 不变（2×），`transform-origin` 贴栏那侧（往栏外长）。

   拖拽浏览松手**回弹**（不再循环、不再吸附到任意格子，见下面 RUBBER/SPRING）。
   竖拖 MOVE_THRESHOLD 才进入"移动图标"。 */
/** 峰（指针正对那个）的倍数 */
export const MAGNIFY_PEAK = 2
/**
 * ⚠️ **波浪模型下这个常量不再被 `paint()` 使用**（保留是为了别处引用与历史可读性）。
 * 波浪的衰减是 `(1 + cos(π·d/RADIUS))/2`，不再有"边缘倍数 MIN"这个概念。
 */
export const MAGNIFY_MIN = 1
/** 旧的衰减指数（波浪模型不再用它；保留同上） */
export const MAGNIFY_EXP = 1.5
/**
 * ⚠️ **已被否掉的三档模型留下的常量**（2026-10-06 当天先加后废）：
 * 那时"紧邻两侧各只大一丢丢（1.08）"；站主随后改口径为 macOS 波浪 → `paint()` **不再读它**。
 * 保留只为"别处若还引用不至于炸"，**别拿它做新逻辑**。
 */
export const MAGNIFY_NEIGHBOR = 1.08
/**
 * **波浪的半径**：离指针这么多格之外完全回到 1×（站主口径"大约 4~6 格"）。
 * ⚠️ 2026-10-06 从 3 调到 **5**：波浪要的是"中部最鼓、两端迅速收平"；
 * 半径 3 时只有三格在动，看着不像波。
 */
export const MAGNIFY_RADIUS_SLOTS = 3
/**
 * **铺开系数**（2026-10-06 站主：「左右两侧偏移的量太多了，把其他图标挤得太远了，同时把图标变得紧凑一些」）：
 * 位移 = 「逐个缝隙累计增量」× 这个系数。
 * ⚠️ 上一版系数是 1（几何上"完全分开"），是**按当时那条"相邻渲染盒不相交"断言**调的 ——
 * 那条断言**定得过严**：macOS 的紧凑感恰恰来自"大图标压住邻居的圆角"，所以断言已放宽为
 * 「允许轻微交叠，但邻居中心必须在 hot 的渲染盒之外、交叠面积 ≤ 邻居面积 25%、不许完全盖住」。
 */
export const SPREAD_FACTOR = 0.5
/**
 * Dock 按钮里图标占按钮边长的比例。
 *
 * 来历：`design/ICON-MACOS-BRIEF.md` 读代码量出来的**与 macOS 差距最大的单点** ——
 * 图标原来是 `h-1/2 w-1/2`，按钮是 `clamp(iconSize,32,64)`，所以默认 **40px 的按钮里图标只有 20px**，
 * 周围一圈空；而 macOS 的 Dock 图标几乎**填满格子**。0.72 → 40px 按钮里约 **29px**。
 *
 * ⚠️ 它只作用于 `wheel`（图标区）模式的 `.dock__glyph`；折行模式仍用 50%（那是它的"旧观感"，
 * 按项目规矩一个字不改）。改这个值会连带影响 **2× 放大后的凸出量**（图标变大 → 凸出更多），
 * 验证里那条"凸出 ≥ 整个增量、贴栏边漂移 ≤2px"要跟着看。
 */
export const DOCK_ICON_FILL = 0.72
export const MOVE_THRESHOLD = 44
export const SNAP_MS = 150
/** 循环轮盘的可视长度至少要有这么多个图标位：少于 3 个，放大后的中心图标会被裁掉一半 */
export const DOCK_VIEW_MIN_SLOTS = 3
/** 长度下限（两套模式共用的地板值） */
export const DOCK_MIN_LENGTH = 140
/** 任务栏与屏幕边缘的间距 */
export const DOCK_MARGIN = 8

/* ── 回弹（站主 2026-10-06：「跟随 macOS 改成回弹，**一切以 macOS 为准**」）────────
   ⚠️ 先把事实说清楚（`MACOS-BRIEF.md` 4.1 节）：**macOS 的 Dock 本身不滚动** ——
   图标多了它是**整体缩小**；回弹是 macOS / iOS **滚动视图**的行为。我们按滚动视图做：
   两端是终点、越界阻尼、松手弹回。站主选的就是这条，所以不是"折中方案"。
   ⚠️ 旧实现是**循环**（渲染两份背靠背的列表 + `offset` 取模归一化，转一圈回到起点），
   已按总原则拆掉 —— **别再改回来**（站主的原话是"有头有尾、到两端回弹"）。
   回归断言在 `verify.mjs` 14b/14d：「到端被夹住」「越界被阻尼」「松手回弹到端点」「装得下不可拖」。 */

/** 橡皮筋公式里的常数（苹果滚动视图那套 `f(x,d,c) = (1 − 1/(x·c/d + 1))·d` 的 c） */
export const RUBBER_C = 0.55
/** `d` = 视口长度的这个比例（480px 的可视区 → 最多能多拉 120px 就被"拽住"） */
export const RUBBER_D_RATIO = 0.25
/** 松手回弹的弹簧：**取 `playground-macos` DockItem 用的那组**（1700 / 90，MIT）。
 *  它原本喂给 framer-motion，我们**不引依赖**，用同一个 k/c 自己积分（见 Dock.tsx 的 settle）。
 *  ζ = c/(2√k) ≈ 1.09 → 略过阻尼，没有回弹过冲，实测 ~200ms 落位。 */
export const SPRING_STIFFNESS = 1700
export const SPRING_DAMPING = 90

/** 图标区内容的总长度（N 个图标 + N−1 个间距）。`dockStep()` 是"中心距"，别拿来当内容长度。 */
export function dockContentLength(count: number, step: number): number {
  return count > 0 ? count * step - DOCK_GAP : 0
}

/**
 * 可拖动的最大偏移 = 内容长度 − 可视长度，**不小于 0**。
 * = 0 表示"装得下、根本不用拖"（这时不许拖，也不许有回弹）—— 站主要的 macOS 行为里，
 * Dock 装得下就是静止的。
 */
export function dockMaxOffset(count: number, step: number, viewLen: number): number {
  return Math.max(0, dockContentLength(count, step) - viewLen)
}

/** 苹果滚动视图的橡皮筋位移：拉得越远、增量越小（永远不超过 d） */
export function rubberBand(x: number, dim: number, c = RUBBER_C): number {
  const d = Math.max(1, dim)
  return (1 - 1 / ((Math.max(0, x) * c) / d + 1)) * d
}

/**
 * 把"原始偏移"（拖动时可能越界）换成**实际画出来的偏移**：界内原样、越界按橡皮筋阻尼。
 * 拖动时用它画、松手时用 spring 收回端点 —— 这样"拉 100px 实移不到 100px、增量递减"。
 */
export function dampedOffset(offset: number, maxOffset: number, viewLen: number): number {
  const dim = viewLen * RUBBER_D_RATIO
  if (offset < 0) return -rubberBand(-offset, dim)
  if (offset > maxOffset) return maxOffset + rubberBand(offset - maxOffset, dim)
  return offset
}

/* ── 两套模式各自的几何 ────────────────────────────────────────────────
   `wheel` = 循环轮盘（**永远单行**）；`wrap` = 旧的折行（最多 3 行，完全旧行为）。
   把两边的数都收在这里，Dock 组件与设置窗口共用一套，避免"一边改了另一边没改"。 */

/** 相邻两个图标的中心距（步长） */
export function dockStep(btn: number): number {
  return btn + DOCK_GAP
}

/* ---- wrap（旧行为，语义一个字都不改） ---- */
/** 最多折几行 */
export const WRAP_MAX_LINES = 3
/** 当前厚度能塞下几行（竖排时是几列） */
export function wrapLines(crossAvail: number, btn: number): number {
  return Math.round(Math.min(Math.max(Math.floor((crossAvail + DOCK_GAP) / (btn + DOCK_GAP)), 1), WRAP_MAX_LINES))
}
/** 折行时每行放几个（内层主轴上限靠它算，折行才会发生） */
export function wrapPerLine(count: number, lines: number): number {
  return Math.max(1, Math.ceil(count / lines))
}

/**
 * 折行模式要在**哪一侧**补多少内边距，图标块才会居中
 * （站主 2026-10-05 报的「转成折行老是往左偏」）。
 *
 * 根因：图标块是在"两端固定按钮之间的可用框"里居中的，所以它的中线天生偏离任务栏中线
 * `(起点固定区 S − 终点固定区 E) / 2`。在**起点**补内边距 p，居中后的中线右移 p/2；
 * 在**终点**补 p，中线左移 p/2 —— 所以偏移要用"两侧之差"来抵消。
 *
 * 返回值**带符号**：
 * - `> 0` → 补在**起点**（`padding-inline-start` / `padding-block-start`）
 * - `< 0` → 补在**终点**（取绝对值补 `padding-inline-end` / `padding-block-end`）
 *
 * 两个方向的固定按钮摆在哪一侧（`Dock.tsx` 里定的，改布局要一起看）：
 * - **横排**：起点一颗「所有项目」（≈ 启动台），终点**没有**了 → 补终点；
 * - **竖排**：菜单按钮在**终点**，起点没有 → 补起点。
 *
 * 它只是内边距，所以**装不下时**滚动原点仍在内容之前 —— 起点那几个图标照样看得见、够得到
 * （实测过：第一个图标仍在栏内 +95px 处，不会被裁到滚动原点之外）。
 * ⚠️ 别换成 `margin`：内边距同时缩小了"用于居中的空闲空间"，这才是它"正好抵消"的原因。
 */
export function wrapSideGap(btn: number, vertical: boolean): number {
  const fixed = btn + DOCK_GAP
  /* 竖排：固定按钮在终点 → 补起点（正）；横排：固定按钮在起点 → 补终点（负） */
  return vertical ? fixed : -fixed
}
/** 折行的长度下限：至少要装得下两端三个固定按钮 + 一个图标 */
export function wrapMinLength(btn: number): number {
  return btn * 4 + DOCK_GAP * 3 + (DOCK_PAD + DOCK_BORDER) * 2
}

/* ---- wheel（图标区，macOS 观感 + 回弹） ---- */
/** 图标区里"固定按钮之外"那一截的长度。
 *  ⚠️ 2026-10-06（macOS P2）：**任务栏只剩一颗固定按钮**（左端的「所有项目」≈ 启动台）——
 *  「全屏 ⛶」与「任务栏位置」已经挪进顶部菜单栏（macOS 的 Dock 两端只有启动台和废纸篓，
 *  没有这类系统按钮）。所以这里从"3 颗固定按钮"改成"1 颗 + 两处间距"，长度下限也跟着降。 */
export function wheelChrome(btn: number): number {
  return btn + DOCK_GAP * 2 + (DOCK_PAD + DOCK_BORDER) * 2
}
/** 图标区可视长度的下限：至少 3 个图标位（少了中心放大出来的图标会被裁一半） */
export function wheelViewMin(btn: number): number {
  return DOCK_VIEW_MIN_SLOTS * dockStep(btn) - DOCK_GAP
}
/**
 * 循环轮盘的长度下限 = 三个固定按钮 + 图标区下限。
 * ⚠️ 工作单里写"比现在还小"，但按「图标区至少 3 个图标位」+「三个固定按钮不许被顶出边界」
 * 两条一起算，这个值必然 ≥ 折行那套（4 个图标位的宽度）—— 我按**物理正确值**来，
 * 没有为了满足那句话去违反另外两条硬要求（已在回报里点名）。
 */
export function wheelMinLength(btn: number): number {
  return wheelChrome(btn) + wheelViewMin(btn)
}

/**
 * 长度下限：**两种模式共用一个值**（取更严的那个 = 轮盘那套）。
 *
 * ⚠️ 为什么必须共用（2026-10-05 站主报的「转回折行会有图标消失」）：
 * 以前按模式各算各的（40px 图标时 wheel **274** / wrap **186**），于是**同一个存档 length**
 * 在两种模式下会被夹到不同的值、渲染出不同的宽度。实测（视口 1280×800、图标 40）：
 *
 *   | 存档 length | 轮盘渲染 | 折行渲染 |
 *   |---|---|---|
 *   | 186 | 栏 274 / 可视 128（现见 3 个图标） | 栏 **186** / 可视 **40**（现见 **1** 个） |
 *   | 200 | 栏 274 / 可视 128 | 栏 **200** / 可视 **54** |
 *   | 240 | 栏 274 / 可视 128 | 栏 **240** / 可视 **94** |
 *   | ≥274 | 一致 | 一致 |
 *
 * 在折行里把任务栏拖短（`Dock.tsx` 的拖动会按**当前模式**的下限夹，写进去的是 186）之后，
 * 切到轮盘再切回折行，任务栏会**突然缩短最多 88px**、图标区从 128 塌到 40 —— 图标没坏，
 * 只是被挤到滚动区外面去了，而滚动条是 `.no-scrollbar`（看不出来），看着就是"图标消失"。
 * 共用下限之后切模式**不再改变任务栏尺寸**，两种模式看到的图标个数也一致。
 *
 * 取更严的那个不损失什么：轮盘的下限（图标区至少 3 个图标位）本身就 ≥ 折行那套（4 个图标位）。
 * ⚠️ 别再改回"按模式各算各的"：回归断言在 `verify.mjs` 的 14f（同一存档 length 下两种模式的
 * 栏宽 / 可视区宽必须相同、且每个图标都能在某个滚动位置被看见）。
 */
export function dockMinLength(btn: number): number {
  return Math.max(DOCK_MIN_LENGTH, wheelMinLength(btn))
}

/* 尺寸上限（按屏幕比例）
   下/上：高 ≤ 1/4 屏高，宽 ≤ 7/8 屏宽
   左/右：宽 ≤ 1/8 屏宽，高 ≤ 3/4 屏高 */
export const MAX_THICKNESS_RATIO_H = 0.25
export const MAX_LENGTH_RATIO_H = 0.875
export const MAX_THICKNESS_RATIO_V = 0.125
export const MAX_LENGTH_RATIO_V = 0.75

/** 位置按钮的切换顺序 */
export const DOCK_ORDER: DockPosition[] = ['bottom', 'top', 'left', 'right']

export function isVertical(position: DockPosition): boolean {
  return position === 'left' || position === 'right'
}

/** 厚度上限：横向按屏高的 1/4，竖向按屏宽的 1/8 */
export function maxDockThickness(position: DockPosition, viewport: { w: number; h: number }): number {
  return isVertical(position)
    ? viewport.w * MAX_THICKNESS_RATIO_V
    : viewport.h * MAX_THICKNESS_RATIO_H
}

/** 长度上限：横向按屏宽的 7/8，竖向按屏高的 3/4 */
export function maxDockLength(position: DockPosition, viewport: { w: number; h: number }): number {
  return isVertical(position)
    ? viewport.h * MAX_LENGTH_RATIO_V
    : viewport.w * MAX_LENGTH_RATIO_H
}

/** 窗口层要躲开的四边：任务栏在哪边就占哪边，按实际厚度算。
 *  ⚠️ 2026-10-06（macOS P2）：**顶部还要让给菜单栏** —— 菜单栏是常驻 chrome，
 *  不管任务栏停在哪一边，`top` 都至少是 `menubarH`（macOS 里最大化窗口不盖菜单栏）。 */
export function dockInsets(position: DockPosition, thickness = DOCK_THICKNESS, menubarH = 0) {
  const reserve = thickness + DOCK_MARGIN * 2
  return {
    top: menubarH + (position === 'top' ? reserve : 0),
    right: position === 'right' ? reserve : 0,
    bottom: position === 'bottom' ? reserve : 0,
    left: position === 'left' ? reserve : 0,
  }
}
