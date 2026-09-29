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
  check('鼠标悬停任务栏图标显示名字', tooltip === '博客', `tooltip=${tooltip}`)

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
