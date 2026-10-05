/* 窗口标签栏的开关与位置（像浏览器的标签页）。

   三档：`top` 顶部一条（默认，最像浏览器）/ `left` 左侧一条 / `off` 不显示。
   尺寸是给 CSS 用的：顶部一条 36px、左侧一条 190px。 */

import type { TabPosition } from '../types/desktop'

export const TAB_POSITIONS: TabPosition[] = ['top', 'left', 'off']

export const TAB_LABEL: Record<TabPosition, string> = {
  top: '顶部',
  left: '左侧',
  off: '不显示',
}

/** 顶部标签栏的高度（px）—— WindowTabs 自己用；它**不占窗口层的空间**（浮层 + 自动隐藏） */
export const TAB_TOP_HEIGHT = 36
/** 左侧标签栏的宽度（px） */
export const TAB_LEFT_WIDTH = 190

const KEY = 'desktop.tabs'

/** 读回标签栏位置；坏数据回默认（顶部） */
export function readTabPosition(): TabPosition {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && TAB_POSITIONS.includes(raw as TabPosition)) return raw as TabPosition
  } catch {
    /* 读不到就用默认 */
  }
  return 'top'
}

export function writeTabPosition(position: TabPosition): void {
  try {
    localStorage.setItem(KEY, position)
  } catch {
    /* 写不进去也不影响本次会话 */
  }
}
