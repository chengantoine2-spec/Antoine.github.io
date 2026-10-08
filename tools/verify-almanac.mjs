/* 黄历窗口专属校验（npm run verify:almanac）—— 复用 DSH 那份 Playwright，不把 playwright 装进本项目。
 *
 * 第一轮 6 条：入口可点 / 真点击开窗 / 路由一致 / 农历格式合理 / 节气宜忌有内容 / 无运行时错误。
 * 第二轮 5 条（站主 A5~A9）：月网格天数对得上 / 翻月翻年且范围夹在 ±2 年 / 点某天详情跟着变 /
 *                            回到今天 / 吉日筛选非空且结果确实"宜该事"。
 *
 * ⚠️ 与 tools/verify.mjs 分开：那份归主管、常被别人改动，这份只钉黄历。 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const candidates = [
  process.env.PLAYWRIGHT_PKG,
  join(homedir(), '.dsh/profiles/web/node_modules/playwright'),
  'playwright',
].filter(Boolean)

let chromium
for (const id of candidates) {
  try {
    ;({ chromium } = require(id))
    break
  } catch {
    /* 试下一个 */
  }
}
if (!chromium) {
  console.error('[verify:almanac] 找不到 playwright。装一个，或设 PLAYWRIGHT_PKG 指向它。')
  process.exit(1)
}

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const CLOCK = '[data-menubar] button[aria-label="黄历"]'
const WIN = 'section[aria-label="黄历 窗口"]'
const ROOT = '[data-almanac-root]'

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log('  PASS  ' + name + (detail ? '  — ' + detail : ''))
  } else {
    fail += 1
    console.log('  x FAIL  ' + name + (detail ? '  — ' + detail : ''))
  }
}

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(BASE + '/', { waitUntil: 'load' })
await page.evaluate(() => localStorage.removeItem('desktop.openWindows'))
/* 注意：别用固定 sleep 等启动 —— 桌面挂载偶尔要 1s 以上（实测有次 600ms 还没挂上，连菜单栏都抓不到、整份断言全红，属假红）。显式等元素出现。 */
await page.goto(BASE + '/', { waitUntil: 'load' })
await page.waitForSelector(CLOCK, { timeout: 15000 })

const clock = await page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { tag: el.tagName.toLowerCase(), x: r.x + r.width / 2, y: r.y + r.height / 2 }
}, CLOCK)
check('右上角日期是一枚可点的按钮（不是死文字）', clock?.tag === 'button', JSON.stringify(clock))
if (clock) await page.mouse.click(clock.x, clock.y)
await page.waitForTimeout(600)
check('点右上角日期 → 黄历窗口真的打开了', await page.evaluate((s) => !!document.querySelector(s), WIN))
check('窗口能被路由到（/almanac）', (await page.evaluate(() => location.pathname)) === '/almanac')

const viewOf = () => page.getAttribute(ROOT + ' [data-almanac-view], ' + ROOT, 'data-almanac-view').catch(() => null)
async function readView() {
  return page.evaluate((s) => document.querySelector(s + ' [data-almanac-view]')?.getAttribute('data-almanac-view') ?? '', ROOT)
}
async function readDetail() {
  return page.evaluate((s) => document.querySelector(s)?.getAttribute('data-almanac-detail') ?? '', ROOT + ' [data-almanac-detail]')
}
async function gridCount() {
  return page.locator(ROOT + ' [data-almanac-day]').count()
}

/* ── 第一轮那三条内容断言 ── */
const text = await page.evaluate((s) => document.querySelector(s)?.innerText ?? '', WIN)
const lunarOk =
  /农历\s*闰?[正一二三四五六七八九十冬腊0-9]{1,3}月/.test(text) && /月\s*((初|十|廿|三)[一二三四五六七八九十]?|\d{1,2})/.test(text)
check('农历字段非空且格式合理（干支年 + 月 + 日）', lunarOk && /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]年/.test(text))
const termOk = /(立春|雨水|惊蛰|春分|清明|谷雨|立夏|小满|芒种|夏至|小暑|大暑|立秋|处暑|白露|秋分|寒露|霜降|立冬|小雪|大雪|冬至|小寒|大寒)/.test(text)
const luckOk = /宜/.test(text) && /忌/.test(text) && /(建|除|满|平|定|执|破|危|成|收|开|闭)日/.test(text)
check('节气与宜忌字段都有内容', termOk && luckOk)

/* ── ② 月网格天数对得上（只渲染当月） ── */
let view = await readView()
let [vy, vm] = view.split('-').map(Number)
let expectDays = new Date(vy, vm, 0).getDate()
let got = await gridCount()
check(
  '月网格渲染出当月天数（只渲染当月）',
  got === expectDays && got >= 28 && got <= 31,
  'view=' + view + ' 期望 ' + expectDays + ' 格 / 实得 ' + got,
)

/* ── ③ 翻月 / 翻年，且范围夹在 ±2 年 ── */
const today = new Date()
const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
const nextM = new Date(today.getFullYear(), today.getMonth() + 1, 1)
await page.click(ROOT + ' button[aria-label="下一月"]')
await page.waitForTimeout(200)
const afterNext = await readView()
const gridNext = await gridCount()
const expectNext = new Date(nextM.getFullYear(), nextM.getMonth() + 1, 0).getDate()
await page.click(ROOT + ' button[aria-label="上一年"]')
await page.waitForTimeout(200)
const afterYear = await readView()
check(
  '翻月 / 翻年后网格跟着变',
  afterNext === ym(nextM) && gridNext === expectNext && afterYear.startsWith(String(today.getFullYear() - 1)),
  '下一月→' + afterNext + '(' + gridNext + '格) 上一年→' + afterYear,
)
const range = await page.evaluate((s) => document.querySelector(s + ' [data-almanac-range]')?.getAttribute('data-almanac-range') ?? '', ROOT)
check(
  '范围是今天前后各 2 年（共 5 年）',
  range === today.getFullYear() - 2 + '-' + (today.getFullYear() + 2),
  range,
)
/* 连点到底：⚠️ 到达下界后按钮会真的 disabled，再点 Playwright 会一直等（TimeoutError），所以禁用就停 */
for (let i = 0; i < 40; i++) {
  if (await page.locator(ROOT + ' button[aria-label="上一月"]').isDisabled()) break
  await page.click(ROOT + ' button[aria-label="上一月"]')
  await page.waitForTimeout(30)
}
await page.waitForTimeout(250)
const clamped = await readView()
const prevDisabled = await page.locator(ROOT + ' button[aria-label="上一月"]').isDisabled()
check(
  '连点上一月会被夹在下界（±2 年），并禁用上一月',
  clamped === ym(new Date(today.getFullYear() - 2, today.getMonth(), 1)) && prevDisabled,
  clamped + ' disabled=' + prevDisabled,
)

/* ── ④ 点某天 → 详情跟着变；回到今天 ── */
await page.click(ROOT + ' button[aria-label="回到今天"]')
await page.waitForTimeout(200)
const backView = await readView()
const backDetail = await readDetail()
check('「回到今天」回到今天的月份与今天', backView === ym(today) && backDetail === today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate(), backView + ' / ' + backDetail)

const day15 = await page.evaluate((s) => {
  const b = document.querySelector(s + ' [data-almanac-day="15"]')
  b?.click()
  return b ? b.getAttribute('data-almanac-date') : null
}, ROOT)
await page.waitForTimeout(250)
const d15 = await readDetail()
check('点 15 号 → 详情跟着变成那天', !!day15 && d15 === day15, (day15 ?? '?') + ' → ' + d15)

/* ── ⑤ 吉日筛选：非空 + 结果确实"宜该事" ── */
await page.click(ROOT + ' button[aria-label="吉日筛选"]')
await page.waitForTimeout(200)
await page.click(ROOT + ' button[aria-label="事项：嫁娶"]')
await page.waitForTimeout(400)
const total = Number(await page.getAttribute(ROOT + ' [data-almanac-total]', 'data-almanac-total'))
const hits = await page.evaluate(
  (s) => [...document.querySelectorAll(s + ' [data-almanac-hit]')].slice(0, 3).map((b) => b.getAttribute('data-almanac-hit')),
  ROOT,
)
check('按事项筛选「嫁娶」返回非空结果', total > 0 && hits.length > 0, '共 ' + total + ' 天，首页 ' + hits.length + ' 条：' + hits.join(', '))

let allGood = true
const seen = []
for (const h of hits) {
  await page.click(ROOT + ' button[aria-label="吉日筛选"]')
  await page.waitForTimeout(150)
  await page.click(ROOT + ' [data-almanac-hit="' + h + '"]')
  await page.waitForTimeout(250)
  const detail = await page.evaluate((s) => document.querySelector(s)?.innerText ?? '', ROOT + ' [data-almanac-detail]')
  const ok = /宜/.test(detail) && /嫁娶/.test(detail) && (await readDetail()) === h
  if (!ok) allGood = false
  seen.push(h + (ok ? '✓' : '✗'))
}
check('筛选结果里的日子确实都标了该事项为「宜」（点进去复核）', allGood && hits.length > 0, seen.join(' '))

check('没有未捕获的运行时错误', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 160))

await browser.close()
console.log('\n' + pass + '/' + (pass + fail) + ' 通过')
process.exit(fail === 0 ? 0 : 1)
