/**
 * 生成 `design/veggies.html`（蔬菜水果设计稿预览页，**不参与 Vite 构建**）。
 *
 *   node design/build-veggies.mjs
 *
 * 来源就是 `design/veggies/*.svg` 本身 —— 页面上看到的形状与文件里的一模一样，
 * 不存在"手抄一份预览"的漂移。
 *
 * 画法约定（新加一件请照做）：`viewBox="0 0 64 64"`、平涂 + 同色系深色描边（stroke-width 2）、
 * 高光用白色低透明度。这样它在浅底和深底上都立得住，缩到 24px 也不糊。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'design/veggies')

/** 分组：站里那 11 样菜带上对应窗口，其余按类分 */
const GROUPS = [
  {
    title: '一、站里的 11 样菜',
    note: '每样菜对应一个窗口（菜名只出现在任务栏提示与「所有项目」里，图标本身不画菜 —— DSH 除外）',
    items: [
      ['potato', '土豆', '关于'],
      ['pumpkin', '南瓜', '项目'],
      ['corn', '玉米', '博客'],
      ['tomato', '番茄', '博客创作'],
      ['bamboo-shoot', '竹笋', '技能'],
      ['grape', '葡萄', '联系'],
      ['chili', '辣椒', '终端'],
      ['peanut', '花生', '资产库'],
      ['garlic', '大蒜', '设置'],
      ['onion', '洋葱', '饥荒 Wiki'],
      ['celery', '芹菜', 'DSH'],
    ],
  },
  {
    title: '二、水果',
    note: '后来加的，和 11 样菜同一套画法',
    items: [
      ['apple', '苹果'],
      ['banana', '香蕉'],
      ['orange', '橙子'],
      ['strawberry', '草莓'],
      ['watermelon', '西瓜'],
      ['pear', '梨'],
      ['lemon', '柠檬'],
      ['peach', '桃子'],
      ['cherry', '樱桃'],
    ],
  },
  {
    title: '三、别的常见菜',
    note: '想要更多（黄瓜 / 白菜 / 菠萝 / 蓝莓…）说一声，照同一套画法加',
    items: [
      ['carrot', '胡萝卜'],
      ['eggplant', '茄子'],
      ['mushroom', '蘑菇'],
      ['broccoli', '西兰花'],
    ],
  },
]

function innerOf(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!m) throw new Error('抽不出图形：' + file)
  return m[1].replace(/<!--[\s\S]*?-->/g, '').trim()
}

const symbols = []
let count = 0
for (const group of GROUPS) {
  for (const [id] of group.items) {
    const file = join(dir, id + '.svg')
    if (!existsSync(file)) throw new Error('缺设计稿：' + file)
    symbols.push(`    <symbol id="veg-${id}" viewBox="0 0 64 64">${innerOf(file)}</symbol>`)
    count += 1
  }
}

const data = GROUPS.map((g) => ({
  title: g.title,
  note: g.note,
  items: g.items.map(([id, name, app]) => ({ id, name, app: app || null })),
}))

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>蔬菜水果预览 · 芹菜耕地</title>
<style>
  :root { --sans: ui-sans-serif, system-ui, "Microsoft YaHei", sans-serif; --mono: ui-monospace, Consolas, monospace; }
  body { margin: 0; padding: 26px 30px 70px; background: #f2eee7; color: #2c2620; font: 13px/1.65 var(--sans); }
  h1 { font-size: 19px; margin: 0 0 6px; }
  h2 { font-size: 13px; margin: 30px 0 4px; padding-bottom: 6px; border-bottom: 1px solid #ddd5c8; letter-spacing: .04em; }
  .note { color: #6d6355; font-size: 12px; margin: 0 0 10px; }
  .note b { color: #2c2620; }
  code { font: 11px/1 var(--mono); background: rgba(120,100,75,.1); padding: 1px 4px; border-radius: 4px; }
  .row { display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: flex-end; }
  .item { text-align: center; width: 92px; }
  .item .lbl { font-size: 11px; color: #6d6355; margin-top: 6px; line-height: 1.35; }
  .item .lbl b { color: #2c2620; font-weight: 600; display: block; }
  .item .lbl i { font-style: normal; opacity: .72; }
  .tile { border-radius: 12px; padding: 14px 16px; margin: 10px 0; }
  .tiles3 { display: flex; gap: 12px; flex-wrap: wrap; }
  .tiles3 .tile { flex: 0 0 auto; }
  .tilelab { font-size: 11px; margin-bottom: 8px; }
  .smallrow { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .smallrow .cell { display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<h1>蔬菜水果预览 · 芹菜耕地</h1>
<p class="note">共 <b>${count}</b> 件，来源就是 <code>design/veggies/*.svg</code>（本页由 <code>node design/build-veggies.mjs</code> 抽出生成）。</p>
<p class="note">画法：<code>viewBox 0 0 64 64</code>、平涂 + 同色系深色描边、高光用白色低透明度 —— 浅底深底都立得住，缩到 24px 也不糊。</p>

<div id="main"></div>

<h2>四、缩到小尺寸还认得出吗</h2>
<p class="note">每样依次 48px / 32px / 24px（真实尺寸，没放大）</p>
<div id="sizes"></div>

<h2>五、三套主题的底色下（卡片浅底 / 次面 / 任务栏深底）</h2>
<p class="note">这些是彩色插画、不走 <code>currentColor</code>：放在深色任务栏上要自己够亮，这一节就是看这个。</p>
<div id="themes"></div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${symbols.join('\n')}
</defs></svg>

<script>
(function () {
  var DATA = ${JSON.stringify(data)}
  var THEMES = [
    { key: 'caramel', label: 'caramel · 焦糖', surface: '#fff8f0', surface2: '#f7e6d0', edge: '#efd3b0', text: '#3d2b1f', chrome: 'rgba(61,43,31,.82)' },
    { key: 'linen', label: 'linen · 亚麻', surface: '#fbf7ee', surface2: '#f1e8d8', edge: '#dccdb4', text: '#3a3226', chrome: 'rgba(74,63,50,.78)' },
    { key: 'night', label: 'night · 夜', surface: '#22252b', surface2: '#2a2e35', edge: '#3a3f48', text: '#e8e6e1', chrome: 'rgba(32,34,40,.86)' }
  ]

  function pic(id, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 64 64"><use href="#veg-' + id + '"/></svg>'
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (html !== undefined) e.innerHTML = html
    return e
  }

  var main = document.getElementById('main')
  DATA.forEach(function (group) {
    main.appendChild(el('h2', null, group.title))
    if (group.note) main.appendChild(el('p', 'note', group.note))
    var row = el('div', 'row')
    group.items.forEach(function (it) {
      var item = el('div', 'item')
      item.appendChild(el('div', null, pic(it.id, 84)))
      item.appendChild(el('div', 'lbl', '<b>' + it.name + '</b>' + (it.app ? '<i>' + it.app + '</i>' : '')))
      row.appendChild(item)
    })
    main.appendChild(row)
  })

  var sizes = document.getElementById('sizes')
  var groups = el('div')
  DATA.forEach(function (group) {
    var row = el('div', 'smallrow')
    row.style.margin = '10px 0'
    group.items.forEach(function (it) {
      ;[48, 32, 24].forEach(function (s) {
        var cell = el('div', 'cell', pic(it.id, s))
        cell.style.height = '48px'
        row.appendChild(cell)
      })
      row.appendChild(el('span', null, '<span style="font:10px/1 var(--mono);opacity:.5;margin:0 8px 0 2px">' + it.name + '</span>'))
    })
    sizes.appendChild(row)
  })

  var themes = document.getElementById('themes')
  THEMES.forEach(function (t) {
    var tiles = el('div', 'tiles3')
    ;[['卡片底 surface', t.surface], ['次面 surface-2', t.surface2], ['任务栏 chrome', t.chrome]].forEach(function (bg) {
      var tile = el('div', 'tile')
      tile.style.background = bg[1]
      tile.style.border = '1px solid ' + t.edge
      tile.appendChild(el('div', 'tilelab', '<b>' + t.label + '</b> · ' + bg[0]))
      var row = el('div', 'smallrow')
      DATA.forEach(function (group) {
        group.items.forEach(function (it) {
          var cell = el('div', 'cell', pic(it.id, 40))
          cell.style.width = '40px'
          row.appendChild(cell)
        })
      })
      tile.appendChild(row)
      tiles.appendChild(tile)
    })
    themes.appendChild(tiles)
  })
})()
</script>
</body>
</html>
`

writeFileSync(join(root, 'design/veggies.html'), html)
console.log(`[veggies] 已生成 design/veggies.html（${count} 件，${(html.length / 1024).toFixed(1)} KB）`)
