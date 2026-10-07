import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AppearanceProvider } from './hooks/useAppearance'
import { DockProvider } from './hooks/useDock'
import { WindowsProvider } from './hooks/useWindows'
import './styles/tokens.css'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('缺少 #root 挂载点')

createRoot(container).render(
  <StrictMode>
    <AppearanceProvider>
      <DockProvider>
        <WindowsProvider>
          <RouterProvider router={router} />
        </WindowsProvider>
      </DockProvider>
    </AppearanceProvider>
  </StrictMode>,
)

/* PWA：**只在生产构建里**注册 Service Worker。
   ⚠️ dev 里绝不能注册（`import.meta.env.PROD` 就是这道闸）：本项目反复踩过
   "dev server 服旧模块/旧代码"的坑，SW 一旦在 dev 里装上，会把旧资源钉死、越查越乱。
   路径用 `BASE_URL` 拼 —— 线上部署在子路径 `/Antoine.github.io/` 下，写死 `/sw.js` 会 404。
   注册失败（不支持 / 非 HTTPS / 被策略拦）**不影响站点使用**，所以这里吞掉错误。 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* 忽略：SW 只是"能离线打开首页"的锦上添花 */
    })
  })
}
