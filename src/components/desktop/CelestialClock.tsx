import { useEffect, useState, type CSSProperties } from 'react'
import {
  formatClock,
  formatMonthDay,
  formatWeekday,
  moonLitPath,
  moonPhase,
  skyArc,
  skyColor,
} from '../../lib/celestial'

/** 月相圆的半径（SVG 用户单位，viewBox 是 -50 ~ 50） */
const MOON_RADIUS = 46

/** 每 20 秒对一次表：颜色是连续变的，秒级刷新没人看得出来，省点电 */
const TICK_MS = 20_000

/**
 * 桌面上的日月时钟：天空条里的圆盘随时刻走一条弧（6:00 出、18:00 落），
 * 颜色从夜 → 拂晓 → 正午 → 黄昏一路插值（色值全在 tokens.css 的 --c-celestial-*，
 * 这里只把「哪两档 + 混合多少」交给 CSS 的 color-mix）；
 * 入夜换月亮，并按当天日期画月相（lib/celestial.ts 的 moonPhase，八相名 + 照亮百分比）。
 */
export function CelestialClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, TICK_MS)
    /* 电脑睡了一觉回来时立刻校准，别让时间停在睡前 */
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const moon = moonPhase(now)
  const sky = skyColor(now)
  const arc = skyArc(now)
  const clock = formatClock(now)
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
      className="celestial rounded-window border border-edge bg-surface shadow-2xl"
      data-phase={arc.day ? 'day' : 'night'}
      style={style}
      aria-label={`${clock}，${formatMonthDay(now)} ${formatWeekday(now)}，月相${moon.name}，照亮 ${illumination}%`}
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
