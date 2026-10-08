/**
 * 「塔罗牌」窗口的专属校验（独立于主管的 tools/verify.mjs，只管这个窗口）。
 *
 * 为什么必须单独验：
 * 1. **78 张牌图是外部素材拷进来的**。少一张、命名错一个字母、映射张冠李戴，
 *    页面都不会报错 —— 只会在翻开某张牌时显示一个空框或另一张牌。
 *    所以这里把 78 个地址**逐个 fetch 一遍**，并且核对"牌 ↔ 图"是不是一一对应。
 * 2. 抽牌逻辑（洗牌 / 不重复 / 正逆位 / 种子可复现）是纯计算，冒烟测试点不出来，
 *    直接动态 import 模块验更靠谱。
 *
 * 用法（需要 dev server 已在跑）：
 *   npm run dev                    # 另一个终端
 *   node tools/verify-tarot.mjs    # 或 npm run verify:tarot
 *   换地址：node tools/verify-tarot.mjs http://127.0.0.1:5173
 *
 * 想换 playwright 位置就设 PLAYWRIGHT_PKG，与 verify.mjs / verify-dst.mjs 一致。
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
  console.error('[tarot-verify] 找不到 playwright。请先安装，或设 PLAYWRIGHT_PKG 指向它。')
  process.exit(1)
}

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

const results = []
function check(name, ok, detail = '') {
  results.push(ok)
  console.log(`${ok ? '  PASS' : '× FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
/** 只提示、不计入通过率：确实是问题但不该拦住交付的（比如上游给的一张图小一号） */
function warn(name, detail = '') {
  console.log(`  WARN  ${name}${detail ? `  — ${detail}` : ''}`)
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  /* 全新 context = 干净的 localStorage：不吃上一次跑留下的会话记忆与占卜记录 */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))

  await page.goto(`${BASE}/tarot`, { waitUntil: 'load' })
  await page.waitForSelector('.tarot__spread', { timeout: 20000 })

  /* ── 1. 数据层：牌表自身对不对 ── */
  const data = await page.evaluate(async () => {
    const mod = await import('/src/data/tarot/index.ts')
    const spreads = await import('/src/data/tarot/spreads.ts')
    const draw = await import('/src/lib/tarot/draw.ts')
    const cards = mod.CARDS
    const ids = cards.map((c) => c.id)
    const bySuit = (s) => cards.filter((c) => c.suit === s).length
    const emptyField = cards.filter(
      (c) => !c.nameZh || !c.nameEn || !c.upright || !c.reversed || !c.description,
    )
    const badRank = cards
      .filter((c) => c.arcana === 'minor')
      .filter((c) => !(c.rank >= 1 && c.rank <= 14) || !c.suit)

    return {
      total: cards.length,
      uniqueIds: new Set(ids).size,
      majors: cards.filter((c) => c.arcana === 'major').length,
      suits: { wands: bySuit('wands'), cups: bySuit('cups'), swords: bySuit('swords'), pents: bySuit('pents') },
      emptyField: emptyField.map((c) => c.id),
      badRank: badRank.map((c) => c.id),
      imageSrcs: cards.map((c) => mod.cardImageSrc(c)),
      spreads: spreads.SPREADS.map((s) => ({ id: s.id, n: s.positions.length })),
      pending: spreads.PENDING_SPREADS.length,
      /* 抽牌逻辑：不重复 + 种子可复现 */
      drawProbe: (() => {
        const spread = spreads.SPREADS.find((s) => s.id === 'celtic-cross')
        const a = draw.drawReading({ spread, seed: 12345, at: 1 }).reading
        const b = draw.drawReading({ spread, seed: 12345, at: 1 }).reading
        const c = draw.drawReading({ spread, seed: 999, at: 1 }).reading
        const key = (r) => r.cards.map((x) => `${x.card.id}:${x.reversed ? 'R' : 'U'}`).join(',')
        return {
          n: a.cards.length,
          distinct: new Set(a.cards.map((x) => x.card.id)).size,
          reproducible: key(a) === key(b),
          differentSeedDiffers: key(a) !== key(c),
        }
      })(),
    }
  })

  check('牌表正好 78 张', data.total === 78, `实测 ${data.total}`)
  check('牌 id 无重复', data.uniqueIds === 78, `唯一 ${data.uniqueIds}`)
  check(
    '大阿卡纳 22 张',
    data.majors === 22,
    `实测 ${data.majors}`,
  )
  check(
    '四个花色各 14 张',
    data.suits.wands === 14 && data.suits.cups === 14 && data.suits.swords === 14 && data.suits.pents === 14,
    JSON.stringify(data.suits),
  )
  check('每张牌的名/正逆位/描述都不为空', data.emptyField.length === 0, data.emptyField.join(','))
  check('小阿卡纳的花色与点数都合法（1~14）', data.badRank.length === 0, data.badRank.join(','))
  /* ⚠️ **原断言 → 新断言**：原来是「三个牌阵，张数与定义一致」+ 写死 `length === 3`。
     2026-10-06 站主要求扩充牌阵（3 → 8 个，覆盖不同场景），写死 3 会立刻红，
     所以改成「6~8 个 + 每个牌阵的张数逐个点名」—— 以后再加牌阵不必改这条，
     而某个牌阵张数写错了照样会被点名报出来。 */
  const EXPECT_POSITIONS = {
    three: 3,
    'holy-triangle': 3,
    'celtic-cross': 10,
    daily: 1,
    'two-choice': 5,
    relation: 5,
    'four-elements': 4,
    week: 7,
  }
  const wrongCounts = data.spreads
    .filter((s) => EXPECT_POSITIONS[s.id] !== s.n)
    .map((s) => `${s.id}=${s.n}（应为 ${EXPECT_POSITIONS[s.id]}）`)
  check(
    '牌阵 6~8 个，每个的张数与定义一致（含新增的 5 个）',
    data.spreads.length >= 6 && data.spreads.length <= 8 && wrongCounts.length === 0,
    `${data.spreads.length} 个 · ${JSON.stringify(data.spreads)}${wrongCounts.length ? ' · 张数不对：' + wrongCounts.join('、') : ''}`,
  )
  check('待接入牌阵也列出来了（不是 0 个）', data.pending > 0, `${data.pending} 个`)
  check(
    '抽牌：张数对、互不重复、同种子可复现、换种子会变',
    data.drawProbe.n === 10 &&
      data.drawProbe.distinct === 10 &&
      data.drawProbe.reproducible &&
      data.drawProbe.differentSeedDiffers,
    JSON.stringify(data.drawProbe),
  )

  /* ── 2. 素材层：78 张牌图是不是都在、都能解码、比例对不对 ──
     ⚠️ 这一条**抓不到"映射张冠李戴"**（图都在、名字也对，只是内容配错了牌）——
     那种错只能靠肉眼比对牌面上印的牌名，详见 docs/tarot.md 第三节。
     它能抓的是：少一张、多一张、名字错一个字母、文件坏了、比例不对（会毁掉牌阵排版）。 */
  const imageProbe = await page.evaluate(async (srcs) => {
    const bad = []
    const oddSize = []
    let totalBytes = 0
    const RATIO = 350 / 600
    for (const src of srcs) {
      try {
        const res = await fetch(src)
        if (!res.ok) {
          bad.push(`${src}: HTTP ${res.status}`)
          continue
        }
        const blob = await res.blob()
        totalBytes += blob.size
        /* 真解码一次：只判 200 抓不到"文件在但是坏图" */
        const bmp = await createImageBitmap(blob).catch(() => null)
        if (!bmp) {
          bad.push(`${src}: 解码失败`)
          continue
        }
        /* 牌阵布局是按 350:600 算的，比例不对会被裁掉一块 */
        const ratio = bmp.width / bmp.height
        if (Math.abs(ratio - RATIO) > 0.01)
          bad.push(`${src}: 比例 ${ratio.toFixed(3)} ≠ ${RATIO.toFixed(3)}`)
        /* 牌在界面上最宽约 152px，源图至少得有 200px 宽才够看 */
        if (bmp.width < 200) bad.push(`${src}: 太小 ${bmp.width}x${bmp.height}`)
        if (bmp.width !== 350 || bmp.height !== 600) oddSize.push(`${bmp.width}x${bmp.height}`)
      } catch (e) {
        bad.push(`${src}: ${e.message}`)
      }
    }
    return { bad, oddSize, totalBytes, count: srcs.length }
  }, data.imageSrcs)

  check(
    `78 张牌图全部可取、能解码、比例正确（实测 ${imageProbe.count} 个，共 ${(imageProbe.totalBytes / 1048576).toFixed(1)} MB）`,
    imageProbe.bad.length === 0,
    imageProbe.bad.slice(0, 5).join(' | '),
  )
  /* 不判失败，只报出来：上游有一张是 224×384 的小图（Pents10），
     比例对、在界面上也够看，但值得知道 —— 哪天要换素材时顺手补一张正尺寸的 */
  if (imageProbe.oddSize.length) {
    warn(
      `有 ${imageProbe.oddSize.length} 张牌图不是 350×600`,
      `${[...new Set(imageProbe.oddSize)].join(', ')}（比例仍对，不影响排版）`,
    )
  }

  /* ── 3. 界面：选牌阵 → 抽牌 → 逐张翻开 → 出解读 ── */
  /* 同上一条：原来写死 3 个按钮，现在按数据算并落在 6~8 的范围里 */
  const spreadButtons = await page.locator('.tarot__spread').count()
  check(
    '牌阵选择区列出全部牌阵（6~8 个，与数据一致）',
    spreadButtons === data.spreads.length && spreadButtons >= 6 && spreadButtons <= 8,
    `${spreadButtons} 个按钮 / 数据 ${data.spreads.length} 个`,
  )

  await page.locator('.tarot__spread[data-spread="celtic-cross"]').click()
  check(
    '选中的牌阵有按下态（aria-pressed）',
    (await page.locator('.tarot__spread[data-spread="celtic-cross"]').getAttribute('aria-pressed')) === 'true',
  )

  await page.fill('#tarot-question', '这份工作要不要换？')
  await page.locator('.tarot__primary').click()
  await page.waitForSelector('.tarot-card', { timeout: 15000 })

  const afterDraw = await page.evaluate(() => ({
    cards: document.querySelectorAll('.tarot-card').length,
    faceDown: document.querySelectorAll('.tarot-card[data-revealed="false"]').length,
    /* 没翻开的牌是 button（可点），翻开之后退回 div —— 这是可点性的判据 */
    buttons: document.querySelectorAll('button.tarot-card').length,
    reading: document.querySelectorAll('.tarot-reading__item').length,
    notes: !!document.querySelector('.tarot-reading__notes'),
    ordinals: [...document.querySelectorAll('.tarot-card__ordinal')].map((n) => n.textContent),
    questionShown: (document.querySelector('.tarot-reading__question')?.textContent ?? '').includes(
      '这份工作要不要换',
    ),
  }))

  check('凯尔特牌阵抽出 10 张牌', afterDraw.cards === 10, `实测 ${afterDraw.cards}`)
  check('刚抽完 10 张全是背面', afterDraw.faceDown === 10, `背面 ${afterDraw.faceDown}`)
  check('没翻开的牌都是可点的按钮', afterDraw.buttons === 10, `可点 ${afterDraw.buttons}`)
  check('没翻开时解读栏是空的', afterDraw.reading === 0, `条目 ${afterDraw.reading}`)
  check('没翻完不给整体构成（不剧透）', afterDraw.notes === false)
  check('牌上有 1~10 的序号角标', afterDraw.ordinals.join(',') === '1,2,3,4,5,6,7,8,9,10', afterDraw.ordinals.join(','))
  check('问题显示在解读栏里', afterDraw.questionShown === true)

  /* 翻开第 3 张（现状/根基那个位置），断言"翻的那张"和"解读那一条"对得上 */
  await page.locator('.tarot-card').nth(2).click()
  await page.waitForTimeout(900)
  const oneOpen = await page.evaluate(() => ({
    revealed: document.querySelectorAll('.tarot-card[data-revealed="true"]').length,
    third: document.querySelectorAll('.tarot-card')[2].getAttribute('data-revealed'),
    reading: document.querySelectorAll('.tarot-reading__item').length,
    ordinal: document.querySelector('.tarot-reading__ordinal')?.textContent,
    headline: document.querySelector('.tarot-reading__item p')?.textContent ?? '',
    /* 牌面图片真的加载出来了吗（naturalWidth > 0 才算） */
    imgOk: [...document.querySelectorAll('.tarot-card[data-revealed="true"] img')].every(
      (im) => im.complete && im.naturalWidth > 0,
    ),
  }))

  check('只翻开了点的那一张', oneOpen.revealed === 1 && oneOpen.third === 'true', JSON.stringify(oneOpen))
  check('解读栏正好多出一条', oneOpen.reading === 1, `条目 ${oneOpen.reading}`)
  check('解读条目的序号与牌上的序号一致', oneOpen.ordinal === '3', `序号 ${oneOpen.ordinal}`)
  check('解读条目写的是第 3 个位置（根基）', oneOpen.headline.includes('根基'), oneOpen.headline)
  check('翻开的牌图真的加载出来了', oneOpen.imgOk === true)

  await page.getByRole('button', { name: '全部翻开' }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('.tarot-card[data-revealed="false"]').length === 0,
    { timeout: 15000 },
  )
  const allOpen = await page.evaluate(() => ({
    reading: document.querySelectorAll('.tarot-reading__item').length,
    notes: !!document.querySelector('.tarot-reading__notes'),
    noteCount: document.querySelectorAll('.tarot-reading__notes li').length,
    /* 逆位是靠把图片转 180° 表达的，所以"转了没转"必须两种都存在过才算这套逻辑活着 */
    rotated: document.querySelectorAll('.tarot-card__art--reversed').length,
    allImgOk: [...document.querySelectorAll('.tarot-card img')].every(
      (im) => im.complete && im.naturalWidth > 0,
    ),
    revealDisabled: document.querySelector('.tarot__ghost')?.disabled,
  }))

  check('全翻开后 10 条解读都在', allOpen.reading === 10, `条目 ${allOpen.reading}`)
  check('全翻开后给整体构成', allOpen.notes === true && allOpen.noteCount >= 3, `${allOpen.noteCount} 条`)
  check('开完「全部翻开」自动置灰', allOpen.revealDisabled === true)
  check('10 张牌图全部加载成功', allOpen.allImgOk === true, `逆位 ${allOpen.rotated} 张`)

  /* 牌面与文字必须说同一件事：图片转了 180° ⟺ 解读栏写"逆位"。
     两边各算一次那个布尔的话，就会出"牌是倒的、文字说正位"这种对不上的情况。
     顺带核对**图片文件名对应的是哪张牌**（牌 id → 名字由 cards.json 决定，不在这里重算）。 */
  const consistency = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.tarot-card')]
    const items = [...document.querySelectorAll('.tarot-reading__item')]
    const bad = []
    for (let i = 0; i < cards.length; i++) {
      const imgRotated = !!cards[i].querySelector('.tarot-card__art--reversed')
      const text = items[i]?.querySelector('p')?.textContent ?? ''
      const textReversed = text.includes('逆位')
      const src = (cards[i].querySelector('img')?.getAttribute('src') ?? '').split('/').pop() ?? ''
      if (imgRotated !== textReversed) bad.push(`#${i + 1} 图${imgRotated ? '倒' : '正'}/文${textReversed ? '逆' : '正'}`)
      if (!src) bad.push(`#${i + 1} 没有图片`)
    }
    return { bad, cards: cards.length, items: items.length }
  })
  check(
    '10 张牌的"正/逆位"图与文完全一致',
    consistency.bad.length === 0 && consistency.cards === consistency.items,
    consistency.bad.join(' | '),
  )

  /* ── 4. 记录落在本地 ── */
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('desktop.tarot')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { rows: parsed.history?.length ?? 0, cards: parsed.history?.[0]?.cards?.length ?? 0 }
  })
  check('占卜记录写进了 desktop.tarot', stored !== null && stored.rows >= 1, JSON.stringify(stored))
  check('记录里存了这次抽的 10 张牌', stored?.cards === 10, JSON.stringify(stored))

  /* 回到选择页，历史列表里应该能看到刚才那一把 */
  await page.getByRole('button', { name: '换个牌阵' }).click()
  await page.waitForSelector('.tarot__spread', { timeout: 10000 })
  const historyShown = await page.evaluate(() => ({
    rows: document.querySelectorAll('.tarot__history').length,
    text: document.querySelector('.tarot__history')?.textContent ?? '',
  }))
  check('选择页列出了刚才那一把', historyShown.rows >= 1, `${historyShown.rows} 条`)
  check('历史条目带着问题', historyShown.text.includes('这份工作要不要换'), historyShown.text.slice(0, 40))

  /* ── 「想问什么」的例子：日常小事 + 按时段分桶 + 随时间轮换（站主 2026-10-06） ── */
  const hints = await page.evaluate(async () => {
    const q = await import('/src/data/tarot/questions.ts')
    const at = (h, m = 0) => new Date(2026, 9, 6, h, m, 0, 0)
    const textAt = (h) => q.pickQuestion(at(h)).text
    const all = q.QUESTION_BUCKETS.flatMap((b) => b.questions)
    const list = q.questionBucketForHour(14).questions
    const t0 = at(14, 0)
    const t1 = new Date(t0.getTime() + q.QUESTION_ROTATE_MS)
    const t2 = new Date(t0.getTime() + q.QUESTION_ROTATE_MS * list.length)
    return {
      total: q.questionTotal(),
      buckets: q.QUESTION_BUCKETS.map((b) => ({ id: b.id, name: b.name, n: b.questions.length })),
      unique: new Set(all).size,
      hourMap: [1, 7, 10, 14, 18, 23].map((h) => ({ h, bucket: q.questionBucketForHour(h).id })),
      crossBucket: [textAt(7), textAt(14), textAt(23)],
      rotateMs: q.QUESTION_ROTATE_MS,
      sameBucket: { a: q.pickQuestion(t0).text, b: q.pickQuestion(t1).text, cycle: q.pickQuestion(t2).text },
    }
  })
  check(
    '「想问什么」的例子够多（≥30 条，五个时段各 ≥5 条）',
    hints.total >= 30 && hints.buckets.every((b) => b.n >= 5),
    `${hints.total} 条 / ${hints.buckets.map((b) => b.name + b.n).join(' ')}`,
  )
  check('例子互不重复（同一句不会出现在两个时段）', hints.unique === hints.total, `${hints.unique}/${hints.total}`)
  check(
    '按小时分桶：清晨 / 午后 / 深夜各归各的时段（含跨零点那桶）',
    hints.hourMap.find((x) => x.h === 7)?.bucket === 'dawn' &&
      hints.hourMap.find((x) => x.h === 14)?.bucket === 'afternoon' &&
      hints.hourMap.find((x) => x.h === 1)?.bucket === 'night' &&
      hints.hourMap.find((x) => x.h === 23)?.bucket === 'night',
    JSON.stringify(hints.hourMap),
  )
  check('不同时段取到的例子不一样', new Set(hints.crossBucket).size === 3, hints.crossBucket.join(' | '))
  check(
    `同一时段内每 ${hints.rotateMs / 1000} 秒换一条（一个循环后回到原句）`,
    hints.sameBucket.a !== hints.sameBucket.b && hints.sameBucket.a === hints.sameBucket.cycle,
    `${hints.sameBucket.a} → ${hints.sameBucket.b}`,
  )

  const hintUi = await page.evaluate(() => {
    const input = document.querySelector('#tarot-question')
    const hint = document.querySelector('[data-tarot-hint]')
    return {
      placeholder: input?.getAttribute('placeholder') ?? '',
      hint: (hint?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      bucket: hint?.getAttribute('data-bucket') ?? '',
    }
  })
  check(
    '占位文案已经换成新例子（不再是旧的「这份工作要不要换」）',
    hintUi.placeholder.length > 4 && hintUi.placeholder !== '例如：这份工作要不要换？',
    hintUi.placeholder,
  )
  check('提示行标出当前时段与轮换周期', hintUi.hint.includes('秒') && hintUi.bucket.length > 0, hintUi.hint)

  /* 真等一个周期：证明走时是活的（不是只在打开时算一次） */
  await page.waitForTimeout(hints.rotateMs + 1500)
  const placeholderAfter = await page.evaluate(
    () => document.querySelector('#tarot-question')?.getAttribute('placeholder') ?? '',
  )
  check(
    `等一个周期（${hints.rotateMs / 1000}s）后占位真的会变`,
    placeholderAfter !== hintUi.placeholder,
    `${hintUi.placeholder} → ${placeholderAfter}`,
  )

  /* ── 牌阵扩充（2026-10-06，站主）：新牌阵逐个验「能被选中 / 牌位数 / 抽满 / 能渲染」 ── */
  const spreadInfo = await page.evaluate(async () => {
    const m = await import('/src/data/tarot/spreads.ts')
    return {
      spreads: m.SPREADS.map((s) => ({
        id: s.id,
        name: s.name,
        n: s.positions.length,
        purpose: s.purpose,
        labels: s.positions.map((p) => p.label),
        hints: s.positions.map((p) => p.hint),
      })),
      pending: m.PENDING_SPREADS.map((p) => p.name),
    }
  })
  const NEW_IDS = ['daily', 'two-choice', 'relation', 'four-elements', 'week']
  const newOnes = spreadInfo.spreads.filter((s) => NEW_IDS.includes(s.id))
  check('五个新牌阵都在数据里', newOnes.length === 5, newOnes.map((s) => `${s.id}:${s.n}张`).join(' '))
  check(
    '每个新牌阵都有中文名 / 用途 / 牌位名 / 牌位说明',
    newOnes.every(
      (s) =>
        s.name.length >= 2 &&
        s.purpose.length >= 10 &&
        s.labels.every((l) => typeof l === 'string' && l.length >= 2) &&
        s.hints.every((h) => typeof h === 'string' && h.length >= 8),
    ),
    newOnes.map((s) => `${s.id}[${s.labels.join('/')}]`).join(' '),
  )
  check(
    '同一牌阵里牌位名不重复（不会出现两个「现状」）',
    newOnes.every((s) => new Set(s.labels).size === s.labels.length),
  )
  check(
    '做出来的牌阵不再挂在「待接入」里',
    !newOnes.some((s) => spreadInfo.pending.includes(s.name)),
    `待接入还剩 ${spreadInfo.pending.length} 个`,
  )

  /* 逐个选中：按钮在、按下态对、「共 N 张牌」跟着变 */
  const pickProblems = []
  for (const s of newOnes) {
    const btn = page.locator(`.tarot__spread[data-spread="${s.id}"]`)
    if ((await btn.count()) !== 1) {
      pickProblems.push(`${s.id} 没有按钮`)
      continue
    }
    await btn.click()
    if ((await btn.getAttribute('aria-pressed')) !== 'true') pickProblems.push(`${s.id} 没有按下态`)
    const setupText = (await page.locator('.tarot__setup').innerText()).replace(/\s+/g, ' ')
    if (!setupText.includes(`共 ${s.n} 张牌`)) pickProblems.push(`${s.id} 张数文案不是 ${s.n}`)
  }
  check('每个新牌阵都能被选中，且「共 N 张牌」跟着变', pickProblems.length === 0, pickProblems.join('；') || '5 个都对')

  /* 挑一个抽满一趟（二选一 5 张）：牌数、翻牌、解读按牌位出 */
  const pick5 = spreadInfo.spreads.find((s) => s.id === 'two-choice')
  await page.locator('.tarot__spread[data-spread="two-choice"]').click()
  await page.locator('.tarot__primary').click()
  await page.waitForSelector('.tarot-card', { timeout: 15000 })
  const drawn5 = await page.locator('.tarot-card').count()
  for (let i = 0; i < drawn5; i++) await page.locator('.tarot-card').nth(i).click()
  await page.waitForTimeout(1200)
  const read5 = await page.evaluate(() => ({
    revealed: document.querySelectorAll('.tarot-card[data-revealed="true"]').length,
    items: document.querySelectorAll('.tarot-reading__item').length,
    text: document.querySelector('.tarot-reading')?.textContent ?? '',
  }))
  check('新牌阵抽满：二选一 5 张', drawn5 === 5, `实测 ${drawn5} 张`)
  check(
    '5 张全翻开，解读栏按 5 个牌位出条目（牌位名都出现）',
    read5.revealed === 5 && read5.items === 5 && pick5.labels.every((l) => read5.text.includes(l)),
    `翻开 ${read5.revealed} / 条目 ${read5.items}`,
  )

  /* ── 旧记录兼容：注入一条老牌阵的旧记录 + 一条"牌阵已被删掉"的旧记录 ──
     前者要按中文名显示（证明 spreadId 仍然认得），后者不许把页面弄崩
     （spreadOfId 找不到时回退显示原始 id）。历史结构没动过，所以只验"读得回来"。 */
  await page.evaluate(() => {
    const cards = ['Fool', 'Magician', 'High_Priestess', 'Empress', 'Emperor'].map((id, i) => ({
      id,
      reversed: i % 2 === 1,
    }))
    localStorage.setItem(
      'desktop.tarot',
      JSON.stringify({
        history: [
          { at: 1759600000000, seed: 12345, spreadId: 'legacy-removed-spread', question: '牌阵已下线的旧记录', cards },
          { at: 1759500000000, seed: 999, spreadId: 'celtic-cross', question: '老牌阵的旧记录', cards },
        ],
      }),
    )
  })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.tarot__spread', { timeout: 20000 })
  /* ⚠️ `.tarot__history` 是**每一行按钮本身**（`<button className="tarot__history">`），
     不是容器 —— 用 querySelector 只会读到第一行（我第一版就是这么写错的：
     第二条旧记录明明渲染了却"看不见"）。这里取全部行拼起来。 */
  const legacy = await page.evaluate(() => ({
    text: [...document.querySelectorAll('.tarot__history')]
      .map((el) => el.textContent ?? '')
      .join(' | ')
      .replace(/\s+/g, ' '),
    rows: document.querySelectorAll('.tarot__history').length,
    spreads: document.querySelectorAll('.tarot__spread').length,
  }))
  check('旧记录仍然显示：老牌阵按中文名显示', legacy.text.includes('凯尔特牌阵'), legacy.text.slice(0, 60))
  check(
    '牌阵已被删掉的旧记录也不弄崩页面（回退显示原始 id）',
    legacy.text.includes('legacy-removed-spread') && legacy.spreads >= 6,
    `${legacy.rows} 条记录 · 选择区仍有 ${legacy.spreads} 个牌阵`,
  )

  /* ── 解读文案（第二乱）：三种粒度可切换 + 每条 2~3 句建议 ── */
  await page.locator('.tarot__spread[data-spread="relation"]').click()
  await page.locator('.tarot__primary').click()
  await page.waitForSelector('.tarot-card', { timeout: 15000 })
  const relCards = await page.locator('.tarot-card').count()
  for (let i = 0; i < relCards; i++) await page.locator('.tarot-card').nth(i).click()
  await page.waitForTimeout(1200)

  const cardSrcs = () =>
    page.evaluate(() => [...document.querySelectorAll('.tarot-card img')].map((el) => el.getAttribute('src')))
  const srcsBefore = await cardSrcs()

  /* ① 三种粒度都能切，且同时只有一个处于按下态 */
  const modeIds = ['brief', 'combo', 'overview']
  const modeProblems = []
  for (const id of modeIds) {
    const btn = page.locator(`[data-tarot-mode="${id}"]`)
    if ((await btn.count()) !== 1) {
      modeProblems.push(`${id} 没有按钮`)
      continue
    }
    await btn.click()
    if ((await btn.getAttribute('aria-pressed')) !== 'true') modeProblems.push(`${id} 没进入按下态`)
    const stillPressed = await page.evaluate(
      (self) =>
        [...document.querySelectorAll('[data-tarot-mode]')].filter(
          (el) => el.getAttribute('data-tarot-mode') !== self && el.getAttribute('aria-pressed') === 'true',
        ).length,
      id,
    )
    if (stillPressed !== 0) modeProblems.push(`${id} 按下时还有别的模式也是按下态`)
  }
  check('三种解读粒度都能切换（aria-pressed 唯一）', modeProblems.length === 0, modeProblems.join('；') || '3 种都对')

  /* ② 切模式不重新抽牌：牌的图片地址序列一模一样 */
  const srcsAfter = await cardSrcs()
  check(
    '切模式不重新抽牌（同一手牌，牌序未变）',
    srcsBefore.length === relCards && srcsBefore.join(',') === srcsAfter.join(','),
    `${srcsBefore.length} 张：${srcsBefore.map((x) => (x ?? '').split('/').pop()).join(' ')}`,
  )

  /* ③ (a) 每牌位一句：条目数 == 牌位数，每条含自己的牌位名 */
  await page.locator('[data-tarot-mode="brief"]').click()
  const brief = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.tarot-interp__item')]
    return {
      count: items.length,
      ok: items.every((el) => {
        const pos = el.getAttribute('data-position') ?? ''
        const text = el.querySelector('.tarot-interp__text')?.textContent ?? ''
        return pos.length > 0 && text.includes(pos)
      }),
      adviceCounts: items.map((el) => el.querySelectorAll('.tarot-interp__adviceItem').length),
      sample: items[0]?.querySelector('.tarot-interp__text')?.textContent ?? '',
    }
  })
  check(
    '(a) 每牌位一句：条目数 == 牌位数，且每条都写出牌位名',
    brief.count === relCards && brief.ok,
    `${brief.count}/${relCards} 条 · ${brief.sample}`,
  )

  /* ④ (b) 牌 × 牌位：**同一张牌放到不同牌位必须给不同的话**（防"只按牌给话"的假实现） */
  const gen = await page.evaluate(async () => {
    const R = await import('/src/data/tarot/readings.ts')
    const S = await import('/src/data/tarot/spreads.ts')
    const D = await import('/src/data/tarot/index.ts')
    const spread = S.SPREADS.find((x) => x.id === 'relation')
    const card = D.CARDS.find((c) => c.id === 'Fool')
    const mk = (reversed) => ({
      at: 1,
      spreadId: spread.id,
      question: '',
      cards: [0, 1, 3].map((positionIndex) => ({ card, reversed, positionIndex })),
    })
    const up = R.interpret(mk(false), spread, 'combo', 42)
    const rev = R.interpret(mk(true), spread, 'combo', 42)
    const ov = R.interpret(mk(false), spread, 'overview', 42)
    return {
      three: up.entries.map((e) => e.text),
      labels: up.entries.map((e) => e.position),
      upText: up.entries[0].text,
      revText: rev.entries[0].text,
      /* 用模块自己算的核心义（上游字段是逗号串，coreOf 会截成前两个词） */
      coreUp: R.coreOf({ card, reversed: false, positionIndex: 0 }),
      coreRev: R.coreOf({ card, reversed: true, positionIndex: 0 }),
      advice: up.entries[0].advice,
      revAdvice: rev.entries[0].advice,
      overview: ov.overview,
      disclaimer: up.disclaimer,
      mode: { brief: R.interpret(mk(false), spread, 'brief', 42).entries[0].text },
    }
  })
  check(
    '(b) 牌 × 牌位：同一张牌在三个不同牌位给出三段不同的话（牌位角色真的参与）',
    new Set(gen.three).size === 3 && gen.three.every((t, i) => t.includes(gen.labels[i])),
    `${gen.labels.join(' / ')}`,
  )

  /* ⑤ (c) 整体综述：够长，且三段结构（氛围 / 走向 / 提醒）都在 */
  await page.locator('[data-tarot-mode="overview"]').click()
  const ovUi = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel)?.textContent ?? ''
    return {
      mood: q('.tarot-interp__mood'),
      flow: q('.tarot-interp__flow'),
      remind: q('.tarot-interp__remind'),
      text: q('.tarot-interp__mood') + q('.tarot-interp__flow') + q('.tarot-interp__remind'),
      advice: document.querySelectorAll('.tarot-interp__adviceItem').length,
    }
  })
  check(
    '(c) 整体综述够长且含氛围 / 走向 / 提醒三段',
    ovUi.text.length >= 120 && ovUi.mood.length > 10 && ovUi.flow.length > 30 && ovUi.remind.length > 20,
    `${ovUi.text.length} 字 · ${ovUi.mood.slice(0, 28)}…`,
  )

  /* ⑥ 每条 2~3 句建议，每句成句；全篇不许出现宿命论措辞 */
  const fatalWords = ['一定', '必然', '注定', '绝对', '肯定会', '命中注定']
  const adviceShape = {
    ok:
      brief.adviceCounts.every((n) => n >= 2 && n <= 3) &&
      gen.advice.length >= 2 &&
      gen.advice.length <= 3 &&
      gen.revAdvice.length >= 2 &&
      gen.revAdvice.every((line) => line.length >= 8),
    counts: brief.adviceCounts.join(','),
    fatal: fatalWords.filter((w) => (JSON.stringify(gen) + ovUi.text).includes(w)),
  }
  check(
    '每条都给 2~3 句「建议与注意」（每句成句，且不写宿命论）',
    adviceShape.ok && adviceShape.fatal.length === 0,
    `每条 ${adviceShape.counts} 句${adviceShape.fatal.length ? ' · 出现宿命论措辞：' + adviceShape.fatal.join('/') : ''}`,
  )

  /* ⑦ 逆位文案与正位不同，而且各自带自己的核心义（不是加个"不"字） */
  check(
    '逆位文案与正位不同（各用自己的核心义，不是加个"不"字）',
    gen.upText !== gen.revText && gen.upText.includes(gen.coreUp) && gen.revText.includes(gen.coreRev),
    `正：${gen.coreUp} / 逆：${gen.coreRev}`,
  )

  /* ⑧ 免责声明在解读区里（站主要求：不构成决策依据） */
  const disclaimer = await page.evaluate(
    () => document.querySelector('.tarot-interp__disclaimer')?.textContent ?? '',
  )
  check('解读区注明「仅供思考参考，不构成决策依据」', disclaimer.includes('仅供思考参考') && disclaimer.includes('不构成决策依据'), disclaimer)

  /* ── 解读模式持久化（站主 2026-10-06：「好，塔罗牌就制作持久化」） ──
     存法：**扩展已有的 desktop.tarot 键**（加一个 mode 标量字段），不新增键。 */
  const KEY = 'desktop.tarot'
  const readKey = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), KEY)

  /* ① 切换模式 → 键里立刻有 mode（不必等抽牌 / 提交） */
  await page.locator('[data-tarot-mode="combo"]').click()
  const wrote = await readKey()
  check(
    '① 切换解读模式立即写进 desktop.tarot 的 mode',
    wrote.mode === 'combo',
    `mode = ${JSON.stringify(wrote.mode)}（键里还有 history ${Array.isArray(wrote.history) ? wrote.history.length : '?'} 条）`,
  )

  /* ② 刷新之后还是上次那个模式：按钮按下态 + 解读呈现形态（combo 的句子有"拿到…核心是"，brief 没有） */
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.tarot__spread', { timeout: 20000 })
  await page.locator('.tarot__spread[data-spread="daily"]').click()
  await page.locator('.tarot__primary').click()
  await page.waitForSelector('.tarot-card', { timeout: 15000 })
  await page.locator('.tarot-card').first().click()
  await page.waitForTimeout(900)
  const restored = await page.evaluate(() => ({
    pressed: [...document.querySelectorAll('[data-tarot-mode]')]
      .filter((el) => el.getAttribute('aria-pressed') === 'true')
      .map((el) => el.getAttribute('data-tarot-mode')),
    text: document.querySelector('.tarot-interp__text')?.textContent ?? '',
  }))
  check(
    '② 刷新后仍是上次选的模式（按钮按下态 + 解读形态都对）',
    restored.pressed.length === 1 &&
      restored.pressed[0] === 'combo' &&
      restored.text.includes('拿到') &&
      restored.text.includes('核心是'),
    `按下：${restored.pressed.join(',') || '（无）'} · ${restored.text.slice(0, 46)}…`,
  )

  /* ③ 坏值回落：往键里塞一个不存在的模式 → 不崩、回落 brief */
  const errsBefore = errors.length
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ history: [], mode: '不存在的模式' })), KEY)
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.tarot__spread', { timeout: 20000 })
  const guard = await page.evaluate(async () => {
    const h = await import('/src/lib/tarot/history.ts')
    return { read: h.readInterpMode(), valid: h.isInterpMode('不存在的模式') }
  })
  await page.locator('.tarot__spread[data-spread="daily"]').click()
  await page.locator('.tarot__primary').click()
  await page.waitForSelector('.tarot-card', { timeout: 15000 })
  await page.locator('.tarot-card').first().click()
  await page.waitForTimeout(900)
  const fallback = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.tarot') ?? '{}')
    return {
      pressed: [...document.querySelectorAll('[data-tarot-mode]')]
        .filter((el) => el.getAttribute('aria-pressed') === 'true')
        .map((el) => el.getAttribute('data-tarot-mode')),
      /* 抽完牌后是"打出牌面"的视图：选择区按钮本来就不在，
         所以这里判"牌面还在"= 页面没崩（判选择区是这个断言自己写错过一次的点） */
      cards: document.querySelectorAll('.tarot-card').length,
      spreads: document.querySelectorAll('.tarot__spread').length,
      storedRaw: raw.mode,
    }
  })
  check(
    '③ 坏模式值回落 brief（页面不崩，且新增的未捕获错误为 0）',
    guard.read === 'brief' &&
      guard.valid === false &&
      fallback.pressed.length === 1 &&
      fallback.pressed[0] === 'brief' &&
      fallback.cards >= 1 &&
      errors.length === errsBefore,
    `readInterpMode() = ${guard.read} · isInterpMode(坏值) = ${guard.valid} · 按下 ${fallback.pressed.join(',')} · 牌面 ${fallback.cards} 张 · 键里仍留着 ${JSON.stringify(fallback.storedRaw)} · 新增错误 ${errors.length - errsBefore}`,
  )

  check('无未捕获的运行时错误', errors.length === 0, errors.join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} 通过`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error(`[tarot-verify] 运行失败：${error.message}`)
  process.exit(1)
})
