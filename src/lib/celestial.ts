/* 天象：桌面上的日月时钟（components/desktop/CelestialClock.tsx）用的纯函数。
   只求"够看"的近似 —— 太阳按 6:00 升、18:00 落走一条正弦弧；月相用会合月周期推算，
   误差远小于"看个大概"的需要（拿 4 次真实日月食校过，见 tools/verify.mjs 的检查）。
   颜色一律不写死：这里只回"哪两档、混合多少"，色值在 tokens.css 的 --c-celestial-* */

/** 会合月（朔望月）长度，单位：天 */
const SYNODIC_MONTH = 29.530588853

/** 参考新月：2000-01-06 18:14 UTC（天文计算常用历元） */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)

const DAY_MS = 86_400_000

/** 八个相，从新月起按"盈"的顺序排 */
export const MOON_PHASE_NAMES = [
  '新月',
  '蛾眉月',
  '上弦月',
  '盈凸月',
  '满月',
  '亏凸月',
  '下弦月',
  '残月',
] as const

export type MoonPhaseName = (typeof MOON_PHASE_NAMES)[number]

/** 一天里的颜色锚点：0 点最暗、6 点拂晓、12 点正午、18 点黄昏，然后回到夜 */
export type SkyStop = 'night' | 'dawn' | 'noon' | 'dusk'

export interface MoonPhase {
  /** 0 = 新月，0.25 = 上弦，0.5 = 满月，0.75 = 下弦 */
  phase: number
  /** 最接近的八相序号（对应 MOON_PHASE_NAMES） */
  index: number
  name: MoonPhaseName
  /** 被照亮的比例 0~1 */
  illumination: number
  /** 盈（渐圆）还是亏（渐缺） */
  waxing: boolean
}

export interface SkyColor {
  from: SkyStop
  to: SkyStop
  /** from 这一档占的比例（0~100），直接当 color-mix 里的 A 权重用 */
  weight: number
}

export interface SkyArc {
  /** 0 = 左端，1 = 右端 */
  x: number
  /** 0 = 贴着地平线，1 = 最高 */
  altitude: number
  /** 白昼（太阳）还是夜晚（月亮） */
  day: boolean
}

const SKY_STOPS: Array<{ at: number; stop: SkyStop }> = [
  { at: 0, stop: 'night' },
  { at: 6, stop: 'dawn' },
  { at: 12, stop: 'noon' },
  { at: 18, stop: 'dusk' },
  { at: 24, stop: 'night' },
]

/** 一天里的进度，0 ~ 1（含秒，所以颜色是连续变的） */
export function dayFraction(date: Date): number {
  return (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400
}

/** 当前小时（带小数） */
export function hourOf(date: Date): number {
  return dayFraction(date) * 24
}

/** 按当前时刻取「相邻两档颜色 + 混合比例」—— 交给 CSS 的 color-mix 出最终色 */
export function skyColor(date: Date): SkyColor {
  const hour = hourOf(date)
  for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
    const from = SKY_STOPS[i]
    const to = SKY_STOPS[i + 1]
    /* 上界取开区间：整点（比如 6:00）落在下一段，颜色不会在整点跳一下 */
    if (hour >= from.at && hour < to.at) {
      const progress = (hour - from.at) / (to.at - from.at)
      return {
        from: from.stop,
        to: to.stop,
        /* 越接近 to 越小：18:30 该是"八成黄昏 + 两成夜"，不是反过来的两成黄昏 */
        weight: Math.round((1 - progress) * 100),
      }
    }
  }
  return { from: 'night', to: 'night', weight: 100 }
}

/** 太阳 6:00 出、18:00 落；夜里换成月亮，同一条弧线（18:00 出、6:00 落） */
export function skyArc(date: Date): SkyArc {
  const hour = hourOf(date)
  const day = hour >= 6 && hour < 18
  const t = day ? (hour - 6) / 12 : ((hour + 6) % 24) / 12
  return { x: t, altitude: Math.sin(Math.PI * t), day }
}

/** 当前月相：会合月周期推算，返回相位、八相名与被照亮比例 */
export function moonPhase(date: Date): MoonPhase {
  const days = (date.getTime() - NEW_MOON_EPOCH) / DAY_MS
  const phase = (((days / SYNODIC_MONTH) % 1) + 1) % 1
  /* 离哪个相更近就算哪个相（0.0625 是新月的边界） */
  const index = Math.floor(phase * 8 + 0.5) % 8
  return {
    phase,
    index,
    name: MOON_PHASE_NAMES[index],
    illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2,
    waxing: phase < 0.5,
  }
}

/**
 * 月亮被照亮那一块的路径（给 SVG 用，坐标系原点在月心、y 向下）。
 * 形状 = 外缘半圆 + 明暗界线（一条椭圆弧）：
 * 界线椭圆的 x 半轴是 `r·|cos(2πp)|`，弧往亮面那边鼓就是月牙、往暗面那边鼓就是凸月，
 * 两个 sweep 标志就是这么定的（八相都渲染出来逐个看过）。
 */
export function moonLitPath(phase: number, radius: number): string {
  const p = ((phase % 1) + 1) % 1
  const x = Math.cos(2 * Math.PI * p) * radius
  const rx = Math.abs(x)
  const waxing = p < 0.5
  const limbSweep = waxing ? 1 : 0
  const terminatorSweep = waxing ? (x > 0 ? 0 : 1) : x > 0 ? 1 : 0
  return [
    `M 0 ${-radius}`,
    `A ${radius} ${radius} 0 0 ${limbSweep} 0 ${radius}`,
    `A ${rx} ${radius} 0 0 ${terminatorSweep} 0 ${-radius}`,
    'Z',
  ].join(' ')
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function formatWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()]
}
