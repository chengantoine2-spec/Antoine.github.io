/**
 * GitHub Pages 的 SPA 兜底：把 index.html 复制成 404.html。
 * 项目站深链（如 /repo/settings）命中 404 时会返回这份同样的壳，
 * 应用再用 router 的 basename 把路径还原成 /settings。
 */
import { copyFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const index = join(dist, 'index.html')
const notFound = join(dist, '404.html')

try {
  await access(index)
} catch {
  console.error('[pages] 找不到 dist/index.html，请先执行构建')
  process.exit(1)
}

await copyFile(index, notFound)
console.log('[pages] 已生成 dist/404.html')
