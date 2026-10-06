import { cardOfId } from '../../data/tarot'
import type { DrawnCard, Reading } from './types'

/* 占卜记录的存取（localStorage 键 `desktop.tarot`）。

   一条记录存三样东西：
   - `seed`：**有它就能完整复现这次占卜**（洗牌与正逆位都从这条随机流来，见 `draw.ts`）；
   - `cards`：牌 id + 正逆位。冗余，但牌表将来变了（比如补了别的牌组）也能照着显示，
     不至于因为 seed 的算法改了就显示成另一副牌；
   - 时刻 / 牌阵 / 问题：列表要显示的东西。

   ⚠️ 按项目规矩：读取一律走 guard，坏数据回默认值，**绝不能让启动崩掉**。 */

const KEY = 'desktop.tarot'

/** 最多留多少条：这只是个"回顾"用的列表，不是数据库 */
export const HISTORY_LIMIT = 30

export interface StoredCard {
  /** 牌 id（`Fool` / `Wands01` / `Pents14`） */
  id: string
  reversed: boolean
}

export interface StoredReading {
  /** 抽牌时刻（ms） */
  at: number
  seed: number
  spreadId: string
  question: string
  cards: StoredCard[]
}

interface Store {
  history: StoredReading[]
}

function isStoredCard(value: unknown): value is StoredCard {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.reversed === 'boolean'
}

/** 逐条校验：字段缺一个就丢掉这一条，不整份作废（半坏的数据也该保住能用的那部分） */
function isStoredReading(value: unknown): value is StoredReading {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.at === 'number' &&
    Number.isFinite(v.at) &&
    typeof v.seed === 'number' &&
    Number.isFinite(v.seed) &&
    typeof v.spreadId === 'string' &&
    typeof v.question === 'string' &&
    Array.isArray(v.cards) &&
    v.cards.every(isStoredCard)
  )
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { history: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { history: [] }
    const list = (parsed as Record<string, unknown>).history
    if (!Array.isArray(list)) return { history: [] }
    return { history: list.filter(isStoredReading).slice(0, HISTORY_LIMIT) }
  } catch {
    /* 坏 JSON / 隐私模式下 localStorage 抛异常 —— 都回空列表 */
    return { history: [] }
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* 写不进去不影响这次会话 */
  }
}

/** 最近的在最前 */
export function readHistory(): StoredReading[] {
  return readStore().history
}

/** 记一次占卜，返回写回之后的完整列表（调用方直接拿去 setState，省一次读） */
export function appendHistory(item: StoredReading): StoredReading[] {
  /* 同一时刻的同一次占卜不重复记（用户连点「再抽一次」不该刷出两条一样的） */
  const kept = readStore().history.filter(
    (row) => !(row.at === item.at && row.seed === item.seed && row.spreadId === item.spreadId),
  )
  const next = [item, ...kept].slice(0, HISTORY_LIMIT)
  writeStore({ history: next })
  return next
}

export function clearHistory(): StoredReading[] {
  writeStore({ history: [] })
  return []
}

/** 一次占卜 → 一条存档记录 */
export function toStored(reading: Reading, seed: number): StoredReading {
  return {
    at: reading.at,
    seed,
    spreadId: reading.spreadId,
    question: reading.question,
    cards: reading.cards.map((c) => ({ id: c.card.id, reversed: c.reversed })),
  }
}

/**
 * 一条存档记录 → 可以渲染的 `Reading`。
 *
 * ⚠️ **回顾用存下来的牌，不用 seed 重算**：seed 重算依赖洗牌算法一字不变，
 * 哪天换了算法，用户翻旧记录会看到另一副牌 —— 那比"看不到"更糟。
 * seed 仍然留着，它的价值是"能精确复现当时的随机"，不是用来显示历史。
 *
 * 任何一张牌在牌表里找不到（牌组换过）就整条作废，宁可这条记录不显示，
 * 也不要显示一个位置错乱的半条解读。
 */
export function fromStored(row: StoredReading): Reading | null {
  const cards: DrawnCard[] = []
  for (let i = 0; i < row.cards.length; i++) {
    const card = cardOfId(row.cards[i].id)
    if (!card) return null
    cards.push({ card, reversed: row.cards[i].reversed, positionIndex: i })
  }
  if (!cards.length) return null
  return { at: row.at, spreadId: row.spreadId, question: row.question, cards }
}
