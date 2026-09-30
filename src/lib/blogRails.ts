/* 博客首页（三栏卡片流）两条侧栏的宽度规则。
   和文章页的正文列不一样：这里拖的是**栏与栏的分界**，中栏（卡片流）始终 1fr 吃满剩余空间 ——
   所以拖多少就是多少（不像正文列那种居中对称的 ×2），布局也永远是贴齐的，不会在两端留空。

   常量与 globals.css 的 `.blog__grid` 一节对应，改一处要改两处。 */

import { clampWidth, readStoredWidth, writeStoredWidth } from './columnWidth'

export const BLOG_NAV_WIDTH_KEY = 'desktop.blogNavWidth'
export const BLOG_ASIDE_WIDTH_KEY = 'desktop.blogAsideWidth'

/** 抓取带宽度 = 格子间距（globals.css 里 `.blog__grid` 的 gap，同时写进 --width-handle-offset） */
export const BLOG_HANDLE_OFFSET = 14

/** 各断点下的默认宽度：两列时左栏 168，三列时左 176 / 右 228 */
export const BLOG_NAV_DEFAULT_TWO = 168
export const BLOG_NAV_DEFAULT_THREE = 176
export const BLOG_ASIDE_DEFAULT = 228

/** 拖动能到哪儿：左栏、右栏各自的上下限，以及中栏至少留多宽 */
export const BLOG_NAV_MIN = 132
export const BLOG_NAV_MAX = 360
export const BLOG_ASIDE_MIN = 168
export const BLOG_ASIDE_MAX = 420
export const BLOG_FEED_MIN = 300

/** 栏数断点：与 globals.css 的容器查询一致（<620 一列、≥620 两列、≥900 三列） */
export const BLOG_TWO_COLUMN_FROM = 620
export const BLOG_THREE_COLUMN_FROM = 900

export type BlogColumns = 1 | 2 | 3

export function blogColumns(containerWidth: number): BlogColumns {
  if (containerWidth >= BLOG_THREE_COLUMN_FROM) return 3
  if (containerWidth >= BLOG_TWO_COLUMN_FROM) return 2
  return 1
}

export function navDefaultWidth(columns: BlogColumns): number {
  return columns >= 3 ? BLOG_NAV_DEFAULT_THREE : BLOG_NAV_DEFAULT_TWO
}

export function readNavWidth(): number | null {
  return readStoredWidth(BLOG_NAV_WIDTH_KEY)
}

export function writeNavWidth(width: number | null): void {
  writeStoredWidth(BLOG_NAV_WIDTH_KEY, width)
}

export function readAsideWidth(): number | null {
  return readStoredWidth(BLOG_ASIDE_WIDTH_KEY)
}

export function writeAsideWidth(width: number | null): void {
  writeStoredWidth(BLOG_ASIDE_WIDTH_KEY, width)
}

/** 左栏的上限：容器减掉间距，再减掉右栏（三列时）与中栏的下限 */
export function navCeiling(containerWidth: number, asideWidth: number, columns: BlogColumns): number {
  const gaps = (columns - 1) * BLOG_HANDLE_OFFSET
  const aside = columns >= 3 ? asideWidth : 0
  return Math.min(BLOG_NAV_MAX, containerWidth - gaps - aside - BLOG_FEED_MIN)
}

/** 右栏的上限：容器减掉间距、左栏与中栏的下限 */
export function asideCeiling(containerWidth: number, navWidth: number, columns: BlogColumns): number {
  const gaps = (columns - 1) * BLOG_HANDLE_OFFSET
  return Math.min(BLOG_ASIDE_MAX, containerWidth - gaps - navWidth - BLOG_FEED_MIN)
}

/** 中栏能不能拿到最小宽度：拿不到就不显示这条手柄，免得拖了没反应 */
export function navRoom(containerWidth: number, asideWidth: number, columns: BlogColumns): boolean {
  return columns >= 2 && navCeiling(containerWidth, asideWidth, columns) >= BLOG_NAV_MIN
}

export function asideRoom(containerWidth: number, navWidth: number, columns: BlogColumns): boolean {
  return columns >= 3 && asideCeiling(containerWidth, navWidth, columns) >= BLOG_ASIDE_MIN
}

export function clampNav(width: number, containerWidth: number, asideWidth: number, columns: BlogColumns): number {
  return clampWidth(width, BLOG_NAV_MIN, navCeiling(containerWidth, asideWidth, columns))
}

export function clampAside(width: number, containerWidth: number, navWidth: number, columns: BlogColumns): number {
  return clampWidth(width, BLOG_ASIDE_MIN, asideCeiling(containerWidth, navWidth, columns))
}
