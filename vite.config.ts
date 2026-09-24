import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* GitHub Pages 项目站要挂在子路径下：构建时用 VITE_BASE=/<repo>/ 注入；本地默认根路径。
   路由的 basename 取自 import.meta.env.BASE_URL，所以两边自动一致。 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      /* 大体积静态资源在复制/写入期间会被锁住，watcher 撞上 EBUSY 会直接崩掉 dev server */
      ignored: ['**/*.mp4', '**/*.webm'],
    },
  },
})
