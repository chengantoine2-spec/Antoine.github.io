import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

/* 复用已装好的 Playwright（DSH 的 playwright MCP 装在 profile 里），
   所以本项目不把 playwright 写进 devDependencies。
   想换位置就设 PLAYWRIGHT_PKG=/abs/path/to/playwright。 */
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
  console.error('[verify] 找不到 playwright。请先安装，或设 PLAYWRIGHT_PKG 指向它。')
  process.exit(1)
}

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const DOCK = 'nav[aria-label="任务栏"]'
/* 最大化 / 还原：两个标签轮流出现，用组合选择器一次抓。
   别用 [aria-pressed] —— 全屏按钮也带这个属性，会选错元素 */
const MAX_BTN =
  '[aria-label="博客 窗口"] header button[aria-label="最大化"], [aria-label="博客 窗口"] header button[aria-label="还原"]'

const results = []
function check(name, ok, detail = '') {
  results.push(ok)
  console.log(`${ok ? '  PASS' : '× FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const page = { /* 由 main 填充 */ }

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  page.current = p

  const errors = []
  p.on('pageerror', (e) => errors.push(String(e.message)))

  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  // 1 桌面骨架
  const shell = await p.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    skin: document.documentElement.getAttribute('data-skin'),
    dock: !!document.querySelector('nav[aria-label="任务栏"]'),
    wall: getComputedStyle(document.querySelector('.desktop__wall')).backgroundImage,
  }))
  check('桌面能打开，任务栏在', shell.dock)
  check('默认主题 caramel，且没有残留的 data-skin', shell.theme === 'caramel' && shell.skin === null, shell.theme)
  check('默认壁纸是主题渐变', shell.wall.includes('linear-gradient'))

  // 2 「关于」窗口
  await p.click(`${DOCK} button[aria-label="关于"]`)
  await p.waitForTimeout(500)
  const about = await p.evaluate(() => ({
    path: location.pathname,
    win: !!document.querySelector('[aria-label="关于 窗口"]'),
  }))
  check('点任务栏「关于」→ 路由 /about 且窗口打开', about.path === '/about' && about.win, about.path)

  // 2b 站名改成「芹菜耕地」，每个窗口是一样菜；DSH 快捷入口只在本机出现
  const branding = await p.evaluate((dockSel) => ({
    title: document.title,
    about: document.querySelector('[aria-label="关于 窗口"]')?.textContent ?? '',
    /* 无障碍名仍是窗口名（验证脚本靠它点按钮），菜名在 title 里 */
    dockTitles: Array.from(document.querySelectorAll(`${dockSel} button[title]`)).map((b) =>
      b.getAttribute('title'),
    ),
  }), DOCK)
  check(
    '站名是「芹菜耕地」，任务栏每个窗口都带一样菜',
    branding.title.includes('芹菜耕地') &&
      branding.about.includes('芹菜耕地') &&
      branding.dockTitles.includes('博客 · 玉米') &&
      branding.dockTitles.includes('终端 · 辣椒'),
    `title=${branding.title}｜${branding.dockTitles.slice(1, 4).join('、')}…`,
  )
  check(
    'DSH 快捷入口在本地出现（就是那棵芹菜）',
    branding.dockTitles.includes('DSH · 芹菜'),
    JSON.stringify(branding.dockTitles.filter((label) => label.includes('DSH'))),
  )
  await p.click(`${DOCK} button[aria-label="DSH"]`)
  await p.waitForTimeout(600)
  /* 探活是异步的：等它从「探测中」落定（本机 DSH 没跑时会是 offline，也算落定） */
  await p
    .waitForFunction(
      () => {
        const el = document.querySelector('[aria-label="DSH 窗口"] [data-probe]')
        return el !== null && el.dataset.probe !== 'checking'
      },
      { timeout: 4000 },
    )
    .catch(() => {})
  const dsh = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="DSH 窗口"]')
    if (!win) return null
    const probe = win.querySelector('[data-probe]')
    return {
      path: location.pathname,
      address: win.querySelector('input[aria-label="DSH 地址"]')?.value ?? '',
      probe: probe?.dataset.probe ?? '',
      open: Array.from(win.querySelectorAll('button')).some((b) =>
        (b.textContent ?? '').includes('打开 DSH'),
      ),
    }
  })
  check(
    'DSH 窗口：地址可改、能探活、有「打开 DSH」按钮',
    !!dsh &&
      dsh.path === '/dsh' &&
      /^https?:\/\/[^\s]+$/.test(dsh.address) &&
      ['online', 'offline'].includes(dsh.probe) &&
      dsh.open,
    JSON.stringify(dsh),
  )
  await p.click('[aria-label="DSH 窗口"] header button[aria-label="关闭"]')
  await p.waitForTimeout(300)
  /* 桌面一次只显示一个窗口（路由驱动），刚才跳到 /dsh 了 —— 回「关于」，后面的几何记忆检查要用它 */
  await p.click(`${DOCK} button[aria-label="关于"]`)
  await p.waitForTimeout(400)

  // 3 窗口几何记忆
  const before = await p.evaluate(() => {
    const r = document.querySelector('[aria-label="关于 窗口"]').getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y) }
  })
  const bar = await p.evaluate(() => {
    const r = document.querySelector('[aria-label="关于 窗口"] header').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await p.mouse.move(bar.x, bar.y)
  await p.mouse.down()
  await p.mouse.move(bar.x + 90, bar.y + 70, { steps: 6 })
  await p.mouse.up()
  await p.waitForTimeout(250)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)
  const after = await p.evaluate(() => {
    const r = document.querySelector('[aria-label="关于 窗口"]')?.getBoundingClientRect()
    return r ? { x: Math.round(r.x), y: Math.round(r.y) } : null
  })
  check(
    '窗口位置被记住（刷新后回到原处）',
    after !== null && Math.abs(after.x - (before.x + 90)) <= 3 && Math.abs(after.y - (before.y + 70)) <= 3,
    `${JSON.stringify(before)} → ${JSON.stringify(after)}`,
  )

  // 4 设置窗口（默认尺寸更大）
  await p.click(`${DOCK} button[aria-label="设置"]`)
  await p.waitForTimeout(600)
  const settings = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="设置 窗口"]')
    if (!win) return null
    const r = win.getBoundingClientRect()
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      hasHelp: win.textContent.includes('操作说明'),
      /* 全屏入口现在归到设置窗口里（标题栏那个已经撤掉） */
      fullscreenBtn: [...win.querySelectorAll('button')].some((b) =>
        /进入全屏|退出全屏/.test(b.textContent ?? ''),
      ),
    }
  })
  check('设置窗口打开且带「操作说明」', !!settings?.hasHelp, JSON.stringify(settings))
  check('设置窗口里有「全屏」按钮', settings?.fullscreenBtn === true, JSON.stringify(settings))
  check('设置窗口用了自己的默认尺寸（720×620）', settings?.w === 720 && settings?.h === 620, `${settings?.w}×${settings?.h}`)

  // 5 主题切换
  await p.getByRole('button', { name: /^暗夜/ }).click()
  await p.waitForTimeout(300)
  const themed = await p.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
  }))
  check('切到暗夜主题生效', themed.theme === 'night' && themed.accent === '#c68a5b', themed.accent)

  // 6 壁纸纹理
  await p.getByRole('button', { name: /网格纹理/ }).click()
  await p.waitForTimeout(300)
  const wall = await p.evaluate(() => {
    const el = document.querySelector('.desktop__wall')
    return { cls: el.className, img: getComputedStyle(el).backgroundImage }
  })
  check(
    '网格纹理生效（类名被命中，样式没被裁掉）',
    wall.cls.includes('desktop__wall--grid') && wall.img !== 'none',
    wall.img.slice(0, 34),
  )

  // 7 任务栏边缘缩放 + 双击回自适应
  const navH0 = await p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height), DOCK)
  const edge = await p.evaluate((sel) => {
    const el = document.querySelectorAll(`${sel} [role="separator"]`)[0]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, DOCK)
  await p.mouse.move(edge.x, edge.y)
  await p.mouse.down()
  await p.mouse.move(edge.x, edge.y - 30, { steps: 5 })
  await p.mouse.up()
  await p.waitForTimeout(250)
  const navH1 = await p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height), DOCK)
  check('拖任务栏边缘改厚度', navH1 === navH0 + 30, `${navH0} → ${navH1}`)

  const edge2 = await p.evaluate((sel) => {
    const el = document.querySelectorAll(`${sel} [role="separator"]`)[0]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, DOCK)
  await p.mouse.dblclick(edge2.x, edge2.y)
  await p.waitForTimeout(300)
  const navH2 = await p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height), DOCK)
  check('双击边缘回到自适应厚度', navH2 === navH0, `${navH1} → ${navH2}`)

  // 8 任务栏应用勾选
  await p.locator('label', { hasText: '终端' }).locator('input').uncheck()
  await p.waitForTimeout(300)
  const docked = await p.evaluate(
    (sel) => !!document.querySelector(`${sel} button[aria-label="终端"]`),
    DOCK,
  )
  check('取消勾选后应用从任务栏移除', docked === false)

  // 9 项目窗口：列表 → 详情，标题栏跟着换
  await p.click(`${DOCK} button[aria-label="项目"]`)
  await p.waitForTimeout(500)
  const list = await p.evaluate(() => ({
    path: location.pathname,
    cards: document.querySelectorAll('[aria-label="项目 窗口"] ul.grid > li > button').length,
  }))
  check('点「项目」→ 卡片列表出现', list.path === '/projects' && list.cards > 0, `${list.cards} 张卡`)

  await p.click('[aria-label="项目 窗口"] ul.grid > li > button')
  await p.waitForTimeout(500)
  const detail = await p.evaluate(() => ({
    path: location.pathname,
    title: document.querySelector('[aria-label="项目 窗口"] header span')?.textContent?.trim() ?? '',
  }))
  check(
    '点卡片 → 进详情，且窗口标题变成项目名',
    detail.path.startsWith('/projects/') && detail.title !== '' && detail.title !== '项目',
    `${detail.path}｜标题「${detail.title}」`,
  )

  // 10 博客创作窗口（没有 PAT 时只显示凭据表单）
  await p.click(`${DOCK} button[aria-label="博客创作"]`)
  await p.waitForTimeout(700)
  const write = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="博客创作 窗口"]')
    if (!win) return null
    const text = win.textContent ?? ''
    return {
      hasTokenField: !!win.querySelector('input[type="password"]'),
      asksToken: text.includes('填入 Token'),
      path: location.pathname,
    }
  })
  check(
    '点「博客创作」→ 窗口打开并要 Token',
    write?.path === '/write' && write.hasTokenField && write.asksToken,
    JSON.stringify(write),
  )

  // 10c 图片区：不需要 Token 也能列出 img 分支里的图；悬停任务栏图标要显示名字
  const writeText = await p.evaluate(
    () => document.querySelector('[aria-label="博客创作 窗口"]')?.textContent ?? '',
  )
  check('博客创作窗口带图片区（img 分支）', writeText.includes('图片（img 分支）'))

  const dockTarget = await p.evaluate((sel) => {
    const el = document.querySelector(`${sel} button[aria-label="博客"]`)
    const rect = el.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }, DOCK)
  await p.mouse.move(dockTarget.x, dockTarget.y)
  await p.waitForTimeout(500)
  const tooltip = await p.evaluate(
    (sel) => document.querySelector(`${sel} [role="tooltip"]`)?.textContent?.trim() ?? null,
    DOCK,
  )
  check('鼠标悬停任务栏图标显示名字（带「一样菜」）', (tooltip ?? '').includes('博客'), `tooltip=${tooltip}`)

  // 10b 假 Token 要被明确拒绝（真打一次 GitHub API，但不产生任何写入）
  await p.fill('[aria-label="博客创作 窗口"] input[type="password"]', 'ghp_this_token_is_fake_for_test')
  await p.click('[aria-label="博客创作 窗口"] button:has-text("保存")')
  await p.click('[aria-label="博客创作 窗口"] button:has-text("验证")')
  await p.waitForTimeout(3000)
  const tokenText = await p.evaluate(
    () => document.querySelector('[aria-label="博客创作 窗口"]')?.textContent ?? '',
  )
  check(
    '假 Token 被明确拒绝（错误信息是中文可读的）',
    /Token 无效|401|权限/.test(tokenText),
    (tokenText.match(/Token 无效[^（]*（401）|Token 权限不足[^（]*（403）/) ?? ['未出现'])[0],
  )

  // 11 博客窗口（数据来自 GitHub Issues；限流时显示缓存或提示，都算通过）
  await p.click(`${DOCK} button[aria-label="博客"]`)
  await p.waitForTimeout(2500)
  const blog = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="博客 窗口"]')
    if (!win) return null
    const text = (win.textContent ?? '').trim()
    return { len: text.length, head: text.slice(0, 30) }
  })
  check('点「博客」→ 窗口渲染出列表或提示', !!blog && blog.len > 0, blog ? blog.head : '窗口未出现')

  // 11b 搜索：要能检索正文，且空格 / 标点不该影响命中
  // （之前索引走 plainText、查询只 trim，两套规则不一致，多打一个空格就搜不到正文）
  const search = await p.evaluate(async () => {
    const input = document.querySelector('input[aria-label="搜索文章"]')
    if (!input) return null
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const run = async (q) => {
      setter.call(input, q)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      return document.querySelectorAll('.blog__feed li button').length
    }
    const spaced = await run('焦糖 布丁')
    const plain = await run('焦糖布丁')
    const none = await run('zzz不存在的词')
    await run('')
    return { spaced, plain, none }
  })
  check(
    '搜索能检索正文，空格 / 标点不影响命中',
    !!search && search.spaced > 0 && search.spaced === search.plain && search.none === 0,
    JSON.stringify(search),
  )

  // 11b1 右栏统计与左栏角标：数字要对得上，而且不能跟着筛选跳
  //       （踩过的坑：统计拿筛选后的列表算，于是「文章 6 篇」和左栏「全部 9」对不上；
  //         另外没打标签的文章落在 other，不列出来角标就加不出「全部」）
  const statsSnapshot = () =>
    p.evaluate(() => {
      const nav = Array.from(document.querySelectorAll('.blog__nav button')).map((b) =>
        b.textContent.trim(),
      )
      const rows = Array.from(document.querySelectorAll('.blog__aside dl > div')).map((d) => ({
        label: d.querySelector('dt')?.textContent?.trim() ?? '',
        value: d.querySelector('dd')?.textContent?.trim() ?? '',
      }))
      const first = (text) => Number((String(text).match(/\d+/) ?? ['0'])[0])
      /* 第一项是「全部」，带 # 的是标签，剩下的是各分类角标 */
      const cats = nav.filter((text, index) => index > 0 && !text.startsWith('#'))
      return {
        nav,
        all: first(nav[0]),
        sum: cats.reduce((acc, text) => acc + first(text), 0),
        rows,
        list: document.querySelectorAll('.blog__feed li').length,
      }
    })
  const statsAll = await statsSnapshot()
  const publishedRow = statsAll.rows.find((row) => row.label === '文章')
  const published = Number((String(publishedRow?.value).match(/\d+/) ?? ['0'])[0])
  check(
    '右栏「文章」= 已发布总数，且与左栏「全部」一致',
    published > 0 && published === statsAll.all,
    `统计 ${published}｜全部角标 ${statsAll.all}｜${publishedRow?.value}`,
  )
  check(
    '左栏分类角标加得出「全部」（含「其他」这一档）',
    statsAll.sum === statsAll.all && statsAll.nav.some((text) => text.startsWith('其他')),
    `角标和 ${statsAll.sum} / 全部 ${statsAll.all}｜${statsAll.nav.join(' ')}`,
  )
  await p.click('.blog__nav button:has-text("饥荒 Wiki")')
  await p.waitForTimeout(400)
  const statsWiki = await statsSnapshot()
  await p.click('.blog__nav button:has-text("全部")')
  await p.waitForTimeout(400)
  check(
    '切分类时角标与统计一个都不变',
    JSON.stringify(statsWiki.nav) === JSON.stringify(statsAll.nav) &&
      JSON.stringify(statsWiki.rows) === JSON.stringify(statsAll.rows),
    JSON.stringify(statsWiki.rows.map((row) => row.value)),
  )
  const days = Number(
    (String(statsAll.rows.find((row) => row.label === '建站')?.value).match(/\d+/) ?? ['0'])[0],
  )
  const charsRow = statsAll.rows.find((row) => row.label === '字数')?.value ?? ''
  check(
    '统计有「建站 N 天」与「字数」等内容',
    days >= 1 &&
      /字/.test(charsRow) &&
      statsAll.rows.some((row) => row.label === '标签') &&
      statsAll.rows.some((row) => row.label === '最近更新'),
    JSON.stringify(statsAll.rows.map((row) => `${row.label}=${row.value}`)),
  )

  // 11b2 博客首页两侧的分隔条：拖的是「栏与栏的分界」，中栏（卡片流）始终 1fr 吃满剩余空间，
  //       所以拖多少变多少（不像文章页那种居中对称的 ×2），整行永远贴齐、两端不留白
  const railState = () =>
    p.evaluate(() => {
      const grid = document.querySelector('.blog__grid')
      const nav = document.querySelector('.blog__nav')
      const feed = document.querySelector('.blog__feed')
      const aside = document.querySelector('.blog__aside')
      return {
        gridWidth: Math.round(grid.getBoundingClientRect().width),
        nav: Math.round(nav.getBoundingClientRect().width),
        feed: Math.round(feed.getBoundingClientRect().width),
        aside: Math.round(aside.getBoundingClientRect().width),
        handles: Array.from(document.querySelectorAll('.width-handle')).map((h) => h.dataset.side),
        stored: [
          localStorage.getItem('desktop.blogNavWidth'),
          localStorage.getItem('desktop.blogAsideWidth'),
        ],
      }
    })
  const railsBefore = await railState()
  check(
    '博客首页三列时左右各有一条分隔条',
    railsBefore.handles.length === 2 &&
      railsBefore.handles.includes('left') &&
      railsBefore.handles.includes('right'),
    JSON.stringify(railsBefore),
  )
  const railFit = await p.evaluate(() => {
    const nav = document.querySelector('.blog__nav').getBoundingClientRect()
    const feed = document.querySelector('.blog__feed').getBoundingClientRect()
    const left = document.querySelector('.width-handle[data-side="left"]')?.getBoundingClientRect()
    const right = document.querySelector('.width-handle[data-side="right"]')?.getBoundingClientRect()
    if (!left || !right) return null
    return {
      leftWidth: Math.round(left.width),
      gap: Math.round(feed.left - nav.right),
      /* 左条的左边缘 = 左栏右边缘；右条的左边缘 = 中栏右边缘（两条都从内容列往外铺） */
      leftPinned: Math.abs(left.left - nav.right) < 1,
      rightPinned: Math.abs(right.left - feed.right) < 1,
    }
  })
  check(
    '分隔条正好落在栏间空隙里（不压侧栏、也不压卡片）',
    !!railFit && railFit.leftPinned && railFit.rightPinned && railFit.leftWidth === railFit.gap,
    JSON.stringify(railFit),
  )

  const dragRail = async (side, dx) => {
    const box = await p.locator(`.width-handle[data-side="${side}"]`).boundingBox()
    const x = box.x + box.width / 2
    const y = Math.min(Math.max(box.y + 120, 90), 600)
    await p.mouse.move(x, y)
    await p.mouse.down()
    await p.mouse.move(x + dx, y, { steps: 8 })
    await p.waitForTimeout(150)
    await p.mouse.up()
    await p.waitForTimeout(300)
    return railState()
  }
  const navDragged = await dragRail('left', 40)
  check(
    '拖左分隔条 40px → 左栏 +40、中栏 -40，整行仍然贴齐（没留白）',
    navDragged.nav === railsBefore.nav + 40 &&
      navDragged.feed === railsBefore.feed - 40 &&
      navDragged.gridWidth === railsBefore.gridWidth &&
      navDragged.stored[0] === String(navDragged.nav),
    `${railsBefore.nav}/${railsBefore.feed} → ${navDragged.nav}/${navDragged.feed}｜落盘 ${navDragged.stored[0]}`,
  )
  const asideDragged = await dragRail('right', -40)
  check(
    '拖右分隔条向左 40px → 右栏 +40、中栏 -40，并落盘',
    asideDragged.aside === railsBefore.aside + 40 &&
      asideDragged.feed === navDragged.feed - 40 &&
      asideDragged.stored[1] === String(asideDragged.aside),
    `${railsBefore.aside}/${navDragged.feed} → ${asideDragged.aside}/${asideDragged.feed}｜落盘 ${asideDragged.stored[1]}`,
  )
  await p.dblclick('.width-handle[data-side="left"]')
  await p.dblclick('.width-handle[data-side="right"]')
  await p.waitForTimeout(350)
  const railsReset = await railState()
  check(
    '双击分隔条复位：宽度回默认、localStorage 的键清掉',
    railsReset.nav === railsBefore.nav &&
      railsReset.aside === railsBefore.aside &&
      railsReset.stored[0] === null &&
      railsReset.stored[1] === null,
    JSON.stringify(railsReset),
  )

  // 11c 文章详情页：最大化后左右两栏要出来，正文列放大但仍被限制（不跟着窗口无限拉长）
  await p.click('.blog__feed li button')
  await p.waitForTimeout(1500)
  await p.click(MAX_BTN)
  await p.waitForTimeout(250)
  const article = await p.evaluate(() => {
    const grid = document.querySelector('.article__grid')
    const main = document.querySelector('.article__main')
    const vis = (sel) => {
      const el = document.querySelector(sel)
      return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0
    }
    return {
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      left: vis('.article__rail--left'),
      right: vis('.article__rail--right'),
      toc: document.querySelectorAll('.article__rail--right li').length,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : 0,
    }
  })
  check(
    '文章详情页宽窗下有左右栏，正文列放大但不被拉长',
    article.left &&
      article.right &&
      article.columns === 3 &&
      article.toc > 0 &&
      article.mainWidth >= 680 &&
      article.mainWidth <= 780,
    JSON.stringify(article),
  )
  /* 先复原成未最大化：最大化窗口会盖住任务栏，那上面的按钮点不到 */
  await p.click(MAX_BTN)
  await p.waitForTimeout(200)

  /* 默认窗口尺寸（1000 宽 → 容器 958）下右栏也必须出来：
     断点曾写成 960，比容器宽 2px，于是默认尺寸下永远是单列 */
  const defaultRail = await p.evaluate(() => {
    const win = document.querySelector('.window')
    const rail = document.querySelector('.article__rail--right')
    return {
      windowWidth: win ? Math.round(win.getBoundingClientRect().width) : 0,
      right: !!rail && getComputedStyle(rail).display !== 'none' && rail.getBoundingClientRect().width > 0,
    }
  })
  check(
    '默认窗口宽度下文章右栏就出现（断点别卡在窗口内边距上）',
    defaultRail.right === true,
    JSON.stringify(defaultRail),
  )

  // 11e 正文列宽拖动条：复刻 DSH 会话页左右那两条长条。
  //     抓取带要正好贴住正文列两侧（左条的右边缘 = 正文列左边缘），拖动是「对称位移」——
  //     正文列居中，两侧各出去 40px，所以拖 40px 宽度该 +80px。
  const handles = await p.evaluate(() => {
    const main = document.querySelector('.article__main')
    const mainBox = main.getBoundingClientRect()
    const list = Array.from(document.querySelectorAll('.width-handle'))
    return {
      count: list.length,
      fit: list.every((el) => {
        const box = el.getBoundingClientRect()
        return el.dataset.side === 'right'
          ? Math.abs(box.left - mainBox.right) < 1
          : Math.abs(box.right - mainBox.left) < 1
      }),
    }
  })
  check(
    '文章页左右各一条拖动条，且抓取带正好贴住正文列',
    handles.count === 2 && handles.fit,
    JSON.stringify(handles),
  )

  const mainWidth = () =>
    p.evaluate(() =>
      Math.round(document.querySelector('.article__main').getBoundingClientRect().width),
    )
  const railsState = () =>
    p.evaluate(() => ({
      attr: document.querySelector('.article__grid').getAttribute('data-rails'),
      right:
        getComputedStyle(document.querySelector('.article__rail--right')).display !== 'none',
      meta: getComputedStyle(document.querySelector('.article__meta')).display,
    }))
  /* 起点取在窗口可视区里，别落在滚动视口之外 */
  const gripPoint = async () => {
    const box = await p.locator('.width-handle[data-side="right"]').boundingBox()
    return { x: box.x + box.width / 2, y: Math.min(Math.max(box.y + 120, 80), 640) }
  }
  const dragGrip = async (dx) => {
    const from = await gripPoint()
    await p.mouse.move(from.x, from.y)
    await p.mouse.down()
    await p.mouse.move(from.x + dx, from.y, { steps: 8 })
    await p.waitForTimeout(120)
    await p.mouse.up()
    await p.waitForTimeout(200)
  }

  const widthBefore = await mainWidth()
  const from = await gripPoint()
  await p.mouse.move(from.x, from.y)
  await p.mouse.down()
  await p.mouse.move(from.x + 40, from.y, { steps: 8 })
  /* 拖动走 rAF 节流：等那一帧真的落到布局上再断言，否则会读到一个还没生效的中间态 */
  await p
    .waitForFunction(
      (expect) =>
        Math.round(document.querySelector('.article__main').getBoundingClientRect().width) ===
        expect,
      widthBefore + 80,
      { timeout: 2000, polling: 100 },
    )
    .catch(() => {})
  const widthDuring = await mainWidth()
  await p.mouse.up()
  await p.waitForTimeout(200)
  const dragged = await p.evaluate(() => ({
    width: Math.round(document.querySelector('.article__main').getBoundingClientRect().width),
    stored: Number(localStorage.getItem('desktop.articleWidth')),
  }))
  check(
    '往右拖 40px → 正文列宽 +80px（对称位移 ×2），松手写进 localStorage',
    widthDuring === widthBefore + 80 &&
      dragged.width === widthBefore + 80 &&
      dragged.stored === widthBefore + 80,
    `${widthBefore} → ${widthDuring}｜落盘 ${dragged.stored}`,
  )

  /* 拖宽到窄栏放不下时窄栏让位（默认窗口 958 容器，正文 802 已经放不下右栏了）；
     双击复位后偏好被清掉，右栏回来 */
  const yielded = await railsState()
  await p.dblclick('.width-handle[data-side="right"]')
  await p.waitForTimeout(250)
  const restored = await p.evaluate(() => ({
    stored: localStorage.getItem('desktop.articleWidth'),
    attr: document.querySelector('.article__grid').getAttribute('data-rails'),
    width: Math.round(document.querySelector('.article__main').getBoundingClientRect().width),
    right: getComputedStyle(document.querySelector('.article__rail--right')).display !== 'none',
  }))
  check(
    '拖宽后窄栏让位（目录藏起来、文内信息回到头部），双击复位后右栏回来',
    yielded.attr === 'none' &&
      yielded.right === false &&
      yielded.meta === 'flex' &&
      restored.stored === null &&
      restored.attr === null &&
      restored.right === true &&
      Math.abs(restored.width - widthBefore) <= 1,
    `${JSON.stringify(yielded)}｜${JSON.stringify(restored)}`,
  )

  /* 宽窗（容器 ≥1160）拖宽时先让左栏、留住目录：这是让位顺序，别写反 */
  await p.click(MAX_BTN)
  await p.waitForTimeout(250)
  await dragGrip(120)
  const order = await p.evaluate(() => ({
    attr: document.querySelector('.article__grid').getAttribute('data-rails'),
    left: getComputedStyle(document.querySelector('.article__rail--left')).display !== 'none',
    right: getComputedStyle(document.querySelector('.article__rail--right')).display !== 'none',
  }))
  await p.dblclick('.width-handle[data-side="right"]')
  await p.waitForTimeout(200)
  await p.click(MAX_BTN)
  await p.waitForTimeout(200)
  check(
    '宽窗拖宽先让左栏、留住目录（顺序别写反）',
    order.attr === 'right' && order.left === false && order.right === true,
    JSON.stringify(order),
  )

  /* 11e2 滚动条：复刻 DSH 的「右侧上下位置指示」—— 8px、透明轨道、4px 圆角滑块走主题令牌。
     滚动条是浏览器原生绘制的，量它的最终外观不稳（各系统滚动条设置不一），
     所以这里断言样式表里确实落了这几条规则、且令牌有值 */
  const scrollbar = await p.evaluate(() => {
    const found = { width: null, track: null, thumb: null }
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = []
      try {
        rules = Array.from(sheet.cssRules)
      } catch {
        continue
      }
      for (const rule of rules) {
        if (rule.selectorText === '::-webkit-scrollbar') found.width = rule.style.width
        else if (rule.selectorText === '::-webkit-scrollbar-track')
          found.track = rule.style.background
        else if (rule.selectorText === '::-webkit-scrollbar-thumb')
          found.thumb = rule.style.background
      }
    }
    return {
      ...found,
      token: getComputedStyle(document.documentElement)
        .getPropertyValue('--c-scroll-thumb')
        .trim(),
    }
  })
  check(
    '滚动条复刻 DSH（8px 宽、透明轨道、圆角滑块用主题令牌）',
    scrollbar.width === '8px' &&
      scrollbar.track === 'transparent' &&
      /--c-scroll-thumb/.test(String(scrollbar.thumb)) &&
      scrollbar.token !== '',
    JSON.stringify(scrollbar),
  )

  // 11d 任务栏上固定的「全屏」按钮：走 Fullscreen API，要真的进全屏（连浏览器窗口一起盖住），
  //     按钮自己也要跟着状态变 —— 和"窗口最大化"不是一回事。
  //     标题栏已经没有全屏按钮了（挪到任务栏 + 设置里），这里顺手断言它不在
  const FS_BTN = `${DOCK} button[aria-label="全屏"], ${DOCK} button[aria-label="退出全屏"]`
  await p.click(FS_BTN)
  await p.waitForTimeout(300)
  const fsIn = await p.evaluate((dockSel) => ({
    on: document.fullscreenElement !== null,
    dockLabel:
      document
        .querySelector(`${dockSel} button[aria-label="退出全屏"]`)
        ?.getAttribute('aria-label') ?? '',
    titleButtons: [...document.querySelectorAll('[aria-label="博客 窗口"] header button')].map((b) =>
      b.getAttribute('aria-label'),
    ),
  }), DOCK)
  check(
    '任务栏「全屏」按钮进入浏览器全屏（连浏览器窗口一起盖住）',
    fsIn.on && fsIn.dockLabel === '退出全屏' && fsIn.titleButtons.join(',') === '最小化,还原,关闭',
    JSON.stringify(fsIn),
  )

  /* 进全屏时窗口被顺手最大化了，任务栏又被盖住 —— 先还原窗口，任务栏上的按钮才点得到 */
  await p.click(MAX_BTN)
  await p.waitForTimeout(200)
  await p.click(FS_BTN)
  await p.waitForTimeout(300)
  const fsOut = await p.evaluate((dockSel) => ({
    on: document.fullscreenElement !== null,
    dockLabel:
      document.querySelector(`${dockSel} button[aria-label="全屏"]`)?.getAttribute('aria-label') ?? '',
  }), DOCK)
  check(
    '再点一次退出全屏，任务栏按钮回到「全屏」',
    !fsOut.on && fsOut.dockLabel === '全屏',
    JSON.stringify(fsOut),
  )

  // 12 最大化按钮必须跟着状态变（曾经写死成「最大化」，最大化之后完全看不出来，
  //    只能靠肉眼发现 —— 所以这里补一条回归检查）
  await p.click(MAX_BTN)
  const maxed = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="博客 窗口"]')
    const btn = win?.querySelector('header button[aria-pressed]')
    const dock = document.querySelector('[aria-label="任务栏"]')
    const w = win?.getBoundingClientRect()
    const d = dock?.getBoundingClientRect()
    /* 命中测试：任务栏中心点上最顶层的元素若不属于任务栏，说明窗口真的把它盖住了 */
    const hit = d ? document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2) : null
    return {
      label: btn?.getAttribute('aria-label') ?? '',
      pressed: btn?.getAttribute('aria-pressed') === 'true',
      isMax: (win?.className ?? '').includes('window--max'),
      shapes: btn ? btn.querySelectorAll('svg rect, svg path').length : 0,
      fillsViewport:
        !!w && Math.round(w.width) === window.innerWidth && Math.round(w.height) === window.innerHeight,
      coversDock: !!w && !!d && w.top <= d.top && w.bottom >= d.bottom && w.left <= d.left && w.right >= d.right,
      dockOnTop: !!dock && !!hit && dock.contains(hit),
    }
  })
  check(
    '最大化后标题栏按钮变成「还原」（图标换成两个方块）',
    maxed.label === '还原' && maxed.pressed && maxed.isMax && maxed.shapes === 2,
    JSON.stringify({ label: maxed.label, pressed: maxed.pressed, isMax: maxed.isMax, shapes: maxed.shapes }),
  )
  check(
    '最大化后铺满视口并盖住任务栏',
    maxed.fillsViewport && maxed.coversDock && !maxed.dockOnTop,
    JSON.stringify({ fillsViewport: maxed.fillsViewport, coversDock: maxed.coversDock, dockOnTop: maxed.dockOnTop }),
  )

  // 再点一次还回去，别把窗口留在最大化状态给后面的检查添乱
  await p.click(MAX_BTN)
  const backUp = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="博客 窗口"]')
    const btn = win?.querySelector('header button[aria-pressed]')
    return {
      label: btn?.getAttribute('aria-label') ?? '',
      isMax: (win?.className ?? '').includes('window--max'),
    }
  })
  check('再点一次能还原回「最大化」', backUp.label === '最大化' && !backUp.isMax, JSON.stringify(backUp))

  // 13 终端窗口：真命令要本机跑 tools/term-server.mjs，所以这里只保证 UI 在、
  //    状态如实（服务在线 / 未运行）。走「所有项目」菜单打开 —— 任务栏里可能没勾选它
  await p.click(`${DOCK} button[aria-label="所有项目"]`)
  await p.waitForTimeout(250)
  await p.click('[role="dialog"][aria-label="所有项目"] button:has-text("终端")')
  await p.waitForTimeout(1200)
  const terminal = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="终端 窗口"]')
    if (!win) return null
    const text = win.textContent ?? ''
    return {
      hasInput: !!win.querySelector('input[aria-label="终端输入"]'),
      hasToken: !!win.querySelector('input[aria-label="终端服务 token"]'),
      hasPort: !!win.querySelector('input[aria-label="终端服务端口"]'),
      status: /服务在线|服务未运行|检测中/.exec(text)?.[0] ?? '',
    }
  })
  check(
    '终端窗口有连接栏与输入行，并如实显示服务状态',
    !!terminal && terminal.hasInput && terminal.hasToken && terminal.hasPort && terminal.status !== '',
    JSON.stringify(terminal),
  )

  // 13b 饥荒 Wiki 窗口：内容是 wiki 负责人的，这里只保证外壳能开、
  //     搜索 / 分类 / 条目都渲染出来（外壳属于主管的职责范围）
  await p.click(`${DOCK} button[aria-label="所有项目"]`)
  await p.waitForTimeout(250)
  await p.click('[role="dialog"][aria-label="所有项目"] button:has-text("饥荒 Wiki")')
  await p.waitForTimeout(900)
  const wiki = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="饥荒 Wiki 窗口"]')
    const grid = document.querySelector('.wiki__grid')
    if (!win) return null
    return {
      hasSearch: !!win.querySelector('input[aria-label="搜索 Wiki 条目"]'),
      categories: win.querySelectorAll('.wiki__navItem').length,
      cards: win.querySelectorAll('.wiki__feed li button').length,
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      empty: (win.textContent ?? '').includes('条目整理中'),
    }
  })
  check(
    '饥荒 Wiki 窗口能开：有搜索、分类与条目',
    !!wiki && wiki.hasSearch && wiki.categories >= 2 && wiki.cards > 0 && !wiki.empty,
    JSON.stringify(wiki),
  )

  // 13b 饥荒 Wiki 窗口也有那两条分隔条（和博客首页共用 useColumnRails / WidthHandle）：
  //     资料区左右各一条，教程区没有左栏、所以只剩右边那条，而且不留空轨道
  const wikiRails = await p.evaluate(() => {
    const grid = document.querySelector('.wiki__grid')
    const nav = document.querySelector('.wiki__nav')
    const feed = document.querySelector('.wiki__feed')
    const g = grid.getBoundingClientRect()
    return {
      handles: Array.from(document.querySelectorAll('.width-handle')).map((h) => h.dataset.side),
      gap: Math.round(feed.getBoundingClientRect().left - g.left),
      nav: nav ? Math.round(nav.getBoundingClientRect().width) : 0,
      feed: Math.round(feed.getBoundingClientRect().width),
      flush: Math.round(g.width),
    }
  })
  check(
    '饥荒 Wiki 资料区左右各有一条分隔条，左栏贴最左、中间只隔一道栏距',
    wikiRails.handles.length === 2 &&
      wikiRails.handles.includes('left') &&
      wikiRails.handles.includes('right') &&
      Math.abs(wikiRails.gap - (wikiRails.nav + 14)) < 2,
    JSON.stringify(wikiRails),
  )
  const wikiDrag = await (async () => {
    const box = await p.locator('.width-handle[data-side="left"]').boundingBox()
    const x = box.x + box.width / 2
    const y = Math.min(Math.max(box.y + 120, 100), 560)
    await p.mouse.move(x, y)
    await p.mouse.down()
    await p.mouse.move(x + 40, y, { steps: 8 })
    await p.waitForTimeout(150)
    await p.mouse.up()
    await p.waitForTimeout(300)
    return p.evaluate(() => ({
      nav: Math.round(document.querySelector('.wiki__nav').getBoundingClientRect().width),
      feed: Math.round(document.querySelector('.wiki__feed').getBoundingClientRect().width),
      stored: localStorage.getItem('desktop.wikiNavWidth'),
      flush: Math.round(document.querySelector('.wiki__grid').getBoundingClientRect().width),
    }))
  })()
  check(
    '拖 Wiki 左分隔条 40px → 左栏 +40、内容列 −40，并落盘 desktop.wikiNavWidth',
    wikiDrag.nav === wikiRails.nav + 40 &&
      wikiDrag.feed === wikiRails.feed - 40 &&
      wikiDrag.flush === wikiRails.flush &&
      wikiDrag.stored === String(wikiDrag.nav),
    `${wikiRails.nav}/${wikiRails.feed} → ${wikiDrag.nav}/${wikiDrag.feed}｜落盘 ${wikiDrag.stored}`,
  )
  await p.click('.wiki button:has-text("新手教程")')
  await p.waitForTimeout(500)
  const guideRails = await p.evaluate(() => {
    const grid = document.querySelector('.wiki__grid')
    const feed = document.querySelector('.wiki__feed')
    return {
      handles: Array.from(document.querySelectorAll('.width-handle')).map((h) => h.dataset.side),
      gap: Math.round(feed.getBoundingClientRect().left - grid.getBoundingClientRect().left),
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    }
  })
  check(
    'Wiki 教程区没有左栏：只剩右边那条，且不再留一条空轨道',
    guideRails.handles.length === 1 &&
      guideRails.handles[0] === 'right' &&
      guideRails.gap === 0 &&
      guideRails.columns === 2,
    JSON.stringify(guideRails),
  )
  await p.click('.wiki button:has-text("资料")')
  await p.waitForTimeout(400)
  await p.evaluate(() => {
    localStorage.removeItem('desktop.wikiNavWidth')
    localStorage.removeItem('desktop.wikiAsideWidth')
  })

  // 14 任务栏对齐：拖长/加厚之后图标要居中，但不是从左边排起、也不是靠滚动容器居中
  const dockAlign = await p.evaluate(() => {
    const dock = document.querySelector('nav[aria-label="任务栏"]')
    const scroller = dock?.querySelector('.no-scrollbar')
    const inner = scroller?.firstElementChild
    const innerStyle = inner ? getComputedStyle(inner) : null
    return {
      dockJustify: dock ? getComputedStyle(dock).justifyContent : '',
      scrollerJustify: scroller ? getComputedStyle(scroller).justifyContent : '',
      /* 用类名判断：auto 外边距的 computed 值会按有没有富余空间解析成 0px / 具体值 */
      innerClass: inner ? String(inner.className) : '',
    }
  })
  check(
    '任务栏居中靠「内层 m-auto」（滚动容器上写 justify-center 会让两端滚不到）',
    dockAlign.dockJustify === 'center' &&
      dockAlign.scrollerJustify !== 'center' &&
      dockAlign.innerClass.includes('m-auto'),
    JSON.stringify(dockAlign),
  )

  // 14b 任务栏被压小 / 加厚时的行为。三条都验：
  //     · 两端都要滚得到（曾经把 justify-center 写在滚动容器上，超出的那侧永远够不到）
  //     · 两端固定的三个按钮不能被顶出任务栏边界（长度下限要装得下它们）
  //     · 加厚 + 拖过长度之后仍要折成多行（折行的尺寸上限不能只在 length === null 时加）
  const dockBefore = await p.evaluate(() => {
    const raw = localStorage.getItem('desktop.dock')
    const dock = raw ? JSON.parse(raw) : {}
    dock.position = 'bottom'
    dock.length = 260
    dock.thickness = 150
    dock.iconSize = null
    localStorage.setItem('desktop.dock', JSON.stringify(dock))
    return raw
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(900)
  const dockProbe = await p.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="任务栏"]')
    const scroller = bar?.querySelector('.no-scrollbar')
    const items = scroller?.firstElementChild
    if (!bar || !scroller || !items) return null
    const icons = [...items.querySelectorAll('button[aria-label]')]
    const box = scroller.getBoundingClientRect()
    const barBox = bar.getBoundingClientRect()
    const fixed = [
      bar.querySelector('button[aria-label="所有项目"]'),
      bar.querySelector('button[aria-label="全屏"], button[aria-label="退出全屏"]'),
      bar.querySelector('button[aria-label="任务栏位置"]'),
    ].filter(Boolean)

    const firstAtStart = icons[0].getBoundingClientRect().left - box.left
    scroller.scrollLeft = 99999
    const maxScroll = Math.round(scroller.scrollLeft)
    const lastAtEnd = icons[icons.length - 1].getBoundingClientRect().right - box.left
    scroller.scrollLeft = 0

    return {
      viewport: Math.round(box.width),
      content: scroller.scrollWidth,
      maxScroll,
      firstReachable: firstAtStart >= -1,
      lastReachable: lastAtEnd <= box.width + 1,
      fixedInside: fixed.every((b) => {
        const r = b.getBoundingClientRect()
        return r.left >= barBox.left - 1 && r.right <= barBox.right + 1
      }),
      rows: new Set(icons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      iconHeight: Math.round(icons[0].getBoundingClientRect().height),
      itemsHeight: Math.round(items.getBoundingClientRect().height),
    }
  })
  check(
    '小任务栏：两端都滚得到，且三个固定按钮不越界',
    !!dockProbe &&
      dockProbe.maxScroll > 0 &&
      dockProbe.firstReachable &&
      dockProbe.lastReachable &&
      dockProbe.fixedInside,
    JSON.stringify(dockProbe),
  )
  check(
    '加厚 + 拖过长度之后仍折成多行',
    !!dockProbe && dockProbe.rows > 1 && dockProbe.itemsHeight >= dockProbe.iconHeight * 2,
    JSON.stringify({
      rows: dockProbe?.rows,
      itemsHeight: dockProbe?.itemsHeight,
      iconHeight: dockProbe?.iconHeight,
    }),
  )
  /* 还原任务栏设置并重新加载，别影响后面的检查 */
  await p.evaluate((raw) => {
    if (raw === null) localStorage.removeItem('desktop.dock')
    else localStorage.setItem('desktop.dock', raw)
  }, dockBefore)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  // 14c 固定图标尺寸时，厚度下限要跟着图标走。
  //     曾经是写死的 48：选了 64 的图标再把厚度拖薄，10 个图标会全被裁掉一截
  const iconBefore = await p.evaluate(() => {
    const raw = localStorage.getItem('desktop.dock')
    const dock = raw ? JSON.parse(raw) : {}
    dock.position = 'bottom'
    dock.length = null
    dock.thickness = 48
    dock.iconSize = 64
    localStorage.setItem('desktop.dock', JSON.stringify(dock))
    return raw
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(800)
  const iconFit = await p.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="任务栏"]')
    const inner = bar?.querySelector('.no-scrollbar')
    if (!bar || !inner) return null
    const barBox = bar.getBoundingClientRect()
    const innerBox = inner.getBoundingClientRect()
    const icons = [...inner.querySelectorAll('button[aria-label]')]
    const outside = (box) =>
      icons.filter((b) => {
        const r = b.getBoundingClientRect()
        return r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5
      }).length
    return {
      barHeight: Math.round(barBox.height),
      iconSize: Math.round(icons[0]?.getBoundingClientRect().height ?? 0),
      outsideBar: outside(barBox),
      clippedByScroll: outside(innerBox),
    }
  })
  check(
    '固定图标尺寸时厚度下限跟着图标走（图标不被裁）',
    !!iconFit &&
      iconFit.iconSize === 64 &&
      iconFit.barHeight >= 78 &&
      iconFit.outsideBar === 0 &&
      iconFit.clippedByScroll === 0,
    JSON.stringify(iconFit),
  )
  /* 还原并重新加载 */
  await p.evaluate((raw) => {
    if (raw === null) localStorage.removeItem('desktop.dock')
    else localStorage.setItem('desktop.dock', raw)
  }, iconBefore)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  // 14d 桌面挂件「日月时钟」：随时刻变色（像太阳）、入夜换月亮、按日期显示月相
  const clock = await p.evaluate(() => {
    const el = document.querySelector('.celestial')
    if (!el) return null
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const text = (sel) => el.querySelector(sel)?.textContent?.trim() ?? ''
    return {
      time: text('.celestial__time'),
      expected: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      hour: now.getHours(),
      phase: el.dataset.phase,
      disc: el.querySelector('.celestial__disc')?.dataset.disc ?? '',
      moon: text('.celestial__phase'),
      illum: Number(text('.celestial__illum').replace('%', '')),
      moonsvg: !!el.querySelector('.celestial__moonLit'),
      z: Number(getComputedStyle(el).zIndex),
    }
  })
  const toSeconds = (value) => {
    const [h, m, s] = String(value).split(':').map(Number)
    return h * 3600 + m * 60 + (s || 0)
  }
  check(
    '桌面有日月时钟挂件，读数与系统时间一致（精确到秒）',
    !!clock &&
      Math.abs(toSeconds(clock.time) - toSeconds(clock.expected)) <= 2 &&
      /* z 在壁纸之上、窗口层（z-10 / 最大化 z-60）之下 */
      clock.z > 0 &&
      clock.z < 10,
    JSON.stringify(clock),
  )
  /* 用户报过"时间停在那一刻、点刷新才动"：时钟必须自己走，而且不依赖刷新。
     这里只等两秒多，靠秒数变化就能证明它在自己跳 */
  const secondsA = await p.evaluate(
    () => document.querySelector('.celestial__seconds')?.textContent ?? '',
  )
  await p.waitForTimeout(2600)
  const secondsB = await p.evaluate(
    () => document.querySelector('.celestial__seconds')?.textContent ?? '',
  )
  check(
    '时钟自己会走（不刷新页面也在跳秒）',
    /^:\d\d$/.test(secondsA) && /^:\d\d$/.test(secondsB) && secondsA !== secondsB,
    `${secondsA} → ${secondsB}`,
  )
  const isDay = !!clock && clock.hour >= 6 && clock.hour < 18
  check(
    '白天是太阳、入夜换月亮（月亮是 SVG 画的相位形状）',
    !!clock &&
      clock.phase === (isDay ? 'day' : 'night') &&
      clock.disc === (isDay ? 'sun' : 'moon') &&
      clock.moonsvg === !isDay,
    JSON.stringify({ phase: clock?.phase, disc: clock?.disc, moonsvg: clock?.moonsvg, isDay }),
  )
  const MOON_NAMES = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月']
  check(
    '月相名在八相里，且与照亮百分比自洽',
    !!clock &&
      MOON_NAMES.includes(clock.moon) &&
      clock.illum >= 0 &&
      clock.illum <= 100 &&
      (clock.moon !== '满月' || clock.illum >= 95) &&
      (clock.moon !== '新月' || clock.illum <= 5) &&
      (!['上弦月', '下弦月'].includes(clock.moon) || Math.abs(clock.illum - 50) <= 13),
    JSON.stringify({ moon: clock?.moon, illum: clock?.illum }),
  )

  /* 拿假时钟另开页面：颜色随时间变、月相随日期变。
     月相那两条是**已知天象** —— 2024-04-08 日全食必是新月、2024-03-25 半影月食必是满月 */
  const probeSky = async (fixedIso) => {
    const q = await ctx.newPage()
    await q.addInitScript((iso) => {
      const Real = Date
      const fixed = new Real(iso).getTime()
      class FakeDate extends Real {
        constructor(...args) {
          if (args.length === 0) super(fixed)
          else super(...args)
        }
        static now() {
          return fixed
        }
      }
      window.Date = FakeDate
    }, fixedIso)
    await q.goto(`${BASE}/`, { waitUntil: 'load' })
    await q.waitForTimeout(600)
    const info = await q.evaluate(() => {
      const el = document.querySelector('.celestial')
      const text = (sel) => el.querySelector(sel)?.textContent?.trim() ?? ''
      return {
        time: text('.celestial__time'),
        disc: el.querySelector('.celestial__disc')?.dataset.disc ?? '',
        sky: getComputedStyle(el.querySelector('.celestial__sky')).backgroundImage,
        moon: text('.celestial__phase'),
        illum: Number(text('.celestial__illum').replace('%', '')),
      }
    })
    await q.close()
    return info
  }
  const dawnSky = await probeSky('2026-09-29T06:40:00')
  const noonSky = await probeSky('2026-09-29T12:00:00')
  const nightSky = await probeSky('2026-09-29T23:30:00')
  check(
    '颜色随时刻变：拂晓 / 正午 / 深夜各不相同，且只有白天挂太阳',
    dawnSky.sky !== noonSky.sky &&
      noonSky.sky !== nightSky.sky &&
      dawnSky.sky !== nightSky.sky &&
      dawnSky.disc === 'sun' &&
      noonSky.disc === 'sun' &&
      nightSky.disc === 'moon',
    JSON.stringify({
      discs: [dawnSky.time, noonSky.time, nightSky.time].join(' / '),
      dawn: dawnSky.sky.slice(0, 40),
      night: nightSky.sky.slice(0, 40),
    }),
  )
  const eclipseNew = await probeSky('2024-04-08T18:30:00')
  const eclipseFull = await probeSky('2024-03-25T15:00:00')
  check(
    '月相按日期算：2024-04-08（日全食）算出新月、2024-03-25（半影月食）算出满月',
    eclipseNew.moon === '新月' &&
      eclipseNew.illum <= 3 &&
      eclipseFull.moon === '满月' &&
      eclipseFull.illum >= 97,
    JSON.stringify({
      newMoon: `${eclipseNew.moon} ${eclipseNew.illum}%`,
      fullMoon: `${eclipseFull.moon} ${eclipseFull.illum}%`,
    }),
  )

  // 15 页面无运行时错误
  check('无未捕获的运行时错误', errors.length === 0, errors.join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} 通过`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('[verify] 运行失败：' + error.message)
  process.exit(1)
})
