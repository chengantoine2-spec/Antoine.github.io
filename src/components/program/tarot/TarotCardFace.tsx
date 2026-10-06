import { useState } from 'react'
import { cardImageSrc } from '../../../data/tarot'
import type { DrawnCard } from '../../../lib/tarot/types'
import { CardBack } from './CardBack'

/* 牌阵里的一张牌：正面 / 背面 + 3D 翻牌 + 序号角标。

   几条决定：
   - **翻牌用 CSS 3D**（`perspective` + `rotateY` + `backface-visibility`）。项目里没有动画库、
     也不引依赖，`globals.css` 原本只有一个窗口进场的 `@keyframes`，这套自己写。
   - **逆位 = 让图片自己转 180°**，不是把整张牌翻过来 —— 位置与序号角标不能跟着倒。
   - **图片挂了要给得出东西**：按站里的规矩"宁可写待接入，也不要给一个裂图"，
     加载失败就退回一张写着牌名的底板，而不是浏览器的裂图图标。
   - 序号角标画在翻转层**外面**：翻牌时它不该跟着转。牌阵位置 ↔ 解读条目靠这个号对上。 */

interface TarotCardFaceProps {
  /** 抽到的牌；不给就是一张还没发的牌（纯背面） */
  drawn?: DrawnCard
  /** 翻开了没有 */
  revealed?: boolean
  /** 牌阵里的位置序号（1 起），显示在左上角 */
  ordinal?: number
  /** 尺寸由外面给（牌阵按百分比算好） */
  className?: string
  /** 点这张牌（抽牌 / 翻牌） */
  onSelect?: () => void
  /** 无障碍名；不传就不渲染成按钮 */
  label?: string
  /**
   * 这张牌在牌阵里被旋转了多少度（凯尔特十字第 2 张是横放的）。
   * 角标要**反向转回来**，否则跟着牌一起躺倒 —— 数字躺平了不好认。
   */
  rotate?: number
}

export function TarotCardFace({
  drawn,
  revealed = false,
  ordinal,
  className = '',
  onSelect,
  label,
  rotate,
}: TarotCardFaceProps) {
  /* 记住的是"哪张牌裂了"而不是 true/false：牌一换就自动重置，不用额外 effect */
  const [brokenId, setBrokenId] = useState<string | null>(null)
  const broken = drawn ? brokenId === drawn.card.id : false

  const interactive = typeof onSelect === 'function'
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      {...(interactive
        ? {
            type: 'button' as const,
            onClick: onSelect,
            'aria-label': label ?? (drawn ? drawn.card.name : '未翻开的牌'),
          }
        : { 'aria-hidden': true })}
      className={`tarot-card ${className}`}
      data-revealed={revealed ? 'true' : 'false'}
      data-reversed={drawn?.reversed ? 'true' : 'false'}
      data-empty={drawn ? 'false' : 'true'}
    >
      <div className="tarot-card__inner">
        {/* 背面（默认朝观众） */}
        <div className="tarot-card__side tarot-card__side--down">
          <CardBack className="h-full w-full" />
        </div>

        {/* 正面（旋转 180° 藏在背面后头） */}
        <div className="tarot-card__side tarot-card__side--up">
          {drawn &&
            (broken ? (
              /* 图没加载出来：给一张写着牌名的底板，绝不显示裂图 */
              <div className="tarot-card__fallback">
                <span className="text-[11px] leading-tight text-dim">图片未加载</span>
                <span className="mt-1 text-center text-xs leading-snug font-medium text-ink">
                  {drawn.card.nameZh || drawn.card.nameEn}
                </span>
                <span className="mt-1 text-[10px] text-dim">{drawn.reversed ? '逆位' : '正位'}</span>
              </div>
            ) : (
              <img
                src={cardImageSrc(drawn.card)}
                alt={drawn.card.name}
                draggable={false}
                loading="lazy"
                decoding="async"
                onError={() => setBrokenId(drawn.card.id)}
                /* 逆位就把牌面自己转过来 */
                className={`tarot-card__art ${drawn.reversed ? 'tarot-card__art--reversed' : ''}`}
              />
            ))}
        </div>
      </div>

      {ordinal ? (
        <span
          className="tarot-card__ordinal"
          style={rotate ? { transform: `rotate(${-rotate}deg)` } : undefined}
        >
          {ordinal}
        </span>
      ) : null}
    </Tag>
  )
}
