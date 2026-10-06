import { CARDS } from '../../data/tarot'
import type { DrawnCard, Reading, Spread } from './types'

/* 洗牌与抽牌 —— 项目里原本一处都没有（全站只有 `lib/github.ts` 用 crypto 生成文件名）。

   两条设计决定：
   1. **随机种子进结果**：同一个 seed 一定抽出同一副牌、同一套正逆位。
      这样占卜记录可以只存一个 seed（几字节）就完整复现，也才有"每日一抽"那种
      "同一天来几次都是同一张"的可能。种子用 `crypto.getRandomValues` 取，别用 `Math.random`
      （后者在同一毫秒内可能撞出相同序列）。
   2. **正逆位也从同一条随机流里取**，不另开一个源 —— 否则复现时两边对不上。 */

/** 逆位概率。传统上正逆各半，这里就按 50% */
export const REVERSED_RATE = 0.5

/** 32 位无符号种子 */
export type Seed = number

/** 密码学随机的种子；拿不到 crypto 时退回 Math.random（老浏览器 / 非安全上下文） */
export function newSeed(): Seed {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/**
 * mulberry32：小而稳的可复现 PRNG。
 * 同一个 seed → 同一条序列，所以"洗牌 + 正逆位"整体可复现。
 * ⚠️ 这不是密码学安全的随机 —— 占卜不需要，抽奖才需要。
 */
export function mulberry32(seed: Seed): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 原地 Fisher-Yates；返回同一个数组（调用方自己决定要不要先拷一份） */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

export interface DrawInput {
  spread: Spread
  question?: string
  /** 不给就现取一个随机种子 */
  seed?: Seed
  /** 抽牌时刻，不给就是现在 */
  at?: number
}

/** 一次占卜的完整结果 + 它的种子（种子要跟着结果存下来，才能复现） */
export interface DrawResult {
  reading: Reading
  seed: Seed
}

/**
 * 按牌阵抽牌。抽出的牌**不重复**（同一个牌阵里同一张牌不会出现两次），
 * 正逆位逐张独立决定。
 */
export function drawReading({ spread, question = '', seed, at }: DrawInput): DrawResult {
  const usedSeed = seed ?? newSeed()
  const rng = mulberry32(usedSeed)

  /* 拷一份再洗：CARDS 是模块级常量，就地洗会污染全局，下一次抽牌就失去随机性了 */
  const deck = shuffle([...CARDS], rng)

  const n = spread.positions.length
  const cards: DrawnCard[] = Array.from({ length: n }, (_, i) => ({
    card: deck[i],
    reversed: rng() < REVERSED_RATE,
    positionIndex: i,
  }))

  return {
    seed: usedSeed,
    reading: {
      at: at ?? Date.now(),
      spreadId: spread.id,
      question,
      cards,
    },
  }
}

/** 只抽一张（每日一抽 / 单牌指引用） */
export function drawSingle(seed?: Seed): DrawnCard {
  const usedSeed = seed ?? newSeed()
  const rng = mulberry32(usedSeed)
  const deck = shuffle([...CARDS], rng)
  return { card: deck[0], reversed: rng() < REVERSED_RATE, positionIndex: 0 }
}
