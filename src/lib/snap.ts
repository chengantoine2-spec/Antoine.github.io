/* 窗口吸附 / 平铺的几何规则（拖到屏幕边缘对半分屏）。
   只算数，不碰 DOM —— 拖动时的预览与松手后的落位用的是同一份函数，所以"看到哪就贴到哪"。 */

import type { SnapZone } from '../types/desktop'

/** 离边缘多少像素算"要吸附"。别太大，否则想把窗口拖到边上放着都会误触发 */
export const SNAP_EDGE = 22

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 四角优先于四边：先看有没有同时贴住两个方向 */
const CORNERS: Array<[SnapZone, boolean, boolean]> = [
  ['tl', true, true],
  ['tr', false, true],
  ['bl', true, false],
  ['br', false, false],
]

/**
 * 指针落在哪个吸附区（都没有就返回 undefined）。
 * px / py 是**视口坐标**（`clientX/clientY` 直接传进来），bounds 也传**整个视口**的尺寸 ——
 * ⚠️ 别传 `.desktop__layer` 的矩形：层被任务栏让过位，用它算的话贴底只能贴到任务栏上沿
 * （用户 2026-10-05 报的 bug：「吸附不到最底边，而是吸附到工具栏上面」）。
 */
export function snapZoneAt(px: number, py: number, bounds: { w: number; h: number }): SnapZone | undefined {
  const left = px <= SNAP_EDGE
  const right = px >= bounds.w - SNAP_EDGE
  const top = py <= SNAP_EDGE
  const bottom = py >= bounds.h - SNAP_EDGE

  for (const [zone, wantLeft, wantTop] of CORNERS) {
    if (left === wantLeft && top === wantTop && (left || right) && (top || bottom)) return zone
  }
  if (left) return 'left'
  if (right) return 'right'
  if (top) return 'top'
  if (bottom) return 'bottom'
  return undefined
}

/** 吸附区 → 目标矩形（**视口坐标**；上边 = 铺满整个屏幕，四角 = 四分之一，其余三边 = 对半） */
export function snapRect(zone: SnapZone, bounds: { w: number; h: number }): Rect {
  const halfW = Math.round(bounds.w / 2)
  const halfH = Math.round(bounds.h / 2)
  switch (zone) {
    case 'left':
      return { x: 0, y: 0, w: halfW, h: bounds.h }
    case 'right':
      return { x: halfW, y: 0, w: bounds.w - halfW, h: bounds.h }
    case 'top':
      return { x: 0, y: 0, w: bounds.w, h: bounds.h }
    case 'bottom':
      return { x: 0, y: halfH, w: bounds.w, h: bounds.h - halfH }
    case 'tl':
      return { x: 0, y: 0, w: halfW, h: halfH }
    case 'tr':
      return { x: halfW, y: 0, w: bounds.w - halfW, h: halfH }
    case 'bl':
      return { x: 0, y: halfH, w: halfW, h: bounds.h - halfH }
    case 'br':
      return { x: halfW, y: halfH, w: bounds.w - halfW, h: bounds.h - halfH }
  }
}

export const SNAP_LABEL: Record<SnapZone, string> = {
  left: '左半边',
  right: '右半边',
  top: '铺满屏幕',
  bottom: '下半屏',
  tl: '左上四分之一',
  tr: '右上四分之一',
  bl: '左下四分之一',
  br: '右下四分之一',
}
