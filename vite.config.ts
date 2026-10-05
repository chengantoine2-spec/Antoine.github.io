import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* GitHub Pages 项目站要挂在子路径下：构建时用 VITE_BASE=/<repo>/ 注入；本地默认根路径。
   路由的 basename 取自 import.meta.env.BASE_URL，所以两边自动一致。 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    /* 菜图（design/veggies/*.svg，48 张）**不要内联**：它们每个只有一两 KB，
       默认会被折成 data URI 塞进主包（实测首屏 gzip 101 → 111 KB）。
       它们是按需出现的（菜单 11 张、关于窗口 49 张），发成独立文件更划算。
       其余资源返回 undefined = 按 Vite 默认规则走。 */
    assetsInlineLimit: (filePath) => (/design[\\/]veggies[\\/]/.test(filePath) ? false : undefined),
  },
  server: {
    port: 5173,
    watch: {
      /* 大体积静态资源在复制/写入期间会被锁住，watcher 撞上 EBUSY 会直接崩掉 dev server */
      ignored: ['**/*.mp4', '**/*.webm'],
    },
  },
})
