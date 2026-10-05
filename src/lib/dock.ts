import type { DockPosition } from '../types/desktop'

/** 任务栏默认厚度：图标 40 + 内边距 12 + 边框 2 */
export const DOCK_THICKNESS = 54
/** 厚度下限（再薄就装不下默认尺寸的按钮） */
export const DOCK_MIN_THICKNESS = 48

/* 任务栏内部几何：Dock 组件与下面的厚度下限共用，改一处即可 */
export const DOCK_GAP = 4
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

/* ── 循环轮盘（mode: 'wheel'，2026-10-05 用户要的）─────────────────────────────
   中央放大：**中心 2×，越远越小，到可视边缘约 0.8×**（站主拍板的口径）。
   公式 `scale = PEAK - (PEAK - MIN) * u^1.5`，`u = 归一化距离`（0 = 峰所在的那个图标，1 = 可视边缘）。
   拖拽浏览松手吸附到最近格子，缓动 SNAP_MS。竖拖 44px 才进入"移动图标"。 */
/** 正中（峰）的倍数 */
export const MAGNIFY_PEAK = 2
/** 可视边缘的倍数：**小于 1×** —— 外侧图标比基础尺寸还小一圈，这是要的效果，不是被裁 */
export const MAGNIFY_MIN = 0.8
/** 衰减曲线的指数（1.5：中心附近变化慢、外侧收得快） */
export const MAGNIFY_EXP = 1.5
export const MOVE_THRESHOLD = 44
export const SNAP_MS = 150
/** 循环轮盘的可视长度至少要有这么多个图标位：少于 3 个，放大后的中心图标会被裁掉一半 */
export const DOCK_VIEW_MIN_SLOTS = 3
/** 长度下限（两套模式共用的地板值） */
export const DOCK_MIN_LENGTH = 140
/** 任务栏与屏幕边缘的间距 */
export const DOCK_MARGIN = 8

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
/** 折行的长度下限：至少要装得下两端三个固定按钮 + 一个图标 */
export function wrapMinLength(btn: number): number {
  return btn * 4 + DOCK_GAP * 3 + (DOCK_PAD + DOCK_BORDER) * 2
}

/* ---- wheel（循环轮盘） ---- */
/** 循环轮盘里"固定按钮之外"那一截的长度：三个固定按钮 + 图标区 + 间距与内边距 */
export function wheelChrome(btn: number): number {
  return btn * 3 + DOCK_GAP * 3 + (DOCK_PAD + DOCK_BORDER) * 2
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

/** 窗口层要躲开的四边：任务栏在哪边就占哪边，按实际厚度算 */
export function dockInsets(position: DockPosition, thickness = DOCK_THICKNESS) {
  const reserve = thickness + DOCK_MARGIN * 2
  return {
    top: position === 'top' ? reserve : 0,
    right: position === 'right' ? reserve : 0,
    bottom: position === 'bottom' ? reserve : 0,
    left: position === 'left' ? reserve : 0,
  }
}
