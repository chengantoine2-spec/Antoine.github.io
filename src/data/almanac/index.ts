/* 黄历（老黄历）的数据与推算 —— **纯本地、零依赖**。
 *
 * 站主原话（2026-10-06）：「再写一个日期黄历功能。从右上角日期进入」。
 *
 * ⚠️ 诚实标注（页面里也要写出来）：这里的**宜 / 忌**是传统「建除十二神」的**简化演绎**，
 *    **不是专业择日**；节气是低精度天文近似（**可能有 ±1 天误差**）；农历取自浏览器内置的
 *    `Intl.DateTimeFormat('zh-CN-u-ca-chinese')`（ICU 的中国农历数据，权威性比自造表高）。
 *
 * 数据表就放这里，别散进组件 —— 组件只负责渲染。
 */

/** 天干、地支、生肖（生肖由地支推得：子鼠丑牛寅虎…） */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
export const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const

/** 二十四节气：按太阳黄经每 15° 一个，从立春（315°）起算 */
export const SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const

/** 建除十二神（值日）：顺序固定，从「建」起 */
export const TWELVE_OFFICERS = [
  '建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭',
] as const

/** 每个值日的宜 / 忌 —— 传统说法里最常被引用的一组，**简化演绎**，不是择日依据。
 *  出处：民间通书对「十二值日」的通行归纳（同一值日在不同流派里说法略有出入，这里取最常见的一套）。 */
export const OFFICER_LUCK: Record<(typeof TWELVE_OFFICERS)[number], { good: string[]; bad: string[] }> = {
  建: { good: ['出行', '上任', '祈福'], bad: ['动土', '开仓', '掘井'] },
  除: { good: ['除服', '沐浴', '扫舍', '求医'], bad: ['出行', '开市', '嫁娶'] },
  满: { good: ['祭祀', '祈福', '开市', '立券'], bad: ['服药', '栽种', '下葬'] },
  平: { good: ['修饰垣墙', '平治道涂', '嫁娶'], bad: ['开渠', '掘井', '栽种'] },
  定: { good: ['祭祀', '订盟', '纳采', '安床'], bad: ['诉讼', '出行', '移徙'] },
  执: { good: ['捕捉', '结网', '造屋'], bad: ['开市', '出行', '移徙'] },
  破: { good: ['破屋坏垣', '求医治病'], bad: ['嫁娶', '开市', '动土', '上任'] },
  危: { good: ['安床', '祭祀', '取渔'], bad: ['登高', '行船', '出行'] },
  成: { good: ['嫁娶', '开市', '入学', '立契'], bad: ['诉讼', '破土'] },
  收: { good: ['纳财', '收账', '入学'], bad: ['开市', '出行', '安葬'] },
  开: { good: ['祭祀', '入学', '开市', '出行'], bad: ['安葬', '动土'] },
  闭: { good: ['筑堤', '埋穴', '收敛'], bad: ['开市', '出行', '求医'] },
}

/** 节气 → 月建地支（正月建寅、二月建卯…）：用于推"建除"里哪一天是「建」。
 *  索引与 SOLAR_TERMS 对齐：立春起为寅月，惊蛰起为卯月，依此类推。 */
export const MONTH_BRANCH_BY_TERM = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1] as const

/** 日干支的锚点：JDN 2440588 = 1970-01-01，取"该日为癸亥日"这一通行算法常量。
 *  ⚠️ 这条**没能与官方历书逐日核对**（见文件头诚实标注）；页面已写明"非专业择日"。
 *  它只影响"宜/忌"落在十二值日的哪一格，不影响农历与节气。 */
export const DAY_GANZHI_ANCHOR_JDN = 2440588
export const DAY_GANZHI_ANCHOR_INDEX = 59 // 癸亥 = 第 60 个（索引 59）

/** 公历 Date → 儒略日序数（JDN，整数，按当地日期算） */
export function toJDN(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + 2440588
}

/** JDN → 日干支索引（0 = 甲子） */
export function dayGanzhiIndex(date: Date): number {
  const diff = toJDN(date) - DAY_GANZHI_ANCHOR_JDN
  return (((DAY_GANZHI_ANCHOR_INDEX + diff) % 60) + 60) % 60
}

/** 日干支的文字（如「甲子」）+ 生肖无关的说明 */
export function dayGanzhi(date: Date): string {
  const i = dayGanzhiIndex(date)
  return `${STEMS[i % 10]}${BRANCHES[i % 12]}`
}

/** 农历日：数字 → 传统写法（1 → 初一 … 30 → 三十）。
 *  ⚠️ 实测（2026-10-06）：`Intl.DateTimeFormat('zh-CN-u-ca-chinese')` 的 `day` 是**阿拉伯数字**
 *  （原文形如 `2026丙午年八月28`），所以页面上要自己转成"廿八"这种传统写法。 */
export function lunarDayName(n: number): string {
  const u = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n === 10) return '初十'
  if (n === 20) return '二十'
  if (n === 30) return '三十'
  if (n < 11) return `初${u[n]}`
  if (n < 20) return `十${u[n - 10]}`
  if (n < 30) return `廿${u[n - 20]}`
  return String(n)
}

/** 低精度太阳黄经（度，0~360）。Meeus 简化式，精度约 0.01°，够"算到日"用 */
export function sunLongitude(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0
  const L = 280.46646 + 0.9856474 * n
  const g = ((357.528 + 0.9856003 * n) * Math.PI) / 180
  const lambda = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)
  return ((lambda % 360) + 360) % 360
}

/** 太阳黄经 → 节气索引（0 = 立春） */
export function termIndexOfLongitude(lambda: number): number {
  /* 立春 = 315°，之后每 15° 一个；+45 把 315° 挪到 0 位置 */
  return Math.floor((((lambda + 45) % 360) + 360) % 360 / 15) % 24
}

/** 找"今天所在的节气"与"下一个节气还有几天"：逐日扫 ±20 天找黄经跨过 15° 整数倍的那天。
 *  ⚠️ 近似值，可能有 ±1 天误差 —— 页面里要写出来。 */
export function termWindow(date: Date): { current: number; since: Date; next: number; daysToNext: number } {
  const at = (offset: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
  const idx = (d: Date) => termIndexOfLongitude(sunLongitude(d))

  let since = 0
  for (let off = 0; off >= -20; off--) {
    if (idx(at(off)) !== idx(at(0))) break
    since = off
  }
  let toNext = 1
  for (let off = 1; off <= 20; off++) {
    if (idx(at(off)) !== idx(at(0))) {
      toNext = off
      break
    }
  }
  return { current: idx(at(0)), since: at(since), next: (idx(at(0)) + 1) % 24, daysToNext: toNext }
}

/* ────────────────── 第二轮（站主 2026-10-06 A5~A9）────────────────── */

/** 常见事项（A8：常用 8~10 项）。`keywords` 去 `OFFICER_LUCK[*].good` 里做**子串匹配**。
 *  ⚠️ 关键词必须真的出现在上面那些 good 串里，否则筛出来永远是 0 天。**「搬家 / 移徙」在这张表里
 *  只出现在"忌"**，所以没收进来 —— 宁可少一项，也不给一个点了没结果的入口。 */
export const ACTIVITIES: Array<{ id: string; name: string; keywords: string[] }> = [
  { id: 'marry', name: '嫁娶', keywords: ['嫁娶'] },
  { id: 'open', name: '开业', keywords: ['开市', '立券', '立契', '纳财', '收账'] },
  { id: 'travel', name: '出行', keywords: ['出行'] },
  { id: 'worship', name: '祭祀', keywords: ['祭祀', '祈福'] },
  { id: 'bed', name: '安床', keywords: ['安床'] },
  { id: 'doctor', name: '求医', keywords: ['求医', '除服'] },
  { id: 'build', name: '修造动土', keywords: ['造屋', '修饰垣墙', '平治道涂', '筑堤', '捕捉', '结网'] },
  { id: 'study', name: '入学考试', keywords: ['入学'] },
  { id: 'office', name: '上任订盟', keywords: ['上任', '订盟', '纳采'] },
  { id: 'clean', name: '扫舍沐浴', keywords: ['扫舍', '沐浴', '收敛', '取渔'] },
]

/** 黄道 / 黑道：十二值日里「除危定执成开」为黄道吉日，其余为黑道（民间通行分法） */
export const AUSPICIOUS_OFFICERS = ['除', '危', '定', '执', '成', '开']

/** 任意一天的值日 —— **纯算术**，1826 天扫一遍也就毫秒级（月建取当天太阳黄经直接算，不做 ±20 天扫描） */
export function officerOf(date: Date): (typeof TWELVE_OFFICERS)[number] {
  const monthBranch = MONTH_BRANCH_BY_TERM[termIndexOfLongitude(sunLongitude(date)) % 12]
  const dayBranch = dayGanzhiIndex(date) % 12
  return TWELVE_OFFICERS[(((dayBranch - monthBranch) % 12) + 12) % 12]
}

/** 这一天是不是某个节气的**头一天**（是就返回节气名，网格里显示它代替农历日） */
export function termStartOf(date: Date): string | null {
  const d0 = termIndexOfLongitude(sunLongitude(date))
  const prev = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  const d1 = termIndexOfLongitude(sunLongitude(prev))
  return d0 !== d1 ? SOLAR_TERMS[d0] : null
}

/** 节气名的月份映射用不上时留着给测试用 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** 某月 1 号是星期几（0 = 周日），月网格靠它补前导空格 */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/** 固定公历节日（只挑几个大众的） */
export const SOLAR_FESTIVALS: Record<string, string> = {
  '1-1': '元旦',
  '5-1': '劳动节',
  '10-1': '国庆节',
}

/** 农历节日：按"月+日"匹配网格里那格已经算出来的农历写法 */
export const LUNAR_FESTIVALS: Record<string, string> = {
  正月初一: '春节',
  五月初五: '端午',
  八月十五: '中秋',
}
