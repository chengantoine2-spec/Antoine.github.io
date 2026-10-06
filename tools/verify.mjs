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
/* 顶部菜单栏（macOS P2，2026-10-06）：常驻 chrome，`lib/menubar.ts` 里 MENUBAR_SELECTOR 与此一致 */
const MENUBAR = '[data-menubar]'
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
  check('默认主题是 macOS 浅色（id = light），且没有残留的 data-skin', shell.theme === 'light' && shell.skin === null, shell.theme)
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
      embed: win.querySelector('[data-embed]')?.dataset.embed ?? '',
      hasFrame: win.querySelector('[data-dsh-frame]') !== null,
      enter: Array.from(win.querySelectorAll('button')).some((b) =>
        (b.textContent ?? '').includes('在窗口里打开 DSH'),
      ),
      outer: Array.from(win.querySelectorAll('button')).some((b) =>
        (b.textContent ?? '').includes('在独立窗口打开'),
      ),
    }
  })
  check(
    'DSH 窗口：地址可改、能探活、默认是说明卡（还没发请求）',
    !!dsh &&
      dsh.path === '/dsh' &&
      /^https?:\/\/[^\s]+$/.test(dsh.address) &&
      ['online', 'offline'].includes(dsh.probe) &&
      dsh.embed === 'off' &&
      !dsh.hasFrame &&
      dsh.enter &&
      dsh.outer,
    JSON.stringify(dsh),
  )

  /* 用户要求：DSH 要展示在桌面站窗口**里面**，不是跳出去。
     这里点一下就走内嵌 —— 对面没登录/没跑也不影响（我们只验它被挂进了这个窗口）。 */
  await p.click('[aria-label="DSH 窗口"] button:has-text("在窗口里打开 DSH")')
  await p.waitForTimeout(700)
  const dshEmbed = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="DSH 窗口"]')
    if (!win) return null
    const frame = win.querySelector('[data-dsh-frame]')
    const bar = win.querySelector('[data-dsh-bar]')
    const rect = frame?.getBoundingClientRect()
    const outer = win.getBoundingClientRect()
    const barRect = bar?.getBoundingClientRect()
    return {
      embed: win.querySelector('[data-embed]')?.dataset.embed ?? '',
      src: frame?.getAttribute('src') ?? '',
      w: Math.round(rect?.width ?? 0),
      h: Math.round(rect?.height ?? 0),
      winW: Math.round(outer.width),
      winH: Math.round(outer.height),
      outside: win.contains(frame),
      /* iframe 与窗口内沿的缝：窗口有 1px 边框，所以右/下/左期望都 ≈1px。
         底缝曾经是 41px（"窗口底下一条白边"），就是 h-full 没补上父级 p-5 的 40px */
      gaps: [
        Math.round(outer.right - (rect?.right ?? 0)),
        Math.round(outer.bottom - (rect?.bottom ?? 0)),
        Math.round((rect?.left ?? 0) - outer.left),
      ],
      /* 上边距 = 标题栏 24（macOS 值；工具条是浮层，不占高度） */
      topOffset: Math.round((rect?.top ?? 0) - outer.top),
      tabRowH: Math.round(win.querySelector('[data-frame-tabs]')?.getBoundingClientRect().height ?? 0),
      barH: Math.round(barRect?.height ?? 0),
      /* 收起时工具条的底应该在 iframe 顶之上（滑出去了） */
      barBottom: Math.round((barRect?.bottom ?? 0) - (rect?.top ?? 0)),
      /* 工具条里一个按钮的高度：barH 只比它多出内边距+边框 = 一行。
         折成两行时 barH ≈ 2×btnH（旧版就是 85 vs 24） */
      btnH: Math.round(bar?.querySelector('button')?.getBoundingClientRect().height ?? 0),
      hasHot: !!win.querySelector('[data-dsh-hot]'),
    }
  })
  check(
    'DSH 就地内嵌：iframe 占满整个正文，工具条是浮层且默认收起',
    !!dshEmbed &&
      dshEmbed.embed === 'on' &&
      dshEmbed.outside &&
      dshEmbed.src === dsh.address &&
      dshEmbed.w > dshEmbed.winW - 4 &&
      dshEmbed.h > dshEmbed.winH * 0.8 &&
      dshEmbed.gaps.every((gap) => Math.abs(gap) <= 2) &&
      /* 正文区从框顶往下就是**一行**（标签行与窗口按钮同排，2026-10-05 改的），
         所以偏移量就是标题栏那一行的高度（24px），不再额外加一行标签栏 */
      Math.abs(dshEmbed.topOffset - 24) <= 3 &&
      dshEmbed.hasHot &&
      dshEmbed.barH >= 44 &&
      dshEmbed.barH - dshEmbed.btnH <= 24 &&
      dshEmbed.barBottom <= 2,
    JSON.stringify(dshEmbed),
  )

  /* 鼠标碰到窗口上边界那条热区 → 工具条滑下来；这一下不改变正文高度（还是浮层） */
  await p.hover('[aria-label="DSH 窗口"] [data-dsh-hot]')
  await p.waitForTimeout(400)
  const dshReveal = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="DSH 窗口"]')
    const frame = win?.querySelector('[data-dsh-frame]')
    const bar = win?.querySelector('[data-dsh-bar]')
    const frameRect = frame?.getBoundingClientRect()
    const barRect = bar?.getBoundingClientRect()
    return {
      barH: Math.round(barRect?.height ?? 0),
      drop: Math.round((barRect?.bottom ?? 0) - (frameRect?.top ?? 0)),
      frameH: Math.round(frameRect?.height ?? 0),
    }
  })
  const frameBefore = dshEmbed?.h ?? 0
  check(
    '鼠标移到窗口上边界才露出工具条（下来时正文高度不变）',
    dshReveal.barH >= 44 && dshReveal.drop >= 40 && Math.abs(dshReveal.frameH - frameBefore) <= 2,
    JSON.stringify({ ...dshReveal, frameBefore }),
  )

  /* 用户：「DSH 工具条加 50% 透明度，点击上边框可以保持显示」 */
  const barOpacity = await p.evaluate(
    () => getComputedStyle(document.querySelector('[data-dsh-bar]')).opacity,
  )
  await p.click('[aria-label="DSH 窗口"] [data-dsh-hot]')
  await p.waitForTimeout(250)
  /* 指针挪到窗口中间（远离上边界）：固定住的话工具条不该收 */
  const dshBox = await p.locator('[aria-label="DSH 窗口"]').boundingBox()
  await p.mouse.move(dshBox.x + dshBox.width / 2, dshBox.y + dshBox.height / 2)
  await p.waitForTimeout(400)
  const dshPinned = await p.evaluate(() => {
    const bar = document.querySelector('[data-dsh-bar]')
    const frame = document.querySelector('[data-dsh-frame]')
    return {
      pinned: bar?.dataset.dshPinned ?? '',
      drop: Math.round(
        (bar?.getBoundingClientRect().bottom ?? 0) - (frame?.getBoundingClientRect().top ?? 0),
      ),
    }
  })
  check(
    'DSH 工具条半透明（50%），点一下上边框就固定住',
    barOpacity === '0.5' && dshPinned.pinned === 'true' && dshPinned.drop >= 40,
    JSON.stringify({ barOpacity, ...dshPinned }),
  )

  await p.click('[aria-label="DSH 窗口"] [data-dsh-hot]')
  await p.waitForTimeout(150)
  await p.mouse.move(dshBox.x + dshBox.width / 2, dshBox.y + dshBox.height / 2)
  await p.waitForTimeout(500)
  const dshUnpinned = await p.evaluate(() => {
    const bar = document.querySelector('[data-dsh-bar]')
    const frame = document.querySelector('[data-dsh-frame]')
    return {
      pinned: bar?.dataset.dshPinned ?? '',
      hidden:
        (bar?.getBoundingClientRect().bottom ?? 0) <=
        (frame?.getBoundingClientRect().top ?? 0) + 1,
    }
  })
  check(
    '再点一下取消固定，工具条回到自动隐藏',
    dshUnpinned.pinned === 'false' && dshUnpinned.hidden,
    JSON.stringify(dshUnpinned),
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
    /* ⚠️ 抓标题栏**右端的空白占位区**，别抓中点：macOS 排版下标签行是**居中**的，
       标题栏正中间正好压在一个标签上 —— 那是"拖标签"而不是"拖窗口"（踩过，位置就变不动了） */
    return { x: r.right - 24, y: r.y + r.height / 2 }
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
  await p.getByRole('button', { name: /^深色/ }).click()
  await p.waitForTimeout(300)
  const themed = await p.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
  }))
  check('切到深色主题（macOS 深）+ 强调蓝 #0a85ff', themed.theme === 'dark' && themed.accent === '#0a85ff', themed.accent)

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
  /* ⚠️ 这一步只测**任务栏自己的几何**，所以要回一个**干净桌面**再量：
     上一步开过设置窗口，而顶部有了菜单栏之后窗口层矮了 28px，那个窗口正好压在任务栏**上沿**
     那条"边缘拖拽带"上（实测 `设置 窗口@97..717`，任务栏上沿在 712）。按"任务栏不挡窗口"的规则，
     越出窗口层的窗口会被提到任务栏之上（z-60），于是 `dblclick` 落在窗口上、厚度不动 ——
     这不是 bug、是那条规则的正常表现。
     ⚠️ 光 `goto('/')` 不够：**会话记忆会把窗口开回来**（实测刷新后 关于 + 设置 都回来了），
     所以先清掉 `desktop.openWindows` 再回桌面。 */
  await p.evaluate(() => localStorage.removeItem('desktop.openWindows'))
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForTimeout(700)
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
  let navH2 = await p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height), DOCK)
  if (navH2 !== navH0) {
    /* 偶发：刚拖完的指针状态下这两次 click 之间会重渲染，`dblclick` 有时不派发。
       单独复现（干净页面 → 拖到 84 → 双击）是好的，所以这里补一次重试而不是放宽断言。 */
    await p.mouse.dblclick(edge2.x, edge2.y)
    await p.waitForTimeout(350)
    navH2 = await p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height), DOCK)
  }
  /* 诊断用：把"双击那一点到底命中谁、存档写的是什么"一并带进断言详情，
     纸上推演过两轮都不是，直接要数据 */
  const dblProbe = await p.evaluate((dockSel) => {
    const el = document.querySelectorAll(`${dockSel} [role="separator"]`)[0]
    const r = el.getBoundingClientRect()
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    return {
      cx: Math.round(cx),
      cy: Math.round(cy),
      hit: hit ? `${hit.tagName.toLowerCase()}.${(hit.className ?? '').toString().slice(0, 46)}` : 'none',
      isSep: hit === el || el.contains(hit),
      stored: JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').thickness ?? null,
      closed: !document.querySelector('.desktop__layer section'),
      /* 到底哪个窗口压在这条边缘上？把每个窗口的纵向范围都打出来 */
      hitIn: (() => {
        const s = hit?.closest('section')
        return s?.getAttribute('aria-label') ?? ''
      })(),
      wins: [...document.querySelectorAll('.desktop__layer section')].map((s) => {
        const r = s.getBoundingClientRect()
        return `${s.getAttribute('aria-label')}@${Math.round(r.top)}..${Math.round(r.bottom)}`
      }),
    }
  }, DOCK)
  check(
    '双击边缘回到自适应厚度',
    navH2 === navH0,
    `${navH1} → ${navH2}｜${JSON.stringify(dblProbe)}`,
  )

  // 8 任务栏应用勾选
  /* 上一步为了量任务栏几何把窗口都清掉了，这一步要在**设置窗口**里勾选：
     按路由重新打开它（会话记忆已清，不会把别的窗口一起带回来） */
  await p.goto(`${BASE}/settings`, { waitUntil: 'load' })
  await p.waitForTimeout(700)
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

  // 11d 顶部菜单栏里的「全屏」按钮：走 Fullscreen API，要真的进全屏（连浏览器窗口一起盖住），
  //     按钮自己也要跟着状态变 —— 和"窗口最大化"不是一回事。
  //     2026-10-06（macOS P2）：这颗按钮**从任务栏挪进了菜单栏**（macOS 的 Dock 两端只有
  //     启动台与废纸篓），所以选择器从 DOCK 换成 MENUBAR，并顺手断言"任务栏里已经没有它了"。
  const FS_BTN = `${MENUBAR} button[aria-label="全屏"], ${MENUBAR} button[aria-label="退出全屏"]`
  await p.click(FS_BTN)
  await p.waitForTimeout(300)
  /* 2026-10-06：菜单栏进全屏后**收起**了（照 macOS），但指针这会儿还停在刚点过的按钮那一带 ——
     先把它挪开，量的才是"指针不在顶部时它是收起的"这个默认态。 */
  await p.mouse.move(640, 420)
  await p.waitForTimeout(320)
  const fsIn = await p.evaluate((sel) => {
    const el = document.querySelector('[data-menubar]')
    const cs = el ? getComputedStyle(el) : null
    const r = el?.getBoundingClientRect()
    return {
      on: document.fullscreenElement !== null,
      menuLabel:
        document.querySelector(`${sel} button[aria-label="退出全屏"]`)?.getAttribute('aria-label') ?? '',
      /* ⚠️ 收起**不是** `display: none`：站主 2026-10-06 要「鼠标碰顶部就浮现菜单栏」，
         所以收起 = 滑上去（transform + opacity），这样热区才唤得回来。 */
      dataFs: el?.getAttribute('data-fs') ?? '',
      dataHidden: el?.getAttribute('data-hidden') ?? '',
      display: cs?.display ?? '',
      offscreen: (r?.bottom ?? 1) <= 0,
      stillInDock: !!document.querySelector(
        'nav[aria-label="任务栏"] button[aria-label="退出全屏"], nav[aria-label="任务栏"] button[aria-label="全屏"]',
      ),
      titleButtons: [
        ...document.querySelectorAll('[aria-label="博客 窗口"] [data-window-controls] button'),
      ].map((b) =>
        b.getAttribute('aria-label'),
      ),
    }
  }, MENUBAR)
  check(
    '菜单栏「全屏」按钮进入浏览器全屏（连浏览器窗口一起盖住），菜单栏按 macOS 收起（滑上去、不是 display:none），任务栏里已无此按钮',
    /* macOS 交通灯的**顺序**：左起 红（关闭）→ 黄（最小化）→ 绿（最大化 / 还原）。
       进全屏时会顺手最大化当前窗口，所以绿点是「还原」 */
    fsIn.on &&
      fsIn.menuLabel === '退出全屏' &&
      fsIn.dataFs === 'on' &&
      fsIn.dataHidden === 'true' &&
      fsIn.display !== 'none' &&
      fsIn.offscreen &&
      !fsIn.stillInDock &&
      fsIn.titleButtons.join(',') === '关闭,最小化,还原',
    JSON.stringify(fsIn),
  )

  /* 11d1 全屏里「鼠标碰顶部就浮现菜单栏」（站主 2026-10-06 点名要的 macOS 细节）。
     ⚠️ 这三条跑在**真·浏览器全屏**里（上一条刚进去），不是驱动标记。 */
  const hot = await p.evaluate(() => {
    const el = document.querySelector('[data-menubar-hot]')
    const r = el?.getBoundingClientRect()
    const token =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--menubar-hot')) || 0
    return { exists: !!el, top: Math.round(r?.top ?? -1), h: Math.round(r?.height ?? -1), token: Math.round(token) }
  })
  check(
    '全屏里屏幕顶端有一条唤出菜单栏的热区（贴 y=0、高 4~6px、与令牌 --menubar-hot 一致）',
    hot.exists && hot.top === 0 && hot.h >= 4 && hot.h <= 6 && hot.h === hot.token,
    JSON.stringify(hot),
  )

  await p.mouse.move(640, 2)
  await p.waitForTimeout(260)
  const revealed = await p.evaluate(() => {
    const el = document.querySelector('[data-menubar]')
    const r = el?.getBoundingClientRect()
    return {
      dataHidden: el?.getAttribute('data-hidden') ?? '',
      opacity: getComputedStyle(el).opacity,
      bottom: Math.round(r?.bottom ?? -1),
    }
  })
  check(
    '鼠标碰到顶部热区 → 菜单栏滑下来（可见，且不是被 display 藏着的）',
    revealed.dataHidden === 'false' && Number(revealed.opacity) > 0.9 && revealed.bottom > 0,
    JSON.stringify(revealed),
  )

  /* 滑下来之后必须**真的能操作**（不许"看得见点不着"）：点开「显示」菜单 */
  await p.click(`${MENUBAR} button[aria-label="显示"]`)
  await p.waitForTimeout(150)
  const interact = await p.evaluate(() => ({
    open: !!document.querySelector('[data-menubar] [role="menu"]'),
    items: document.querySelectorAll('[data-menubar] [role="menu"] [role="menuitem"]').length,
  }))
  check(
    '浮现出来的菜单栏能真的操作（点开「显示」菜单，项都可点）',
    interact.open && interact.items >= 3,
    JSON.stringify(interact),
  )

  /* 移开指针：**不许立刻收**（立刻收就会在"热区↔菜单栏"之间闪，DSH 工具条踩过这个坑） */
  await p.keyboard.press('Escape')
  await p.mouse.move(640, 420)
  await p.waitForTimeout(60)
  const justLeft = await p.evaluate(
    () => document.querySelector('[data-menubar]')?.getAttribute('data-hidden') ?? '',
  )
  await p.waitForTimeout(420)
  const afterLeave = await p.evaluate(
    () => document.querySelector('[data-menubar]')?.getAttribute('data-hidden') ?? '',
  )
  check(
    '指针移开后**不是立刻**收（延迟约 180ms 才滑回去）',
    justLeft === 'false' && afterLeave === 'true',
    JSON.stringify({ justLeft, afterLeave }),
  )

  /* 全屏里菜单栏是收起的（照 macOS），所以退全屏不能再点那颗按钮。
     ⚠️ **合成的 `Escape` 不行**：退出全屏是**浏览器级**手势，Playwright 合成的按键不触发它
     （实测：按完 `document.fullscreenElement` 还在，后面一串检查全被"卡在全屏"带红）。
     这里显式调用 Fullscreen API 退出，然后照样断言"菜单栏回来了、按钮回到全屏" —— 覆盖的是同一条链路。 */
  await p.evaluate(() => document.exitFullscreen())
  await p.waitForTimeout(350)
  const fsOut = await p.evaluate((sel) => {
    const el = document.querySelector('[data-menubar]')
    const r = el?.getBoundingClientRect()
    return {
      on: document.fullscreenElement !== null,
      menuLabel: document.querySelector(`${sel} button[aria-label="全屏"]`)?.getAttribute('aria-label') ?? '',
      menubarVisible: getComputedStyle(el).display !== 'none',
      /* 退出全屏 → 恢复**常驻**（`data-fs=off` / `data-hidden=false`、整条在视口里） */
      dataFs: el?.getAttribute('data-fs') ?? '',
      dataHidden: el?.getAttribute('data-hidden') ?? '',
      onScreen: (r?.top ?? -1) === 0 && (r?.bottom ?? 0) > 0,
    }
  }, MENUBAR)
  check(
    '退出全屏（走 Fullscreen API）：菜单栏恢复常驻（不再是收起态）、按钮回到「全屏」',
    !fsOut.on &&
      fsOut.menuLabel === '全屏' &&
      fsOut.menubarVisible &&
      fsOut.dataFs === 'off' &&
      fsOut.dataHidden === 'false' &&
      fsOut.onScreen,
    JSON.stringify(fsOut),
  )

  /* 进全屏时顺手把当前窗口最大化了 —— 还原掉，别留给后面那几条"最大化"的检查 */
  await p.click(MAX_BTN)
  await p.waitForTimeout(200)

  // 12 最大化按钮必须跟着状态变（曾经写死成「最大化」，最大化之后完全看不出来，
  //    只能靠肉眼发现 —— 所以这里补一条回归检查）
  await p.click(MAX_BTN)
  const maxed = await p.evaluate(() => {
    const win = document.querySelector('[aria-label="博客 窗口"]')
    const btn = win?.querySelector('header button[aria-pressed]')
    const dock = document.querySelector('[aria-label="任务栏"]')
    const menubar = document.querySelector('[data-menubar]')
    const w = win?.getBoundingClientRect()
    const d = dock?.getBoundingClientRect()
    const m = menubar?.getBoundingClientRect()
    /* 命中测试：任务栏中心点上最顶层的元素若不属于任务栏，说明窗口真的把它盖住了 */
    const hit = d ? document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2) : null
    /* 菜单栏中线那一点命中的应该是菜单栏自己（= 最大化不盖菜单栏） */
    const hitTop = m ? document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2) : null
    return {
      label: btn?.getAttribute('aria-label') ?? '',
      pressed: btn?.getAttribute('aria-pressed') === 'true',
      isMax: (win?.className ?? '').includes('window--max'),
      /* macOS 的绿点用**文字字形**，不再是 SVG（旧的 – □ × 那套连同 MaximizeGlyph 一起撤了）：
         未最大化时是 `+`，最大化 / 还原态是 `−`（U+2212） */
      glyph: (btn?.querySelector('span')?.textContent ?? '').trim(),
      /* "铺满"的定义随 macOS 口径走了两步：P2 = 菜单栏之下到**屏幕底**；P4 = 菜单栏下沿到
         **任务栏上沿**（macOS 的缩放连 Dock 一起留出来）。这里量的是后者：四边都贴工作区。 */
      menuH: Math.round(m?.height ?? 0),
      /* 期望的工作区 = 外壳算好的让位（`--inset-*` 继承了菜单栏高度 + 任务栏位置/厚度）。
         不拿任务栏那条"药丸"的矩形当基准：让位余量含 DOCK_MARGIN*2，和药丸的实际边缘差几像素。 */
      insets: (() => {
        const layer = document.querySelector('.desktop__layer')
        const cs = layer ? getComputedStyle(layer) : null
        const num = (k) => (cs ? parseFloat(cs.getPropertyValue(k)) || 0 : 0)
        return {
          top: num('--inset-top'),
          right: num('--inset-right'),
          bottom: num('--inset-bottom'),
          left: num('--inset-left'),
        }
      })(),
      fillsWorkArea: (() => {
        const layer = document.querySelector('.desktop__layer')
        const cs = layer ? getComputedStyle(layer) : null
        const num = (k) => (cs ? parseFloat(cs.getPropertyValue(k)) || 0 : 0)
        if (!w || !m) return false
        return (
          Math.abs(w.top - num('--inset-top')) <= 1 &&
          Math.abs(w.left - num('--inset-left')) <= 1 &&
          Math.abs(w.right - (window.innerWidth - num('--inset-right'))) <= 1 &&
          Math.abs(w.bottom - (window.innerHeight - num('--inset-bottom'))) <= 1 &&
          Math.abs(w.top - m.bottom) <= 1
        )
      })(),
      /* 换任务栏位置（左/右）时"也让位"不在这里量：`.window--max` 用的是外壳算好的 `--inset-*`
         （`dockInsets()` 已把位置算进去），所以换边自动生效；这条由下面那条 CSS 契约断言守住。 */
      maxUsesInsets: (() => {
        const el = [...document.styleSheets]
          .flatMap((s) => {
            try {
              return [...s.cssRules]
            } catch {
              return []
            }
          })
          .find((r) => r.selectorText === '.window--max')
        const css = el?.style ?? null
        return !!css && /var\(--inset-(top|bottom|left|right)/.test(css.cssText)
      })(),
      coversMenuBar: !!w && !!m && w.top < m.bottom - 1,
      menubarOnTop: !!menubar && !!hitTop && menubar.contains(hitTop),
      coversDock: !!w && !!d && w.top <= d.top && w.bottom >= d.bottom && w.left <= d.left && w.right >= d.right,
      dockOnTop: !!dock && !!hit && dock.contains(hit),
    }
  })
  check(
    '最大化后交通灯绿点变成「还原」态（label=还原、aria-pressed、字形 −）',
    maxed.label === '还原' && maxed.pressed && maxed.isMax && maxed.glyph === '\u2212',
    JSON.stringify({ label: maxed.label, pressed: maxed.pressed, isMax: maxed.isMax, glyph: maxed.glyph }),
  )
  check(
    '最大化 = macOS 的「缩放」：铺满工作区（菜单栏下沿 → 任务栏上沿），**既不盖菜单栏也不盖任务栏**',
    maxed.fillsWorkArea &&
      maxed.maxUsesInsets &&
      !maxed.coversDock &&
      /* 语义反转：以前"最大化盖住任务栏"所以要求 `!dockOnTop`；现在 macOS 缩放留出 Dock，
         任务栏**应该**点得到 —— 必须断言 `dockOnTop`，否则就是又把 Dock 盖回去了 */
      maxed.dockOnTop &&
      !maxed.coversMenuBar &&
      maxed.menubarOnTop,
    JSON.stringify({
      menuH: maxed.menuH,
      fillsWorkArea: maxed.fillsWorkArea,
      maxUsesInsets: maxed.maxUsesInsets,
      leavesDockVisible: !maxed.coversDock,
      coversDock: maxed.coversDock,
      dockOnTop: maxed.dockOnTop,
      coversMenuBar: maxed.coversMenuBar,
      menubarOnTop: maxed.menubarOnTop,
    }),
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
  /* 桌面能同时开好几个窗口了，这里先清场：不然别的窗口里同名的拖动条 / 按钮
     会被全局选择器一起选中（'.width-handle[data-side="left"]' 就踩过） */
  await closeAllWindows()
  await p.waitForTimeout(200)
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
  /* 同样先清场：Wiki 的栏宽拖动条和博客文章页那两条是同一套 DOM（.width-handle），
     两个窗口一起开着时全局选择器会一次选中 4 个 */
  await closeAllWindows()
  await p.waitForTimeout(200)
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

  /* ── 14 任务栏图标区：默认是「图标区」（wheel）──────────────────────────────
     ⚠️ 2026-10-06「跟随 macOS 改成回弹，一切以 macOS 为准」把这里从**循环**改成了**回弹**：
       · 只渲染**一份**列表（原来是两份背靠背 + offset 取模归一化，转一圈回到起点）；
       · `offset` 夹在 [0, maxOffset]（maxOffset = 内容长 − 可视长；= 0 就是"装得下、不可拖"）；
       · 越界给橡皮筋阻尼（拉 100px 实移 < 100px）、松手用弹簧（1700/90）弹回端点；
       · 松手**不吸附到格子**（macOS 的 Dock 是滚动视图，停在哪儿就是哪儿）；
       · 放大峰仍 2×，但**边缘回到 1.0×**（macOS 不缩边缘图标，原来 0.8 那套撤了）。
     三个固定按钮（开始 / 全屏 / 位置）钉在两端，不参与滚动与放大。
     旧的折行行为保留成设置里的可选项（wrap），那套断言在 14e 那一段。 */
  /* ⚠️ 放大现在是**指针驱动**的（2026-10-06「一切以 macOS 为准」）：谁离指针近谁最大、
     指针不在 Dock 上时全部回 1×。所以 `mid` = **指针在主轴上位置**（没传就退回几何中点，
     那种情况只用于"指针移开后"的检查里排序，不参与判峰）。 */
  const wheelProbe = (pointerX = null) =>
    p.evaluate(({ sel, pointerX }) => {
      const bar = document.querySelector(sel)
      const view = bar?.querySelector('[data-dock-view]')
      const track = bar?.querySelector('[data-dock-track]')
      const items = [...(track?.querySelectorAll('[data-dock-item]') ?? [])]
      const primary = items.filter((b) => b.getAttribute('data-dock-copy') === '1')
      const vr = view?.getBoundingClientRect()
      const mid = pointerX ?? (vr ? vr.x + vr.width / 2 : 0)
      const byDistance = primary
        .map((b) => {
          const r = b.getBoundingClientRect()
          const m = new DOMMatrixReadOnly(getComputedStyle(b).transform)
          return { id: b.dataset.dockItem, d: Math.abs(r.x + r.width / 2 - mid), s: m.a }
        })
        .sort((a, b) => a.d - b.d)
      return {
        hasView: !!view,
        hasTrack: !!track,
        items: items.length,
        apps: primary.length,
        copies: new Set(items.map((b) => b.getAttribute('data-dock-copy'))).size,
        /* 单行判定用**布局** top（offsetTop），不能用 rect —— 放大后的 rect 每个都不一样 */
        rows: new Set(items.map((b) => Math.round(b.offsetTop))).size,
        named: items.filter((b) => b.hasAttribute('aria-label')).length,
        viewW: vr ? vr.width : 0,
        centerScale: Number((byDistance[0]?.s ?? 0).toFixed(3)),
        centerD: Number((byDistance[0]?.d ?? 0).toFixed(1)),
        secondScale: Number((byDistance[2]?.s ?? 0).toFixed(3)),
        edgeScale: Number((byDistance[byDistance.length - 1]?.s ?? 0).toFixed(3)),
        /* 放大曲线：`scale = PEAK - (PEAK-MIN)·u^1.5`（PEAK=2、**MIN=1.0**，u = 归一化距离）。
           2026-10-06「一切以 macOS 为准」：边缘图标回 1.0×（0.8 那套已撤）。 */
        monoOk: byDistance.every((it, i) => i === 0 || it.s <= byDistance[i - 1].s + 0.02),
        curve: byDistance.map((it) => Number(it.s.toFixed(2))),
        /* clip-path 只裁**主轴**：可视区左右两侧外面的点不该命中任何图标按钮（循环的第二份就藏在那儿） */
        clipPath: view ? getComputedStyle(view).clipPath : '',
        mainAxisClipped: (() => {
          if (!vr) return false
          const y = vr.y + vr.height / 2
          const hits = (x) => {
            const el = document.elementFromPoint(x, y)
            return !!el?.closest('[data-dock-item]')
          }
          return !hits(vr.right + 3) && !hits(vr.x - 3)
        })(),
        /* 凸出量：底栏时"任务栏顶边 − 中心图标顶边"，允许溢出，所以必须 > 0 */
        protrude: (() => {
          if (!vr || !bar) return 0
          const el = primary.find((b) => b.dataset.dockItem === byDistance[0]?.id)
          if (!el) return 0
          return Number((bar.getBoundingClientRect().top - el.getBoundingClientRect().top).toFixed(1))
        })(),
        /* 凸出来的那一截**真的看得见**：在任务栏上方 4px 处做命中测试，应该命中的就是这个图标
           （证明它没被 clip-path / 容器裁掉，也没被别的东西盖住） */
        protrudeHit: (() => {
          if (!bar) return false
          const el = primary.find((b) => b.dataset.dockItem === byDistance[0]?.id)
          if (!el) return false
          const r = el.getBoundingClientRect()
          const hit = document.elementFromPoint(r.x + r.width / 2, bar.getBoundingClientRect().top - 4)
          return !!hit && (el === hit || el.contains(hit))
        })(),
        /* 贴栏那条边**原地不动**：把 transform 摘掉量一次（布局盒）、再装回去量一次（渲染盒）——
           同一个 evaluate 里同步做完，不触发绘制，所以不会闪。
           底栏贴栏的是**下边**（默认几何就是底栏）。对称放大的话这条边会往栏里沉半个增量。 */
        edge: (() => {
          const el = primary.find((b) => b.dataset.dockItem === byDistance[0]?.id)
          if (!el) return { drift: 999, grew: 0, baseH: 0 }
          const saved = el.style.transform
          el.style.transform = ''
          const base = el.getBoundingClientRect()
          el.style.transform = saved
          const cur = el.getBoundingClientRect()
          return {
            drift: Number(Math.abs(cur.bottom - base.bottom).toFixed(1)),
            grew: Number((cur.height - base.height).toFixed(1)),
            baseH: Math.round(base.height),
          }
        })(),
        mode: JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').mode ?? null,
        /* 回弹那套：可拖动的最大偏移（= 内容长 − 可视长；0 = 装得下、根本不用拖），
           以及橡皮筋最多能多拉出去多少（视口的 25%）。 */
        maxOffset: (() => {
          if (!vr || primary.length === 0) return 0
          const st = primary.length > 1 ? primary[1].offsetLeft - primary[0].offsetLeft : 0
          const content = primary.length > 1 ? (primary.length - 1) * st + primary[0].offsetWidth : 0
          return Math.max(0, Math.round(content - vr.width))
        })(),
        rubberDim: vr ? Math.round(vr.width * 0.25) : 0,
      }
    }, { sel: DOCK, pointerX })
  /* 把指针移到某个具体图标的**正中**（挑离可视区中点最近的那个，不会在边缘被裁），
     等放大强度平滑到位，再量曲线 —— 这就是"指针驱动"的测法：
     **指针正对的那个图标必须最大且 ≈2×**，而不是"几何中点那个最大"。 */
  const hoverTarget = await p.evaluate((sel) => {
    const view = document.querySelector(`${sel} [data-dock-view]`)
    if (!view) return null
    const vr = view.getBoundingClientRect()
    const mid = vr.x + vr.width / 2
    const cand = [...view.querySelectorAll('[data-dock-item][data-dock-copy="1"]')]
      .map((b) => {
        const r = b.getBoundingClientRect()
        return { id: b.dataset.dockItem, x: r.x + r.width / 2, y: r.y + r.height / 2, d: Math.abs(r.x + r.width / 2 - mid) }
      })
      .sort((a, b) => a.d - b.d)
    return cand[0] ?? null
  }, DOCK)
  await p.mouse.move(hoverTarget.x, hoverTarget.y)
  await p.waitForTimeout(340)
  const wheel0 = await wheelProbe(hoverTarget.x)
  check(
    '任务栏图标区：永远单行（所有图标同一个布局 top），图标区是**可滚动视口**（macOS 的回弹就建在它上面）',
    wheel0.rows === 1 && wheel0.hasView && wheel0.hasTrack && wheel0.apps > 1,
    JSON.stringify({ rows: wheel0.rows, view: wheel0.hasView, track: wheel0.hasTrack, apps: wheel0.apps }),
  )
  check(
    '只渲染**一份**列表：应用按钮数 == 应用数、每个都带无障碍名（循环的两份已按"以 macOS 为准"拆掉）',
    wheel0.copies === 1 && wheel0.items === wheel0.apps && wheel0.named === wheel0.apps,
    JSON.stringify({ copies: wheel0.copies, items: wheel0.items, named: wheel0.named, apps: wheel0.apps }),
  )
  /* 14a 图标是**功能图标**（2026-10-06「一切以 macOS 为准」把 2026-10-05 那条"任务栏换菜图"撤了）：
     彩色菜图与 macOS 那套圆角单色图标观感直接冲突 → 任务栏回到 `components/icons/**` 的功能图标。
     ⚠️ **菜地身份一个字都没删**（`SITE.name` / `AppDef.veggie` / `lib/veggies.ts` 48 张菜图），
     只是任务栏不再用它 —— 现在只出现在开始菜单与关于窗口。
     ⚠️ 同时钉住"无障碍名一个都没动" —— 两个脚本点任务栏全靠 `button[aria-label="X"]`。 */
  const glyphProbe = await p.evaluate((sel) => {
    const btns = [...document.querySelectorAll(`${sel} [data-dock-item][data-dock-copy="1"]`)]
    /* 量"图标 / 按钮"的填充比：**先把按钮上的放大 transform 摘掉再量**（放大后的 rect 不是布局尺寸），
       量完立刻装回去 —— 同一个 evaluate 里同步做完，不触发绘制，所以不会闪
       （和下面 `edge` 那条用同一个手法）。 */
    const measure = (b) => {
      const svg = b.querySelector('svg')
      if (!svg) return { btn: b.offsetWidth, glyph: 0 }
      const saved = b.style.transform
      b.style.transform = ''
      const bw = b.getBoundingClientRect().width
      const gw = svg.getBoundingClientRect().width
      b.style.transform = saved
      return { btn: Number(bw.toFixed(1)), glyph: Number(gw.toFixed(1)) }
    }
    const rows = btns.map((b) => {
      const m = measure(b)
      return {
        label: b.getAttribute('aria-label'),
        hasImg: !!b.querySelector('img'),
        hasSvg: !!b.querySelector('svg'),
        ...m,
        fill: m.btn > 0 ? Number((m.glyph / m.btn).toFixed(3)) : 0,
      }
    })
    return {
      total: rows.length,
      img: rows.filter((r) => r.hasImg).length,
      svg: rows.filter((r) => r.hasSvg).length,
      labelled: rows.filter((r) => r.label).length,
      fill: rows.map((r) => r.fill),
      sample: rows.slice(0, 3).map((r) => ({ btn: r.btn, glyph: r.glyph, fill: r.fill })),
    }
  }, DOCK)
  check(
    '任务栏图标是**功能图标**（每个按钮里都是 <svg>、没有菜图 <img>），且无障碍名一个没动',
    glyphProbe.total > 1 &&
      glyphProbe.svg === glyphProbe.total &&
      glyphProbe.img === 0 &&
      glyphProbe.labelled === glyphProbe.total,
    JSON.stringify(glyphProbe),
  )

  /* 14a2 图标**填充比**：`.dock__glyph` 读 `--dock-icon-fill`（默认 **72%**）。
     来历：`design/ICON-MACOS-BRIEF.md` 读代码量出来「图标只有按钮的一半」（默认 40px 按钮里 20px）
     是**与 macOS 差距最大的单点** —— macOS 的 Dock 图标几乎填满格子。这个值就是那条的回归：
     谁把 `.dock__glyph` 退回 `h-1/2`（或忘了挂 `--dock-icon-fill`），这里会红。 */
  check(
    'Dock 图标占按钮边长的 **72%**（原来 50%：40px 按钮里只有 20px、周围一圈空）',
    glyphProbe.fill.length > 0 && glyphProbe.fill.every((f) => Math.abs(f - 0.72) <= 0.04),
    JSON.stringify({ 期望: 0.72, 实测样本: glyphProbe.sample }),
  )

  /* 放大 = **指针驱动**（2026-10-06「一切以 macOS 为准」）：上面已经把指针移到某个图标正中，
     所以 `centerScale` 现在是"**指针正对的那个图标**"的 scale，`monoOk` 是"按离指针的距离单调递减"。
     PEAK = 2、MIN = 1.0（macOS 不缩边缘图标）、影响半径 `MAGNIFY_RADIUS_SLOTS = 3` 格。 */
  check(
    '指针驱动放大：**指针正对的那个图标最大且 ≥1.9×**、离指针越远越小、最外侧回到 1.0×（macOS 不缩边缘图标）',
    wheel0.centerScale >= 1.9 &&
      wheel0.monoOk &&
      wheel0.edgeScale >= 0.98 &&
      wheel0.edgeScale <= 1.02,
    JSON.stringify({
      指针正对的图标: wheel0.centerScale,
      曲线按离指针的距离: wheel0.curve,
      最外侧: wheel0.edgeScale,
      单调递减: wheel0.monoOk,
    }),
  )
  /* 允许凸出（站主："中间扩大的图标允许溢出，一种凸出任务栏的夸张感"）：
     不是把裁剪框撑大把 2× 装进去，而是图标从栏边凸出来。 */
  check(
    '放大的中心图标凸出任务栏 ≥ 整个放大增量（不是对称放大的一半），且贴栏那条边原地不动（≤2px）',
    wheel0.protrude >= 0.75 * wheel0.edge.baseH &&
      wheel0.edge.grew > 4 &&
      wheel0.edge.drift <= 2 &&
      wheel0.protrudeHit,
    JSON.stringify({
      凸出量: wheel0.protrude,
      图标边长: wheel0.edge.baseH,
      放大后长高: wheel0.edge.grew,
      贴栏边漂移: wheel0.edge.drift,
      凸出处命中图标: wheel0.protrudeHit,
    }),
  )
  check(
    '图标区只裁主轴（clip-path ≠ none）：可视区左右两侧外面的点命不中任何图标（滚出可视区的图标点不到）',
    wheel0.clipPath !== 'none' && wheel0.mainAxisClipped,
    JSON.stringify({ clipPath: wheel0.clipPath, 主轴外侧命不中图标: wheel0.mainAxisClipped }),
  )

  /* 14a3 **指针不在 Dock 上 = 不放大**（macOS 的行为：没有指针扫过时 Dock 是平的，
     没有"常驻的固定鱼眼"）。把指针移到屏幕中间再量：所有 scale 应该回到 1.0×。 */
  await p.mouse.move(640, 320)
  await p.waitForTimeout(360)
  const wheelAway = await wheelProbe()
  check(
    '指针**不在 Dock 上**时不放大：所有图标回 1.0×（没有常驻的固定鱼眼 —— macOS 只在指针扫过时放大）',
    wheelAway.curve.length > 0 && wheelAway.curve.every((s) => s <= 1.02),
    JSON.stringify({ 指针移开后: wheelAway.curve }),
  )

  /* 14b 拖拽浏览 + **回弹**（2026-10-06「跟随 macOS 改成回弹」）：
     按住沿轴拖 = 跟手；松手**不吸附到格子**（macOS 的 Dock 是滚动视图，停在哪儿就是哪儿）；
     到两端**被夹住**、越界只给橡皮筋阻尼（拉一大截实际只挪一点点）、松手 ≤300ms 弹回端点；
     装得下时根本不可拖。
     ⚠️ 要测"能拖"，得先让**内容比视口宽**：把任务栏定长到一个窄于内容的宽度
     （`length = null` 时图标区正好装下所有图标 → `maxOffset = 0` → macOS 行为就是不可拖，
     这一条在本节最后单独断言）。 */
  const trackState = () =>
    p.evaluate((sel) => {
      const bar = document.querySelector(sel)
      const view = bar?.querySelector('[data-dock-view]')
      const track = bar?.querySelector('[data-dock-track]')
      const items = [...(track?.querySelectorAll('[data-dock-item]') ?? [])]
      const primary = items.filter((b) => b.getAttribute('data-dock-copy') === '1')
      const m = track ? new DOMMatrixReadOnly(getComputedStyle(track).transform) : null
      const vr = view?.getBoundingClientRect()
      const step = primary.length > 1 ? primary[1].offsetLeft - primary[0].offsetLeft : 0
      const content = primary.length > 1 ? (primary.length - 1) * step + primary[0].offsetWidth : 0
      return {
        /* tx = track 的 translateX = **−offset**（往右拖内容 ⇒ tx 变大） */
        tx: m ? Math.round(m.e) : 0,
        step,
        items: primary.length,
        maxOffset: vr ? Math.max(0, Math.round(content - vr.width)) : 0,
        rubberDim: vr ? Math.round(vr.width * 0.25) : 0,
        cover: vr
          ? primary.filter((b) => {
              const r = b.getBoundingClientRect()
              return r.right > vr.x - 1 && r.x < vr.right + 1
            }).length
          : 0,
        viewW: vr ? Math.round(vr.width) : 0,
      }
    }, DOCK)

  /* 压窄任务栏，让内容真的溢出（否则 maxOffset = 0，拖动什么都不动） */
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
    Object.assign(raw, { length: 420, thickness: null, iconSize: null, position: 'bottom' })
    localStorage.setItem('desktop.dock', JSON.stringify(raw))
  })
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForTimeout(800)

  const wheelCenter = await p.evaluate((sel) => {
    const r = document.querySelector(`${sel} [data-dock-view]`)?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  }, DOCK)
  const track0 = await trackState()
  check(
    '回弹的前提：把任务栏压窄（length=420）后图标区**真的能滚**（maxOffset > 一个图标步长）',
    track0.maxOffset > track0.step,
    JSON.stringify({ maxOffset: track0.maxOffset, step: track0.step, viewW: track0.viewW, items: track0.items }),
  )
  /* 往**左**拖 120px（内容跟着走 ⇒ tx 变 −120）：这条方向不越界，才测得出"跟手" */
  await p.mouse.move(wheelCenter.x, wheelCenter.y)
  await p.mouse.down()
  for (let i = 1; i <= 12; i += 1) await p.mouse.move(wheelCenter.x - i * 10, wheelCenter.y)
  const trackDrag = await trackState()
  await p.mouse.up()
  await p.waitForTimeout(400)
  const trackSnap = await trackState()
  check(
    '拖拽浏览：按住沿轴拖 120px，内容跟着指针走（tx 正好差 −120）',
    Math.abs(trackDrag.tx - track0.tx - -120) <= 4,
    JSON.stringify({ before: track0.tx, during: trackDrag.tx, maxOffset: track0.maxOffset }),
  )
  check(
    '松手**不吸附到格子**（macOS 的 Dock 是滚动视图：停在哪儿就是哪儿，位置相对拖动前是 120px 的整倍数与否都不管）',
    Math.abs(trackSnap.tx - trackDrag.tx) <= 2,
    JSON.stringify({ 松手时: trackDrag.tx, 松手后: trackSnap.tx }),
  )
  /* 越界：往**右**拖 300px（越过起点那一端）——按住不放先量"被阻尼了多少" */
  await p.mouse.move(wheelCenter.x, wheelCenter.y)
  await p.mouse.down()
  for (let i = 1; i <= 6; i += 1) await p.mouse.move(wheelCenter.x + i * 50, wheelCenter.y)
  const overshoot = await trackState()
  await p.mouse.up()
  await p.waitForTimeout(320)
  const backHome = await trackState()
  const over = overshoot.tx > 0 ? overshoot.tx : 0
  check(
    '越界被**橡皮筋阻尼**：拉出去 300px，实际只多挪出去一点点（>0、≤ 视口的 25%，且远小于拉动量）',
    over > 0 && over <= overshoot.rubberDim + 1 && over < 300 * 0.5,
    JSON.stringify({ 越界位移: over, 上限: overshoot.rubberDim, 原始拉动: 300 }),
  )
  check(
    '松手**弹回端点**（≤300ms 内回到界内：起点那一端 = tx 0）',
    Math.abs(backHome.tx) <= 1,
    JSON.stringify({ 松手后: backHome.tx, 起点: 0 }),
  )
  /* 装得下 → 不可拖（macOS 的 Dock 这时就是静止的） */
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
    Object.assign(raw, { length: null })
    localStorage.setItem('desktop.dock', JSON.stringify(raw))
  })
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForTimeout(800)
  const autoState = await trackState()
  const autoCenter = await p.evaluate((sel) => {
    const r = document.querySelector(`${sel} [data-dock-view]`)?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  }, DOCK)
  await p.mouse.move(autoCenter.x, autoCenter.y)
  await p.mouse.down()
  for (let i = 1; i <= 8; i += 1) await p.mouse.move(autoCenter.x - i * 30, autoCenter.y)
  await p.mouse.up()
  await p.waitForTimeout(300)
  const autoAfter = await trackState()
  check(
    '装得下时**根本不可拖**（maxOffset = 0：图标区正好装下所有图标，拖动之后偏移还是 0）',
    autoState.maxOffset === 0 && Math.abs(autoAfter.tx) <= 1,
    JSON.stringify({ maxOffset: autoState.maxOffset, 拖前: autoState.tx, 拖后: autoAfter.tx }),
  )

  /* 14c 竖拖 = 移动图标：只对"按在图标上"的拖动生效，门槛 44px；判定成浏览就锁死本次手势 */
  const pickIcon = () =>
    p.evaluate((sel) => {
      const view = document.querySelector(`${sel} [data-dock-view]`)
      const vr = view.getBoundingClientRect()
      const mid = vr.x + vr.width / 2
      const rows = []
      for (const b of document.querySelectorAll(`${sel} [data-dock-item][data-dock-copy="1"]`)) {
        const r = b.getBoundingClientRect()
        const cx = r.x + r.width / 2
        /* 别挑最边上那个：往外的方向要留出至少一格，否则测不了"越过邻居" */
        if (cx < vr.x + 60 || cx > vr.right - 60) continue
        rows.push({ d: Math.abs(cx - mid), x: cx, y: r.y + r.height / 2, id: b.dataset.dockItem })
      }
      rows.sort((a, b) => a.d - b.d)
      return rows[Math.min(1, rows.length - 1)] ?? null
    }, DOCK)
  const savedOrder = () =>
    p.evaluate(() => JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').dockApps ?? [])
  const orderBefore = await savedOrder()
  const iconA = await pickIcon()
  await p.mouse.move(iconA.x, iconA.y)
  await p.mouse.down()
  await p.mouse.move(iconA.x + 60, iconA.y, { steps: 6 })
  await p.mouse.move(iconA.x + 60, iconA.y - 20, { steps: 4 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  const orderAfterSmall = await savedOrder()
  check(
    '横拖之后再竖拖 20px：手势已经锁定为「浏览」，不会误触发换位（顺序不变）',
    JSON.stringify(orderBefore) === JSON.stringify(orderAfterSmall),
    JSON.stringify({ 前: orderBefore.slice(0, 6), 后: orderAfterSmall.slice(0, 6) }),
  )
  const iconB = await pickIcon()
  const liftedProbe = await p.evaluate((sel) => {
    const view = document.querySelector(`${sel} [data-dock-view]`)
    return !!view
  }, DOCK)
  void liftedProbe
  await p.mouse.move(iconB.x, iconB.y)
  await p.mouse.down()
  await p.mouse.move(iconB.x, iconB.y - 70, { steps: 10 })
  const lifted = await p.evaluate(() => document.querySelectorAll('.dock__item--lift').length)
  /* 站主报的 bug：竖拖进移动模式后图标一离开任务栏那一条就被裁掉、看不见了。
     现在跟手的是挂在 `document.body` 上的浮层幽灵（图标区带 clip-path，放进去会被裁）。 */
  const ghostProbe = () =>
    p.evaluate(() => {
      const g = document.querySelector('[data-dock-ghost]')
      const bar = document.querySelector('nav[aria-label="任务栏"]')
      if (!g || !bar) return { present: false }
      const r = g.getBoundingClientRect()
      const br = bar.getBoundingClientRect()
      const cs = getComputedStyle(g)
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return {
        present: true,
        /* 拖到任务栏**之外**仍然看得见（幽灵的底边高于栏顶边） */
        aboveBar: r.bottom < br.top + 1,
        x: Math.round(r.x),
        y: Math.round(r.y),
        onBody: g.parentElement === document.body,
        pe: cs.pointerEvents,
        /* 不挡点击：幽灵所在位置的最上层元素不该是它自己 */
        notHit: !(hit && (g === hit || g.contains(hit))),
      }
    })
  const ghost1 = await ghostProbe()
  await p.mouse.move(iconB.x + 40, iconB.y - 150, { steps: 6 })
  const ghost2 = await ghostProbe()
  check(
    '拖到任务栏之外仍看得见被拖的图标：浮层幽灵挂在 body 上、跟着指针走、不挡点击',
    ghost1.present &&
      ghost1.aboveBar &&
      ghost1.onBody &&
      ghost1.pe === 'none' &&
      ghost1.notHit &&
      ghost2.present &&
      Math.abs(ghost2.x - ghost1.x) >= 20 &&
      ghost2.y < ghost1.y - 40,
    JSON.stringify({ 第一次: ghost1, 第二次: ghost2 }),
  )
  await p.mouse.move(iconB.x + 70, iconB.y - 70, { steps: 10 })
  await p.mouse.up()
  await p.waitForTimeout(400)
  const ghostGone = await p.evaluate(() => !document.querySelector('[data-dock-ghost]'))
  check(
    '松手后浮层幽灵收掉（原位置那个占位图标恢复不透明）',
    ghostGone,
    JSON.stringify({ ghostGone }),
  )
  const orderAfterMove = await savedOrder()
  check(
    '竖拖 60px 进入移动模式（图标被抬起），越过邻居后松手 → desktop.dock.dockApps 顺序真的变了',
    lifted === 1 && JSON.stringify(orderBefore) !== JSON.stringify(orderAfterMove),
    JSON.stringify({ lifted, 前: orderBefore.slice(0, 6), 后: orderAfterMove.slice(0, 6) }),
  )

  /* 14d 任务栏的固定按钮：2026-10-06（macOS P2）起**只剩左端一颗「所有项目」**（≈ 启动台）——
     「全屏 ⛶」与「任务栏位置」已经挪进顶部菜单栏（macOS 的 Dock 两端只有启动台与废纸篓，
     不该长着系统按钮）。这里只断言剩下那一颗，两颗挪走的按钮见第 15 节。 */
  const fixedProbe = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    const track = bar?.querySelector('[data-dock-track]')
    const barBox = bar.getBoundingClientRect()
    const find = (s) => bar.querySelector(s)
    const btns = { menu: find('button[aria-label="所有项目"]') }
    const out = {}
    for (const [k, b] of Object.entries(btns)) {
      if (!b) {
        out[k] = null
        continue
      }
      const r = b.getBoundingClientRect()
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      const hit = document.elementFromPoint(cx, cy)
      out[k] = {
        inBar: r.x >= barBox.x - 1 && r.right <= barBox.right + 1,
        inTrack: !!track && track.contains(b),
        clickable: !!hit && (b === hit || b.contains(hit)),
      }
    }
    /* 两颗已经挪走的按钮：任务栏里**不应该**再有它们 */
    out.goneFromDock = !find('button[aria-label="全屏"]') && !find('button[aria-label="任务栏位置"]')
    return out
  }, DOCK)
  check(
    '任务栏只剩左端「所有项目」一颗固定按钮：在栏内、不在滚动轨道里、点得到；全屏与位置已不在栏里',
    !!fixedProbe.menu &&
      fixedProbe.menu.inBar &&
      !fixedProbe.menu.inTrack &&
      fixedProbe.menu.clickable &&
      fixedProbe.goneFromDock,
    JSON.stringify(fixedProbe),
  )

  /* 14d2 顶部菜单栏的几何与"两颗按钮真的搬进来了"（macOS P2） */
  const menubarProbe = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    if (!bar) return null
    const r = bar.getBoundingClientRect()
    const token = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--menubar-h'),
    )
    const hitOf = (b) => {
      const bb = b.getBoundingClientRect()
      const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2)
      return !!hit && (b === hit || b.contains(hit))
    }
    const full = bar.querySelector('button[aria-label="全屏"], button[aria-label="退出全屏"]')
    const pos = bar.querySelector('button[aria-label="任务栏位置"]')
    return {
      top: Math.round(r.top),
      left: Math.round(r.left),
      height: Math.round(r.height),
      token: Math.round(token || 0),
      fullWidth: Math.round(r.width) === window.innerWidth,
      fullOk: !!full && hitOf(full),
      posOk: !!pos && hitOf(pos),
      clockIn: !!bar.querySelector('.celestial'),
      app: bar.querySelector('[data-menubar-app]')?.textContent?.trim() ?? '',
    }
  }, MENUBAR)
  check(
    '菜单栏贴顶、跨整宽，高度与令牌 --menubar-h 一致（两个值都对得上才算）',
    !!menubarProbe &&
      menubarProbe.top === 0 &&
      menubarProbe.left === 0 &&
      menubarProbe.fullWidth &&
      menubarProbe.token > 0 &&
      menubarProbe.height === menubarProbe.token,
    JSON.stringify(menubarProbe),
  )
  check(
    '「全屏 ⛶」与「任务栏位置」已经在菜单栏里、且都点得到（改位置没改无障碍名）',
    !!menubarProbe && menubarProbe.fullOk && menubarProbe.posOk,
    JSON.stringify({ fullOk: menubarProbe?.fullOk, posOk: menubarProbe?.posOk }),
  )
  check(
    '日月时钟并进了菜单栏（原来那个浮在右上角的挂件位已撤，不再是双份）',
    !!menubarProbe && menubarProbe.clockIn && (await p.locator('.celestial').count()) === 1,
    JSON.stringify({ clockIn: menubarProbe?.clockIn, count: await p.locator('.celestial').count() }),
  )

  /* 14d 竖排（左/右停靠）也必须是"单列轮盘"：整套代码按轴参数化，但布局与裁剪走的是另一条分支
     （`.dock__view--v` / `dock__track--v`、用 offsetTop/height 而不是 offsetLeft/width），
     所以横排过了不代表竖排也对，单独断言一遍 */
  const posBefore = await p.evaluate(() => localStorage.getItem('desktop.dock'))
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
    raw.position = 'left'
    raw.length = null
    raw.thickness = null
    localStorage.setItem('desktop.dock', JSON.stringify(raw))
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(900)
  /* 放大是**指针驱动**的（见上面 14a2）：左停靠也要先把指针移到某个图标上再量 ——
     竖排时"指针位置"是 **y**。挑离可视区垂直中点最近的那个（不会在边缘被裁）。 */
  const leftTarget = await p.evaluate((sel) => {
    const view = document.querySelector(`${sel} [data-dock-view]`)
    if (!view) return null
    const vr = view.getBoundingClientRect()
    const mid = vr.y + vr.height / 2
    const cand = [...view.querySelectorAll('[data-dock-item][data-dock-copy="1"]')]
      .map((b) => {
        const r = b.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, d: Math.abs(r.y + r.height / 2 - mid) }
      })
      .sort((a, b) => a.d - b.d)
    return cand[0] ?? null
  }, DOCK)
  await p.mouse.move(leftTarget.x, leftTarget.y)
  await p.waitForTimeout(340)
  const verticalWheel = await p.evaluate(({ sel, pointerY }) => {
    const bar = document.querySelector(sel)
    const view = bar?.querySelector('[data-dock-view]')
    const track = bar?.querySelector('[data-dock-track]')
    const items = [...(track?.querySelectorAll('[data-dock-item][data-dock-copy="1"]') ?? [])]
    const vr = view?.getBoundingClientRect()
    const mid = pointerY ?? (vr ? vr.y + vr.height / 2 : 0)
    const scales = items
      .map((b) => {
        const r = b.getBoundingClientRect()
        return { d: Math.abs(r.y + r.height / 2 - mid), s: new DOMMatrixReadOnly(getComputedStyle(b).transform).a }
      })
      .sort((a, b) => a.d - b.d)
    const bb = bar.getBoundingClientRect()
    return {
      verticalBar: bb.height > bb.width,
      cols: new Set(items.map((b) => Math.round(b.offsetLeft))).size,
      hasView: !!view,
      viewV: !!view?.classList.contains('dock__view--v'),
      trackV: !!track?.classList.contains('dock__track--v'),
      items: items.length,
      copies: new Set([...(track?.querySelectorAll('[data-dock-item]') ?? [])].map((b) => b.getAttribute('data-dock-copy'))).size,
      center: Number((scales[0]?.s ?? 0).toFixed(2)),
      edge: Number((scales[scales.length - 1]?.s ?? 0).toFixed(2)),
    }
  }, { sel: DOCK, pointerY: leftTarget.y })
  check(
    '左停靠 = 单列图标区：图标同一列、有垂直的滚动轨道、**指针正对的那个一样放大**、**只渲染一份**（回弹，不是循环）',
    verticalWheel.verticalBar &&
      verticalWheel.cols === 1 &&
      verticalWheel.hasView &&
      verticalWheel.viewV &&
      verticalWheel.trackV &&
      verticalWheel.copies === 1 &&
      verticalWheel.center >= 1.3 &&
      verticalWheel.edge <= 1.01,
    JSON.stringify(verticalWheel),
  )
  await p.evaluate((raw) => {
    if (raw === null) localStorage.removeItem('desktop.dock')
    else localStorage.setItem('desktop.dock', raw)
  }, posBefore)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  // 14c 固定图标尺寸时，厚度下限要跟着图标走。
  //     曾经是写死的 48：选了 64 的图标再把厚度拖薄，图标会被裁掉一截。
  //     ⚠️ 这里量的是**布局盒**（offsetHeight）而不是 rect：轮盘模式下中央图标带 scale，
  //        rect 会比布局盒大一圈，那是"故意溢出的放大"，不是被裁。
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
  const iconFit = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    if (!bar) return null
    const items = [...bar.querySelectorAll('[data-dock-item][data-dock-copy="1"]')]
    const barH = Math.round(bar.getBoundingClientRect().height)
    const btn = items[0]?.offsetHeight ?? 0
    /* 图标 + 上下内边距(6+6) + 上下边框(1+1) 必须装得进任务栏厚度 */
    const need = items.map((b) => b.offsetHeight + 14)
    return {
      barHeight: barH,
      iconSize: btn,
      worstNeed: need.length ? Math.max(...need) : 0,
      mode: JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').mode ?? null,
    }
  }, DOCK)
  check(
    '固定图标尺寸时厚度下限跟着图标走（64 的图标 + 内边距与边框都装得下）',
    !!iconFit && iconFit.iconSize === 64 && iconFit.barHeight >= 78 && iconFit.worstNeed <= iconFit.barHeight,
    JSON.stringify(iconFit),
  )
  /* 还原并重新加载 */
  await p.evaluate((raw) => {
    if (raw === null) localStorage.removeItem('desktop.dock')
    else localStorage.setItem('desktop.dock', raw)
  }, iconBefore)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  /* ── 14e 折行模式（wrap）：设置里的可选项，**完全旧行为** ─────────────────────
     用户追加：「旧的展示方式也作为可选项放进设置里面吧」。
     折行那几条旧断言（m-auto 居中 / 两端滚得到 / 折成多行）都搬到这一段的 wrap 分支下断言。 */
  const setDockMode = async (label) => {
    if ((await p.locator('button[aria-label^="任务栏图标区："]').count()) === 0) {
      await p.click(`${DOCK} button[aria-label="设置"]`)
      await p.waitForTimeout(600)
    }
    await p.click(`button[aria-label="任务栏图标区：${label}"]`)
    await p.waitForTimeout(400)
  }
  await setDockMode('折行')
  const wrapStored = await p.evaluate(
    () => JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').mode ?? null,
  )
  check('设置里能切到「折行」：desktop.dock.mode 落盘为 wrap', wrapStored === 'wrap', String(wrapStored))

  /* 加厚到 150、长度拖到 260：折行模式下应该折成多行（旧行为） */
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
    raw.position = 'bottom'
    raw.thickness = 150
    raw.length = 260
    raw.iconSize = null
    localStorage.setItem('desktop.dock', JSON.stringify(raw))
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(900)
  const wrapProbe = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    const scroller = bar?.querySelector('.no-scrollbar')
    const items = scroller?.firstElementChild
    if (!bar || !scroller || !items) return null
    const icons = [...items.querySelectorAll('button[aria-label]')]
    const box = scroller.getBoundingClientRect()
    const barBox = bar.getBoundingClientRect()
    const inner = scroller.firstElementChild
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
      hasView: !!bar.querySelector('[data-dock-view]'),
      rows: new Set(icons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      iconHeight: Math.round(icons[0].getBoundingClientRect().height),
      itemsHeight: Math.round(items.getBoundingClientRect().height),
      maxScroll,
      firstReachable: firstAtStart >= -1,
      lastReachable: lastAtEnd <= box.width + 1,
      fixedInside: fixed.every((b) => {
        const r = b.getBoundingClientRect()
        return r.left >= barBox.left - 1 && r.right <= barBox.right + 1
      }),
      dockJustify: getComputedStyle(bar).justifyContent,
      scrollerJustify: getComputedStyle(scroller).justifyContent,
      innerClass: inner ? String(inner.className) : '',
      mode: JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').mode ?? null,
    }
  }, DOCK)
  check(
    '折行模式（wrap）：加厚 + 拖过长度之后仍折成多行（多行行为的断言搬到这里）',
    !!wrapProbe && !wrapProbe.hasView && wrapProbe.rows > 1 && wrapProbe.itemsHeight >= wrapProbe.iconHeight * 2,
    JSON.stringify({ rows: wrapProbe?.rows, itemsHeight: wrapProbe?.itemsHeight, iconHeight: wrapProbe?.iconHeight }),
  )
  check(
    '折行模式：两端都滚得到，且三个固定按钮不越界（旧断言）',
    !!wrapProbe && wrapProbe.maxScroll > 0 && wrapProbe.firstReachable && wrapProbe.lastReachable && wrapProbe.fixedInside,
    JSON.stringify({
      maxScroll: wrapProbe?.maxScroll,
      firstReachable: wrapProbe?.firstReachable,
      lastReachable: wrapProbe?.lastReachable,
      fixedInside: wrapProbe?.fixedInside,
    }),
  )
  check(
    '折行模式：居中仍然靠「内层 m-auto」（滚动容器上写 justify-center 会让两端滚不到）',
    !!wrapProbe &&
      wrapProbe.dockJustify === 'center' &&
      wrapProbe.scrollerJustify !== 'center' &&
      wrapProbe.innerClass.includes('m-auto'),
    JSON.stringify({ dock: wrapProbe?.dockJustify, scroller: wrapProbe?.scrollerJustify }),
  )
  check(
    '刷新后模式还在（desktop.dock.mode === wrap，渲染的仍是折行视口）',
    wrapProbe?.mode === 'wrap' && !wrapProbe?.hasView,
    JSON.stringify({ mode: wrapProbe?.mode, hasView: wrapProbe?.hasView }),
  )

  /* 切回回弹：单行 + 图标区都回来 */
  await setDockMode('回弹')
  await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
    raw.thickness = null
    raw.length = null
    localStorage.setItem('desktop.dock', JSON.stringify(raw))
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(900)
  const backToWheel = await wheelProbe()
  check(
    '切回「回弹」：回到单行 + 图标区（mode 落盘 wheel）',
    backToWheel.mode === 'wheel' && backToWheel.rows === 1 && backToWheel.hasView && backToWheel.hasTrack,
    JSON.stringify({ mode: backToWheel.mode, rows: backToWheel.rows, view: backToWheel.hasView }),
  )
  await closeAllWindows()
  await p.waitForTimeout(400)

  /* ── 14f 切模式不许改变任务栏尺寸（站主 2026-10-05 报的「转回折行会有图标消失」的回归）──
     根因（实测）：长度下限以前**按模式各算各的**（40px 图标时 wheel 274 / wrap 186），
     于是**同一个存档 length** 会被夹到不同的值、渲染出不同的宽度：
       存档 186 → 轮盘 栏 274/可视 128（现见 3 个）  折行 栏 186/可视 40（现见 1 个）
       存档 200 → 轮盘 栏 274/可视 128              折行 栏 200/可视 54
       存档 240 → 轮盘 栏 274/可视 128              折行 栏 240/可视 94
     在折行里把任务栏拖短（拖动按**当前模式**的下限夹，写进去 186）之后，切到轮盘（渲染 274）
     再切回折行（渲染 186），任务栏**突然缩短最多 88px**、图标区从 128 塌到 40 —— 图标没坏，
     只是被挤进 `.no-scrollbar` 的滚动区外面，看着就是"图标消失"。现在两种模式共用一个下限。
     ⚠️ 折行本来就是"装不下就滚"（旧行为），所以"没丢"要断成**每个图标都能在某个滚动位置被看见**
     （逐格取样），而不是"每一刻都在可视区里" —— 后者在折行里根本不成立（11 个图标 480px 宽，
     短任务栏的可视区只有 128px）。 */
  const dockProbe = () =>
    p.evaluate(
      ({ sel, fixed }) => {
        const bar = document.querySelector(sel)
        if (!bar) return null
        const vis = bar.querySelector('[data-dock-view]') ?? bar.querySelector('.no-scrollbar')
        if (!vis) return null
        const btns = [...bar.querySelectorAll('button[aria-label]')].filter(
          (b) => !fixed.includes(b.getAttribute('aria-label')),
        )
        const box = (el) => el.getBoundingClientRect()
        const hit = (a, b) =>
          a.right > b.left + 0.5 && a.left < b.right - 0.5 && a.bottom > b.top + 0.5 && a.top < b.bottom - 0.5
        const vertical = vis.scrollHeight > vis.clientHeight + 1
        const max = vertical ? vis.scrollHeight - vis.clientHeight : vis.scrollWidth - vis.clientWidth
        const seen = new Set()
        for (let s = 0; s <= max + 8; s += 8) {
          if (vertical) vis.scrollTop = Math.min(s, max)
          else vis.scrollLeft = Math.min(s, max)
          const v = box(vis)
          for (const b of btns) if (hit(box(b), v)) seen.add(b.getAttribute('aria-label'))
        }
        if (vertical) vis.scrollTop = 0
        else vis.scrollLeft = 0
        const dock = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
        return {
          mode: dock.mode ?? null,
          stored: dock.length ?? null,
          barW: Math.round(box(bar).width),
          visW: Math.round(box(vis).width),
          count: btns.length,
          dockApps: (dock.dockApps ?? []).length,
          scaled: btns.filter((b) => getComputedStyle(b).transform !== 'none').map((b) => b.getAttribute('aria-label')),
          never: btns.map((b) => b.getAttribute('aria-label')).filter((l) => !seen.has(l)),
        }
      },
      { sel: DOCK, fixed: ['所有项目'] },
    )
  /* 切模式走**路由**打开设置：轮盘里图标会循环，短任务栏时"设置"那个图标可能正好在可视圈外，
     点它会扑空（clip-path 挡住命中测试，实测踩过） */
  const pickDockMode = async (label) => {
    await p.goto(`${BASE}/settings`, { waitUntil: 'load' })
    await p.waitForTimeout(600)
    await p.click(`button[aria-label="任务栏图标区：${label}"]`)
    await p.waitForTimeout(350)
    await closeAllWindows()
    await p.waitForTimeout(300)
  }
  const setDockLength = async (length) => {
    await p.evaluate((length) => {
      const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
      Object.assign(raw, { length, thickness: null, iconSize: null, position: 'bottom' })
      localStorage.setItem('desktop.dock', JSON.stringify(raw))
    }, length)
    await p.goto(`${BASE}/`, { waitUntil: 'load' })
    await p.waitForTimeout(800)
  }

  /* 挑一个"旧死区"里的 length（186 < 200 < 274）—— 以前正是这个区间会跳 */
  await setDockLength(200)
  await pickDockMode('回弹')
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForTimeout(700)
  const wheel200 = await dockProbe()
  await pickDockMode('折行')
  const wrap200 = await dockProbe()
  check(
    '切到「折行」不再改变任务栏尺寸（同一存档 length=200：以前轮盘 274 / 折行 200，突然缩短 74px）',
    !!wheel200 && !!wrap200 && wheel200.mode === 'wheel' && wrap200.mode === 'wrap' && wheel200.barW === wrap200.barW && wheel200.visW === wrap200.visW,
    JSON.stringify({ wheel: { barW: wheel200?.barW, visW: wheel200?.visW }, wrap: { barW: wrap200?.barW, visW: wrap200?.visW } }),
  )
  check(
    '折行下渲染的按钮数 == dockApps 条数，且没有残留的内联缩放（轮盘是直接写这几个节点的）',
    !!wrap200 && wrap200.count === wrap200.dockApps && wrap200.scaled.length === 0,
    JSON.stringify({ count: wrap200?.count, dockApps: wrap200?.dockApps, scaled: wrap200?.scaled }),
  )
  check(
    '折行下每个图标都能在某个滚动位置被看见（没有图标被留在够不到的地方）',
    !!wrap200 && wrap200.count > 0 && wrap200.never.length === 0,
    JSON.stringify({ count: wrap200?.count, never: wrap200?.never }),
  )

  /* 来回切一次：结论必须不变（第二类残留就该在这一条上现形） */
  await pickDockMode('回弹')
  const wheel200b = await dockProbe()
  await pickDockMode('折行')
  const wrap200b = await dockProbe()
  check(
    '来回切一次（wheel → wrap → wheel → wrap）结论不变：尺寸一致、按钮数一致、仍然一个都不少',
    !!wheel200b &&
      !!wrap200b &&
      wheel200b.barW === wrap200b.barW &&
      wheel200b.visW === wrap200b.visW &&
      wrap200b.count === wrap200b.dockApps &&
      wrap200b.scaled.length === 0 &&
      wrap200b.never.length === 0,
    JSON.stringify({
      wheel: { barW: wheel200b?.barW, visW: wheel200b?.visW },
      wrap: { barW: wrap200b?.barW, visW: wrap200b?.visW, count: wrap200b?.count, never: wrap200b?.never },
    }),
  )

  /* ── 14g 折行：图标块要待在任务栏「中间」（站主 2026-10-05 报的「转成折行老是往左偏」）─────
     根因两条，都是实测出来的：
     ① 两端固定按钮**不对称** —— 主轴起点只有一颗「所有项目」，终点是「全屏 + 位置」两颗；
        所以图标块的中线天生偏向起点：实测 length=null 时任务栏 626 宽、左留白 **51** / 右留白 **95**
        → 中线**偏左 22px**（竖排更狠：上下 44 / 132 → 偏 44px）。
     ② 轮盘与折行**外层都是 `<div>`**，React 会把同一个节点复用，`scrollLeft` 跟着一起带过去：
        实测 wheel → wrap 之后残留 **110**，图标看着更偏、起点那几个还够不到。
     修法：折行滚动容器补 `padding-inline-start = 两端固定区之差`（`lib/dock` 的 `wrapSideGap`，
        内边距同时把"用于居中的空闲"缩小一半，正好抵消偏移）+ 内层 `justify-content: safe center`
        （装得下每行居中、装不下退化成 start）+ 两个分支各给一个 `key`（各用各的 DOM 节点）。
     ⚠️ 不能写成裸 `center`：内容溢出时两端同时溢出，左边那半截既看不见也滚不到（坑 5）。 */
  const wrapCenterProbe = () =>
    p.evaluate(
      ({ sel, fixed }) => {
        const dock = document.querySelector(sel)
        if (!dock) return null
        const apps = [...dock.querySelectorAll('button[aria-label]')].filter(
          (b) => !fixed.includes(b.getAttribute('aria-label')),
        )
        const inner = dock.querySelector('.m-auto')
        const scroller = inner?.parentElement ?? null
        const dr = dock.getBoundingClientRect()
        const mid = (dr.left + dr.right) / 2
        const rows = new Map()
        for (const b of apps) {
          const r = b.getBoundingClientRect()
          const k = Math.round(r.top)
          if (!rows.has(k)) rows.set(k, [])
          rows.get(k).push({ l: r.left, r: r.right })
        }
        const lines = [...rows.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([top, items]) => {
            const l = Math.min(...items.map((i) => i.l))
            const r = Math.max(...items.map((i) => i.r))
            return { top, n: items.length, off: +((l + r) / 2 - mid).toFixed(1) }
          })
        const first = apps.map((b) => b.getBoundingClientRect()).sort((a, b) => a.left - b.left)[0]
        return {
          n: apps.length,
          lines,
          innerJustify: inner ? getComputedStyle(inner).justifyContent : null,
          scrollLeft: scroller?.scrollLeft ?? null,
          overflows: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
          firstIconLeftMinusDockLeft: first ? +(first.left - dr.left).toFixed(1) : null,
          padStart: scroller ? getComputedStyle(scroller).paddingLeft : null,
          dockW: Math.round(dr.width),
        }
      },
      { sel: DOCK, fixed: ['所有项目'] },
    )
  const setDockGeom = async (patch) => {
    await p.evaluate((patch) => {
      const raw = JSON.parse(localStorage.getItem('desktop.dock') ?? '{}')
      Object.assign(raw, { position: 'bottom' }, patch)
      localStorage.setItem('desktop.dock', JSON.stringify(raw))
    }, patch)
    await p.goto(`${BASE}/`, { waitUntil: 'load' })
    await p.waitForTimeout(800)
  }
  await pickDockMode('折行')
  await setDockGeom({ mode: 'wrap', length: null, thickness: null, iconSize: null })
  const wrapAuto = await wrapCenterProbe()
  await setDockGeom({ mode: 'wrap', length: 760, thickness: null, iconSize: null })
  const wrapWide = await wrapCenterProbe()
  check(
    '折行：图标块在任务栏里**居中**（装得下时中线偏差 ≤2px；「长度自适应」与「指定宽度」各量一次）',
    !!wrapAuto &&
      !!wrapWide &&
      wrapAuto.lines.length > 0 &&
      /* ⚠️ 还要断言「没溢出」：只量中线的话，内容被挤进滚动区、只露一半也算"居中"（假过） */
      !wrapAuto.overflows &&
      wrapAuto.lines.every((l) => Math.abs(l.off) <= 2) &&
      wrapWide.lines.every((l) => Math.abs(l.off) <= 2),
    JSON.stringify({
      auto: wrapAuto && { dockW: wrapAuto.dockW, padStart: wrapAuto.padStart, off: wrapAuto.lines.map((l) => l.off), overflows: wrapAuto.overflows },
      wide: wrapWide && { dockW: wrapWide.dockW, off: wrapWide.lines.map((l) => l.off) },
    }),
  )
  await setDockGeom({ mode: 'wrap', length: 560, thickness: 120, iconSize: 40 })
  const wrapMulti = await wrapCenterProbe()
  check(
    '折行多行时**每一行**都居中（包括不满的最后一行 —— 裸 center 的 flex-start 会把最后一行甩到左边）',
    !!wrapMulti && wrapMulti.lines.length >= 2 && wrapMulti.lines.every((l) => Math.abs(l.off) <= 2),
    JSON.stringify({ lines: wrapMulti?.lines }),
  )
  await setDockGeom({ mode: 'wrap', length: 200, thickness: null, iconSize: null })
  const wrapNarrow = await wrapCenterProbe()
  const reachEnd = await p.evaluate(
    ({ sel, fixed }) => {
      const dock = document.querySelector(sel)
      const scroller = dock?.querySelector('.m-auto')?.parentElement
      if (!dock || !scroller) return null
      const apps = [...dock.querySelectorAll('button[aria-label]')].filter(
        (b) => !fixed.includes(b.getAttribute('aria-label')),
      )
      scroller.scrollLeft = 99999
      const last = apps.map((b) => b.getBoundingClientRect()).sort((a, b) => b.right - a.right)[0]
      const dr = dock.getBoundingClientRect()
      return { maxScrollLeft: scroller.scrollLeft, lastRightMinusDockRight: +(last.right - dr.right).toFixed(1) }
    },
    { sel: DOCK, fixed: ['所有项目', '全屏', '退出全屏', '任务栏位置'] },
  )
  check(
    '折行装不下时：起点不被推到滚动原点之外（第一个图标完整可见），且能滚到最后一个',
    !!wrapNarrow &&
      wrapNarrow.overflows &&
      wrapNarrow.firstIconLeftMinusDockLeft >= -1 &&
      !!reachEnd &&
      reachEnd.maxScrollLeft > 0 &&
      reachEnd.lastRightMinusDockRight <= 1,
    JSON.stringify({
      first: wrapNarrow?.firstIconLeftMinusDockLeft,
      overflows: wrapNarrow?.overflows,
      ...reachEnd,
    }),
  )
  check(
    '折行内层居中用的是 `safe center`（装不下时自动退化成 start —— 别退回裸 center，坑 5 会回来）',
    !!wrapNarrow && typeof wrapNarrow.innerJustify === 'string' && wrapNarrow.innerJustify.includes('safe'),
    JSON.stringify({ justify: wrapNarrow?.innerJustify }),
  )
  /* 切模式不许留滚动残值：轮盘与折行外层都是 <div>，不给 key 时 React 会复用节点、把 scrollLeft 带过去 */
  await p.goto(`${BASE}/settings`, { waitUntil: 'load' })
  await p.waitForTimeout(700)
  await p.evaluate((sel) => {
    const s = document.querySelector(`${sel} .m-auto`)?.parentElement
    if (s) s.scrollLeft = 200
  }, DOCK)
  const scrollBefore = await p.evaluate(
    (sel) => document.querySelector(`${sel} .m-auto`)?.parentElement?.scrollLeft ?? null,
    DOCK,
  )
  await p.click('button[aria-label="任务栏图标区：回弹"]')
  await p.waitForTimeout(500)
  await p.click('button[aria-label="任务栏图标区：折行"]')
  await p.waitForTimeout(700)
  const afterSwitch = await wrapCenterProbe()
  check(
    '切模式（wheel → wrap）不留滚动残值：scrollLeft 归零',
    scrollBefore > 0 && !!afterSwitch && afterSwitch.scrollLeft === 0,
    JSON.stringify({ scrollBefore, after: afterSwitch && { scrollLeft: afterSwitch.scrollLeft, off: afterSwitch.lines.map((l) => l.off) } }),
  )

  /* 收尾：长度回到自适应、模式回到轮盘，别影响后面几段 */
  await setDockLength(null)
  await pickDockMode('回弹')
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForTimeout(700)
  await closeAllWindows()
  await p.waitForTimeout(300)

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
      /* 2026-10-06（macOS P2）：时钟并进了顶部菜单栏 —— 这里量"它在不在菜单栏里" */
      inMenubar: !!el.closest('[data-menubar]'),
    }
  })
  const toSeconds = (value) => {
    const [h, m, s] = String(value).split(':').map(Number)
    return h * 3600 + m * 60 + (s || 0)
  }
  check(
    '菜单栏里有日月时钟（读数与系统时间一致，精确到秒）',
    !!clock &&
      Math.abs(toSeconds(clock.time) - toSeconds(clock.expected)) <= 2 &&
      /* 2026-10-06（macOS P2）：时钟从"浮在桌面右上角的挂件"并进了**顶部菜单栏**，
         不再有自己的 z（原先断言 z 在壁纸与窗口层之间）。现在断言的是"它在菜单栏里" */
      clock.inMenubar,
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
      /* 四分之一相（上/下弦）的照亮区间是**推导出来的**，不是拍的：
         八相各占 45°（±22.5°，即相角 67.5°~112.5°），照亮 = (1 − cosθ)/2
         → 0.309 ~ 0.691，也就是 50% ± 19。原来写 ±13 会在真实月亮走到 36%~37% 时
         无端判红（2026-10-05 实测就红在这 1 个百分点上，而且只跟当天日期有关）。
         ⚠️ 别再收窄回去；要更严就改成按相位角判定，别用照亮百分比卡。 */
      (!['上弦月', '下弦月'].includes(clock.moon) || Math.abs(clock.illum - 50) <= 19),
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

  /* 关掉所有开着的窗口：用**程序化 click**，免得被压在上面的窗口挡住点不到 */
  async function closeAllWindows() {
    for (let i = 0; i < 15; i += 1) {
      const left = await p.evaluate(() => {
        const btn = document.querySelector('[data-frame-head] button[aria-label="关闭"]')
        if (!btn) return 0
        btn.click()
        /* 数是**标签**不是帧：合并过的一帧里要一个个关（每次关掉的是活动标签） */
        return document.querySelectorAll('[data-tab]').length
      })
      if (!left) return
      await p.waitForTimeout(120)
    }
  }

  // 16 多窗口：桌面能同时开好几个窗口（可叠加），像浏览器那样用标签栏切换
  //    用户 2026-10-05：「窗口要可以叠加，可以同时打开多个窗口，显示方式像浏览器一样」
  /* 先清场：上一节留下的窗口会被「会话记忆」在刷新后原样开回来（第一次跑就踩了：
     饥荒 Wiki 那扇窗跟着 session 一起回来了，断言"就两个窗口"直接红） */
  await closeAllWindows()
  await p.waitForTimeout(200)
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.evaluate(() => {
    localStorage.removeItem('desktop.windows')
    localStorage.removeItem('desktop.tabs')
  })
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(700)

  await p.click(`${DOCK} button[aria-label="关于"]`)
  await p.waitForTimeout(300)
  await p.click(`${DOCK} button[aria-label="博客"]`)
  await p.waitForTimeout(400)
  /* 帧快照：一帧一条标签栏，帧里可以有好几个标签（合并后） */
  const framesNow = () =>
    p.evaluate(() => ({
      frames: [...document.querySelectorAll('[data-frame]')].map((f) => ({
        group: f.dataset.frame,
        active: f.dataset.frameActive,
        hidden: f.className.includes('hidden'),
        tabs: [...f.querySelectorAll('[data-tab]')].map((t) => t.dataset.tab),
      })),
      tabs: [...document.querySelectorAll('[data-tab]')].map((t) => t.dataset.tab),
      path: location.pathname,
    }))

  const multi = await framesNow()
  check(
    '同时开着两个窗口：各自一帧，帧里各一条标签',
    multi.frames.length === 2 &&
      multi.frames.every((f) => !f.hidden && f.tabs.length === 1) &&
      multi.tabs.join(',') === 'about,blog' &&
      multi.path === '/blog',
    JSON.stringify(multi),
  )

  /* 合并：把一扇窗拖到另一扇的**标题栏**上松手 —— 两帧并成一帧、两个标签 */
  const headOf = (label) =>
    p.locator(`section[aria-label="${label}"] [data-frame-head]`).boundingBox()
  const blogHead = await headOf('博客 窗口')
  const aboutHead = await headOf('关于 窗口')
  await p.mouse.move(blogHead.x + blogHead.width - 120, blogHead.y + blogHead.height / 2)
  await p.mouse.down()
  await p.mouse.move(aboutHead.x + 80, aboutHead.y + aboutHead.height / 2, { steps: 14 })
  await p.waitForTimeout(150)
  const mergeHint = await p.evaluate(() => ({
    drop: !!document.querySelector('[data-merge-drop]'),
    /* 用语义钩子，别去数 Tailwind 类名（实现换个样式就假红） */
    ring: !!document.querySelector('[data-merge-target]'),
  }))
  await p.mouse.up()
  await p.waitForTimeout(450)
  const merged = await framesNow()
  check(
    '拖一扇窗到另一扇的标题栏上 → 合并成一帧（拖动时给提示）',
    mergeHint.drop &&
      mergeHint.ring &&
      merged.frames.length === 1 &&
      merged.frames[0].tabs.join(',') === 'about,blog' &&
      merged.frames[0].active === 'blog',
    JSON.stringify({ ...merged, mergeHint }),
  )

  /* 标签行必须画在窗口边框**里面**，而且和交通灯**同一行**。
     macOS 排版（站主 2026-10-06「其他照 macOS 全改」）：**交通灯在最左、标签行居中**。
     这里量五件事：不越出窗框、纵向在标题行里、与交通灯同一水平线、交通灯贴左边、标签在交通灯右边 */
  const stripIn = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="博客 窗口"]')
    const strip = win?.querySelector('[data-frame-tabs]')
    const controls = win?.querySelector('[data-window-controls]')
    const head = win?.querySelector('[data-frame-head]')
    const w = win?.getBoundingClientRect()
    const s2 = strip?.getBoundingClientRect()
    const c = controls?.getBoundingClientRect()
    const h = head?.getBoundingClientRect()
    if (!w || !s2 || !c || !h) return null
    const mid = (r) => (r.top + r.bottom) / 2
    return {
      headH: Math.round(h.height),
      stripH: Math.round(s2.height),
      gap: Math.round(s2.top - w.top),
      sameRow: Math.round(Math.abs(mid(s2) - mid(c))) <= 2,
      inHead: s2.top >= h.top - 1 && s2.bottom <= h.bottom + 1,
      inside: s2.left >= w.left - 1 && s2.right <= w.right + 1 && s2.top >= w.top - 1,
      ctrlAtLeft: Math.round(c.left - w.left) <= 12,
      tabsRightOfCtrl: s2.left >= c.right - 1,
    }
  })
  check(
    '整扇窗只有一行：macOS 排版（交通灯贴左、标签行与它同排）',
    !!stripIn &&
      stripIn.inside &&
      stripIn.inHead &&
      stripIn.sameRow &&
      stripIn.headH === 24 &&
      stripIn.stripH <= 26 &&
      stripIn.gap <= 8 &&
      stripIn.ctrlAtLeft &&
      stripIn.tabsRightOfCtrl,
    JSON.stringify(stripIn),
  )

  /* 用户 2026-10-05：「鼠标到按钮上时应该显示按钮的形状……颜色可以不用那么深」，
     以及「注意左侧删除窗口的小按钮也要做」—— 三个窗口按钮 + 标签上那个小 × 悬停都要有底色，
     而且都是同一套**淡**底色（关闭按钮不再是那个很深的强调色）。
     形状本身是 CSS 的 hover 态，这里量的是"悬停后真的有了背景色" */
  const hoverBg = async (sel) => {
    await p.hover(sel)
    await p.waitForTimeout(120)
    return p.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel)
  }
  /* macOS 交通灯（站主 2026-10-06 批准「其他照 macOS 全改」，同日又加码两条：
     「再大一点」→ 12→14px、间距 8→9px；「图标鼠标上去再明显一点」→ 字形 9→11px、hover opacity 1→0.85、
     字形色 0.55→0.78/0.85 加深一档）：
     14px 圆点 / 间距 9px / 距左 8px，顺序红黄绿、都在**左侧**；
     **字形平时隐藏、hover 才显**；悬停**不给底色** ——
     旧的「悬停显按钮形状 + 关闭键红底」那套已经撤掉（--c-danger 只留令牌，不再用于关闭键）。
     标签上那个小 × 也不再是红底（红色只属于交通灯里的关闭圆点）。 */
  const WIN = 'section[aria-label="博客 窗口"] '
  const hasFill = (v) => !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)'
  /** 红底判定：红通道明显压过绿蓝（令牌换成别的红也照样过，不钉死具体色值） */
  const isRed = (v) => {
    const m = /rgba?\(([^)]+)\)/.exec(v || '')
    if (!m) return false
    const [r, g, b] = m[1].split(',').map((n) => parseFloat(n))
    return r > g + 20 && r > b + 20
  }
  const chan = (v) => {
    const m = /rgba?\(([^)]+)\)/.exec(v || '')
    return m ? m[1].split(',').map(Number) : [0, 0, 0]
  }
  const lights = await p.evaluate((sel) => {
    const win = document.querySelector(sel)
    const box = win?.querySelector('[data-window-controls]')
    const head = win?.querySelector('[data-frame-head]')
    const dots = [...(box?.querySelectorAll('button') ?? [])]
    /* "距左"以**标题栏**为基准量：窗口本身还有 1px 边框，拿窗口量会多出 1px */
    const w = head.getBoundingClientRect()
    const r = dots.map((d) => d.getBoundingClientRect())
    return {
      n: dots.length,
      size: Math.round(r[0]?.width ?? 0),
      gap: Math.round((r[1]?.left ?? 0) - (r[0]?.right ?? 0)),
      inset: Math.round((r[0]?.left ?? 0) - w.left),
      colors: dots.map((d) => getComputedStyle(d).backgroundColor),
      glyph: dots.map((d) => getComputedStyle(d.querySelector('span')).opacity),
      glyphSize: dots.map((d) => parseFloat(getComputedStyle(d.querySelector('span')).fontSize)),
      /* 14px 圆点要塞进 24px 标题栏：量它有没有溢出、有没有偏心 */
      fit: {
        headH: Math.round(w.height),
        top: Math.round(r[0].top - w.top),
        bottom: Math.round(w.bottom - r[2].bottom),
        centerOff: Math.round(r[0].top + r[0].height / 2 - (w.top + w.height / 2)),
      },
      labels: dots.map((d) => d.getAttribute('aria-label')),
    }
  }, WIN)
  const [cr, cg, cb] = chan(lights.colors[0])
  const [mr, mg, mb] = chan(lights.colors[1])
  const [gr, gg, gb] = chan(lights.colors[2])
  check(
    '交通灯在左：14px 圆点 / 间距 9px / 距左 8px、字形 11px 平时隐藏（aria-label 仍是 关闭 / 最小化 / 最大化|还原）',
    lights.n === 3 &&
      lights.size === 14 &&
      lights.gap === 9 &&
      lights.inset === 8 &&
      lights.glyphSize.every((s) => s === 11) &&
      lights.glyph.every((o) => Number(o) === 0) &&
      lights.labels[0] === '关闭' &&
      lights.labels[1] === '最小化' &&
      (lights.labels[2] === '最大化' || lights.labels[2] === '还原'),
    JSON.stringify(lights),
  )
  check(
    '交通灯完整落在 24px 标题栏里且垂直居中（14px 圆点不溢出、也不把标题栏撑高）',
    lights.fit.headH === 24 &&
      lights.fit.top >= 0 &&
      lights.fit.bottom >= 0 &&
      Math.abs(lights.fit.centerOff) <= 1,
    JSON.stringify(lights.fit),
  )
  /* 右端那颗"等宽占位"是用令牌算出来的（inset + 3*size + 2*gap），圆点一变大它就该跟着变宽。
     这里直接量标签块的中线有没有跟着偏 —— 占位写死或忘了联动，这条就红 */
  const titleMid = await p.evaluate((sel) => {
    const win = document.querySelector(sel)
    const head = win.querySelector('[data-frame-head]')
    const tabs = [...win.querySelectorAll('[data-tab]')]
    const h = head.getBoundingClientRect()
    const first = tabs[0].getBoundingClientRect()
    const last = tabs[tabs.length - 1].getBoundingClientRect()
    return {
      headMid: Math.round(h.left + h.width / 2),
      tabsMid: Math.round((first.left + last.right) / 2),
      n: tabs.length,
    }
  }, WIN)
  check(
    '标签块在标题栏里居中（右端占位宽度跟着交通灯令牌走，中线偏差 ≤2px）',
    titleMid.n >= 1 && Math.abs(titleMid.headMid - titleMid.tabsMid) <= 2,
    JSON.stringify(titleMid),
  )
  check(
    '交通灯三色 = 红 / 黄 / 绿（按通道判定，不钉死 hex）',
    cr > cg + 20 && cr > cb + 20 && mr > mb + 20 && mg > mb + 20 && gg > gr + 20 && gg > gb + 20,
    JSON.stringify(lights.colors),
  )
  await p.hover(WIN + '[data-window-controls] button[aria-label="关闭"]')
  await p.waitForTimeout(150)
  const litHover = await p.evaluate((sel) => {
    const d = document.querySelector(sel)
    const span = d.querySelector('span')
    return {
      glyph: getComputedStyle(span).opacity,
      glyphColor: getComputedStyle(span).color,
      bg: getComputedStyle(d).backgroundColor,
    }
  }, WIN + '[data-window-controls] button[aria-label="关闭"]')
  check(
    '交通灯悬停：字形明显显现（opacity ≥0.8）、且不给底色（旧的悬停显形状已撤）',
    Number(litHover.glyph) >= 0.8 && litHover.bg === lights.colors[0],
    JSON.stringify(litHover),
  )
  /* 「更明显」不能只量 opacity：**字形色自己的 alpha 与元素 opacity 是相乘的**
     （第一版就踩在这儿：把字形色加深到 0.78 又乘 0.85，有效只剩 0.66，反而比旧的 0.55 强不了多少）。
     这里按 WCAG 公式算"黑字压在圆点上"的**实际对比度**，三个圆点都要 ≥4.5:1；
     旧值 0.55 × 1.0 只有 3.0 / 3.9 / 3.7 —— 这条就是站主那句"再明显一点"的回归。 */
  const alphaOf = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '')
    if (!m) return 1
    const parts = m[1].split(',').map(Number)
    return parts.length > 3 ? parts[3] : 1
  }
  const lumOf = (rgb) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
  }
  const ratioOf = (a, b) => {
    const l1 = lumOf(a)
    const l2 = lumOf(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const effAlpha = Number((alphaOf(litHover.glyphColor) * Number(litHover.glyph)).toFixed(3))
  const glyphRatios = lights.colors.map((c) => {
    const dot = chan(c)
    return Number(ratioOf(dot.map((v) => Math.round(v * (1 - effAlpha))), dot).toFixed(2))
  })
  check(
    '交通灯悬停：字形实际对比度 ≥4.5:1（有效 alpha = 字形色 alpha × 元素 opacity，只量一个会算错）',
    effAlpha >= 0.78 && glyphRatios.every((r) => r >= 4.5),
    JSON.stringify({ effAlpha, glyphRatios, glyphColor: litHover.glyphColor, 旧值: '0.55×1.0 → 3.0/3.9/3.7' }),
  )
  const tabCloseBg = await hoverBg(WIN + '[data-tab-close]')
  check(
    '标签上那个小 × 悬停是中性淡底（不再是红底）',
    hasFill(tabCloseBg) && !isRed(tabCloseBg),
    tabCloseBg,
  )

  /* 拖拽排序：把「关于」标签拖到「博客」右边 */
  const tab0 = await p.locator('[data-tab="about"]').boundingBox()
  const tab1 = await p.locator('[data-tab="blog"]').boundingBox()
  await p.mouse.move(tab0.x + tab0.width / 2, tab0.y + tab0.height / 2)
  await p.mouse.down()
  await p.mouse.move(tab0.x + 6, tab0.y + tab0.height / 2, { steps: 3 })
  await p.mouse.move(tab1.x + tab1.width - 4, tab1.y + tab1.height / 2, { steps: 14 })
  await p.waitForTimeout(150)
  const dropping = await p.evaluate(() =>
    [...document.querySelectorAll('[data-tab]')].map((t) => t.dataset.dropping),
  )
  await p.mouse.up()
  await p.waitForTimeout(350)
  const reordered = await framesNow()
  check(
    '标签拖拽排序：拖到别的标签右边就换过去',
    dropping.includes('true') && reordered.tabs.join(',') === 'blog,about',
    JSON.stringify({ dropping, tabs: reordered.tabs }),
  )

  await p.click('[data-tab-select="about"]')
  await p.waitForTimeout(400)
  const switched = await p.evaluate(() => ({
    active: document.querySelector('[data-frame-active]')?.dataset.frameActive ?? '',
    activeTab: document.querySelector('[data-tab][data-active="true"]')?.dataset.tab ?? '',
    aboutWin: !!document.querySelector('section[aria-label="关于 窗口"]'),
    path: location.pathname,
  }))
  check(
    '点标签切页面：活动标签换了、URL 跟着走',
    switched.active === 'about' &&
      switched.activeTab === 'about' &&
      switched.aboutWin &&
      switched.path === '/about',
    JSON.stringify(switched),
  )

  /* 把标签**拖出框外**松手 = 拆成两个框（用户 2026-10-05 拍板的手势）。
     ⚠️ 顺序：先测"拆帧"、再测"关标签" —— 关掉之后这一框就只剩一个标签，
     而拆帧要求同框里至少 2 个标签（单个标签的框没有"拆"的意义） */
  const detachTab = await p.locator('[data-tab="about"]').boundingBox()
  await p.mouse.move(detachTab.x + detachTab.width / 2, detachTab.y + detachTab.height / 2)
  await p.mouse.down()
  await p.mouse.move(detachTab.x + detachTab.width / 2, detachTab.y + 12, { steps: 4 })
  await p.mouse.move(detachTab.x + detachTab.width / 2, detachTab.y + 60, { steps: 10 })
  await p.waitForTimeout(150)
  await p.mouse.up()
  await p.waitForTimeout(450)
  const detached = await framesNow()
  check(
    '把标签拖出框外松手 → 拆成两个框',
    detached.frames.length === 2 &&
      detached.frames.some((f) => f.tabs.join(',') === 'blog') &&
      detached.frames.some((f) => f.tabs.join(',') === 'about'),
    JSON.stringify(detached),
  )

  /* 再合回去（点任务栏图标把「关于」抬到最上面，就抓得到它的标题栏了），然后测"关标签" */
  await p.click(`${DOCK} button[aria-label="关于"]`)
  await p.waitForTimeout(400)
  const backHead = await p
    .locator('section[aria-label="关于 窗口"] [data-frame-head]')
    .boundingBox()
  const backInto = await p
    .locator('section[aria-label="博客 窗口"] [data-frame-head]')
    .boundingBox()
  await p.mouse.move(backHead.x + 60, backHead.y + backHead.height / 2)
  await p.mouse.down()
  await p.mouse.move(backInto.x + backInto.width - 100, backInto.y + backInto.height / 2, {
    steps: 10,
  })
  await p.mouse.up()
  await p.waitForTimeout(450)

  await p.click('[data-tab-close="about"]')
  await p.waitForTimeout(400)
  const closedTab = await framesNow()
  check(
    '关掉一个标签：帧还在，焦点交给同帧另一个标签',
    closedTab.frames.length === 1 &&
      closedTab.frames[0].tabs.join(',') === 'blog' &&
      closedTab.frames[0].active === 'blog' &&
      closedTab.path === '/blog',
    JSON.stringify(closedTab),
  )

  /* 刷新恢复：先把两框**再合并一次**，刷新后应该还是"一框两标签"。
     ⚠️ 上一条刚把「关于」那个标签关掉了 —— 先点任务栏图标把它开回来（那会新建一框并抬到最上面，
     这样它的标题栏一定抓得到），再拖到「博客」框上合并 */
  await p.click(`${DOCK} button[aria-label="关于"]`)
  await p.waitForTimeout(400)
  const beforeMergeHead = await p
    .locator('section[aria-label="关于 窗口"] [data-frame-head]')
    .boundingBox()
  const intoHead = await p
    .locator('section[aria-label="博客 窗口"] [data-frame-head]')
    .boundingBox()
  await p.mouse.move(beforeMergeHead.x + beforeMergeHead.width - 150, beforeMergeHead.y + beforeMergeHead.height / 2)
  await p.mouse.down()
  await p.mouse.move(intoHead.x + 90, intoHead.y + intoHead.height / 2, { steps: 14 })
  await p.mouse.up()
  await p.waitForTimeout(450)
  await p.click(`${DOCK} button[aria-label="设置"]`)
  await p.waitForTimeout(400)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(900)
  const session = await framesNow()
  check(
    '刷新后把上次开着的框都开回来（合并过的框仍是多标签）',
    session.frames.length === 2 &&
      session.frames.some((f) => f.tabs.slice().sort().join(',') === 'about,blog') &&
      session.frames.some((f) => f.tabs.join(',') === 'settings'),
    JSON.stringify(session),
  )

  /* ⚠️ 先把「设置」抬到最上面再拖：合并出来的那扇框比它大，可能把它整个盖住，
     被盖住时它的标题栏按不到（真实使用里也是点任务栏图标抬起来） */
  await p.click(`${DOCK} button[aria-label="设置"]`)
  await p.waitForTimeout(400)

  /* 前面「全屏」那条检查会顺手最大化当前窗口，而最大化状态下标题栏是拖不动的
     （要拖得先点还原，和真桌面一样）—— 这里先还原，免得后面的拖动全落空 */
  if (await p.locator('section[aria-label="设置 窗口"] button[aria-label="还原"]').count()) {
    await p.click('section[aria-label="设置 窗口"] button[aria-label="还原"]')
    await p.waitForTimeout(300)
  }

  /* 用户报的那个问题：窗口拖不到最左 / 最上（标签栏占了一条）。
     现在把标题栏一直拖到视口左上角，窗口就该老老实实停在 (0, 0) */
  const headBox = await p
    .locator('section[aria-label="设置 窗口"] [data-frame-head]')
    .boundingBox()
  /* ⚠️ 抓标题行里**标签右边的空白区**（浏览器里也是拖那块空白移动窗口）：
     现在整行都是标签行，左边被标签占着，按在标签上那是"拖标签换顺序" */
  await p.mouse.move(headBox.x + headBox.width - 150, headBox.y + headBox.height / 2)
  await p.mouse.down()
  await p.mouse.move(2, 2, { steps: 12 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  const corner = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const layer = document.querySelector('.desktop__layer')
    const w = win?.getBoundingClientRect()
    const l = layer?.getBoundingClientRect()
    return {
      x: Math.round(w?.left ?? -1),
      y: Math.round(w?.top ?? -1),
      layerLeft: Math.round(l?.left ?? -1),
      layerTop: Math.round(l?.top ?? -1),
    }
  })
  check(
    /* 2026-10-06（macOS P2）：顶部有了常驻菜单栏，窗口能到的"最上面"= **菜单栏下沿**
       （macOS 里窗口不会跑到菜单栏底下）。所以这里比的是"和窗口层的左上角对齐" */
    '窗口能拖到工作区最左上角（菜单栏之下、标签栏不再挡路）',
    corner.x === corner.layerLeft && corner.y === corner.layerTop && corner.layerTop > 0,
    JSON.stringify(corner),
  )

  // 17 吸附 / 平铺：拖到屏幕边缘对半分屏（用户 2026-10-05 要的）
  const snapLayer = await p.locator('.desktop__layer').boundingBox()
  const SET_HEAD = 'section[aria-label="设置 窗口"] [data-frame-head]'
  /* 上一步把窗口一路拖到了 (0,0) —— 那同时也命中了左上角的吸附区，所以它现在是四分之一。
     先双击标题栏解吸附，回到自由尺寸当基准（标签栏已经在窗框里面，不用再等它收回去） */
  await p.mouse.move(snapLayer.x + snapLayer.width / 2, snapLayer.y + snapLayer.height / 2)
  await p.waitForTimeout(500)
  await p.dblclick(SET_HEAD)
  await p.waitForTimeout(300)
  const freeBox = await p.locator('section[aria-label="设置 窗口"]').boundingBox()
  const grabSet = async () => {
    const h = await p.locator(SET_HEAD).boundingBox()
    /* 同前：抓标签右边的空白区，别按在标签上（那是拖标签） */
    return { x: h.x + h.width - 150, y: h.y + h.height / 2 }
  }

  /* 拖到左边缘：拖动过程中就该看到预览，松手才落位 */
  let g = await grabSet()
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(snapLayer.x + 6, snapLayer.y + snapLayer.height / 2, { steps: 8 })
  await p.waitForTimeout(120)
  const preview = await p.evaluate(
    () => document.querySelector('[data-snap-preview]')?.getAttribute('data-snap-preview') ?? '',
  )
  await p.mouse.up()
  await p.waitForTimeout(300)
  const snapped = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const layer = document.querySelector('.desktop__layer')
    const w = win?.getBoundingClientRect()
    const l = layer?.getBoundingClientRect()
    return {
      snap: win?.getAttribute('data-snap') ?? '',
      x: Math.round((w?.left ?? -1) - (l?.left ?? 0)),
      w: Math.round(w?.width ?? 0),
      half: Math.round(window.innerWidth / 2),
    }
  })
  check(
    '拖动时给吸附预览，松手贴到左半边',
    preview === 'left' && snapped.snap === 'left' && snapped.x === 0 && Math.abs(snapped.w - snapped.half) <= 2,
    JSON.stringify({ preview, ...snapped }),
  )

  /* 拖到上边缘 = 铺满**工作区**（从菜单栏下沿到屏幕底）。
      2026-10-06（macOS P2）：以前是"铺满整个屏幕（含任务栏那一带）"，现在顶部有常驻菜单栏，
      macOS 的铺满 / 最大化都**不盖它** —— 盖住菜单栏只有真·全屏那条路（见第 11d 条）。 */
  g = await grabSet()
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(snapLayer.x + snapLayer.width / 2, snapLayer.y + 6, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  const snappedTop = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const w = win?.getBoundingClientRect()
    const m = document.querySelector('[data-menubar]')?.getBoundingClientRect()
    return {
      snap: win?.getAttribute('data-snap') ?? '',
      w: Math.round(w?.width ?? 0),
      h: Math.round(w?.height ?? 0),
      top: Math.round(w?.top ?? -1),
      menuH: Math.round(m?.height ?? 0),
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
  check(
    '拖到上边缘 = 铺满工作区（菜单栏下沿 → 屏幕底，宽度通栏、**不盖菜单栏**）',
    snappedTop.snap === 'top' &&
      snappedTop.w === snappedTop.vw &&
      snappedTop.top === snappedTop.menuH &&
      snappedTop.h === snappedTop.vh - snappedTop.menuH,
    JSON.stringify(snappedTop),
  )

  /* ⚠️ 用户 2026-10-05 报的 bug：吸附基准曾经是「窗口层」（已被任务栏让过位），
     于是拖到底边只能贴到**任务栏上沿**。现在基准是整个视口 —— 贴底必须真的贴到屏幕底边 */
  g = await grabSet()
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(snapLayer.x + snapLayer.width / 2, 799, { steps: 8 })
  await p.waitForTimeout(120)
  const bottomPreview = await p.evaluate(
    () => document.querySelector('[data-snap-preview]')?.getAttribute('data-snap-preview') ?? '',
  )
  await p.mouse.up()
  await p.waitForTimeout(300)
  const snappedBottom = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const r = win?.getBoundingClientRect()
    return {
      snap: win?.getAttribute('data-snap') ?? '',
      bottomGap: Math.round(window.innerHeight - (r?.bottom ?? 0)),
      h: Math.round(r?.height ?? 0),
      /* 工作区高度的一半（视口 − 菜单栏）—— P2 之后"下半屏"分的是工作区，不是整个视口 */
      half: Math.round(
        (window.innerHeight -
          (document.querySelector('[data-menubar]')?.getBoundingClientRect().height ?? 0)) /
          2,
      ),
      layerBottom: Math.round(
        document.querySelector('.desktop__layer')?.getBoundingClientRect().bottom ?? 0,
      ),
    }
  })
  check(
    /* 2026-10-06（macOS P2）：下半屏是按**工作区**（视口 − 菜单栏）对半分的，
       所以高度 = (视口高 − 菜单栏高) / 2，底边仍然要贴到**屏幕最底边**（bottomGap === 0） */
    '拖到底边 = 工作区下半屏，而且真的贴到屏幕最底边（不再停在任务栏上沿）',
    bottomPreview === 'bottom' &&
      snappedBottom.snap === 'bottom' &&
      snappedBottom.bottomGap === 0 &&
      Math.abs(snappedBottom.h - snappedBottom.half) <= 2,
    JSON.stringify({ bottomPreview, ...snappedBottom }),
  )

  /* 用户 2026-10-05：「任务栏不要挡住窗口」—— 窗口层必须压在任务栏之上。
     此刻正好有一扇贴到底边的窗口盖在任务栏那一条上，拿它当断言样本最合适：
     任务栏中心点最上面那个元素应该属于窗口，而不是任务栏自己 */
  const dockOrder = await p.evaluate(() => {
    const layer = document.querySelector('.desktop__layer')
    const dock = document.querySelector('nav[aria-label="任务栏"]')
    const r = dock?.getBoundingClientRect()
    const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
    return {
      layerZ: Number(getComputedStyle(layer).zIndex),
      dockZ: Number(getComputedStyle(dock).zIndex),
      dockCoveredByWindow: !!(top && dock && !dock.contains(top)),
    }
  })
  check(
    '任务栏不挡窗口：窗口层压在任务栏之上（贴底的窗口不会被挡一截）',
    dockOrder.layerZ > dockOrder.dockZ && dockOrder.dockCoveredByWindow,
    JSON.stringify(dockOrder),
  )

  /* 从吸附状态拖开 = 解吸附，回到吸附前那个自由尺寸 */
  g = await grabSet()
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(snapLayer.x + snapLayer.width / 2, snapLayer.y + snapLayer.height / 2, { steps: 6 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  const unsnapped = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const w = win?.getBoundingClientRect()
    return { snap: win?.getAttribute('data-snap') ?? '', w: Math.round(w?.width ?? 0) }
  })
  check(
    '吸附后再拖开 = 解吸附（不再是贴边形状，标记也清掉）',
    unsnapped.snap === '' &&
      unsnapped.w !== snappedTop.vw &&
      unsnapped.w !== Math.round(snapLayer.width / 2) &&
      unsnapped.w >= 360,
    JSON.stringify({ ...unsnapped, freeW: Math.round(freeBox.width) }),
  )

  await closeAllWindows()
  await p.waitForTimeout(300)

  // 15 顶部菜单栏（macOS P2，2026-10-06）：应用名跟着聚焦窗口变、菜单真能打开、
  //    菜单里的动作**真有作用**（项目红线：不许摆点了没反应的按钮）
  await closeAllWindows()
  await p.waitForTimeout(300)

  /* 打开两个不同的窗口：菜单栏上的应用名要跟着聚焦（= 当前路由那个窗口）走 */
  await p.goto(`${BASE}/settings`, { waitUntil: 'load' })
  await p.waitForTimeout(600)
  const nameSettings = await p.textContent(`${MENUBAR} [data-menubar-app]`)
  await p.goto(`${BASE}/blog`, { waitUntil: 'load' })
  await p.waitForTimeout(800)
  const nameBlog = await p.textContent(`${MENUBAR} [data-menubar-app]`)
  check(
    '菜单栏上的应用名跟着聚焦窗口变（设置 → 博客）',
    !!nameSettings && !!nameBlog && nameSettings !== nameBlog && nameBlog.includes('博客'),
    JSON.stringify({ 设置: nameSettings, 博客: nameBlog }),
  )

  /* 点开「显示」：下拉要从菜单栏下沿展开，且项都是**可点**的按钮 */
  await p.click(`${MENUBAR} button[aria-label="显示"]`)
  await p.waitForTimeout(250)
  const viewMenu = await p.evaluate((sel) => {
    const menu = document.querySelector(`${sel} [role="menu"][aria-label="显示"]`)
    const items = menu ? [...menu.querySelectorAll('button[role="menuitem"]')] : []
    return {
      open: !!menu,
      n: items.length,
      clickable: items.filter((b) => {
        const r = b.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return !!hit && (b === hit || b.contains(hit))
      }).length,
      below: menu ? Math.round(menu.getBoundingClientRect().top) : -1,
      menuH: Math.round(document.querySelector('[data-menubar]').getBoundingClientRect().height),
    }
  }, MENUBAR)
  check(
    '菜单栏的「显示」菜单能打开：下拉挂在菜单栏下沿，且项都能点（≥3 项）',
    viewMenu.open &&
      viewMenu.n >= 3 &&
      viewMenu.clickable === viewMenu.n &&
      Math.abs(viewMenu.below - viewMenu.menuH) <= 2,
    JSON.stringify(viewMenu),
  )

  /* 从菜单点「平铺：左半」：落位要和"拖到左边缘"一模一样（同一份 snapRect），点完菜单收起 */
  await p.click(`${MENUBAR} [role="menu"][aria-label="显示"] button:has-text("平铺：左半")`)
  await p.waitForTimeout(400)
  const tiled = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="博客 窗口"]')
    const w = win?.getBoundingClientRect()
    const l = document.querySelector('.desktop__layer')?.getBoundingClientRect()
    return {
      snap: win?.getAttribute('data-snap') ?? '',
      x: Math.round((w?.left ?? -1) - (l?.left ?? 0)),
      w: Math.round(w?.width ?? 0),
      half: Math.round(window.innerWidth / 2),
      menuClosed: !document.querySelector('[data-menubar] [role="menu"]'),
    }
  })
  check(
    '菜单栏「平铺：左半」真的铺到左半边（与拖到左边缘同一份几何），点完菜单收起',
    tiled.snap === 'left' && tiled.x === 0 && Math.abs(tiled.w - tiled.half) <= 2 && tiled.menuClosed,
    JSON.stringify(tiled),
  )

  await closeAllWindows()
  await p.waitForTimeout(300)

  // 16 页面无运行时错误
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
