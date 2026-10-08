import { cardOfId } from '../../data/tarot'
/* ⚠️ 只**读**模式清单（合法值以 INTERP_MODES 为准），不在这里重抄一份 id */
import { INTERP_MODES, type InterpModeId } from '../../data/tarot/readings'
import type { DrawnCard, Reading } from './types'

/* 占卜记录的存取（localStorage 键 `desktop.tarot`）。

   **同一个键还记住"上次选的解读粒度"**（mode）—— 只加一个标量字段，
   历史数组那份逐条校验（isStoredReading）一个字没动：粒度坏了/缺了只会回落默认，
   不影响历史能不能读出来。写历史时会把 mode 一起带上（...readStore()），别把它写丢。

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
  /** 上次选的解读粒度（brief / combo / overview）；**原样存**，读出时再校验 */
  mode?: unknown
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
    const bag = parsed as Record<string, unknown>
    const mode = bag.mode
    const list = bag.history
    /* mode 与历史各管各的：历史坏了也别把已经存好的粒度丢掉 */
    if (!Array.isArray(list)) return { history: [], mode }
    return { history: list.filter(isStoredReading).slice(0, HISTORY_LIMIT), mode }
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
  /* ⚠️ 必须把 mode 一起写回去 —— 不然"记一次占卜"会把用户选的粒度抹掉 */
  writeStore({ ...readStore(), history: next })
  return next
}

export function clearHistory(): StoredReading[] {
  /* 清历史不清粒度：那是两件事 */
  writeStore({ ...readStore(), history: [] })
  return []
}

/* ── 解读粒度（desktop.tarot 的 mode 字段） ── */

/** 缺键 / 坏值 / 未知模式时的默认粒度 */
export const DEFAULT_INTERP_MODE: InterpModeId = 'brief'

/** 合法值以 INTERP_MODES 为唯一来源（数据层加模式，这里自动跟上） */
export function isInterpMode(value: unknown): value is InterpModeId {
  return typeof value === 'string' && INTERP_MODES.some((item) => item.id === value)
}

/**
 * 读上次选的解读粒度。**坏数据一律回落默认**，绝不抛 ——
 * 这个键用户能随手改，进不了就进不了，不能把窗口弄崩。
 */
export function readInterpMode(): InterpModeId {
  const raw = readStore().mode
  return isInterpMode(raw) ? raw : DEFAULT_INTERP_MODE
}

/** 切换时立刻写（不用等抽牌 / 提交） */
export function writeInterpMode(mode: InterpModeId): void {
  writeStore({ ...readStore(), mode })
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
