import type { ReadingView } from '../../../lib/tarot/reading'
import { rankLabel } from '../../../lib/tarot/reading'
import type { Spread } from '../../../lib/tarot/types'

/* 解读栏：把 `buildReading()` 算出来的东西排版出来。

   ⚠️ **没翻开的牌不给解读**：只渲染翻开了的那几条（`revealed[i] === true`）。
   总述（统计那几句）要等全部翻开才出现 —— 它讲的是整副牌的构成，
   早显示等于剧透，而且那份统计本身也会跟着翻牌变。 */

interface ReadingPanelProps {
  spread: Spread
  view: ReadingView
  /** 逐张的翻开状态（下标 = 位置下标），和牌阵上用的是同一份 */
  revealed: boolean[]
  question: string
}

export function ReadingPanel({ spread, view, revealed, question }: ReadingPanelProps) {
  const shown = view.positions.filter((item) => revealed[item.index])
  const openCount = revealed.filter(Boolean).length
  const done = view.total > 0 && openCount >= view.total

  return (
    <div className="tarot-reading">
      <header className="tarot-reading__head">
        <h3 className="text-sm font-semibold text-ink">{spread.name}</h3>
        <p className="mt-1 text-xs leading-relaxed text-dim">{spread.purpose}</p>
        {question.trim() ? (
          <p className="tarot-reading__question">
            <span className="text-dim">问的是：</span>
            {question.trim()}
          </p>
        ) : null}
      </header>

      <ol className="tarot-reading__list">
        {shown.map((item) => (
          <li key={item.index} className="tarot-reading__item">
            <div className="tarot-reading__ordinal">{item.index + 1}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.headline}</p>
              <p className="mt-0.5 text-[11px] text-dim">{rankLabel(item.drawn)}</p>

              {item.hint ? (
                <p className="mt-2 text-xs leading-relaxed text-dim">
                  <span className="text-ink">位置：</span>
                  {item.hint}
                </p>
              ) : null}

              <p className="mt-1.5 text-xs leading-relaxed text-ink">
                <span className="text-dim">{item.drawn.reversed ? '逆位：' : '正位：'}</span>
                {item.keywords}
              </p>

              <details className="tarot-reading__more">
                <summary>牌面描述</summary>
                <p className="mt-1 text-xs leading-relaxed text-dim">{item.drawn.card.description}</p>
                <p className="mt-1 text-[10px] break-all text-dim">
                  牌义出处：{item.drawn.card.detail}
                </p>
              </details>
            </div>
          </li>
        ))}
      </ol>

      {!shown.length ? (
        <p className="text-xs text-dim">还没有翻开的牌。抽牌之后一张张点开，或者按「全部翻开」。</p>
      ) : null}

      {done ? (
        <section className="tarot-reading__notes">
          <h4 className="text-xs font-semibold text-ink">这一把的整体构成</h4>
          <ul className="mt-1.5 space-y-1.5">
            {view.notes.map((note) => (
              <li key={note} className="text-xs leading-relaxed text-dim">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : shown.length ? (
        <p className="text-xs text-dim">
          还剩 {view.total - openCount} 张没翻开 —— 全部翻完给这一把的整体构成。
        </p>
      ) : null}
    </div>
  )
}
