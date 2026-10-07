import type { DockPosition } from '../types/desktop'

/** 任务栏默认厚度：图标 48 + 内边距 12 + 边框 2。
 *  ⚠️ 沿革：54（图标 40）→ **62**（2026-10-07 站主「**增大图标，同时继续减少图标间距**」）。
 *  这里就是"默认图标尺寸"的**唯一来源**：`iconSize === null` 时按钮尺寸 = 厚度 − 内边距×2
 *  （62 − 14 = 48），所以"默认图标 40 → 48"是通过抬高厚度实现的，不是改 `iconSize` 的初始值
 *  （那个初值本来就是 `null` = 跟着厚度自适应）。
 *  ⚠️ 老存档里若定过 `iconSize`（< 48）或把厚度拖到过 ≤ 54，`useDock` 的 `readStored` 会**向上迁移**
 *  到新默认（**只往上抬**，绝不覆盖用户手动调过的更大值），规则写在那里。 */
export const DOCK_THICKNESS = 62
/** 厚度下限（再薄就装不下默认尺寸的按钮）。62 的默认留下 6px 可收的余量：
 *  收到 56 时自动按钮 = 42px，图标 42×0.8 ≈ 34px，仍然清楚、也不会被裁。 */
export const DOCK_MIN_THICKNESS = 56

/* 任务栏内部几何：Dock 组件与下面的厚度下限共用，改一处即可。
   ⚠️ GAP 沿革：4 → **8**（2026-10-06「一切以 macOS 为准」）→ **5**（紧凑化那轮：4 时相邻按钮热区
   只差 4px、容易点偏，所以放宽到 5）→ **4**（2026-10-07 站主口径「继续缩小图标之间的间隙」）
   → **3**（同日站主「**增大图标，同时继续减少图标间距，紧密一些**」）。
   ⚠️ **收紧到 3 是有前提的**：按钮本身也从 40 涨到 48，"热区"跟着变宽，所以 3 仍然点得准
   （`verify` 里「点得中某个 app 图标」那类断言逐条通过）。再往 2 收紧前**必须再用那类断言复验**，
   否则退回上一个通过的值。
   它是 `dockStep()` 的一半，所以改它会连带放大/吸附/长度下限的几何，别单独在组件里写死别的间距。 */
export const DOCK_GAP = 3
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
/** ⚠️ **波浪模型已退役**（2026-10-07 第 14 轮，站主最新口径**优先于之前所有波浪口径**）：
 *  「**先光做选中图标放大，和右侧图标放大，其他不变**」→ 现在只有三档（见下面三个常量），
 *  `MAGNIFY_EXP` / `MAGNIFY_RADIUS_SLOTS` / `ASYM_*` 这套**都不再参与渲染**（常量留着记沿革）。
 *  沿革：1.5 → **1.9**（"两侧等大、略大"那版，d=1 → 1.12）→ **本轮整条波浪作废**。 */
export const MAGNIFY_EXP = 1.9
/** ⭐ 第 14 轮：**右侧紧邻**（`sel + 1`）的倍数 —— 站主「略大于正常图标」，取 **1.12**。
 *  ⚠️ 左侧紧邻、以及其余所有图标**恒为 1.0**（`paint()` 里的三档，别再写成"两侧对称"）。 */
export const MAGNIFY_RIGHT_NEIGHBOR = 1.12
/** ⭐ 第 14 轮：**右侧紧邻的让路系数** —— 位移 = `(PEAK−1) · 图标边长 · 0.5 · 本值 · amp`。
 *  0.25 × 48 × 0.5 = **6px**（"可以有一点让路"，别推成"完全让开"）。 */
export const MAGNIFY_NEIGHBOR_PUSH = 0.25
/** ⭐⭐ 第 14 轮：**生长/收缩的时间常数（秒）** —— 站主「**动画的动作慢一点**」。
 *  0.16s ≈ 总时长 **~450ms**（4τ 到 98%）。原来写死在 `tick()` 里是 0.09（~200ms）。
 *  ⚠️ 它同时是**每个图标自己缩放的缓动时间常数**（换目标时旧的 2× 平滑收回，不是"啪"地掉下来）
 *  —— 所以调大它 = 更慢，但也别大到"一直在缓慢漂移"：冻结是硬要求，动画一做完就必须停。 */
export const MAGNIFY_TAU = 0.09
/** 逐图标缩放的缓动时间常数（秒）—— 新模型是**离散选中**，换目标时旧那颗要从 2 掉回 1，
 *  没有这层缓动就会"啪"地跳一下。取 `MAGNIFY_TAU` 的一半：两级一阶滞后叠加后的总时长
 *  才和 `78e9d18` 那版（只有 fade 一层、τ=0.09）**手感一致**（实测长满 ~250ms）。
 *  ⚠️ 改它等于改"生长快慢"，别单独调大而不同步 `MAGNIFY_TAU`。 */
export const MAGNIFY_EASE_TAU = 0.05
/** ⭐⭐ 第 14 轮：**冻结大框的容差（px）** —— 站主「在**放大的图标外围一个足够大的框范围内**，
 *  在放大动画做完之后就**都不许动**，直到移出这个框之后再变化」。
 *  框 = 「放大后那个图标的渲染盒」各向外扩本值；取 **30px**（≥ 半个图标步长 50/2 = 25px）。
 *  ⚠️ 它与 `LEAVE_SLACK`（5px）是**两种东西**，两个都要：
 *    · `LEAVE_SLACK` = "还算不算在任务栏区域里"（决定要不要收起放大）；
 *    · `FREEZE_PAD`  = "冻结期间允许多大风筝范围"（决定要不要换目标）。
 *  判定顺序：**先判大框**（还在框里 → 什么都不做），**再判任务栏并集**（出了框、也出了并集 → 收起）。 */
export const FREEZE_PAD = DOCK_GAP / 2
/**
 * ⚠️ **已被否掉的三档模型留下的常量**（2026-10-06 当天先加后废）：
 * 那时"紧邻两侧各只大一丢丢（1.08）"；站主随后改口径为 macOS 波浪 → `paint()` **不再读它**。
 * 保留只为"别处若还引用不至于炸"，**别拿它做新逻辑**。
 */
export const MAGNIFY_NEIGHBOR = 1.08

/* ── 2026-10-06（第 8 轮）「波浪」最终口径：**半径收到 1 格 + 方向不对称 + 平滑速度防抖** ────────
   站主原话：「图标问题还是**震动感太强**。我在任务栏里面滑动的时候，**其他图标要是尽量不动的，
   只有左右两个图标变化**。**从左往右滑动，左边就比右边的小一点；从右往左滑动，右边就比左边小一点**，
   可以更好地显示波浪感。」
   → 所以：**指针正对的那个 ≈2×**；**紧邻左右各一个**参与；**≥2 格之外 scale 恒 1.0、位移恒 0**。 */

/** 紧邻的**最大**放大：`ramp(d) = clamp(WINDOW − d, 0, 1)` 在 d=0.5（指针正落在两格中间）取满，
 *  指针正对某格（d=1）时取一半 → 约 **1.13**（站主要求的 1.1~1.2 落在这一档）。 */
export const MAGNIFY_NEIGHBOR_PEAK = 1.26
/** 紧邻**让路**的位移系数：位移 = (PEAK−1)·边长·0.5·PUSH_FACTOR·amp（0.6 → 40px 按钮让 ~12px）。
 *  ⚠️ 乘 `amp`（= fade）：进入任务栏时平滑滑开、离开时平滑收回，**末态严格 0** ——
 *  站主补充口径：「第一次滑动进入任务栏的时候允许图标移动给选中图标让路；滑出去的时候就得变回原样」。 */
export const PUSH_FACTOR = 0.6
/** 紧邻参与变化的窗口（格）。**到窗口边缘正好回 0**，所以第 2 格之外的图标既不缩放也不位移，
 *  而且**不会在边界上"pop"一下**（硬截断会让远处图标突然从 1.0 跳到 1.1，那正是"震动感"）。 */
export const MAGNIFY_NEIGHBOR_WINDOW = 1.5
/** 位置不对称用的速度参考值。
 *  ⚠️ **2026-10-07 站主口径反转后已废弃**（原话：「两侧图标生长大小改为**略大于正常图标、且一样大**」）——
 *  即**不再随滑动方向变化**。常量**保留定义**（别删：留着记沿革），但 `Dock.tsx` 已不再 import 它。
 *  现在的两侧邻居是**等大**的（同一个 `wave(1)` 值），靠 `MAGNIFY_EXP` 定大小。 */
export const ASYM_V_REF = 6
/** 不对称的实现方式：把**波峰位置**按平滑速度偏置最多这么多格（**不搞"左右各乘一个系数"**）——
 *  那种写法在指针跨过"两个图标中点"时会左右互换，scale 瞬间跳 ~0.35，反而更震。
 *  偏置是连续的：右滑 → 波峰偏右 → **左邻居小、右邻居大**（站主要的正是这个方向感）；
 *  停手后速度归零 → 偏置归零 → **自动收敛回左右对称**。
 *  ⚠️ **2026-10-07 站主口径反转后已废弃**：新口径是「**两侧等大、只略大于正常**」→ 方向偏置取消。
 *  常量保留（记沿革），`Dock.tsx` 已不再 import。**要恢复方向感就把它加回 import 并在
 *  `paint()` 里 `hotEff = hot + vNorm * ASYM_BIAS`**（那行代码的注释里留了原式）。 */
export const ASYM_BIAS = 0.3
/** 速度死区（**格/秒**）：`vEma` 低于它就归零。2026-10-07（第 11 轮）**0.35 → 0.8** ——
 *  站主报「在图标之间移动的时候还是有抖动」，实测是这套偏置吃了事件噪声：邻居 scale 出现
 *  `1.008 → 1.005` 的小幅回落（"不许抖"断言方向翻转 2 次、红）。加大死区把残余噪声直接归零，
 *  与上面的"权重上限 0.5→0.2"配合；真机 125Hz 下方向感仍约 60ms 建立，肉眼无差别。 */
export const ASYM_DEAD = 0.8
export const ASYM_EMA = 0.12
/** `vEma` **衰减**的时间常数（只用在 `tick` 里）。要比 `EMA` 快：站主要求"停手后收敛回对称"，
 *  0.12s 的衰减在 320ms 后还剩 6.7%，实测左右仍差 0.023（刚好越过 ±0.02 的判据）。
 *  0.06s 衰减 → 320ms 后只剩 0.5% → 落进死区 → **严格对称**。 */
export const ASYM_DECAY = 0.06

/* ---- 冻结（站主 2026-10-07：「鼠标移动到图标上面之后，完成生长动画就不要动了，直到我移动到其他图标
   之后再缩小」「**冻住之后，移动到另一个图标上才解冻**」）—— 指针停住一段时间就判定"停稳"，
   平滑吸附到**指针当时的连续位置**（⚠️ 不是取整槽位：锚在格心会来回跳，实测单步 2px 变化 0.483），
   然后**真的停止更新**（同槽位内的 pointermove 不排帧、不碰 hot）。 */
/** 目标值连续稳定超过这个时长 → 开始平滑吸附（判据是"目标值没再变"，阈值 0.02 格 ≈ 1px） */
export const LATCH_MS = 200
/** ⚠️ **已废弃（2026-10-07）**：曾用来做"漂移解锁"（指针在已冻住那格里漂移超过它就解锁）。
 *  站主改口径为「**冻住之后，移动到另一个图标上才解冻**」→ 解锁**只看目标槽位有没有变**
 *  （`Math.round(target) !== Math.round(latched)`），**不再看漂移量**：同一颗图标上哪怕漂 ±10px
 *  也不许解锁、不许重算。**常量保留只为记沿革，别再引用它**（引用会被 `noUnusedLocals` 拦）。
 *  留着的另一个原因：以后若有人想退回"漂移解锁"，先看这条注释再决定。 */
export const LATCH_DEAD = 0.1
/** 吸附的时间常数（秒）：~50ms 收敛 —— 比"跟手"慢、比"看得见的动画"快，肉眼就是"贴正"一下 */
export const LATCH_SNAP_TAU = 0.05
/**
 * **波浪的半径**：离指针这么多格之外完全回到 1×（站主口径"大约 4~6 格"）。
 * ⚠️ 2026-10-06 从 3 调到 **5**：波浪要的是"中部最鼓、两端迅速收平"；
 * 半径 3 时只有三格在动，看着不像波。
 */
export const MAGNIFY_RADIUS_SLOTS = 1.5
/**
 * **铺开系数**（2026-10-06 站主：「左右两侧偏移的量太多了，把其他图标挤得太远了，同时把图标变得紧凑一些」）：
 * 位移 = 「逐个缝隙累计增量」× 这个系数。
 * ⚠️ 上一版系数是 1（几何上"完全分开"），是**按当时那条"相邻渲染盒不相交"断言**调的 ——
 * 那条断言**定得过严**：macOS 的紧凑感恰恰来自"大图标压住邻居的圆角"，所以断言已放宽为
 * 「允许轻微交叠，但邻居中心必须在 hot 的渲染盒之外、交叠面积 ≤ 邻居面积 25%、不许完全盖住」。
 */
export const SPREAD_FACTOR = 0.5
/**
 * **"还算在任务栏上"的容差（px）** —— 2026-10-07（第 13 轮）站主报的真 bug 用：
 * 「图标放大之后，移动到任务栏**上边缘**会取消选中图标」。
 * 根因：放大后的图标**往栏外长**，那部分在任务栏盒子外面；指针移过去时视口触发 `pointerleave`
 * → 立刻 `target = 0` → 放大被收回。
 * 现在 `wheelLeave()` 先判**并集**：`任务栏盒 ∪ 当前放大图标的渲染盒`，再外扩本容差；
 * 落在里面就**不收**。所以**取消条件只剩两个**：主轴移到另一个图标（换目标）／移出这个并集。
 * ⚠️ 槽位（`hot`）**只由主轴坐标决定**，交叉轴坐标只参与"是否还在并集里"。
 * 取 5px：macOS 的 `pointerleave` 判定普遍带 1~2px 抖动余量，5px 够稳又不会让"真的移开"失灵。 */
export const LEAVE_SLACK = 5
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
 *
 * ⚠️ 沿革：0.72（按钮 40px → 图标 ~29px）→ **0.80**（2026-10-07 站主「**增大图标**」；按钮同时
 * 40 → 48，图标 ≈ 38px）。0.80 是"几乎填满格子"（macOS 那味），再往上（0.85+）圆角会贴到按钮边缘、
 * 相邻图标在 `DOCK_GAP=3` 时会显得粘在一起，所以**别超过 0.82**。
 */
export const DOCK_ICON_FILL = 1
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
  /* ⚠️ 2026-10-06（站主：「最左边的全部应用图标也改到顶部栏里面去吧」）：
     任务栏里**已经没有任何固定按钮**（启动台搬进菜单栏、全屏与位置早在 P2 就搬走了），
     所以"两侧固定区不等"这个**根因消失了** —— 再补内边距反而会把图标块推偏
     （实测：横排时补了 45px，图标块中线偏 −22px，多行时最后一行也偏 −22px，两条断言当场红）。
     这里保留函数与签名（调用方不用改），但**返回 0**：图标块由 `margin: auto` 自己居中即可。
     ⚠️ 以后若又往任务栏里加固定按钮，先想清楚它在哪一侧，再决定要不要恢复补偿。 */
  void btn
  void vertical
  return 0
}
/** 折行的长度下限：至少要装得下**两个图标** + 内边距（原来还要给两端三个固定按钮留位，
 *  ⚠️ 2026-10-06 起任务栏没有固定按钮了，所以这个下限跟着降 —— 见 `wheelChrome` 的注释）。 */
export function wrapMinLength(btn: number): number {
  return btn * 2 + DOCK_GAP + (DOCK_PAD + DOCK_BORDER) * 2
}

/* ---- wheel（图标区，macOS 观感 + 回弹） ---- */
/** 图标区里"固定按钮之外"那一截的长度。
 *  ⚠️ 2026-10-06：任务栏里**已无固定按钮**（「全屏 ⛶」「任务栏位置」在 macOS P2 搬进菜单栏；
 *  「所有项目」≈ 启动台随后也搬了过去）→ 固定开销**只剩内边距**。
 *  `Dock.tsx` 的 `chromeLen` 直接用它算显式长度（单一真源，别再在组件里写一份字面量）。 */
export function wheelChrome(_btn: number): number {
  void _btn
  return (DOCK_PAD + DOCK_BORDER) * 2
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
