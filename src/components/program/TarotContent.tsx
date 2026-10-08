import { useEffect, useMemo, useRef, useState } from 'react'
import { PENDING_SPREADS, SPREADS, spreadOfId } from '../../data/tarot/spreads'
import { QUESTION_ROTATE_MS, pickQuestion } from '../../data/tarot/questions'
import { INTERP_MODES, interpret, type InterpModeId } from '../../data/tarot/readings'
import { drawReading } from '../../lib/tarot/draw'
import {
  appendHistory,
  clearHistory,
  fromStored,
  readHistory,
  readInterpMode,
  toStored,
  writeInterpMode,
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
  /* 解读粒度：三种可切换，**切换不重抽**（同一手牌只换呈现）。
     ⚠️ 初值从存档读（desktop.tarot 的 mode 字段）—— 刷新/关窗重开还是上次那个；
     坏值/缺键在 guard 里回落 brief。 */
  const [interpMode, setInterpMode] = useState<InterpModeId>(() => readInterpMode())

  const timer = useRef<number | null>(null)

  /* 「想问什么」的示例：按时段分桶（清晨/上午/午后/傍晚/深夜）、每 20 秒换一条。
     ⚠️ 走时用**对齐整秒的自调度 setTimeout**，不用 setInterval —— 后台标签页节流、Edge 的睡眠标签页
     会把它停掉（项目里栽过）；窗口不可见时干脆不排下一次，回到可见立刻重新对表。 */
  const [hintTick, setHintTick] = useState(0)
  const questionHint = useMemo(() => pickQuestion(new Date()), [hintTick])

  useEffect(() => {
    let id: number | null = null
    const schedule = () => {
      if (document.visibilityState === 'hidden') return
      /* 对齐到下一个 20s 边界；20s 是整秒的整数倍，所以落点也在整秒上 */
      const wait = QUESTION_ROTATE_MS - (Date.now() % QUESTION_ROTATE_MS)
      id = window.setTimeout(() => {
        setHintTick((n) => n + 1)
        schedule()
      }, wait)
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (id !== null) window.clearTimeout(id)
      setHintTick((n) => n + 1)
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (id !== null) window.clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

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

  /* 解读文案（组合生成，见 data/tarot/readings.ts）：跟着"正在看的那一把"，
     切粒度只换呈现 —— 这里**没有**任何重新抽牌的动作 */
  const interp = useMemo(
    () => (active ? interpret(active.reading, activeSpread, interpMode, active.seed) : null),
    [active, activeSpread, interpMode],
  )
  const allOpen = revealed.length > 0 && revealed.every(Boolean)

  /* 历史里能还原出来的那些（牌表里还找得到全部牌） */
  const usableHistory = useMemo(
    () => history.filter((row) => fromStored(row) !== null),
    [history],
  )

  /* 切粒度：立刻写回存档（站主要求"不必等抽牌/提交"） */
  function chooseMode(mode: InterpModeId) {
    setInterpMode(mode)
    writeInterpMode(mode)
  }

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
              placeholder={questionHint.text}
              className="mt-1.5 w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:border-[var(--c-accent)]"
            />
            {/* 这一行既是提示、也是"它会变"的证据（验证脚本按 data-tarot-hint 找它） */}
            <p className="mt-1.5 text-[11px] text-dim" data-tarot-hint data-bucket={questionHint.bucket.id}>
              例子会随时间换：现在是「{questionHint.bucket.name}」的写法，每 {QUESTION_ROTATE_MS / 1000} 秒换一条。
            </p>
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
          {interp ? (
            /* ⚠️ `col-span-full` 是必需的：`.tarot__play` 是**显式两行/两列的 grid**，
               不加就会变成第三个网格项，把牌阵那一格压成 0 高 ——
               `layoutSpread()` 量到 0 就返回 null，牌面整个不渲染（踩过：全翻开后牌全没了、
               解读栏还留着几条）。高度上限 + 自身滚动，保证牌阵永远有地方。 */
            <section className="tarot-interp col-span-full mt-3 max-h-[34vh] overflow-auto">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="解读粒度">
                <span className="text-[11px] text-dim">解读粒度：</span>
                {INTERP_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-tarot-mode={item.id}
                    aria-pressed={interpMode === item.id}
                    title={item.hint}
                    onClick={() => chooseMode(item.id)}
                    className="rounded border border-edge px-2 py-0.5 text-[11px] text-dim aria-pressed:bg-accent aria-pressed:text-accent-ink"
                  >
                    {item.name}
                  </button>
                ))}
              </div>

              {interp.mode === 'overview' ? (
                interp.overview && allOpen ? (
                  <div className="mt-2 space-y-1.5 rounded-md border border-edge bg-surface-2 p-2.5">
                    <p className="tarot-interp__mood text-xs leading-relaxed text-ink">
                      <span className="text-dim">整体氛围：</span>
                      {interp.overview.mood}
                    </p>
                    <p className="tarot-interp__flow text-xs leading-relaxed text-ink">
                      {interp.overview.flow}
                    </p>
                    <p className="tarot-interp__remind text-xs leading-relaxed text-ink">
                      <span className="text-dim">关键提醒：</span>
                      {interp.overview.remind}
                    </p>
                    <ul className="tarot-interp__advice space-y-0.5 pt-0.5">
                      {interp.overview.advice.map((line) => (
                        <li key={line} className="tarot-interp__adviceItem text-[11px] leading-relaxed text-dim">
                          · {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-dim">
                    全部翻开之后给整体综述（还差 {revealed.filter((v) => !v).length} 张）。
                  </p>
                )
              ) : (
                <ol className="mt-2 space-y-2">
                  {interp.entries.map((entry, index) =>
                    revealed[index] ? (
                      <li
                        key={`${entry.position}-${index}`}
                        className="tarot-interp__item rounded-md border border-edge bg-surface-2 p-2.5"
                        data-position={entry.position}
                      >
                        <p className="text-xs font-medium text-ink">
                          {entry.position}
                          <span className="ml-1.5 text-[11px] font-normal text-dim">
                            {entry.card}
                            {entry.reversed ? ' · 逆位' : ' · 正位'}
                          </span>
                        </p>
                        <p className="tarot-interp__text mt-1 text-xs leading-relaxed text-ink">{entry.text}</p>
                        <ul className="tarot-interp__advice mt-1.5 space-y-0.5">
                          {entry.advice.map((line) => (
                            <li
                              key={line}
                              className="tarot-interp__adviceItem text-[11px] leading-relaxed text-dim"
                            >
                              · {line}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : null,
                  )}
                </ol>
              )}

              <p className="tarot-interp__disclaimer mt-2 text-[10px] leading-relaxed text-dim">
                {interp.disclaimer}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
