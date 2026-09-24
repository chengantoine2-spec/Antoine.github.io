import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      /* 大体积静态资源在复制/写入期间会被锁住，watcher 撞上 EBUSY 会直接崩掉 dev server */
      ignored: ['**/*.mp4', '**/*.webm'],
    },
  },
})
