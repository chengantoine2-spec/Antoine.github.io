/* 「内容列 + 两侧栏」的宽度规则：博客首页、饥荒 Wiki 两个窗口共用。
   拖的是**栏与栏的分界**：中栏（内容列）始终 1fr 吃满剩余空间，
   所以拖多少变多少、布局永远贴齐，不像文章页那种居中对称的 ×2。

   ⚠️ 新窗口想加这套，照 BLOG_RAILS 抄一份配置就行（键名 / CSS 变量名 / 选择器换掉，
   几何数值可以直接用 RAIL_SHAPE），再去 globals.css 把网格列写成 var(--xxx-nav-width, 默认值)。
   常量与 CSS 的对应关系：offset = 格子间距，navDefaults/asideDefault = 各断点的默认宽度。 */

import { clampWidth, readStoredWidth, writeStoredWidth } from './columnWidth'

export type RailSide = 'nav' | 'aside'
export type RailColumns = 1 | 2 | 3

export interface RailSpec {
  /** 两条栏各自的 localStorage 键 */
  navKey: string
  asideKey: string
  /** 写进容器元素的 CSS 变量名 */
  navVar: string
  asideVar: string
  /** 在这个容器里哪儿找那两条栏 */
  navSelector: string
  asideSelector: string
  /** 抓取带宽度 = 格子间距（globals.css 里同时写进 --width-handle-offset） */
  offset: number
  /** 各断点下的默认宽度 */
  navDefaults: { two: number; three: number }
  asideDefault: number
  /** 拖动能到哪儿，以及内容列至少要留多宽 */
  navMin: number
  navMax: number
  asideMin: number
  asideMax: number
  feedMin: number
  /** 栏数断点：与 globals.css 的容器查询一致 */
  twoColumnFrom: number
  threeColumnFrom: number
}

/** 几何数值只有一份：两个窗口的栏宽范围本来就该一样，只有名字不同 */
const RAIL_SHAPE = {
  offset: 14,
  navDefaults: { two: 168, three: 176 },
  asideDefault: 228,
  navMin: 132,
  navMax: 360,
  asideMin: 168,
  asideMax: 420,
  feedMin: 300,
  twoColumnFrom: 620,
  threeColumnFrom: 900,
} as const

export const BLOG_RAILS: RailSpec = {
  ...RAIL_SHAPE,
  navKey: 'desktop.blogNavWidth',
  asideKey: 'desktop.blogAsideWidth',
  navVar: '--blog-nav-width',
  asideVar: '--blog-aside-width',
  navSelector: '.blog__nav',
  asideSelector: '.blog__aside',
}

export const WIKI_RAILS: RailSpec = {
  ...RAIL_SHAPE,
  navKey: 'desktop.wikiNavWidth',
  asideKey: 'desktop.wikiAsideWidth',
  navVar: '--wiki-nav-width',
  asideVar: '--wiki-aside-width',
  navSelector: '.wiki__nav',
  asideSelector: '.wiki__aside',
}

export function railVar(spec: RailSpec, side: RailSide): string {
  return side === 'nav' ? spec.navVar : spec.asideVar
}

export function readRail(spec: RailSpec, side: RailSide): number | null {
  return readStoredWidth(side === 'nav' ? spec.navKey : spec.asideKey)
}

export function writeRail(spec: RailSpec, side: RailSide, width: number | null): void {
  writeStoredWidth(side === 'nav' ? spec.navKey : spec.asideKey, width)
}

export function railColumns(spec: RailSpec, containerWidth: number): RailColumns {
  if (containerWidth >= spec.threeColumnFrom) return 3
  if (containerWidth >= spec.twoColumnFrom) return 2
  return 1
}

export function navDefaultWidth(spec: RailSpec, columns: RailColumns): number {
  return columns >= 3 ? spec.navDefaults.three : spec.navDefaults.two
}

/** 左栏的上限：容器减掉间距，再减掉右栏（三列时）与内容列的下限 */
export function navCeiling(
  spec: RailSpec,
  containerWidth: number,
  asideWidth: number,
  columns: RailColumns,
): number {
  const gaps = (columns - 1) * spec.offset
  const aside = columns >= 3 ? asideWidth : 0
  return Math.min(spec.navMax, containerWidth - gaps - aside - spec.feedMin)
}

/** 右栏的上限 */
export function asideCeiling(
  spec: RailSpec,
  containerWidth: number,
  navWidth: number,
  columns: RailColumns,
): number {
  const gaps = (columns - 1) * spec.offset
  return Math.min(spec.asideMax, containerWidth - gaps - navWidth - spec.feedMin)
}

/** 内容列还拿得到最小宽度吗？拿不到就不显示这条手柄，免得拖了没反应 */
export function navRoom(
  spec: RailSpec,
  containerWidth: number,
  asideWidth: number,
  columns: RailColumns,
): boolean {
  return columns >= 2 && navCeiling(spec, containerWidth, asideWidth, columns) >= spec.navMin
}

export function asideRoom(
  spec: RailSpec,
  containerWidth: number,
  navWidth: number,
  columns: RailColumns,
): boolean {
  return columns >= 3 && asideCeiling(spec, containerWidth, navWidth, columns) >= spec.asideMin
}

export function clampNav(
  spec: RailSpec,
  width: number,
  containerWidth: number,
  asideWidth: number,
  columns: RailColumns,
): number {
  return clampWidth(width, spec.navMin, navCeiling(spec, containerWidth, asideWidth, columns))
}

export function clampAside(
  spec: RailSpec,
  width: number,
  containerWidth: number,
  navWidth: number,
  columns: RailColumns,
): number {
  return clampWidth(width, spec.asideMin, asideCeiling(spec, containerWidth, navWidth, columns))
}
