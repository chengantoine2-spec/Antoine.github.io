/**
 * 生成 `design/preview.html`（图标设计稿预览页，**不参与 Vite 构建**）。
 *
 *   node design/build-preview.mjs
 *
 * 为什么要有这个脚本：任务书 §4 要求「组件 / design/icons/*.svg / 预览页」三份同源。
 * 靠手抄迟早漂移，所以预览页由本脚本从**两份真实来源**抽出来：
 *   ① 上线那份：`src/components/icons/*Icon.tsx`（几何以此为准）
 *   ② 设计稿：  `design/icons/*.svg`
 * 脚本会顺手断言两者几何一致（不一致就在终端里喊出来），所以它同时是一道同源校验。
 *
 * 「改前」那一栏是**基线快照**：从 BASELINE 这个提交里读旧组件，写死在页面里。
 * 换基线就改下面那个 sha，别让它跟着 HEAD 漂。
 *
 * 只用 Node 内置模块（fs / child_process），不引任何依赖。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compDir = join(root, 'src/components/icons')
const draftDir = join(root, 'design/icons')

/** 改前快照的基线（就是本批图标重画之前的那个提交） */
const BASELINE = 'b5749d6'

/** IconName → 中文名 + 每样菜（菜名只出现在预览页，不进无障碍名） */
const APPS = [
  ['about', '关于', '土豆'],
  ['projects', '项目', '南瓜'],
  ['blog', '博客', '玉米'],
  ['write', '博客创作', '番茄'],
  ['skills', '技能', '竹笋'],
  ['contact', '联系', '葡萄'],
  ['terminal', '终端', '辣椒'],
  ['assets', '资产库', '花生'],
  ['settings', '设置', '大蒜'],
  ['wiki', '饥荒 Wiki', '洋葱'],
  ['dsh', 'DSH', '芹菜'],
]

const pascal = (id) => id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')

/** 把一段 JSX / SVG 里的图形标签按出现顺序抽出来 */
function shapesOf(markup) {
  const out = []
  const re = /<(rect|circle|path|ellipse|line|polygon)\b[^>]*\/?>/g
  let m
  while ((m = re.exec(markup)) !== null) out.push(m[0].replace(/\s*\/>$/, ' />'))
  return out
}

function innerOfSvg(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!m) throw new Error('抽不出图形：' + file)
  return m[1].replace(/<!--[\s\S]*?-->/g, '').trim()
}

function innerOfTsx(text) {
  const i = text.indexOf('<svg')
  const j = text.lastIndexOf('</svg>')
  if (i < 0 || j < 0) throw new Error('抽不出图形')
  return text.slice(text.indexOf('>', i) + 1, j).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim()
}

/** 基线提交里的旧图形；取不到就返回 null（页面里那栏自动省略） */
function baselineMarkup(id) {
  try {
    const text = execFileSync('git', ['show', `${BASELINE}:src/components/icons/${pascal(id)}Icon.tsx`], {
      cwd: root,
      encoding: 'utf8',
    })
    return innerOfTsx(text)
  } catch {
    return null
  }
}

/* ---------- 应用图标：设计稿 vs 上线组件，同源校验 ---------- */
const ICONS = []
for (const [id, name, veggie] of APPS) {
  const draftPath = join(draftDir, id + '.svg')
  if (!existsSync(draftPath)) throw new Error('缺设计稿：' + draftPath)
  const draft = shapesOf(innerOfSvg(draftPath))
  const live = shapesOf(innerOfTsx(readFileSync(join(compDir, pascal(id) + 'Icon.tsx'), 'utf8')))
  const same = draft.length === live.length && draft.every((s, i) => s === live[i])
  if (!same) {
    console.error(`[preview] ✗ ${id}：design/icons/${id}.svg 与 ${pascal(id)}Icon.tsx 几何不一致`)
    console.error('   设计稿：' + draft.join(' | '))
    console.error('   组件  ：' + live.join(' | '))
    process.exitCode = 1
  }
  ICONS.push({ id, name, veggie, draft, before: baselineMarkup(id) })
}
if (process.exitCode !== 1) console.log(`[preview] ${ICONS.length} 个图标：设计稿与组件几何一致 ✓`)

/* ---------- 外壳字形：12 网格那三张 + 九宫格 ---------- */
const glyph = (id, name, viewBox, states) => ({ id, name, viewBox, states })
const menuDots = []
for (const y of [7, 12, 17]) for (const x of [7, 12, 17]) menuDots.push(`<circle cx="${x}" cy="${y}" r="1.7" />`)

const GLYPHS = [
  glyph('menu', '所有项目（九宫格）', '0 0 24 24', [{ name: '默认', shapes: menuDots, solid: true }]),
  glyph('fullscreen', '全屏 / 退出全屏', '0 0 12 12', [
    {
      name: '未全屏',
      shapes: ['<path d="M1.5 4.8V1.5H4.8" />', '<path d="M10.5 4.8V1.5H7.2" />', '<path d="M1.5 7.2v3.3H4.8" />', '<path d="M10.5 7.2v3.3H7.2" />'],
    },
    {
      name: '已全屏',
      shapes: ['<path d="M4.8 1.5V4.8H1.5" />', '<path d="M7.2 1.5V4.8H10.5" />', '<path d="M4.8 10.5V7.2H1.5" />', '<path d="M7.2 10.5V7.2H10.5" />'],
    },
  ]),
  glyph('maximize', '最大化 / 还原', '0 0 12 12', [
    { name: '未最大化', shapes: ['<rect x="1.5" y="1.5" width="9" height="9" rx="1.3" />'] },
    {
      name: '已最大化（必须是 2 个图形）',
      shapes: [
        '<rect x="1.5" y="3.5" width="7" height="7" rx="1.2" />',
        '<path d="M4.2 3.4V2.9A1.1 1.1 0 0 1 5.3 1.8H9.6A1.1 1.1 0 0 1 10.7 2.9V7.2A1.1 1.1 0 0 1 9.6 8.3H8.4" />',
      ],
    },
  ]),
  glyph('position', '任务栏位置（四态）', '0 0 12 12', [
    { name: '底部', shapes: ['<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" />', '<rect x="3" y="8.25" width="6" height="1.25" rx="0.6" fill="currentColor" />'] },
    { name: '顶部', shapes: ['<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" />', '<rect x="3" y="2.5" width="6" height="1.25" rx="0.6" fill="currentColor" />'] },
    { name: '左侧', shapes: ['<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" />', '<rect x="2.5" y="3" width="1.25" height="6" rx="0.6" fill="currentColor" />'] },
    { name: '右侧', shapes: ['<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" />', '<rect x="8.25" y="3" width="1.25" height="6" rx="0.6" fill="currentColor" />'] },
  ]),
]

/* ---------- 组装页面 ---------- */
const symbols = []
for (const icon of ICONS) {
  symbols.push(`    <symbol id="new-${icon.id}" viewBox="0 0 24 24">${icon.draft.join('')}</symbol>`)
  if (icon.before) symbols.push(`    <symbol id="old-${icon.id}" viewBox="0 0 24 24">${shapesOf(icon.before).join('')}</symbol>`)
}
for (const g of GLYPHS) {
  for (const state of g.states) {
    symbols.push(
      `    <symbol id="glyph-${g.id}-${state.name}" viewBox="${g.viewBox}">${state.shapes.join('')}</symbol>`,
    )
  }
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>图标预览 · 芹菜耕地</title>
<style>
  :root { --sans: ui-sans-serif, system-ui, "Microsoft YaHei", sans-serif; --mono: ui-monospace, Consolas, monospace; }
  body { margin: 0; padding: 26px 30px 70px; background: #f2eee7; color: #2c2620; font: 13px/1.65 var(--sans); }
  h1 { font-size: 19px; margin: 0 0 6px; }
  h2 { font-size: 13px; margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #ddd5c8; letter-spacing: .04em; }
  .note { color: #6d6355; font-size: 12px; margin: 0 0 4px; }
  .note b { color: #2c2620; }
  code { font: 11px/1 var(--mono); background: rgba(120,100,75,.1); padding: 1px 4px; border-radius: 4px; }
  .theme { border-radius: 12px; padding: 14px 18px 16px; margin: 12px 0; border: 1px solid; }
  .theme h3 { margin: 0 0 6px; font-size: 12px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }
  .theme h3 em { font-style: normal; font-weight: 400; font-size: 11px; opacity: .66; }
  table { border-collapse: separate; border-spacing: 0; }
  th, td { vertical-align: middle; text-align: center; padding: 0 12px 0 0; }
  th { font-weight: 500; font-size: 11px; opacity: .7; padding-bottom: 4px; }
  td.size, th.size { font: 11px/1 var(--mono); opacity: .55; padding-right: 8px; text-align: left; }
  .cell { display: flex; align-items: center; justify-content: center; }
  .dock { display: flex; gap: 8px; align-items: center; width: max-content; padding: 7px 9px; border-radius: 14px; }
  .dock .btn { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .grid-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 14px 10px; }
  .item { text-align: center; }
  .lbl { font-size: 11px; color: #6d6355; margin-top: 6px; }
  .lbl b { color: #2c2620; font-weight: 600; }
  .pair { display: flex; gap: 8px; align-items: flex-end; justify-content: center; }
  .pair .one { text-align: center; }
  .pair .one i { display: block; font-style: normal; font-size: 10px; color: #8a7f6d; margin-top: 3px; }
  .gridbox { position: relative; width: 110px; height: 110px; margin: 0 auto; border-radius: 10px; border: 1px solid #e3dccf; background-color: #fff8f0;
    background-image: linear-gradient(to right, rgba(120,100,75,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,100,75,.16) 1px, transparent 1px);
    background-size: 4.583px 4.583px; display: flex; align-items: center; justify-content: center; }
  .gridbox .safe { position: absolute; left: 13.75px; top: 13.75px; right: 13.75px; bottom: 13.75px; border: 1px dashed rgba(165,82,42,.45); border-radius: 6px; }
  .raster { display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap; }
  .raster canvas { display: block; image-rendering: pixelated; }
  .glyphrow { display: flex; gap: 22px; align-items: flex-end; flex-wrap: wrap; }
  .glyphrow .one { text-align: center; }
  .tiles { display: flex; gap: 10px; align-items: center; }
  .tile { border-radius: 10px; padding: 9px 11px; display: flex; gap: 14px; align-items: center; }
  .tile .slot { display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<h1>图标预览 · 芹菜耕地</h1>
<p class="note">这是<b>设计稿页面</b>，不参与 Vite 构建，双击即可打开。按任务书 §6：<b>只有这一页允许写死颜色</b>，组件里一律 currentColor。</p>
<p class="note">本页由 <code>node design/build-preview.mjs</code> 从 <code>src/components/icons/*.tsx</code> 与 <code>design/icons/*.svg</code> 抽出生成；
两份几何不一致时脚本会报错 —— 它就是「三份同源」的看门人。「改前」是基线 <code>${BASELINE}</code> 的快照。</p>

<h2>一、三套主题 × 五档尺寸（颜色取 text-accent，即标题栏 / 列表里的用法）</h2>
<div id="themes"></div>

<h2>二、任务栏实景（深底：未选中 = chrome-ink；选中 = accent 底 + accent-ink）</h2>
<div id="docks"></div>

<h2>三、改前 vs 改后（24px，浅底深线）</h2>
<div class="grid-icons" id="compare"></div>

<h2>四、16px 实拍放大 ×4（最近邻；矢量缩放看不出糊不糊，这一行才是真判断）</h2>
<div id="raster"></div>

<h2>五、细节与网格（110px；虚线框是 3~21 的安全区）</h2>
<div class="grid-icons" id="detail"></div>

<h2>六、外壳字形（12 网格那三张与九宫格；按真实尺寸给：任务栏 22px / 设置与菜单 16px / 标题栏 12px）</h2>
<div id="glyphs"></div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${symbols.join('\n')}
</defs></svg>

<script>
(function () {
  var BASE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
  var THEMES = [
    { key: 'caramel', label: 'caramel · 焦糖', surface: '#fff8f0', edge: '#efd3b0', text: '#3d2b1f', accent: '#a96f44', chrome: 'rgba(61,43,31,.82)', chromeInk: '#fff8f0', accentInk: '#fff8f0' },
    { key: 'linen', label: 'linen · 亚麻', surface: '#fbf7ee', edge: '#dccdb4', text: '#3a3226', accent: '#8a6a45', chrome: 'rgba(74,63,50,.78)', chromeInk: '#fbf7ee', accentInk: '#fbf7ee' },
    { key: 'night', label: 'night · 夜', surface: '#22252b', edge: '#3a3f48', text: '#e8e6e1', accent: '#c68a5b', chrome: 'rgba(32,34,40,.86)', chromeInk: '#e8e6e1', accentInk: '#1b1d22' }
  ]
  var ICONS = ${JSON.stringify(ICONS.map(({ id, name, veggie, before }) => ({ id, name, veggie, before: !!before })))}
  var SIZES = [16, 24, 32, 48, 64]
  var RASTER_BASE = 'fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'

  function icon(sym, viewBox, size, color) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + viewBox + '" ' + BASE +
      (color ? ' style="color:' + color + '"' : '') + '><use href="#' + sym + '"/></svg>'
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (html !== undefined) e.innerHTML = html
    return e
  }

  /* 一、主题 × 尺寸 */
  var themesHost = document.getElementById('themes')
  THEMES.forEach(function (t) {
    var box = el('div', 'theme')
    box.style.background = t.surface
    box.style.borderColor = t.edge
    box.style.color = t.text
    box.appendChild(el('h3', null, t.label + ' <em>卡片底 ' + t.surface + ' · 图形色 = accent ' + t.accent + '</em>'))
    var table = el('table')
    var head = el('tr')
    head.innerHTML = '<th class="size">尺寸</th>' + ICONS.map(function (i) { return '<th>' + i.name + '</th>' }).join('')
    table.appendChild(head)
    SIZES.forEach(function (size) {
      var tr = el('tr')
      tr.appendChild(el('th', 'size', size + 'px'))
      ICONS.forEach(function (i) {
        var td = el('td')
        var cell = el('div', 'cell')
        cell.style.height = size + 'px'
        cell.innerHTML = icon('new-' + i.id, '0 0 24 24', size, t.accent)
        td.appendChild(cell)
        tr.appendChild(td)
      })
      table.appendChild(tr)
    })
    box.appendChild(table)
    themesHost.appendChild(box)
  })

  /* 二、任务栏实景 */
  var dockHost = document.getElementById('docks')
  THEMES.forEach(function (t) {
    var row = el('div')
    row.style.margin = '10px 0'
    var dock = el('div', 'dock')
    dock.style.background = t.chrome
    ICONS.forEach(function (i, idx) {
      var b = el('div', 'btn')
      if (idx === 1) { b.style.background = t.accent; b.style.color = t.accentInk }
      else { b.style.color = t.chromeInk }
      b.innerHTML = icon('new-' + i.id, '0 0 24 24', 32)
      dock.appendChild(b)
    })
    row.appendChild(dock)
    row.appendChild(el('div', 'note', t.label + ' —— 任务栏底 ' + t.chrome + '，第 2 个是选中态（' + t.accent + ' 底）'))
    dockHost.appendChild(row)
  })

  /* 三、改前 vs 改后 */
  var cmpHost = document.getElementById('compare')
  ICONS.forEach(function (i) {
    var item = el('div', 'item')
    if (i.before) {
      item.appendChild(el('div', 'pair',
        '<div class="one">' + icon('old-' + i.id, '0 0 24 24', 24, '#3d2b1f') + '<i>改前</i></div>' +
        '<div class="one">' + icon('new-' + i.id, '0 0 24 24', 24, '#3d2b1f') + '<i>改后</i></div>'))
    } else {
      item.appendChild(el('div', 'pair', '<div class="one">' + icon('new-' + i.id, '0 0 24 24', 24, '#3d2b1f') + '<i>本批新增</i></div>'))
    }
    item.appendChild(el('div', 'lbl', '<b>' + i.name + '</b><br />' + i.veggie))
    cmpHost.appendChild(item)
  })

  /* 四、16px 实拍 */
  var rasterHost = document.getElementById('raster')
  function rasterRow(bg, color, label, cells) {
    var wrap = el('div')
    wrap.appendChild(el('div', 'note', label))
    var row = el('div', 'raster')
    wrap.appendChild(row)
    cells.forEach(function (p) {
      var cell = el('div', 'item')
      var holder = el('div')
      cell.appendChild(holder)
      cell.appendChild(el('div', 'lbl', p.name))
      row.appendChild(cell)
      var sym = document.getElementById(p.sym)
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + p.viewBox + '" ' + RASTER_BASE +
        ' stroke="' + color + '">' + sym.innerHTML + '</svg>'
      var img = new Image()
      img.onload = function () {
        var small = document.createElement('canvas')
        small.width = small.height = 16
        small.getContext('2d').drawImage(img, 0, 0, 16, 16)
        var big = document.createElement('canvas')
        big.width = big.height = 64
        var g = big.getContext('2d')
        g.imageSmoothingEnabled = false
        g.drawImage(small, 0, 0, 64, 64)
        holder.style.cssText = 'width:64px;height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + bg
        holder.appendChild(big)
      }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
    rasterHost.appendChild(wrap)
  }
  var rasterCells = ICONS.map(function (i) {
    return [
      { sym: 'old-' + i.id, viewBox: '0 0 24 24', name: i.name + ' · 改前' },
      { sym: 'new-' + i.id, viewBox: '0 0 24 24', name: i.name + ' · 改后' },
    ]
  })
  var flat = []
  rasterCells.forEach(function (pair) { pair.forEach(function (c) { flat.push(c) }) })
  rasterRow('#fff8f0', '#3d2b1f', '浅底（卡片 / 窗口正文，图形取 text-ink）—— 每组左=改前、右=改后', flat)
  rasterRow('#22252b', '#e8e6e1', '深底（night 主题卡片）—— 同上', flat)

  /* 五、细节 + 网格 */
  var detailHost = document.getElementById('detail')
  ICONS.forEach(function (i) {
    var item = el('div', 'item')
    var box = el('div', 'gridbox')
    box.appendChild(el('div', 'safe'))
    box.innerHTML += icon('new-' + i.id, '0 0 24 24', 110, '#3d2b1f')
    item.appendChild(box)
    item.appendChild(el('div', 'lbl', i.name))
    detailHost.appendChild(item)
  })

  /* 六、字形 */
  var glyphHost = document.getElementById('glyphs')
  var GLYPHS = ${JSON.stringify(GLYPHS.map((g) => ({ id: g.id, name: g.name, viewBox: g.viewBox, states: g.states.map((s) => s.name), solid: g.states.some((s) => s.solid === true) })))}
  /* 实心字形（九宫格）自己带 fill，不能套图标那套 fill="none" 的 BASE —— 否则九个点会被画成空心圈 */
  function glyphIcon(g, state, size) {
    var paint = g.solid
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="' + (g.viewBox === '0 0 12 12' ? '1.2' : '1.6') + '" stroke-linecap="round" stroke-linejoin="round"'
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + g.viewBox + '" ' + paint + '><use href="#glyph-' + g.id + '-' + state + '"/></svg>'
  }
  GLYPHS.forEach(function (g) {
    var wrap = el('div')
    wrap.style.margin = '14px 0 22px'
    wrap.appendChild(el('div', 'note', '<b>' + g.name + '</b> · viewBox ' + g.viewBox + (g.solid ? ' · 实心' : '')))
    var tiles = el('div', 'tiles')
    var SIZES_G = [{ size: 22, label: '任务栏 22px' }, { size: 16, label: '设置 / 菜单 16px' }, { size: 12, label: '标题栏 12px' }]
    SIZES_G.forEach(function (s) {
      var tile = el('div', 'tile')
      tile.style.background = THEMES[0].chrome
      tile.style.color = THEMES[0].chromeInk
      g.states.forEach(function (state, si) {
        var slot = el('div', 'slot')
        slot.innerHTML = glyphIcon(g, state, s.size) +
          (si === 0 ? '<span style="font:10px/1 var(--mono);margin-left:8px;opacity:.7">' + s.label + '</span>' : '')
        tile.appendChild(slot)
      })
      tiles.appendChild(tile)
    })
    wrap.appendChild(tiles)
    var labels = el('div', 'note', '状态：' + g.states.join(' / '))
    wrap.appendChild(labels)
    glyphHost.appendChild(wrap)
  })
  /* 字形也来一行 16px 实拍 —— 线宽够不够就在这里看 */
  var glyphRow = el('div')
  glyphRow.appendChild(el('div', 'note', '<b>字形 16px 实拍放大 ×4</b>（浅底深线）'))
  var grow = el('div', 'raster')
  glyphRow.appendChild(grow)
  GLYPHS.forEach(function (g) {
    g.states.forEach(function (state) {
      var cell = el('div', 'item')
      var holder = el('div')
      cell.appendChild(holder)
      cell.appendChild(el('div', 'lbl', g.id + ' · ' + state))
      grow.appendChild(cell)
      var sym = document.getElementById('glyph-' + g.id + '-' + state)
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + g.viewBox + '" ' +
        (g.solid
          ? 'fill="#3d2b1f" stroke="none"'
          : 'fill="none" stroke="#3d2b1f" stroke-width="' + (g.viewBox === '0 0 12 12' ? '1.2' : '1.6') + '" stroke-linecap="round" stroke-linejoin="round"') +
        '>' + sym.innerHTML + '</svg>'
      var img = new Image()
      img.onload = function () {
        var small = document.createElement('canvas')
        small.width = small.height = 16
        small.getContext('2d').drawImage(img, 0, 0, 16, 16)
        var big = document.createElement('canvas')
        big.width = big.height = 64
        var c = big.getContext('2d')
        c.imageSmoothingEnabled = false
        c.drawImage(small, 0, 0, 64, 64)
        holder.style.cssText = 'width:64px;height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff8f0'
        holder.appendChild(big)
      }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
  })
  glyphHost.appendChild(glyphRow)
})()
</script>
</body>
</html>
`

writeFileSync(join(root, 'design/preview.html'), html)
console.log(`[preview] 已生成 design/preview.html（${(html.length / 1024).toFixed(1)} KB）`)
