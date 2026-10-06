import { useEffect, useMemo, useRef, useState } from 'react'
import { PENDING_SPREADS, SPREADS, spreadOfId } from '../../data/tarot/spreads'
import { drawReading } from '../../lib/tarot/draw'
import {
  appendHistory,
  clearHistory,
  fromStored,
  readHistory,
  toStored,
  type StoredReading,
} from '../../lib/tarot/history'
import { buildReading } from '../../lib/tarot/reading'
import type { Reading } from '../../lib/tarot/types'
import { ReadingPanel } from './tarot/ReadingPanel'
import { SpreadBoard } from './tarot/SpreadBoard'

/* 「塔罗牌」窗口的实现。外壳在 `TarotWindow.tsx`（懒加载，见那个文件）。

   一次占卜的流程：选牌阵 → （可选）写下问题 → 抽牌（全部背面朝上）→ 逐张翻开 → 解读。
   - **抽牌时就把结果定死**，翻牌只是"揭示"。所以翻牌动画随便慢，结果不会变。
   - 翻开状态是**逐张**的（`revealed: boolean[]`）：点哪张翻哪张，「全部翻开」按牌阵顺序依次翻。
   - 记录落在 `desktop.tarot`（见 `lib/tarot/history.ts`），回顾时**用存下来的牌**重放。 */

/** 「全部翻开」时每张之间的间隔 */
const REVEAL_STEP_MS = 260

interface ActiveReading {
  reading: Reading
  seed: number
}

export default function TarotContent() {
  const [spreadId, setSpreadId] = useState<string>(SPREADS[0].id)
  const [question, setQuestion] = useState('')
  const [active, setActive] = useState<ActiveReading | null>(null)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [history, setHistory] = useState<StoredReading[]>(() => readHistory())
  const [showPending, setShowPending] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const picked = spreadOfId(spreadId) ?? SPREADS[0]
  /* 正在看的那一把用**它自己的**牌阵，不是当前选中的那个 —— 回顾旧记录时两者会不一样 */
  const activeSpread = active ? (spreadOfId(active.reading.spreadId) ?? picked) : picked

  const view = useMemo(
    () => (active ? buildReading(active.reading, activeSpread) : null),
    [active, activeSpread],
  )

  /* 历史里能还原出来的那些（牌表里还找得到全部牌） */
  const usableHistory = useMemo(
    () => history.filter((row) => fromStored(row) !== null),
    [history],
  )

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  function startDraw() {
    clearTimer()
    const { reading, seed } = drawReading({ spread: picked, question })
    setActive({ reading, seed })
    setRevealed(new Array(reading.cards.length).fill(false))
    setReviewing(false)
    setHistory(appendHistory(toStored(reading, seed)))
  }

  function revealOne(index: number) {
    clearTimer()
    setRevealed((prev) => {
      if (prev[index]) return prev
      const next = [...prev]
      next[index] = true
      return next
    })
  }

  /* 依次翻开剩下那些：一张张翻比"啪一下全开"更像在占卜，也让每张牌都被看到 */
  function revealAll() {
    clearTimer()
    const total = active?.reading.cards.length ?? 0
    if (!total) return
    const queue = Array.from({ length: total }, (_, i) => i).filter((i) => !revealed[i])
    let k = 0
    const step = () => {
      const index = queue[k]
      setRevealed((prev) => {
        if (prev[index]) return prev
        const next = [...prev]
        next[index] = true
        return next
      })
      k += 1
      timer.current = k < queue.length ? window.setTimeout(step, REVEAL_STEP_MS) : null
    }
    if (queue.length) step()
  }

  function openHistory(row: StoredReading) {
    const reading = fromStored(row)
    if (!reading) return
    clearTimer()
    setActive({ reading, seed: row.seed })
    setSpreadId(row.spreadId)
    setQuestion(row.question)
    setRevealed(new Array(reading.cards.length).fill(true))
    setReviewing(true)
  }

  function backToSetup() {
    clearTimer()
    setActive(null)
    setRevealed([])
    setReviewing(false)
  }

  const fmtTime = (at: number) =>
    new Date(at).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  /* ── 一、选牌阵（还没抽牌） ── */
  if (!active) {
    return (
      <div className="tarot">
        <div className="tarot__setup">
          <header>
            <h2 className="text-base font-semibold text-ink">塔罗牌占卜</h2>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              挑一个牌阵，写下想问的事（也可以留空），抽牌之后一张张翻开。
              占卜记录只存在这台机器的浏览器里。
            </p>
          </header>

          <section className="mt-4">
            <h3 className="text-xs font-semibold text-ink">选择牌阵</h3>
            <div className="tarot__spreads" role="group" aria-label="选择牌阵">
              {SPREADS.map((spread) => (
                <button
                  key={spread.id}
                  type="button"
                  aria-pressed={spread.id === spreadId}
                  onClick={() => setSpreadId(spread.id)}
                  className="tarot__spread"
                  data-spread={spread.id}
                >
                  <span className="tarot__spreadTop">
                    <span className="text-sm font-medium text-ink">{spread.name}</span>
                    <span className="shrink-0 text-[11px] text-dim">
                      {spread.positions.length} 张
                    </span>
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-dim">{spread.purpose}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <label className="text-xs font-semibold text-ink" htmlFor="tarot-question">
              想问什么（可留空）
            </label>
            <input
              id="tarot-question"
              type="text"
              value={question}
              maxLength={80}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：这份工作要不要换？"
              className="mt-1.5 w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:border-[var(--c-accent)]"
            />
          </section>

          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={startDraw} className="tarot__primary">
              开始占卜
            </button>
            <span className="text-xs text-dim">
              共 {spreadOfId(spreadId)?.positions.length ?? 0} 张牌，抽完不重复
            </span>
          </div>

          <section className="mt-5 border-t border-edge pt-3">
            <button
              type="button"
              onClick={() => setShowPending((v) => !v)}
              aria-expanded={showPending}
              className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-ink"
            >
              <span aria-hidden="true">{showPending ? '▾' : '▸'}</span>
              另外 {PENDING_SPREADS.length} 个牌阵（待接入）
            </button>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              资料里给了名字和用途，但没有排布 —— 每个位置摆在哪、在问什么得一个个定，还没做。
              先列在这儿，不放假按钮。
            </p>
            {showPending ? (
              <ul className="mt-2 space-y-1.5">
                {PENDING_SPREADS.map((item) => (
                  <li key={item.name} className="text-xs leading-relaxed text-dim">
                    <span className="text-ink">{item.name}</span> —— {item.purpose}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {usableHistory.length ? (
            <section className="mt-5 border-t border-edge pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink">
                  最近占卜（{usableHistory.length}）
                </h3>
                <button
                  type="button"
                  className="tarot__link"
                  onClick={() => setHistory(clearHistory())}
                >
                  清空
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {usableHistory.map((row) => (
                  <li key={`${row.at}-${row.seed}`}>
                    <button
                      type="button"
                      onClick={() => openHistory(row)}
                      className="tarot__history"
                    >
                      <span className="shrink-0 text-[11px] text-dim">{fmtTime(row.at)}</span>
                      <span className="shrink-0 text-xs text-ink">
                        {spreadOfId(row.spreadId)?.name ?? row.spreadId}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-dim">
                        {row.question || '（没写问题）'}
                      </span>
                      <span className="shrink-0 text-[11px] text-dim">
                        {row.cards.length} 张
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    )
  }

  /* ── 二、牌阵 + 解读 ── */
  return (
    <div className="tarot">
      <div className="tarot__playWrap">
        <div className="tarot__bar">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">{activeSpread.name}</h2>
            <p className="text-[11px] text-dim">
              {view ? `${view.total} 张 · 已翻开 ${revealed.filter(Boolean).length}` : ''}
              {reviewing ? ' · 这是回顾的记录' : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={revealAll}
              disabled={revealed.every(Boolean)}
              className="tarot__ghost"
            >
              全部翻开
            </button>
            <button type="button" onClick={startDraw} className="tarot__ghost">
              再抽一次
            </button>
            <button type="button" onClick={backToSetup} className="tarot__ghost">
              换个牌阵
            </button>
          </div>
        </div>

        <div className="tarot__play">
          <SpreadBoard
            spread={activeSpread}
            cards={active.reading.cards}
            revealed={revealed}
            onSelect={revealOne}
          />
          {view ? (
            <ReadingPanel
              spread={activeSpread}
              view={view}
              revealed={revealed}
              question={active.reading.question}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
