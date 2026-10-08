import { useMemo, useState } from 'react'
import {
  ACTIVITIES,
  AUSPICIOUS_OFFICERS,
  BRANCHES,
  LUNAR_FESTIVALS,
  OFFICER_LUCK,
  SOLAR_FESTIVALS,
  SOLAR_TERMS,
  STEMS,
  ZODIAC,
  dayGanzhi,
  daysInMonth,
  firstWeekday,
  lunarDayName,
  officerOf,
  termStartOf,
  termWindow,
} from '../../data/almanac'

/* 黄历窗口（第一轮：站主 2026-10-06「从右上角日期进入」；第二轮 A5~A9：月网格 + 翻年月 + 回到今天 + 按事项筛吉日）
 *
 * ⚠️ **诚实标注不许删**：宜 / 忌 是「建除十二神」的**简化演绎**，不是专业择日；
 *    节气是低精度天文近似（**可能有 ±1 天误差**）；农历取自浏览器内置 ICU 的中国农历。
 *
 * ⚠️ 性能（A5）：范围是**前后各 2 年 = 5 年 ≈ 1826 天**，但
 *    ① 月网格**只算当月**，绝不把 5 年渲染进 DOM；② 吉日筛选是**纯算术**扫 1826 天（毫秒级），结果**分页**。
 *
 * 版式：颜色只用主题令牌类（浅 / 深两套都要能看）。 */

const PAGE_SIZE = 20
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function key(d: Date) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}

/** 农历：Intl 的中国农历（ICU）→ 原始串 + 结构化字段。
 *  ⚠️ 实测（2026-10-06）：zh-CN-u-ca-chinese 输出形如 2026丙午年八月28 —— **日号是阿拉伯数字**，
 *  所以别用正则抠整串，直接 formatToParts 取 yearName / month / day。 */
function readLunar(date: Date) {
  try {
    const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' })
    const raw = fmt.format(date)
    const part = (t: string) => fmt.formatToParts(date).find((x) => x.type === t)?.value ?? ''
    let ganzhiYear = part('yearName')
    const relatedYear = Number(part('relatedYear')) || date.getFullYear()
    if (!ganzhiYear) {
      const i = (((relatedYear - 4) % 60) + 60) % 60
      ganzhiYear = STEMS[i % 10] + BRANCHES[i % 12]
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
    return { raw: '', ganzhiYear: '', zodiac: '', month: '', day: '', ok: false }
  }
}

function dayOfYear(d: Date) {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1
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

export function AlmanacWindow() {
  const today = useMemo(() => startOfDay(new Date()), [])
  /* A5：前后各 2 年（共 5 年）—— 范围只用来夹住翻月翻年与筛吉日 */
  const min = useMemo(() => new Date(today.getFullYear() - 2, today.getMonth(), 1), [today])
  const max = useMemo(() => new Date(today.getFullYear() + 2, today.getMonth(), 1), [today])

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState<Date>(today)
  const [tab, setTab] = useState<'day' | 'fortune'>('day')
  const [actId, setActId] = useState(ACTIVITIES[0].id)
  const [page, setPage] = useState(1)

  const atMin = view.y === min.getFullYear() && view.m === min.getMonth()
  const atMax = view.y === max.getFullYear() && view.m === max.getMonth()

  /* ⚠️ 必须用**函数式** setView：连点翻月时 React 会把同一批事件合起来处理，
     读闭包里的 `view` 会让 30 次点击只前进 1 个月（实测：点 30 次只走了 6 个月）。
     函数式更新每次都基于最新状态算，连点才能真正一格格走。 */
  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return d < min || d > max ? v : { y: d.getFullYear(), m: d.getMonth() }
    })
  }
  function shiftYear(delta: number) {
    setView((v) => {
      const d = new Date(v.y + delta, v.m, 1)
      return d < min || d > max ? v : { y: d.getFullYear(), m: d.getMonth() }
    })
  }
  function goToday() {
    setView({ y: today.getFullYear(), m: today.getMonth() })
    setSelected(today)
    setTab('day')
  }

  /* 当月网格：只算这一个月 */
  const monthDays = useMemo(() => {
    const n = daysInMonth(view.y, view.m)
    const lead = firstWeekday(view.y, view.m)
    return { n, lead, cells: Array.from({ length: lead + n }, (_, i) => (i < lead ? null : i - lead + 1)) }
  }, [view.y, view.m])

  /* 吉日筛选：纯算术扫 5 年，结果分页 */
  const fortune = useMemo(() => {
    const act = ACTIVITIES.find((a) => a.id === actId) ?? ACTIVITIES[0]
    const out: Date[] = []
    const end = new Date(max.getFullYear(), max.getMonth() + 1, 0)
    for (let d = new Date(min); d <= end; d = addDays(d, 1)) {
      const good = OFFICER_LUCK[officerOf(d)].good
      if (act.keywords.some((k) => good.some((g) => g.includes(k)))) out.push(new Date(d))
    }
    return out
  }, [actId, min, max])
  const totalPages = Math.max(1, Math.ceil(fortune.length / PAGE_SIZE))
  const pageRows = fortune.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const lunar = useMemo(() => readLunar(selected), [selected])
  const term = useMemo(() => termWindow(selected), [selected])
  const officer = useMemo(() => officerOf(selected), [selected])
  const luck = OFFICER_LUCK[officer]

  const card = 'rounded-window border border-edge bg-surface-2 p-3'
  const label = 'text-xs text-dim'
  const btn = 'rounded border border-edge px-2 py-0.5 text-xs hover:bg-[var(--c-control-hover)] disabled:opacity-40'

  return (
    <div data-almanac-root="" className="flex h-full flex-col gap-3 overflow-auto text-sm text-ink">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="上一年" className={btn} onClick={() => shiftYear(-1)}>
          «
        </button>
        <button type="button" aria-label="上一月" className={btn} disabled={atMin} onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <span
          data-almanac-view={view.y + '-' + String(view.m + 1).padStart(2, '0')}
          data-almanac-range={min.getFullYear() + '-' + max.getFullYear()}
          className="min-w-[7.5rem] text-center font-medium"
        >
          {view.y} 年 {view.m + 1} 月
        </span>
        <button type="button" aria-label="下一月" className={btn} disabled={atMax} onClick={() => shiftMonth(1)}>
          ›
        </button>
        <button type="button" aria-label="下一年" className={btn} onClick={() => shiftYear(1)}>
          »
        </button>
        <button type="button" aria-label="回到今天" className={btn} onClick={goToday}>
          回到今天
        </button>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            aria-label="今日详情"
            aria-pressed={tab === 'day'}
            className={btn + (tab === 'day' ? ' bg-accent text-accent-ink' : '')}
            onClick={() => setTab('day')}
          >
            今日详情
          </button>
          <button
            type="button"
            aria-label="吉日筛选"
            aria-pressed={tab === 'fortune'}
            className={btn + (tab === 'fortune' ? ' bg-accent text-accent-ink' : '')}
            onClick={() => setTab('fortune')}
          >
            吉日筛选
          </button>
        </span>
      </div>

      <section className={card}>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-dim">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthDays.cells.map((day, i) => {
            if (day === null) return <span key={'b' + i} />
            const date = new Date(view.y, view.m, day)
            const isToday = key(date) === key(today)
            const isSel = key(date) === key(selected)
            const l = readLunar(date)
            const term0 = termStartOf(date)
            const festival = SOLAR_FESTIVALS[date.getMonth() + 1 + '-' + day] ?? LUNAR_FESTIVALS[l.month + l.day]
            const off = officerOf(date)
            const good = AUSPICIOUS_OFFICERS.indexOf(off) >= 0
            return (
              <button
                key={key(date)}
                type="button"
                data-almanac-day={day}
                data-almanac-date={key(date)}
                aria-label={date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + day + '日'}
                onClick={() => {
                  setSelected(date)
                  setTab('day')
                }}
                className={
                  'flex h-12 flex-col items-center justify-center rounded border text-center ' +
                  (isSel ? 'border-accent bg-accent text-accent-ink' : 'border-edge') +
                  (isToday && !isSel ? ' outline outline-1 outline-accent' : '')
                }
              >
                <span className="text-[13px] font-medium">{day}</span>
                <span className="truncate text-[10px] text-dim" style={{ maxWidth: '4.5rem' }}>
                  {term0 ?? festival ?? l.day}
                </span>
                {good && <span className="text-[9px] leading-none text-accent-ink">吉</span>}
              </button>
            )
          })}
        </div>
      </section>

      {tab === 'day' ? (
        <section className={card} data-almanac-detail={key(selected)}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-semibold">
              {selected.getFullYear()} 年 {selected.getMonth() + 1} 月 {selected.getDate()} 日
            </h2>
            <span className="text-dim">星期{WEEK[selected.getDay()]}</span>
            <span className="text-xs text-dim">
              {officer}日 · {AUSPICIOUS_OFFICERS.indexOf(officer) >= 0 ? '黄道吉日' : '黑道日'}
            </span>
          </div>
          <p className="mt-1">
            {lunar.ok ? (
              <>
                <span className="font-medium">
                  农历 {lunar.month}
                  {lunar.day}
                </span>
                <span className="text-dim">
                  {' '}
                  · {lunar.ganzhiYear}年 · 属{lunar.zodiac} · 日干支 {dayGanzhi(selected)}
                </span>
              </>
            ) : (
              <span className="text-dim">农历：这台浏览器的 Intl 拿不到中国农历，暂只显示公历</span>
            )}
          </p>
          {lunar.ok && <p className="mt-0.5 text-xs text-dim">（浏览器农历原文：{lunar.raw}）</p>}
          <dl className="mt-2 grid grid-cols-2 gap-y-1">
            <dt className={label}>当前节气</dt>
            <dd>
              {SOLAR_TERMS[term.current]}
              <span className="text-dim">
                （{term.since.getMonth() + 1}/{term.since.getDate()} 起 · 下一个 {SOLAR_TERMS[term.next]} 还有{' '}
                {term.daysToNext} 天）
              </span>
            </dd>
            <dt className={label}>宜</dt>
            <dd className="text-accent-ink">{luck.good.join(' · ')}</dd>
            <dt className={label}>忌</dt>
            <dd className="text-dim">{luck.bad.join(' · ')}</dd>
            <dt className={label}>今年第几天</dt>
            <dd>
              第 {dayOfYear(selected)} 天{' '}
              <span className="text-dim">
                （第 {isoWeek(selected)} 周 · 还剩 {yearDays(selected.getFullYear()) - dayOfYear(selected)} 天）
              </span>
            </dd>
            <dt className={label}>闰年</dt>
            <dd>{yearDays(selected.getFullYear()) === 366 ? '是' : '否'}</dd>
          </dl>
          <p className="mt-2 text-xs text-dim">
            ⚠️ 节气用的是低精度天文近似（太阳黄经每 15° 一个），**可能有 ±1 天误差**；宜忌按传统「建除十二神」简化演绎，
            **仅供消遣，不是专业择日**（不同流派说法本来就不一致）。
          </p>
        </section>
      ) : (
        <section className={card}>
          <div className="flex flex-wrap gap-1">
            {ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={'事项：' + a.name}
                aria-pressed={a.id === actId}
                className={btn + (a.id === actId ? ' bg-accent text-accent-ink' : '')}
                onClick={() => {
                  setActId(a.id)
                  setPage(1)
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim" data-almanac-total={fortune.length}>
            范围 {min.getFullYear()}/{min.getMonth() + 1} ~ {max.getFullYear()}/{max.getMonth() + 1} 共 5 年 · 宜「
            {ACTIVITIES.find((a) => a.id === actId)?.name}」的日子：**{fortune.length} 天**（第 {page}/{totalPages} 页）
          </p>
          <ul className="mt-2 divide-y divide-edge">
            {pageRows.map((d) => (
              <li key={key(d)}>
                <button
                  type="button"
                  data-almanac-hit={key(d)}
                  className="flex w-full items-baseline gap-2 py-1 text-left hover:bg-[var(--c-control-hover)]"
                  onClick={() => {
                    setSelected(d)
                    setView({ y: d.getFullYear(), m: d.getMonth() })
                    setTab('day')
                  }}
                >
                  <span className="font-medium">
                    {d.getFullYear()}-{String(d.getMonth() + 1).padStart(2, '0')}-{String(d.getDate()).padStart(2, '0')}
                  </span>
                  <span className="text-dim">
                    农历{readLunar(d).month}
                    {readLunar(d).day} · {officerOf(d)}日 · 宜 {OFFICER_LUCK[officerOf(d)].good.slice(0, 3).join('、')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="上一页"
              className={btn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="text-xs text-dim">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="下一页"
              className={btn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </div>
          <p className="mt-2 text-xs text-dim">
            ⚠️ 筛选结果同样是「建除十二神」的**简化演绎**，不是专业择日；只按值日的传统宜项匹配，**不查冲煞、不看主事人生辰**。
          </p>
        </section>
      )}

      <p className="pb-1 text-xs text-dim">
        范围限定在**今天前后各 2 年**（共 5 年，约 1826 天）；月网格只算当月、筛选结果分页 —— 不把 5 年一次性塞进页面。
      </p>
    </div>
  )
}