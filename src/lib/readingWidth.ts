/* 正文列宽：文章详情页左右两条拖动条共用的一套几何规则 + 存储。
   模型照搬 DSH 会话页的 WidthHandle（对应 DSH 前端 ConversationRoot 里的那套）：
   - 正文列居中，两条手柄对称，所以指针位移要 ×2 才是列宽的变化量
     （往右拖 40px，正文列左右各出去 40px，一共宽 80px，手柄始终黏在指针下面）
   - 手柄离正文列 24px，正好落在正文与窄栏之间的那道空隙里
   - 上限 = 容器宽 - 两侧抓取带（48px），再宽就没有抓的地方了
   - 拖宽到窄栏放不下时**窄栏让位**（先让左栏、留住目录，再全让），拖回去自己回来 ——
     否则默认窗口下（容器 958）上限只有 726，往外拖几乎没反应
   这里只放纯函数与常量；测量与渲染在 hooks/useArticleWidth.ts。
   存取与钳制这两个通用动作在 lib/columnWidth.ts（博客首页的两条侧栏也用它） */

import { clampWidth, readStoredWidth, writeStoredWidth } from './columnWidth'

export const ARTICLE_WIDTH_KEY = 'desktop.articleWidth'
/** 正文列下限：再窄行宽就碎了（DSH 是 640，我们字号小一点，取 480） */
export const ARTICLE_MIN_WIDTH = 480

/** 手柄抓取带的宽度，同时也是正文列与窄栏之间的空隙。
    ⚠️ 必须与 globals.css 里 `.article__grid` 的 `--width-handle-offset` 一致 */
export const ARTICLE_HANDLE_OFFSET = 24

/** 两侧抓取带一共要占的宽度：列宽上限里留出来，不然拖到最宽就没地方抓手柄了 */
export const ARTICLE_HANDLE_ROOM = ARTICLE_HANDLE_OFFSET * 2

/* 窄栏的宽度与断点：与 globals.css 的 `.article__*` 一节一致。
   JS 需要提前知道"有栏时占多少"—— 栏一旦被藏起来就量不到宽度了 */
export const RAIL_LEFT_WIDTH = 168
/** 左右栏都在时的右栏宽度 */
export const RAIL_RIGHT_WIDTH = 216
/** 只有右栏时的右栏宽度 */
export const RAIL_RIGHT_ONLY_WIDTH = 208
/** 左右栏都放得下的容器宽度 */
export const RAIL_BOTH_FROM = 1160
/** 至少放得下一条右栏的容器宽度 */
export const RAIL_RIGHT_FROM = 940

export type RailMode = 'none' | 'right' | 'both'

/** 读存下来的偏好；没存过、或者存坏了，都回 null（= 用 CSS 里按行宽自适应的 88ch） */
export function readArticleWidth(): number | null {
  return readStoredWidth(ARTICLE_WIDTH_KEY)
}

/** 传 null = 清掉偏好，正文列回到 CSS 的自适应行宽（双击手柄就是这个） */
export function writeArticleWidth(width: number | null): void {
  writeStoredWidth(ARTICLE_WIDTH_KEY, width)
}

/** 上限：容器里除了正文，还得留下两侧抓取带 */
export function maxArticleWidth(containerWidth: number): number {
  return Math.max(ARTICLE_MIN_WIDTH, Math.round(containerWidth - ARTICLE_HANDLE_ROOM))
}

export function clampArticleWidth(width: number, containerWidth: number): number {
  return clampWidth(width, ARTICLE_MIN_WIDTH, maxArticleWidth(containerWidth))
}

/** 某个栏位组合占掉的横向空间（栏宽 + 它们两侧的空隙） */
export function railSpace(mode: RailMode): number {
  if (mode === 'both') {
    return (
      RAIL_LEFT_WIDTH + ARTICLE_HANDLE_OFFSET + RAIL_RIGHT_WIDTH + ARTICLE_HANDLE_OFFSET
    )
  }
  if (mode === 'right') return RAIL_RIGHT_ONLY_WIDTH + ARTICLE_HANDLE_OFFSET
  return 0
}

/**
 * 窄栏让位规则：先试左右都在，再试只留右栏（目录比"文内信息"重要），最后全让。
 * 判定只看「正文列宽 + 栏占位 <= 容器」，与栏当前是否显示无关，
 * 所以不会出现"栏一出现 → 滚动条出现 → 容器窄 8px → 栏又收起"的来回横跳。
 */
export function resolveRailMode(containerWidth: number, mainWidth: number): RailMode {
  if (containerWidth >= RAIL_BOTH_FROM && mainWidth + railSpace('both') <= containerWidth) {
    return 'both'
  }
  if (containerWidth >= RAIL_RIGHT_FROM && mainWidth + railSpace('right') <= containerWidth) {
    return 'right'
  }
  return 'none'
}
