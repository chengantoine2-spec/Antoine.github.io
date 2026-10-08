import { useMemo } from 'react'
import {
  BRANCHES,
  OFFICER_LUCK,
  SOLAR_TERMS,
  STEMS,
  TWELVE_OFFICERS,
  ZODIAC,
  dayGanzhi,
  dayGanzhiIndex,
  lunarDayName,
  termWindow,
} from '../../data/almanac'

/* 黄历窗口（站主 2026-10-06：「再写一个日期黄历功能。从右上角日期进入」）。
 *
 * ⚠️ 诚实标注（页面上也印出来了，别删）：宜 / 忌 是「建除十二神」的**简化演绎**，不是专业择日；
 *    节气是低精度天文近似（可能有 ±1 天误差）；农历取自浏览器内置 ICU 的中国农历。
 *
 * 版式：单列、正文 ≤ 68ch、颜色只用主题令牌类（浅 / 深两套主题都要能看）。 */

/** 农历：`Intl` 的中国农历（ICU 数据）→ 原始串 + 结构化字段。
 *
 *  ⚠️ **实测原文（2026-10-06，本机）**：`new Intl.DateTimeFormat('zh-CN-u-ca-chinese',
 *  { year:'numeric', month:'long', day:'numeric' }).format(new Date())` → `2026丙午年八月28`。
 *  两个坑：①**日号是阿拉伯数字**（不是"廿八"）；②年号前面带 `relatedYear`（2026）。
 *  所以**别用正则抠整串** —— `formatToParts()` 直接给 `relatedYear` / `yearName` / `month` / `day`
 *  四个结构化字段，稳得多（`yearName` 就是干支年）。 */
function readLunar(now: Date) {
  try {
    const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const raw = fmt.format(now)
    const part = (t: string) => fmt.formatToParts(now).find((x) => x.type === t)?.value ?? ''
    let ganzhiYear = part('yearName')
    const relatedYear = Number(part('relatedYear')) || now.getFullYear()
    if (!ganzhiYear) {
      /* ICU 没给干支年就自己推：公元 4 年 = 甲子（同一个 60 循环） */
      const i = (((relatedYear - 4) % 60) + 60) % 60
      ganzhiYear = `${STEMS[i % 10]}${BRANCHES[i % 12]}`
    }
    const branch = ganzhiYear[1] ?? ''
    const zodIndex = BRANCHES.indexOf(branch as (typeof BRANCHES)[number])
    const month = part('month')
    const dayNum = Number(part('day')) || 0
    return {
      raw,
      ganzhiYear,
      zodiac: zodIndex >= 0 ? ZODIAC[zodIndex] : '',
      month,
      day: dayNum ? lunarDayName(dayNum) : '',
      ok: !!ganzhiYear && !!month && dayNum > 0,
    }
  } catch {
    /* 拿不到农历就只显示公历（浏览器不支持 u-ca-chinese 时走这里） */
    return { raw: '', ganzhiYear: '', zodiac: '', month: '', day: '', ok: false }
  }
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function yearDays(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function AlmanacWindow() {
  const now = useMemo(() => new Date(), [])
  const lunar = useMemo(() => readLunar(now), [now])
  const term = useMemo(() => termWindow(now), [now])

  const officer = useMemo(() => {
    /* 建除：日支与月建（节气月）同支即「建」，其余顺推十二神 */
    const monthBranch = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1][term.current % 12]
    const dayBranch = dayGanzhiIndex(now) % 12
    return TWELVE_OFFICERS[(((dayBranch - monthBranch) % 12) + 12) % 12]
  }, [now, term.current])

  const luck = OFFICER_LUCK[officer]
  const doy = dayOfYear(now)
  const dLeft = yearDays(now.getFullYear()) - doy

  const card = 'rounded-window border border-edge bg-surface-2 p-4'
  const label = 'text-xs text-dim'
  const value = 'text-ink'

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto text-sm text-ink">
      {/* 今日 */}
      <section className={card}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-semibold">
            {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日
          </h2>
          <span className="text-dim">星期{WEEK[now.getDay()]}</span>
        </div>
        <p className="mt-2">
          {lunar.ok ? (
            <>
              <span className="font-medium">
                农历 {lunar.month}
                {lunar.day}
              </span>
              <span className="text-dim">
                {' '}
                · {lunar.ganzhiYear}年 · 属{lunar.zodiac}
              </span>
            </>
          ) : (
            <span className="text-dim">农历：这台浏览器的 Intl 拿不到中国农历，暂只显示公历</span>
          )}
        </p>
        {lunar.ok && <p className="mt-1 text-xs text-dim">（浏览器农历原文：{lunar.raw}）</p>}
      </section>

      {/* 节气 */}
      <section className={card}>
        <h3 className="mb-2 font-medium">节气</h3>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className={label}>当前节气</dt>
          <dd className={value}>
            {SOLAR_TERMS[term.current]}
            <span className="text-dim">
              （{term.since.getMonth() + 1}/{term.since.getDate()} 起）
            </span>
          </dd>
          <dt className={label}>下一个</dt>
          <dd className={value}>
            {SOLAR_TERMS[term.next]}
            <span className="text-dim"> · 还有 {term.daysToNext} 天</span>
          </dd>
        </dl>
        <p className="mt-2 text-xs text-dim">
          节气用的是低精度天文近似（太阳黄经每 15° 一个），**可能有 ±1 天误差**。
        </p>
      </section>

      {/* 宜忌 */}
      <section className={card}>
        <h3 className="mb-2 font-medium">
          今日宜忌
          <span className="ml-2 text-xs font-normal text-dim">
            值日：{officer}日 · 日干支 {dayGanzhi(now)}
          </span>
        </h3>
        <dl className="grid gap-y-1">
          <dt className="text-accent-ink">宜</dt>
          <dd>{luck.good.join(' · ')}</dd>
          <dt className="mt-1 text-dim">忌</dt>
          <dd className="text-dim">{luck.bad.join(' · ')}</dd>
        </dl>
        <p className="mt-3 text-xs text-dim">
          ⚠️ 宜忌按传统「建除十二神」简化演绎得出，**仅供消遣，不是专业择日**；不同流派说法本来就不一致。
        </p>
      </section>

      {/* 实用信息 */}
      <section className={card}>
        <h3 className="mb-2 font-medium">今日数字</h3>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className={label}>今年第几天</dt>
          <dd className={value}>
            第 {doy} 天 <span className="text-dim">（还剩 {dLeft} 天）</span>
          </dd>
          <dt className={label}>第几周</dt>
          <dd className={value}>第 {isoWeek(now)} 周</dd>
          <dt className={label}>天干地支</dt>
          <dd className={value}>
            {STEMS[dayGanzhiIndex(now) % 10]}
            {BRANCHES[dayGanzhiIndex(now) % 12]}日
          </dd>
          <dt className={label}>闰年</dt>
          <dd className={value}>{yearDays(now.getFullYear()) === 366 ? '是' : '否'}</dd>
        </dl>
      </section>
    </div>
  )
}
