import { RANK_LABEL, SUIT_LABEL } from '../../data/tarot'
import type { DrawnCard, Reading, Spread, SpreadPosition, Suit } from './types'

/* 把「牌阵位置 + 抽到的牌」拼成人话。

   分工要清楚：**牌义是上游给的**（`upright` / `reversed` 关键词、`description` 牌面描述），
   这里只负责**组合与统计**，不编造新的牌义 —— 想加更厚的解读，加在数据里，别加在这儿。 */

export interface PositionReading {
  index: number
  position: SpreadPosition
  drawn: DrawnCard
  /** 「现状 · 愚人 The Fool（逆位）」 */
  headline: string
  /** 正位取 upright、逆位取 reversed —— 上游给的就是一行关键词 */
  keywords: string
  /** 位置在问什么（来自牌阵定义） */
  hint: string
}

export interface SuitTally {
  major: number
  wands: number
  cups: number
  swords: number
  pents: number
}

export interface ReadingView {
  positions: PositionReading[]
  total: number
  reversedCount: number
  tally: SuitTally
  /** 总述，逐条短句。统计出来的事实 + 一句这事实意味着什么 */
  notes: string[]
}

/** 花色的性格，用来写"哪一类力量占上风"那句 */
const SUIT_MEANING: Record<Suit, string> = {
  wands: '行动与意志（火）',
  cups: '情感与关系（水）',
  swords: '思维与冲突（风）',
  pents: '现实与资源（土）',
}

const SUIT_ORDER: Suit[] = ['wands', 'cups', 'swords', 'pents']

export function buildReading(reading: Reading, spread: Spread): ReadingView {
  const positions: PositionReading[] = reading.cards.map((drawn, index) => {
    const position = spread.positions[drawn.positionIndex] ?? {
      label: `第 ${index + 1} 张`,
      hint: '',
      x: 0,
      y: 0,
    }
    return {
      index,
      position,
      drawn,
      headline: `${position.label} · ${drawn.card.name}${drawn.reversed ? '（逆位）' : '（正位）'}`,
      keywords: drawn.reversed ? drawn.card.reversed : drawn.card.upright,
      hint: position.hint,
    }
  })

  const total = reading.cards.length
  const reversedCount = reading.cards.filter((c) => c.reversed).length

  const tally: SuitTally = { major: 0, wands: 0, cups: 0, swords: 0, pents: 0 }
  for (const { card } of reading.cards) {
    if (card.arcana === 'major') tally.major += 1
    else if (card.suit) tally[card.suit] += 1
  }

  const notes: string[] = []

  /* ① 张数与正逆位 */
  notes.push(
    `共 ${total} 张，其中逆位 ${reversedCount} 张、正位 ${total - reversedCount} 张。` +
      (reversedCount === 0
        ? '全正位，这些力量眼下是顺的。'
        : reversedCount === total
          ? '全是逆位 —— 牌面说的力量现在多半是堵着的，不是"没有"，是还没通。'
          : reversedCount * 2 > total
            ? '逆位偏多，说明这件事眼下更卡在"内部"而不是"外部"。'
            : '正位偏多，事情的整体走向比你想的顺。'),
  )

  /* ② 牌组构成 */
  const parts = [`大阿卡纳 ${tally.major} 张`]
  for (const suit of SUIT_ORDER) {
    if (tally[suit] > 0) parts.push(`${SUIT_LABEL[suit]} ${tally[suit]} 张`)
  }
  notes.push(`牌组构成：${parts.join('、')}。`)

  /* ③ 大阿卡纳的分量 —— 这是塔罗里最有信息量的一条统计 */
  if (tally.major > 0) {
    if (tally.major * 3 >= total) {
      notes.push(
        `大阿卡纳占了 ${tally.major}/${total} —— 分量很重。这件事的走向不太由你日常的小选择决定，` +
          '牵扯的是阶段性的命题，急着推动往往没用。',
      )
    } else if (tally.major * 2 >= total) {
      notes.push(`大阿卡纳 ${tally.major} 张，分量不轻：这件事有一部分不由你说了算。`)
    }
  } else {
    notes.push('一张大阿卡纳都没有 —— 这件事落在日常层面，你手上的选择是有效的。')
  }

  /* ④ 占上风的花色 */
  const ranked = SUIT_ORDER.map((suit) => ({ suit, n: tally[suit] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  if (ranked.length > 1 && ranked[0].n > ranked[1].n) {
    notes.push(
      `最重的是${SUIT_LABEL[ranked[0].suit]}（${ranked[0].n} 张）—— 这件事主要在${SUIT_MEANING[ranked[0].suit]}这一路上。`,
    )
  } else if (ranked.length > 1) {
    notes.push(
      `花色比较平均，${ranked
        .map((x) => `${SUIT_LABEL[x.suit]} ${x.n}`)
        .join(' / ')} —— 几条线同时在推，哪一条都不是唯一的主因。`,
    )
  }

  return { positions, total, reversedCount, tally, notes }
}

/** 宫廷牌（侍卫 / 骑士 / 王后 / 国王）—— 界面上单独标一下，它们常指"某个人" */
export function isCourtCard(drawn: DrawnCard): boolean {
  return drawn.card.arcana === 'minor' && (drawn.card.rank ?? 0) >= 11
}

/** 「权杖 · 国王」这种副标题，给卡牌下方用 */
export function rankLabel(drawn: DrawnCard): string {
  const { card } = drawn
  if (card.arcana === 'major' || !card.suit || !card.rank) return '大阿卡纳'
  return `${SUIT_LABEL[card.suit]} · ${RANK_LABEL[card.rank]}`
}
