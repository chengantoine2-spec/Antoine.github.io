import type { DockPosition, SkinId } from '../types/desktop'

/** 任务栏默认厚度：图标 40 + 内边距 12 + 边框 2 */
export const DOCK_THICKNESS = 54
/** 厚度下限（再薄就装不下按钮） */
export const DOCK_MIN_THICKNESS = 48
/** 长度下限 */
export const DOCK_MIN_LENGTH = 140
/** 任务栏与屏幕边缘的间距 */
export const DOCK_MARGIN = 8
/** Ubuntu 皮肤顶部状态栏高度 */
export const TOPBAR_HEIGHT = 34

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

/** 顶部被状态栏占掉的高度（只有 Ubuntu 皮肤有） */
export function topChrome(skin: SkinId): number {
  return skin === 'ubuntu' ? TOPBAR_HEIGHT : 0
}

/** 任务栏自身贴边的偏移：顶部要让开状态栏 */
export function dockOffset(position: DockPosition, skin: SkinId): number {
  return position === 'top' ? topChrome(skin) + DOCK_MARGIN : DOCK_MARGIN
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

/** 窗口层要躲开的四边：状态栏 + 任务栏（任务栏在哪边就占哪边，按实际厚度算） */
export function dockInsets(position: DockPosition, skin: SkinId, thickness = DOCK_THICKNESS) {
  const reserve = thickness + DOCK_MARGIN * 2
  return {
    top: topChrome(skin) + (position === 'top' ? reserve : 0),
    right: position === 'right' ? reserve : 0,
    bottom: position === 'bottom' ? reserve : 0,
    left: position === 'left' ? reserve : 0,
  }
}
