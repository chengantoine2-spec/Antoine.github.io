/**
 * 生成 `design/icons-macos/preview.html`（macOS 版图标对照页，**不参与 Vite 构建**）。
 *
 *   node design/build-icons-macos.mjs
 *
 * 三栏对照：**现在这版**（live 组件，线宽 1.6）/ **草稿 A**（design/icons-macos/*.svg，线宽 2）
 * / **样本 C**（实心，只有 about 与 blog 两张）。
 *
 * 尺寸档取任务书第 4.1 节：12 / 14 / 16 / 20 / 32 / 48 / 64（12、14、20 是重点）；
 * 主题值直接抄 tokens.css；「毛玻璃底」用真的 backdrop-filter 压一层壁纸渐变再叠 Dock 底板色，
 * 因为真实 Dock 上壁纸是会透过来的。
 *
 * 只有这一页允许写死颜色（它不参与构建）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const draftDir = join(root, 'design/icons-macos')
const compDir = join(root, 'src/components/icons')

/** 这一轮先看这四张：三个应用图标 + 一个外壳字形 */
const ICONS = [
  { key: 'about', name: '关于', file: 'AboutIcon.tsx' },
  { key: 'blog', name: '博客', file: 'BlogIcon.tsx' },
  { key: 'terminal', name: '终端', file: 'TerminalIcon.tsx' },
  { key: 'menu', name: '所有项目（字形）', menu: true },
]

const SIZES = [12, 14, 16, 20, 32, 48, 64]

const THEMES = [
  {
    key: 'light',
    label: 'light · macOS 浅色',
    surface: 'hsl(240, 24%, 100%)',
    surface2: 'hsl(240, 20%, 96%)',
    text: 'hsl(240, 6%, 12%)',
    dim: 'hsl(240, 4%, 44%)',
    accent: 'hsl(211, 100%, 50%)',
    dockBg: 'rgba(255, 255, 255, 0.2)',
    dockBorder: 'rgba(160, 160, 170, 0.4)',
    dockShadow: '0 0 20px rgba(0, 0, 0, 0.17)',
    wallpaper: 'linear-gradient(160deg, #e9eff8 0%, #cfdbee 34%, #a9bddd 66%, #7d95bf 100%)',
    ink: 'hsl(240, 6%, 12%)',
  },
  {
    key: 'dark',
    label: 'dark · macOS 深色',
    surface: 'hsl(240, 3%, 11%)',
    surface2: 'hsl(240, 4%, 15%)',
    text: 'hsl(240, 10%, 92%)',
    dim: 'hsl(240, 5%, 62%)',
    accent: '#0a85ff',
    dockBg: 'rgba(28, 28, 30, 0.35)',
    dockBorder: 'rgba(160, 160, 170, 0.3)',
    dockShadow: '0 0 20px rgba(0, 0, 0, 0.35)',
    wallpaper: 'linear-gradient(160deg, #2b3245 0%, #1c2130 46%, #0d0f16 100%)',
    ink: 'hsl(240, 10%, 92%)',
  },
]

function innerOfSvg(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!m) throw new Error('抽不出图形：' + file)
  return m[1].replace(/<!--[\s\S]*?-->/g, '').trim()
}

function innerOfTsx(file) {
  const src = readFileSync(join(compDir, file), 'utf8')
  const i = src.indexOf('<svg')
  const j = src.lastIndexOf('</svg>')
  return src.slice(src.indexOf('>', i) + 1, j).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim()
}

/* 「现在这版」的所有项目九宫格是 .map() 生成的，这里照抄那组数（24 网格、r=1.7、7/12/17） */
const menuDots = []
for (const y of [7, 12, 17]) for (const x of [7, 12, 17]) menuDots.push(`<circle cx="${x}" cy="${y}" r="1.7" />`)

const SHAPES = []
for (const icon of ICONS) {
  const cur = icon.menu ? menuDots.join('') : innerOfTsx(icon.file)
  const draftPath = join(draftDir, icon.key + '.svg')
  const solidPath = join(draftDir, 'solid-' + icon.key + '.svg')
  SHAPES.push({
    key: icon.key,
    name: icon.name,
    current: { paint: icon.menu ? 'fill' : 'stroke1.6', inner: cur },
    draft: { paint: 'stroke2', inner: innerOfSvg(draftPath) },
    solid: existsSync(solidPath) ? { paint: 'fill', inner: innerOfSvg(solidPath) } : null,
  })
}

const symbols = []
for (const s of SHAPES) {
  symbols.push(`    <symbol id="cur-${s.key}" viewBox="0 0 24 24">${s.current.inner}</symbol>`)
  symbols.push(`    <symbol id="new-${s.key}" viewBox="0 0 24 24">${s.draft.inner}</symbol>`)
  if (s.solid) symbols.push(`    <symbol id="sol-${s.key}" viewBox="0 0 24 24">${s.solid.inner}</symbol>`)
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>图标对照（macOS 版草稿） · 芹菜耕地</title>
<style>
  :root { --sans: ui-sans-serif, system-ui, "Microsoft YaHei", sans-serif; --mono: ui-monospace, Consolas, monospace; }
  body { margin: 0; padding: 26px 30px 70px; background: #f2f2f4; color: #1d1d20; font: 13px/1.65 var(--sans); }
  h1 { font-size: 19px; margin: 0 0 6px; }
  h2 { font-size: 13px; margin: 30px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #dcdce2; letter-spacing: .04em; }
  .note { color: #5c5c66; font-size: 12px; margin: 0 0 6px; }
  .note b { color: #1d1d20; }
  code { font: 11px/1 var(--mono); background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 4px; }
  table { border-collapse: separate; border-spacing: 0; }
  th, td { vertical-align: middle; }
  th { font-weight: 500; font-size: 11px; opacity: .72; padding: 0 0 6px; text-align: center; }
  td.lab { font: 11px/1.3 var(--mono); white-space: nowrap; padding: 0 12px 0 0; opacity: .8; text-align: right; }
  td.lab b { display: block; font: 600 11px/1.3 var(--sans); opacity: 1; }
  .cell { display: flex; align-items: center; justify-content: center; width: 76px; height: 40px; }
  .card { border-radius: 10px; padding: 14px 16px; margin: 10px 0 18px; border: 1px solid; }
  .rowlab { font-size: 11px; opacity: .7; margin: 0 0 8px; }
  .ver { font: 600 11px/1 var(--sans); }
  .glass { position: relative; border-radius: 12px; padding: 14px; overflow: hidden; border: 1px solid; }
  .glass > .wall { position: absolute; inset: 0; z-index: 0; }
  .glass > .plate { position: absolute; inset: 0; z-index: 1; }
  .glass > .inner { position: relative; z-index: 2; }
  .strip { display: flex; gap: 18px; align-items: flex-end; flex-wrap: wrap; }
  .raster { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
  .raster .one { text-align: center; }
  .raster canvas { display: block; image-rendering: pixelated; }
  .raster .cap { font: 10px/1.4 var(--mono); opacity: .7; margin-top: 5px; }
  .grid-cell { position: relative; width: 120px; height: 120px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,.12);
    background-image: linear-gradient(to right, rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.08) 1px, transparent 1px); background-size: 5px 5px; }
  .grid-cell .mid { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(255,0,0,.45); }
  .grid-cell .midv { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(255,0,0,.45); }
  .grid-cell .safe { position: absolute; left: 15px; top: 15px; right: 15px; bottom: 15px; border: 1px dashed rgba(0,120,255,.5); }
</style>
</head>
<body>
<h1>图标对照 · macOS 版草稿（方案 A）</h1>
<p class="note">这一页是**方向评审**用的：只看 <b>现在这版（线宽 1.6）</b> / <b>草稿 A（线宽 2 + 砍细节）</b> / <b>样本 C（实心）</b> 三者在各尺寸下的差距，不是最终交付。</p>
<p class="note">尺寸档 <code>12 / 14 / 16 / 20 / 32 / 48 / 64</code>；12（窗口标签）、14（菜单栏）、20（Dock 默认）是重点。主题值抄自 <code>tokens.css</code>；只有本页允许写死颜色。</p>
<p class="note">本页由 <code>node design/build-icons-macos.mjs</code> 生成：「现在」那一栏从 <code>src/components/icons/*.tsx</code> 抽，草稿从 <code>design/icons-macos/*.svg</code> 抽。</p>

<h2>一、尺寸阶梯 · 浅色（看的是：同一张图在 12px 还剩几笔）</h2>
<div id="light"></div>

<h2>二、尺寸阶梯 · 深色</h2>
<div id="dark"></div>

<h2>三、12px / 14px 实拍放大 ×6（最近邻）—— 糊不糊只有这一节能判</h2>
<div id="raster"></div>

<h2>四、三种底（含 Dock 毛玻璃：壁纸会透过来）</h2>
<p class="note">毛玻璃那一格是真的 <code>backdrop-filter: blur(40px)</code> + Dock 底板色压在壁纸渐变上 —— 和真实 Dock 一样。图标的对比度就在这一节判。</p>
<div id="glass"></div>

<h2>五、光学检查（草稿 A @120px：1px 网格 + 中线 + 3~21 安全框）</h2>
<div class="strip" id="optical"></div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${symbols.join('\n')}
</defs></svg>

<script>
(function () {
  var THEMES = ${JSON.stringify(THEMES)}
  var SHAPES = ${JSON.stringify(SHAPES.map((s) => ({ key: s.key, name: s.name, hasSolid: !!s.solid })))}
  var SIZES = ${JSON.stringify(SIZES)}

  /* 三套画法的着色规则；颜色只在这一页写死 */
  function paintOf(ver, ink) {
    if (ver === 'current') return 'fill="none" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
    if (ver === 'draft') return 'fill="none" stroke="' + ink + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    return 'fill="' + ink + '"'
  }
  var PREFIX = { current: 'cur', draft: 'new', solid: 'sol' }
  var LABEL = { current: '现在（1.6）', draft: '草稿 A（2.0）', solid: '样本 C（实心）' }

  function icon(ver, key, size, ink) {
    if (ver === 'solid' && !SHAPES.filter(function (s) { return s.key === key })[0].hasSolid) return ''
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' + paintOf(ver, ink) +
      '><use href="#' + PREFIX[ver] + '-' + key + '"/></svg>'
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (html !== undefined) e.innerHTML = html
    return e
  }

  /* 一 / 二：尺寸阶梯 */
  function ladder(t, hostId) {
    var host = document.getElementById(hostId)
    var card = el('div', 'card')
    card.style.background = t.surface
    card.style.borderColor = 'rgba(107,114,114,.25)'
    card.style.color = t.text
    var body = el('div')
    var table = el('table')
    var head = el('tr')
    head.appendChild(el('th', null, '画法 / 图标'))
    SIZES.forEach(function (s) { head.appendChild(el('th', null, s + 'px')) })
    table.appendChild(head)
    SHAPES.forEach(function (shape) {
      ;['current', 'draft', 'solid'].forEach(function (ver) {
        if (ver === 'solid' && !shape.hasSolid) return
        var tr = el('tr')
        tr.appendChild(el('td', 'lab', '<b>' + shape.name + '</b>' + LABEL[ver]))
        SIZES.forEach(function (size) {
          var td = el('td')
          var cell = el('div', 'cell')
          cell.innerHTML = icon(ver, shape.key, size, t.key === 'dark' ? t.text : t.text)
          td.appendChild(cell)
          tr.appendChild(td)
        })
        table.appendChild(tr)
      })
    })
    body.appendChild(table)
    card.appendChild(body)
    host.appendChild(card)
  }
  ladder(THEMES[0], 'light')
  ladder(THEMES[1], 'dark')

  /* 三：12 / 14px 实拍放大 */
  var rasterHost = document.getElementById('raster')
  function rasterBlock(t, sizes) {
    var wrap = el('div')
    wrap.appendChild(el('div', 'note', '<b>' + t.label + '</b>（底 = ' + t.surface + '，墨色 = ' + t.text + '）'))
    var row = el('div', 'raster')
    wrap.appendChild(row)
    SHAPES.forEach(function (shape) {
      ;['current', 'draft', 'solid'].forEach(function (ver) {
        if (ver === 'solid' && !shape.hasSolid) return
        sizes.forEach(function (size) {
          var one = el('div', 'one')
          var holder = el('div')
          one.appendChild(holder)
          one.appendChild(el('div', 'cap', shape.key + ' · ' + LABEL[ver].replace(/（.*/, '') + ' · ' + size + 'px'))
          row.appendChild(one)
          var sym = document.getElementById(PREFIX[ver] + '-' + shape.key)
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + paintOf(ver, t.ink) + '>' + sym.innerHTML + '</svg>'
          var img = new Image()
          var scale = 6
          img.onload = function () {
            var small = document.createElement('canvas')
            small.width = small.height = size
            small.getContext('2d').drawImage(img, 0, 0, size, size)
            var big = document.createElement('canvas')
            big.width = big.height = size * scale
            var g = big.getContext('2d')
            g.imageSmoothingEnabled = false
            g.drawImage(small, 0, 0, big.width, big.height)
            holder.style.cssText = 'width:' + big.width + 'px;height:' + big.height + 'px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:' + t.surface
            holder.appendChild(big)
          }
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        })
      })
    })
    rasterHost.appendChild(wrap)
  }
  rasterBlock(THEMES[0], [12, 14])
  rasterBlock(THEMES[1], [12, 14])

  /* 四：三种底 */
  var glassHost = document.getElementById('glass')
  THEMES.forEach(function (t) {
    var wrap = el('div')
    wrap.appendChild(el('div', 'note', '<b>' + t.label + '</b>'))
    var row = el('div', 'strip')
    ;[['卡片 surface', t.surface, null], ['次面 surface-2', t.surface2, null], ['Dock 毛玻璃（壁纸透出）', null, t]].forEach(function (bg) {
      var box
      if (bg[2] === null) {
        box = el('div', 'card')
        box.style.background = bg[1]
        box.style.borderColor = 'rgba(107,114,114,.25)'
      } else {
        box = el('div', 'glass')
        box.style.borderColor = t.dockBorder
        box.style.boxShadow = t.dockShadow
        box.style.background = t.dockBg
        var wall = el('div', 'wall')
        wall.style.background = t.wallpaper
        var plate = el('div', 'plate')
        plate.style.background = t.dockBg
        plate.style.backdropFilter = 'blur(40px)'
        plate.style.webkitBackdropFilter = 'blur(40px)'
        box.appendChild(wall)
        box.appendChild(plate)
      }
      var inner = el('div', bg[2] === null ? '' : 'inner')
      inner.appendChild(el('div', 'rowlab', bg[0]))
      var strip = el('div', 'strip')
      SHAPES.forEach(function (shape) {
        ;[20, 32, 48].forEach(function (size) {
          var one = el('div', 'one')
          one.style.textAlign = 'center'
          one.innerHTML = '<div style="color:' + t.text + '">' + icon('draft', shape.key, size, t.text) + '</div>' +
            '<div class="cap" style="font:10px/1.4 var(--mono);opacity:.7">' + shape.key + ' ' + size + '</div>'
          strip.appendChild(one)
        })
      })
      inner.appendChild(strip)
      box.appendChild(inner)
      row.appendChild(box)
    })
    wrap.appendChild(row)
    glassHost.appendChild(wrap)
  })

  /* 五：光学检查 */
  var opticalHost = document.getElementById('optical')
  SHAPES.forEach(function (shape) {
    var one = el('div', 'one')
    var cell = el('div', 'grid-cell')
    cell.appendChild(el('div', 'mid'))
    cell.appendChild(el('div', 'midv'))
    cell.appendChild(el('div', 'safe'))
    cell.style.color = '#1d1d20'
    cell.innerHTML += icon('draft', shape.key, 120, '#1d1d20')
    one.appendChild(cell)
    one.appendChild(el('div', 'cap', shape.key))
    opticalHost.appendChild(one)
  })
})()
</script>
</body>
</html>
`

writeFileSync(join(draftDir, 'preview.html'), html)
console.log(`[icons-macos] 已生成 design/icons-macos/preview.html（${(html.length / 1024).toFixed(1)} KB）`)
