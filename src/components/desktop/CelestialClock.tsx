import { useEffect, useState, type CSSProperties } from 'react'
import {
  formatClock,
  formatMonthDay,
  formatSeconds,
  formatWeekday,
  moonLitPath,
  moonPhase,
  skyArc,
  skyColor,
} from '../../lib/celestial'

/** 月相圆的半径（SVG 用户单位，viewBox 是 -50 ~ 50） */
const MOON_RADIUS = 46

/** 每秒对一次表：分 / 秒一到就跟着变。挂件只有十来个节点，每秒重渲染一次的开销可以忽略。
    ⚠️ 别改回 `setInterval` —— 后台标签页被节流、Edge 的"睡眠标签页"、电脑睡一觉回来，
    定时器都可能长时间不触发甚至停掉，表现就是"时间停在那一刻，点刷新才对"（用户报过一次）。
    这里用「对齐到整秒的自调度 setTimeout」+ 三个兜底事件，任何一次唤醒都立刻重新对表。 */
const TICK_MS = 1000

/**
 * 桌面上的日月时钟：天空条里的圆盘随时刻走一条弧（6:00 出、18:00 落），
 * 颜色从夜 → 拂晓 → 正午 → 黄昏一路插值（色值全在 tokens.css 的 --c-celestial-*，
 * 这里只把「哪两档 + 混合多少」交给 CSS 的 color-mix）；
 * 入夜换月亮，并按当天日期画月相（lib/celestial.ts 的 moonPhase，八相名 + 照亮百分比）。
 *
 * ⚠️ 2026-10-06（macOS P2）：它现在挂在**顶部菜单栏**里（`variant="compact"`），
 * 不再浮在桌面右上角。两种形态用的是**同一份 DOM 结构与类名**（`.celestial__time` /
 * `__seconds` / `__phase` / `__illum` / `__disc[data-disc]` / `__sky`）——
 * `verify.mjs` 的时钟断言全按这些类名取数，**别在 compact 形态里少渲染任何一个**。
 */
export function CelestialClock({ variant = 'widget' }: { variant?: 'widget' | 'compact' } = {}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    /* 自调度：每跳完一次再排下一次，并且对齐到整秒，所以秒数不会越走越飘 */
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setNow(new Date())
          schedule()
        },
        TICK_MS - (Date.now() % TICK_MS),
      )
    }
    schedule()

    /* 兜底：标签页被节流 / 冻结、从后台切回来、电脑睡醒，都立刻重新对表 */
    const resync = () => setNow(new Date())
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    window.addEventListener('pageshow', resync)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
      window.removeEventListener('pageshow', resync)
    }
  }, [])

  const moon = moonPhase(now)
  const sky = skyColor(now)
  const arc = skyArc(now)
  const clock = formatClock(now)
  const seconds = formatSeconds(now)
  const illumination = Math.round(moon.illumination * 100)

  const style = {
    '--celestial-a': `var(--c-celestial-${sky.from})`,
    '--celestial-b': `var(--c-celestial-${sky.to})`,
    '--celestial-mix': `${sky.weight}%`,
    /* 圆盘在天空条里走弧：左右 17%~83%、高低按正弦。
       这两个区间是照着"44px 的盘子 + 天空条 84px 高"留的边距，改了尺寸记得一起改，
       否则日出日落时圆盘会被天空条裁掉一块 */
    '--celestial-x': `${17 + arc.x * 66}%`,
    '--celestial-y': `${71 - arc.altitude * 42}%`,
  } as CSSProperties

  return (
    <aside
      className={`celestial rounded-window border border-edge bg-surface shadow-2xl${
        variant === 'compact' ? ' celestial--compact' : ''
      }`}
      data-phase={arc.day ? 'day' : 'night'}
      style={style}
      aria-label={`${clock}:${seconds}，${formatMonthDay(now)} ${formatWeekday(now)}，月相${moon.name}，照亮 ${illumination}%`}
    >
      <div className="celestial__sky" aria-hidden="true">
        <div className="celestial__disc" data-disc={arc.day ? 'sun' : 'moon'}>
          {arc.day ? null : (
            <svg className="celestial__moon" viewBox="-50 -50 100 100">
              <circle className="celestial__moonShade" r={MOON_RADIUS} />
              <path className="celestial__moonLit" d={moonLitPath(moon.phase, MOON_RADIUS)} />
            </svg>
          )}
        </div>
      </div>

      <div className="celestial__readout">
        <time className="celestial__time" dateTime={now.toISOString()}>
          {clock}
          {/* 秒单独一层、小一号：一眼能看出表在走，而不是"停住了" */}
          <span className="celestial__seconds">:{seconds}</span>
        </time>
        <p className="celestial__meta">
          {formatMonthDay(now)} {formatWeekday(now)}
        </p>
        <p className="celestial__meta">
          月相 <span className="celestial__phase">{moon.name}</span>
          <span className="celestial__illum">{illumination}%</span>
        </p>
      </div>
    </aside>
  )
}
