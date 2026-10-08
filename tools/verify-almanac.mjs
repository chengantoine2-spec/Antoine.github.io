/* 黄历窗口专属校验（`npm run verify:almanac`）—— 复用 DSH 那份 Playwright，不把 playwright 装进本项目。
 *
 * 五条：
 *  ① 点**右上角日期**（菜单栏里那枚时钟）能真的打开黄历窗口 —— 真实点击，不是"元素存在"；
 *  ② 农历字段非空且格式合理（干支年 + 月 + 日）；
 *  ③ 节气与宜忌字段有内容；
 *  ④ 窗口能被路由到（路径与登记表一致）；
 *  ⑤ 打开前后没有未捕获的运行时错误。
 *
 * ⚠️ 与 `tools/verify.mjs` 分开：那份归主管、常被别人改动，这份只钉黄历。 */
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

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`)
  } else {
    fail += 1
    console.log(`  × FAIL  ${name}${detail ? `  — ${detail}` : ''}`)
  }
}

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(`${BASE}/`, { waitUntil: 'load' })
await page.evaluate(() => localStorage.removeItem('desktop.openWindows'))
await page.goto(`${BASE}/`, { waitUntil: 'load' })
await page.waitForTimeout(600)

/* ① 入口：右上角日期是**菜单栏里的一枚按钮**，点它要真的开窗 */
const clock = await page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { tag: el.tagName.toLowerCase(), x: r.x + r.width / 2, y: r.y + r.height / 2, w: Math.round(r.width) }
}, CLOCK)
check('右上角日期是一枚可点的按钮（不是死文字）', clock?.tag === 'button', JSON.stringify(clock))

if (clock) await page.mouse.click(clock.x, clock.y)
await page.waitForTimeout(600)
const opened = await page.evaluate((sel) => !!document.querySelector(sel), WIN)
check('点右上角日期 → 黄历窗口真的打开了', opened)

/* ④ 路由一致（登记表里 path = /almanac） */
const path = await page.evaluate(() => location.pathname)
check('窗口能被路由到（/almanac）', path === '/almanac', path)

/* ②③ 内容 */
const text = await page.evaluate((sel) => document.querySelector(sel)?.innerText ?? '', WIN)
const lunarOk =
  /农历\s*闰?[正一二三四五六七八九十冬腊0-9]{1,3}月/.test(text) &&
  /月\s*((初|十|廿|三)[一二三四五六七八九十]?|\d{1,2})/.test(text)
const ganzhiOk = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]年/.test(text)
check('农历字段非空且格式合理（干支年 + 月 + 日）', lunarOk && ganzhiOk, text.split('\n').slice(0, 4).join(' / '))

const termOk = /(立春|雨水|惊蛰|春分|清明|谷雨|立夏|小满|芒种|夏至|小暑|大暑|立秋|处暑|白露|秋分|寒露|霜降|立冬|小雪|大雪|冬至|小寒|大寒)/.test(text)
const luckOk = /宜/.test(text) && /忌/.test(text) && /(建|除|满|平|定|执|破|危|成|收|开|闭)日/.test(text)
check('节气与宜忌字段都有内容', termOk && luckOk, termOk ? '节气 ✓ / 宜忌 ✓' : '缺节气或宜忌')

check('没有未捕获的运行时错误', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 160))

await browser.close()
console.log(`\n${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
