import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* GitHub Pages 项目站要挂在子路径下：构建时用 VITE_BASE=/<repo>/ 注入；本地默认根路径。
   路由的 basename 取自 import.meta.env.BASE_URL，所以两边自动一致。 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    /* 菜图（design/veggies/*.svg）与彩色 App 图标（design/icons-app/*.svg）**都不要内联**：它们每个只有一两 KB，
       默认会被折成 data URI 塞进主包（实测首屏 gzip 101 → 111 KB）。
       它们是按需出现的（菜单 11 张、关于窗口 49 张），发成独立文件更划算。
       其余资源返回 undefined = 按 Vite 默认规则走。 */
    assetsInlineLimit: (filePath) =>
      (/design[\\/](veggies|icons-app)[\\/]/.test(filePath) ? false : undefined),
  },
  server: {
    port: 5173,
    watch: {
      /* ⚠️ 这几条是"dev server 一改文件就死"的真凶，别删：
         ① 大体积静态资源在复制/写入期间会被锁住；
         ② 更常见的是**原子写留下的临时目录** —— 保存文件时常常写成
            `<目录>/.<文件名>.<pid>.<guid>.tmpdir/<文件名>.tmp` 再替换，Vite 的 watcher
            会去 watch 那个临时文件；它一被锁住/删掉就抛
            `EBUSY: resource busy or locked, watch '…tmp'`，并**直接结束进程**（不是警告）。
            忽略之后再用工具改文件就不会把 dev server 带走了。 */
      ignored: ['**/*.mp4', '**/*.webm', '**/.*.tmpdir/**', '**/*.tmp'],
    },
  },
})
