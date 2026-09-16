import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 只用到 process.env，避免为构建配置引入 @types/node
declare const process: { env: Record<string, string | undefined> }

// GitHub Pages 项目站需要把 base 设为 /<repo>/。
// 部署 workflow 会自动注入 VITE_BASE；本地开发保持 '/' 即可。
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
