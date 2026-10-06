import type { Spread, SpreadPosition } from './types'

/* 牌阵的几何 —— 只有这一份。

   坐标的读法（**不是** 0~1 的相对百分比，别按画布比例理解）：
   - `positions[].u / .v` 是**牌心**的位置，单位是「牌高」：`v = 1` 就是往下挪一张牌的高度。
     横向用同一个单位，牌宽 = `CARD_RATIO`（350/600 ≈ 0.583）个牌高。
   - 好处：坐标和牌的实际大小挂钩，**画布该多大、牌该多大由这里算出来**，
     不需要人肉去猜一个"画布宽高比"。凯尔特十字一开始被我按 1.55（横的）定过，
     结果纵向白白空着、牌被压到 51px 宽 —— 那一版就是没算、硬猜的。

   ⚠️ 画布必须**同时**受窗口宽与高约束。纯 CSS 做不到：`width:100%` + `aspect-ratio` +
   `max-height` 被夹住时宽度不会跟着缩，比例会破。所以这里是量出来算的
   （同 `useArticleWidth` / `useColumnRails` 的路子：几何在 lib，组件只负责贴数值）。 */

/** 牌面固有宽高比（宽 / 高）—— 素材实测 350×600 */
export const CARD_RATIO = 350 / 600

/** 一张牌在坐标系里占的半个宽 / 半个高（旋转 90° 时两者互换） */
function halfExtents(position: SpreadPosition): { hw: number; hh: number } {
  const rotated = typeof position.rotate === 'number' && position.rotate % 180 !== 0
  return rotated ? { hw: 0.5, hh: CARD_RATIO / 2 } : { hw: CARD_RATIO / 2, hh: 0.5 }
}

export interface SpreadBounds {
  minU: number
  minV: number
  width: number
  height: number
}

/** 牌阵的最小包围盒（单位：牌高）。旋转的牌按它转完之后的占位算 */
export function spreadBounds(spread: Spread): SpreadBounds {
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const position of spread.positions) {
    const { hw, hh } = halfExtents(position)
    minU = Math.min(minU, position.u - hw)
    maxU = Math.max(maxU, position.u + hw)
    minV = Math.min(minV, position.v - hh)
    maxV = Math.max(maxV, position.v + hh)
  }
  return { minU, minV, width: maxU - minU, height: maxV - minV }
}

export interface BoardLayout {
  /** 一个「牌高」等于多少 px —— 也就是牌高的像素值，其它全由它推出来 */
  scale: number
  /** 画布尺寸（px） */
  width: number
  height: number
  /** 牌面尺寸（px） */
  cardW: number
  cardH: number
  /** 画布左上角对应坐标系里的哪个点 */
  originU: number
  originV: number
}

/**
 * 在给定的可用空间里放下整个牌阵，**尽量把牌放大**。
 * `availW / availH` 是量出来的舞台尺寸；返回 null 表示还没量到（或牌阵是空的）。
 */
export function layoutSpread(
  spread: Spread,
  availW: number,
  availH: number,
  padding = 8,
): BoardLayout | null {
  if (!spread.positions.length) return null
  const bounds = spreadBounds(spread)
  if (!(bounds.width > 0) || !(bounds.height > 0)) return null

  const usableW = Math.max(0, availW - padding)
  const usableH = Math.max(0, availH - padding)
  const scale = Math.min(usableW / bounds.width, usableH / bounds.height)
  if (!(scale > 0) || !Number.isFinite(scale)) return null

  return {
    scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
    cardW: CARD_RATIO * scale,
    cardH: scale,
    originU: bounds.minU,
    originV: bounds.minV,
  }
}

/** 某个位置在画布里的 px 偏移（**牌心**；组件再 translate(-50%,-50%) 才是左上角） */
export function slotOffset(position: SpreadPosition, layout: BoardLayout): { x: number; y: number } {
  return {
    x: (position.u - layout.originU) * layout.scale,
    y: (position.v - layout.originV) * layout.scale,
  }
}
