/**
 * 把 public/logo.svg 渲染成位图 logo（默认 public/logo.png，512×512）。
 *
 * 为什么不用 sharp/canvas：本项目约定不装额外依赖。这里复用 DSH 那份 Playwright +
 * 系统 Edge（和 tools/verify.mjs 同一套查找逻辑），拿浏览器当 SVG 光栅化器，
 * 圆角之外的区域保持透明。
 *
 *   node tools/make-logo.mjs                  # → public/logo.png  512×512
 *   node tools/make-logo.mjs --size 1024      # 换尺寸（GitHub 头像、社交预览图）
 *   node tools/make-logo.mjs --out logo-180.png --size 180
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* 和 tools/verify.mjs 一致：优先用 DSH profile 里那份 Playwright，可用 PLAYWRIGHT_PKG 覆盖 */
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
  console.error('[logo] 找不到 playwright。请先安装，或设 PLAYWRIGHT_PKG 指向它。')
  process.exit(1)
}

/* 参数解析：--size / --out / --svg 都可省略 */
const argv = process.argv.slice(2)
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const size = Number(arg('size', '512'))
if (!Number.isInteger(size) || size < 16 || size > 4096) {
  console.error(`[logo] --size 只能是 16–4096 之间的整数，收到 ${arg('size', '512')}`)
  process.exit(1)
}
const svgPath = resolve(root, arg('svg', 'public/logo.svg'))
const outPath = resolve(root, arg('out', 'public/logo.png'))

const svg = readFileSync(svgPath, 'utf8')
const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}
svg{display:block;width:${size}px;height:${size}px}</style>${svg}`

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(html, { waitUntil: 'load' })
  const el = await page.$('svg')
  // omitBackground：背景整体保持透明，PNG 贴到浅色/深色背景上都不出色块
  await el.screenshot({ path: outPath, omitBackground: true })
} finally {
  await browser.close()
}

/* 自己读 PNG 头报一下真实尺寸，省得"生成了但尺寸不对"没人发现 */
const buf = readFileSync(outPath)
const width = buf.readUInt32BE(16)
const height = buf.readUInt32BE(20)
console.log(`[logo] ${svgPath} → ${outPath}  ${width}×${height}  ${(statSync(outPath).size / 1024).toFixed(1)} KB`)
if (width !== size || height !== size) {
  console.error(`[logo] 尺寸不对：期望 ${size}×${size}，实际 ${width}×${height}`)
  process.exit(1)
}
