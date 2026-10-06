import { useEffect, useRef, useState } from 'react'
import { layoutSpread, slotOffset } from '../../../lib/tarot/layout'
import type { DrawnCard, Spread } from '../../../lib/tarot/types'
import { TarotCardFace } from './TarotCardFace'

/* 牌阵画布：把 `Spread.positions` 的坐标摆成真正的牌阵。

   尺寸怎么定的：
   - 量一次舞台的可用空间交给 `layoutSpread()`，它按"把整个牌阵塞进去、尽量把牌放大"算出
     画布尺寸、牌的尺寸、以及画布左上角对应坐标系里的哪一点。这里只负责把算出来的数贴到 style 上。
   - 画布要**同时**受宽与高约束。纯 CSS 做不到这件事（`width:100%` + `aspect-ratio` +
     `max-height` 被夹住时宽度不会跟着缩，比例会破），所以用 ResizeObserver 量，
     和 `useArticleWidth` / `useColumnRails` 一个办法。
   - 牌宽写进 CSS 变量 `--card-w`，角标字号、圆角、内边距全由它 calc 出来
     → 牌阵整体等比缩放，没有第二套断点数值。 */

interface SpreadBoardProps {
  spread: Spread
  /** 按 `positionIndex` 排好的牌；还没抽就是空数组 */
  cards: DrawnCard[]
  /**
   * 逐张的翻开状态（下标 = 位置下标）。用**逐张**而不是"翻开了几张"：
   * 用户点了第 5 张，就该只翻第 5 张，不是把前 5 张一起掀开。
   */
  revealed: boolean[]
  /** 点第 index 张牌（翻开它） */
  onSelect?: (index: number) => void
}

export function SpreadBoard({ spread, cards, revealed, onSelect }: SpreadBoardProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setAvail({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = layoutSpread(spread, avail.w, avail.h)

  return (
    <div className="tarot-stage" ref={stageRef}>
      {layout ? (
        <div
          className="tarot-board"
          data-spread={spread.id}
          style={{
            width: `${layout.width}px`,
            height: `${layout.height}px`,
            ['--card-w' as string]: `${layout.cardW}px`,
          }}
        >
          {spread.positions.map((position, index) => {
            const drawn = cards[index]
            const isOpen = revealed[index] ?? false
            const { x, y } = slotOffset(position, layout)
            return (
              <div
                key={`${spread.id}-${index}`}
                className="tarot-slot"
                /* left/top 是**牌心**：.tarot-slot 里有一句 translate(-50%,-50%) 把它挪成左上角 */
                style={{ left: `${x}px`, top: `${y}px` }}
              >
                <div
                  className="tarot-slot__rot"
                  style={position.rotate ? { transform: `rotate(${position.rotate}deg)` } : undefined}
                >
                  <TarotCardFace
                    drawn={drawn}
                    revealed={isOpen}
                    ordinal={index + 1}
                    rotate={position.rotate}
                    label={
                      drawn
                        ? `第 ${index + 1} 张 · ${position.label} · ${drawn.card.name}`
                        : `第 ${index + 1} 张 · ${position.label}`
                    }
                    onSelect={onSelect && !isOpen ? () => onSelect(index) : undefined}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
