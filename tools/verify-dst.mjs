/**
 * 饥荒 Wiki 的数据校验（独立于主管的 tools/verify.mjs，只管这个窗口的数据）。
 *
 * 为什么需要一个独立脚本：
 * 条目之间的引用只存 id（配方材料、related、掉落物），**页面本身不会因为引用写错而报错** ——
 * 它只会安静地少渲染一个按钮。所以引用完整性必须单独验，不能指望冒烟测试顺手覆盖。
 *
 * 为什么走浏览器而不是直接读 .ts：
 * 数据文件是 Vite 风格的免扩展名 import，Node 直接跑不起来；
 * 而 dev server 已经能解析 TS，所以借它一把 —— 这也是主管 verify.mjs 的既有做法。
 *
 * 用法（需要 dev server 已在跑）：
 *   npm run dev                 # 另一个终端
 *   node tools/verify-dst.mjs   # 或 npm run verify:dst
 *
 * 想换 playwright 位置就设 PLAYWRIGHT_PKG，与 verify.mjs 一致。
 */
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
  console.error('[dst-verify] 找不到 playwright。请先安装，或设 PLAYWRIGHT_PKG 指向它。')
  process.exit(1)
}

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

const results = []
function check(name, ok, detail = '') {
  results.push(ok)
  console.log(`${ok ? '  PASS' : '× FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))

  await page.goto(`${BASE}/wiki`, { waitUntil: 'load' })
  await page.waitForSelector('input[aria-label="搜索 Wiki 条目"]', { timeout: 15000 })
  /* 等拼音索引补完：这一步决定「首字母能不能搜」，也是数据量偏大时最慢的一步 */
  await page.waitForFunction(
    () => {
      const nodes = [...document.querySelectorAll('.wiki__feed p')]
      return nodes.some((p) => (p.textContent ?? '').includes('拼音检索已就绪'))
    },
    { timeout: 15000 },
  )

  /* ── 1. 引用完整性：在页面里对数据做一次全量核对 ──
     通过窗口暴露出来的 DOM 拿不到原始数据，所以这里用一个技巧：
     把每个 id 都搜一遍，看它能不能被"反查"出来 —— 更直接的做法是校验 DOM 里的按钮数，
     但最可靠的还是直接问模块。这里用动态 import 把数据模块取出来做静态校验。 */
  const integrity = await page.evaluate(async () => {
    const mod = await import('/src/data/dst/index.ts')
    const ids = new Set(mod.DST_ENTRIES.map((e) => e.id))
    const dupes = []
    const seen = new Set()
    for (const e of mod.DST_ENTRIES) {
      if (seen.has(e.id)) dupes.push(e.id)
      seen.add(e.id)
    }
    const dangling = []
    for (const r of mod.RECIPES) {
      if (!ids.has(r.output)) dangling.push(`产出 ${r.output}`)
      for (const i of r.ingredients) if (!ids.has(i.id)) dangling.push(`材料 ${i.id}（用于 ${r.output}）`)
    }
    for (const e of mod.DST_ENTRIES) {
      for (const rel of e.related ?? []) if (!ids.has(rel)) dangling.push(`related ${rel}（来自 ${e.id}）`)
    }
    const byCategory = {}
    for (const e of mod.DST_ENTRIES) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1
    /* 每条都必须有摘要、正文、别名 —— 缺了它们在页面上就是空白卡片 */
    const incomplete = mod.DST_ENTRIES.filter(
      (e) => !e.summary || !e.body?.length || !e.aliases?.length,
    ).map((e) => e.id)
    return {
      entries: mod.DST_ENTRIES.length,
      recipes: mod.RECIPES.length,
      dupes,
      dangling: [...new Set(dangling)],
      byCategory,
      incomplete,
      emptyIds: mod.DST_ENTRIES.filter((e) => !e.id || !e.name).length,
    }
  })

  check('条目与配方数量正常', integrity.entries >= 50 && integrity.recipes >= 20,
    `${integrity.entries} 条 / ${integrity.recipes} 配方`)
  check('没有重复 id', integrity.dupes.length === 0, integrity.dupes.join(', ') || '无')
  check('没有悬空引用（配方材料 / related 全部能解析）', integrity.dangling.length === 0,
    integrity.dangling.slice(0, 5).join(' | ') || '无')
  check('每个分类都有条目', Object.keys(integrity.byCategory).length >= 4,
    JSON.stringify(integrity.byCategory))
  check('条目字段完整（摘要 / 正文 / 别名）', integrity.incomplete.length === 0,
    integrity.incomplete.slice(0, 5).join(', ') || '无')
  check('id 与 name 都不为空', integrity.emptyIds === 0)

  /* ── 2. 拼音与首字母检索：正例 + 反例 ── */
  const search = await page.evaluate(async () => {
    const input = document.querySelector('input[aria-label="搜索 Wiki 条目"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const run = async (q) => {
      setter.call(input, q)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 90))
      return [...document.querySelectorAll('.wiki__feed li button')].map((b) =>
        (b.textContent ?? '').trim(),
      )
    }
    const first = async (q) => (await run(q))[0] ?? ''
    const out = {
      initialsGoldenAxe: await first('jft'),
      fullGoldenAxe: await first('jinfutou'),
      initialsWilson: await first('wex'),
      initialsHamBat: await first('htb'),
      english: await first('wx78'),
      chinese: await first('金斧头'),
      alias: await first('大力士'),
      nonsense: (await run('zzzz')).length,
      nonsense2: (await run('qqqq')).length,
    }
    await run('')
    return out
  })

  check('首字母检索：jft → 金斧头', search.initialsGoldenAxe.includes('金斧头'), search.initialsGoldenAxe.slice(0, 14))
  check('全拼检索：jinfutou → 金斧头', search.fullGoldenAxe.includes('金斧头'), search.fullGoldenAxe.slice(0, 14))
  check('首字母检索：wex → 威尔逊', search.initialsWilson.includes('威尔逊'), search.initialsWilson.slice(0, 14))
  check('首字母检索：htb → 火腿棒', search.initialsHamBat.includes('火腿棒'), search.initialsHamBat.slice(0, 14))
  check('英文名检索：wx78 → WX-78', search.english.includes('WX-78'), search.english.slice(0, 14))
  check('中文检索：金斧头', search.chinese.includes('金斧头'), search.chinese.slice(0, 14))
  check('别名检索：大力士 → 沃尔夫冈', search.alias.includes('沃尔夫冈'), search.alias.slice(0, 14))
  check('无意义查询不假命中（拼接串边界回归）', search.nonsense === 0 && search.nonsense2 === 0,
    `zzzz=${search.nonsense} qqqq=${search.nonsense2}`)

  /* ── 3. 配方反查：详情页要真的把「怎么做 / 用在哪」渲染出来 ── */
  const reverse = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const searchInput = () => document.querySelector('input[aria-label="搜索 Wiki 条目"]')
    /* ⚠️ 卡片选择器必须限定在 .wiki__feed 里：
       左栏的分类按钮也是 `li button`，用全局限定符会先点到左栏去（这里踩过一次） */
    const cards = () => [...document.querySelectorAll('.wiki__feed li button')]

    const type = async (q) => {
      const input = searchInput()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, q)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(150)
    }
    const openFirst = async (q) => {
      await type(q)
      cards()[0]?.click()
      await wait(250)
      const feed = document.querySelector('.wiki__feed')
      const headings = [...feed.querySelectorAll('section h3')].map((h) => h.textContent.trim())
      /* 每个配方渲染成一个 li：用 li 数而不是数「×数量」——
         「作为材料用于」那栏渲染的是产出（斧头、镐子…），本来就不带数量 */
      const recipeRows = [...feed.querySelectorAll('section')]
        .filter((s) => s.querySelector('h3')?.textContent?.includes('制作配方') ||
          s.querySelector('h3')?.textContent?.includes('作为材料用于'))
        .reduce((sum, s) => sum + s.querySelectorAll('li').length, 0)
      const text = feed.textContent ?? ''
      /* 返回列表：详情页第一个按钮就是「← 全部条目」，等它把列表渲染回来 */
      feed.querySelector('button')?.click()
      await wait(200)
      return { headings, text, recipeRows, cardCount: cards().length }
    }

    const goldenAxe = await openFirst('jft')
    const flint = await openFirst('燧石')
    return {
      goldenAxeHeadings: goldenAxe.headings,
      goldenAxeHasStation: goldenAxe.text.includes('科学机器'),
      goldenAxeLeaksRawId: /\b(none|science|alchemy|shadow|lunar|ancient)\b/.test(goldenAxe.text),
      goldenAxeRows: goldenAxe.recipeRows,
      flintHeadings: flint.headings,
      flintRows: flint.recipeRows,
      flintCards: flint.cardCount,
      flintUsedBySix: flint.text.includes('斧头') && flint.text.includes('保温石'),
    }
  })

  check('有配方的条目显示「制作配方」', reverse.goldenAxeHeadings.includes('制作配方'),
    reverse.goldenAxeHeadings.join(' / '))
  check('站台显示中文名而不是原始 id', reverse.goldenAxeHasStation && !reverse.goldenAxeLeaksRawId,
    `中文=${reverse.goldenAxeHasStation} 泄漏=${reverse.goldenAxeLeaksRawId}`)
  check('材料类条目显示「作为材料用于」，且列出了引用它的配方',
    reverse.flintHeadings.includes('作为材料用于') && reverse.flintRows >= 5 && reverse.flintUsedBySix,
    `标题=${reverse.flintHeadings.join('/')} 配方行=${reverse.flintRows} 金斧头配方行=${reverse.goldenAxeRows}`)

  /* ── 4. 教程区：标签分流必须生效 ── */
  const guideTab = await page.evaluate(async () => {
    const tabs = [...document.querySelectorAll('.wiki [role="tab"]')]
    const guide = tabs.find((b) => (b.textContent ?? '').includes('新手教程'))
    if (!guide) return { found: false }
    guide.click()
    await new Promise((r) => setTimeout(r, 600))
    const dataTab = [...document.querySelectorAll('.wiki [role="tab"]')].find((b) =>
      (b.textContent ?? '').includes('资料'),
    )
    const hasGuideSearch = !!document.querySelector('input[aria-label="搜索 Wiki 教程"]')
    const hint = [...document.querySelectorAll('.wiki__feed p')]
      .map((p) => p.textContent.trim())
      .find((t) => t.length > 10)
    const aside = [...document.querySelectorAll('.wiki__aside h3')].map((h) => h.textContent.trim())
    dataTab?.click()
    await new Promise((r) => setTimeout(r, 200))
    const backToData = !!document.querySelector('input[aria-label="搜索 Wiki 条目"]')
    return { found: true, hasGuideSearch, hint: (hint ?? '').slice(0, 50), aside, backToData }
  })

  check('教程区可以切进去，并有独立搜索框', guideTab.found && guideTab.hasGuideSearch,
    JSON.stringify({ found: guideTab.found, search: guideTab.hasGuideSearch }))
  check('教程区有「教程从哪来」的说明', (guideTab.aside ?? []).includes('教程从哪来'),
    (guideTab.aside ?? []).join(' / '))
  check('能切回资料区', guideTab.backToData === true)

  check('无未捕获的运行时错误', errors.length === 0, errors.join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} 通过`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error(`[dst-verify] 运行失败：${error.message}`)
  process.exit(1)
})
