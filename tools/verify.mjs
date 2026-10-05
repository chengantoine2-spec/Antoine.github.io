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
      /* 上边距 = 标题栏 36 + 框内那行标签（工具条是浮层，不占高度） */
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
         所以偏移量就是那一行的高度，不再额外加一行标签栏 */
      Math.abs(dshEmbed.topOffset - 36) <= 3 &&
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
    titleButtons: [
      ...document.querySelectorAll('[aria-label="博客 窗口"] [data-window-controls] button'),
    ].map((b) =>
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
      /* 标签栏是浮层、不让位，所以最大化照旧铺满整个视口（含任务栏） */
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

  /* ── 14 任务栏图标区：默认是「循环轮盘」（wheel，用户 2026-10-05 要的）──────────
     行为：永远单行 + 首尾相接循环 + 中央放大 + 按住拖动浏览 + 竖拖 44px 换位；
     三个固定按钮（开始 / 全屏 / 位置）钉在两端，不参与循环与放大。
     旧的折行行为保留成设置里的可选项（wrap），那套断言在 14e 那一段。 */
  const wheelProbe = () =>
    p.evaluate((sel) => {
      const bar = document.querySelector(sel)
      const view = bar?.querySelector('[data-dock-view]')
      const track = bar?.querySelector('[data-dock-track]')
      const items = [...(track?.querySelectorAll('[data-dock-item]') ?? [])]
      const primary = items.filter((b) => b.getAttribute('data-dock-copy') === '1')
      const vr = view?.getBoundingClientRect()
      const mid = vr ? vr.x + vr.width / 2 : 0
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
        /* 放大曲线：`scale = PEAK - (PEAK-MIN)·u^1.5`（PEAK=2、MIN=0.8，u = 归一化距离）。
           站主 2026-10-05：中心 2×，**越远越小**，外侧要**小于 1×**（不是被裁）。 */
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
        mode: JSON.parse(localStorage.getItem('desktop.dock') ?? '{}').mode ?? null,
      }
    }, DOCK)
  const wheel0 = await wheelProbe()
  check(
    '任务栏图标区：永远单行（所有图标同一个布局 top），图标区是循环视口',
    wheel0.rows === 1 && wheel0.hasView && wheel0.hasTrack && wheel0.apps > 1,
    JSON.stringify({ rows: wheel0.rows, view: wheel0.hasView, track: wheel0.hasTrack, apps: wheel0.apps }),
  )
  check(
    '循环：渲染两份背靠背的列表，且只有正本带无障碍名（副本带 aria-label 会让所有窗口按钮选择器命中两个）',
    wheel0.copies === 2 && wheel0.items === wheel0.apps * 2 && wheel0.named === wheel0.apps,
    JSON.stringify({ copies: wheel0.copies, items: wheel0.items, named: wheel0.named, apps: wheel0.apps }),
  )
  /* 14a 图标全换菜图（站主 2026-10-05：「任务栏图标全部换成蔬菜水果图」，本轮只改任务栏）。
     身份层只有一份对应关系：`AppDef.veggie` → `lib/veggies.ts` 的 `veggieOfName()`。
     ⚠️ 同时钉住"无障碍名一个都没动" —— 两个验证脚本点任务栏全靠 `button[aria-label="X"]`。 */
  const veggieProbe = await p.evaluate((sel) => {
    const btns = [...document.querySelectorAll(`${sel} [data-dock-item][data-dock-copy="1"]`)]
    const rows = btns.map((b) => {
      const img = b.querySelector('img')
      return {
        label: b.getAttribute('aria-label'),
        hasImg: !!img,
        veg: (img?.getAttribute('src') ?? '').includes('veggies'),
      }
    })
    return {
      total: rows.length,
      img: rows.filter((r) => r.hasImg).length,
      veg: rows.filter((r) => r.veg).length,
      labelled: rows.filter((r) => r.label).length,
      sample: rows[0] ?? null,
    }
  }, DOCK)
  check(
    '任务栏图标全是菜图（每个应用按钮里都是 <img>，src 指向 veggies），且无障碍名一个没动',
    veggieProbe.total > 1 &&
      veggieProbe.img === veggieProbe.total &&
      veggieProbe.veg === veggieProbe.total &&
      veggieProbe.labelled === veggieProbe.total,
    JSON.stringify(veggieProbe),
  )

  /* 放大曲线：`scale = PEAK - (PEAK-MIN)·u^1.5`，PEAK = 2、MIN = 0.8、指数 1.5。
     站主的口径是"中心 2×、越远越小、最外侧约 0.8×"（旧口径是 d≥R 之后恒等 1.0）。 */
  check(
    '中央放大：中心 ≥1.9×、按实测距离单调递减、最外侧 ≤0.85×（越远越小，外侧小于 1× 是要的效果）',
    wheel0.centerScale >= 1.9 &&
      wheel0.monoOk &&
      wheel0.edgeScale <= 0.85 &&
      wheel0.edgeScale >= 0.75,
    JSON.stringify({
      center: wheel0.centerScale,
      曲线: wheel0.curve,
      outer: wheel0.edgeScale,
      单调递减: wheel0.monoOk,
    }),
  )
  /* 允许凸出（站主："中间扩大的图标允许溢出，一种凸出任务栏的夸张感"）：
     不是把裁剪框撑大把 2× 装进去，而是图标从栏边凸出来。 */
  check(
    '放大的中心图标凸出任务栏（底栏：图标顶边高于栏顶边），凸出来那一截真的看得见、不被容器裁',
    wheel0.protrude > 6 && wheel0.protrudeHit,
    JSON.stringify({ 凸出量: wheel0.protrude, 凸出处命中图标: wheel0.protrudeHit }),
  )
  check(
    '图标区只裁主轴（clip-path ≠ none）：可视区左右两侧外面的点命不中任何图标（循环的第二份仍藏着）',
    wheel0.clipPath !== 'none' && wheel0.mainAxisClipped,
    JSON.stringify({ clipPath: wheel0.clipPath, 主轴外侧命不中图标: wheel0.mainAxisClipped }),
  )

  /* 14b 拖拽浏览：按住沿轴拖 120px 跟手；松手吸附到最近的整数格；往一个方向一直拖不到头 */
  const trackState = () =>
    p.evaluate((sel) => {
      const bar = document.querySelector(sel)
      const view = bar?.querySelector('[data-dock-view]')
      const track = bar?.querySelector('[data-dock-track]')
      const items = [...(track?.querySelectorAll('[data-dock-item]') ?? [])]
      const primary = items.filter((b) => b.getAttribute('data-dock-copy') === '1')
      const m = track ? new DOMMatrixReadOnly(getComputedStyle(track).transform) : null
      const vr = view?.getBoundingClientRect()
      return {
        tx: m ? Math.round(m.e) : 0,
        step: primary.length > 1 ? primary[1].offsetLeft - primary[0].offsetLeft : 0,
        cycle: primary.length > 1 ? primary.length * (primary[1].offsetLeft - primary[0].offsetLeft) : 0,
        /* 可视区里"有事发生"的格数：**两份都要数** —— 循环接不上时这里会少于可视区能装的格数 */
        cover: vr
          ? items.filter((b) => {
              const r = b.getBoundingClientRect()
              return r.right > vr.x - 1 && r.x < vr.right + 1
            }).length
          : 0,
        viewW: vr ? Math.round(vr.width) : 0,
      }
    }, DOCK)
  const wheelCenter = await p.evaluate((sel) => {
    const r = document.querySelector(`${sel} [data-dock-view]`)?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  }, DOCK)
  const track0 = await trackState()
  await p.mouse.move(wheelCenter.x, wheelCenter.y)
  await p.mouse.down()
  for (let i = 1; i <= 12; i += 1) await p.mouse.move(wheelCenter.x + i * 10, wheelCenter.y)
  const trackDrag = await trackState()
  await p.mouse.up()
  await p.waitForTimeout(400)
  const trackSnap = await trackState()
  check(
    '拖拽浏览：按住沿轴拖 120px，图标区跟着指针走（偏移按一个 cycle 取模后正好差 120）',
    (() => {
      if (!(trackDrag.cycle > 0)) return false
      const mod = (v) => ((v % trackDrag.cycle) + trackDrag.cycle) % trackDrag.cycle
      const delta = mod(trackDrag.tx - track0.tx)
      /* 指针往右拖 120px ⇒ 内容跟着往右 120px ⇒ translateX 增加 120（tx 是 -offset）。
         平移一个 cycle 画面完全一样，所以只能按 cycle 取模比 */
      const want = mod(120)
      return Math.abs(delta - want) <= 4
    })(),
    JSON.stringify({ before: track0.tx, during: trackDrag.tx, cycle: trackDrag.cycle }),
  )
  check(
    '松手吸附到最近的格子（偏移是 step 的整数倍）',
    trackSnap.step > 0 && trackSnap.tx % trackSnap.step === 0,
    JSON.stringify({ tx: trackSnap.tx, step: trackSnap.step }),
  )
  /* 再往左连拖两段（约 2.5 个 cycle）：一直拖不会到头，图标始终铺满可视区 */
  for (let k = 0; k < 2; k += 1) {
    await p.mouse.move(wheelCenter.x, wheelCenter.y)
    await p.mouse.down()
    for (let i = 1; i <= 10; i += 1) await p.mouse.move(wheelCenter.x - i * 60, wheelCenter.y)
    await p.mouse.up()
    await p.waitForTimeout(320)
  }
  const trackFar = await trackState()
  check(
    '循环：往一个方向一直拖不会到头（图标始终铺满可视区，偏移归一化回一个 cycle 内）',
    trackFar.cover >= Math.floor(trackFar.viewW / trackFar.step) &&
      Math.abs(trackFar.tx) <= trackFar.cycle,
    JSON.stringify({ cover: trackFar.cover, need: Math.floor(trackFar.viewW / trackFar.step), tx: trackFar.tx, cycle: trackFar.cycle }),
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

  /* 14d 三个固定按钮：钉在两端，不在循环轨道里（循环转不走它们） */
  const fixedProbe = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    const track = bar?.querySelector('[data-dock-track]')
    const barBox = bar.getBoundingClientRect()
    const find = (s) => bar.querySelector(s)
    const btns = {
      menu: find('button[aria-label="所有项目"]'),
      full: find('button[aria-label="全屏"], button[aria-label="退出全屏"]'),
      pos: find('button[aria-label="任务栏位置"]'),
    }
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
    return out
  }, DOCK)
  check(
    '三个固定按钮钉在两端：都在栏内、都不在循环轨道里、都点得到',
    !!fixedProbe.menu &&
      !!fixedProbe.full &&
      !!fixedProbe.pos &&
      Object.values(fixedProbe).every((v) => v.inBar && !v.inTrack && v.clickable),
    JSON.stringify(fixedProbe),
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
  const verticalWheel = await p.evaluate((sel) => {
    const bar = document.querySelector(sel)
    const view = bar?.querySelector('[data-dock-view]')
    const track = bar?.querySelector('[data-dock-track]')
    const items = [...(track?.querySelectorAll('[data-dock-item][data-dock-copy="1"]') ?? [])]
    const vr = view?.getBoundingClientRect()
    const mid = vr ? vr.y + vr.height / 2 : 0
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
  }, DOCK)
  check(
    '左停靠 = 单列轮盘：图标同一列、有垂直的循环轨道、中央一样放大、两份列表都在',
    verticalWheel.verticalBar &&
      verticalWheel.cols === 1 &&
      verticalWheel.hasView &&
      verticalWheel.viewV &&
      verticalWheel.trackV &&
      verticalWheel.copies === 2 &&
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

  /* 切回循环轮盘：单行 + 循环轨道都回来 */
  await setDockMode('循环轮盘')
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
    '切回「循环轮盘」：回到单行 + 循环轨道（mode 落盘 wheel）',
    backToWheel.mode === 'wheel' && backToWheel.rows === 1 && backToWheel.hasView && backToWheel.hasTrack,
    JSON.stringify({ mode: backToWheel.mode, rows: backToWheel.rows, view: backToWheel.hasView }),
  )
  await closeAllWindows()
  await p.waitForTimeout(400)

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

  /* 标签行必须画在窗口边框**里面**，而且和窗口按钮**同一行**（用户 2026-10-05：
     「图一只有一行，为什么我们的有两行」→ 一行到底，跟浏览器一样）。
     所以这里量三件事：横向不越出窗框、纵向就在标题行里、和右边那三个按钮同一水平线 */
  const stripIn = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="博客 窗口"]')
    const strip = win?.querySelector('[data-frame-tabs]')
    const controls = win?.querySelector('[data-window-controls]')
    const head = win?.querySelector('[data-frame-head]')
    const w = win?.getBoundingClientRect()
    const s = strip?.getBoundingClientRect()
    const c = controls?.getBoundingClientRect()
    const h = head?.getBoundingClientRect()
    if (!w || !s || !c || !h) return null
    const mid = (r) => (r.top + r.bottom) / 2
    return {
      stripH: Math.round(s.height),
      gap: Math.round(s.top - w.top),
      sameRow: Math.round(Math.abs(mid(s) - mid(c))) <= 2,
      inHead: s.top >= h.top - 1 && s.bottom <= h.bottom + 1,
      inside: s.left >= w.left - 1 && s.right <= w.right + 1 && s.top >= w.top - 1,
    }
  })
  check(
    '整扇窗只有一行：标签行与窗口按钮同排（不再有第二行标签栏）',
    !!stripIn && stripIn.inside && stripIn.inHead && stripIn.sameRow && stripIn.stripH <= 40 && stripIn.gap <= 6,
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
  const WIN = 'section[aria-label="博客 窗口"] '
  const ctrlBgs = {
    minus: await hoverBg(`${WIN}[data-window-controls] button[aria-label="最小化"]`),
    /* 最大化 / 还原共用一个按钮，用 aria-pressed 认它，免得窗口恰好在最大化态时选不中 */
    maximize: await hoverBg(`${WIN}[data-window-controls] button[aria-pressed]`),
    close: await hoverBg(`${WIN}[data-window-controls] button[aria-label="关闭"]`),
    tabClose: await hoverBg(`${WIN}[data-tab-close]`),
  }
  const hasFill = (v) => !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)'
  /** 红底判定：红通道明显压过绿蓝（令牌换成别的红也照样过，不钉死具体色值） */
  const isRed = (v) => {
    const m = /rgba?\(([^)]+)\)/.exec(v || '')
    if (!m) return false
    const [r, g, b] = m[1].split(',').map((n) => parseFloat(n))
    return r > g + 20 && r > b + 20
  }
  check(
    '悬停：最小化 / 最大化是淡按钮形状，关闭键（标题行 + 标签上那个小 ×）是红底',
    hasFill(ctrlBgs.minus) &&
      hasFill(ctrlBgs.maximize) &&
      isRed(ctrlBgs.close) &&
      isRed(ctrlBgs.tabClose) &&
      ctrlBgs.close === ctrlBgs.tabClose,
    JSON.stringify(ctrlBgs),
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
    '窗口能拖到最左上角（标签栏不再挡路）',
    corner.x === 0 && corner.y === 0 && corner.layerLeft === 0 && corner.layerTop === 0,
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

  /* 拖到上边缘 = 铺满工作区（任务栏那块留着；要连任务栏一起盖住就点 □ 最大化） */
  g = await grabSet()
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(snapLayer.x + snapLayer.width / 2, snapLayer.y + 6, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(300)
  const snappedTop = await p.evaluate(() => {
    const win = document.querySelector('section[aria-label="设置 窗口"]')
    const w = win?.getBoundingClientRect()
    return {
      snap: win?.getAttribute('data-snap') ?? '',
      w: Math.round(w?.width ?? 0),
      h: Math.round(w?.height ?? 0),
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
  check(
    '拖到上边缘 = 铺满整个屏幕（含任务栏那一带）',
    snappedTop.snap === 'top' && snappedTop.w === snappedTop.vw && snappedTop.h === snappedTop.vh,
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
      half: Math.round(window.innerHeight / 2),
      layerBottom: Math.round(
        document.querySelector('.desktop__layer')?.getBoundingClientRect().bottom ?? 0,
      ),
    }
  })
  check(
    '拖到底边 = 下半屏，而且真的贴到屏幕最底边（不再停在任务栏上沿）',
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
