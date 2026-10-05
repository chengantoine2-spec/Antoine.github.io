import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DesktopShell } from './components/desktop/DesktopShell'
import { visibleApps } from './lib/apps'

/** GitHub Pages 项目站的 base（如 /my-repo/）由 vite 注入；本地是 '/' */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/* 桌面是布局路由，每个窗口一条真实路由：可刷新、可分享、可直接深链。
 *
 * ⚠️ 桌面上能**同时开好几个窗口**，所以窗口内容不再从这里渲染（一个 <Outlet /> 装不下多窗口）——
 * 路由的作用变成「打开 / 聚焦哪个窗口」，窗口内容登记在 `components/program/views.tsx`。
 * 这些子路由因此都是空壳，它们的价值就是"让路径匹配得到"，别删。 */
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <DesktopShell />,
      children: [
        { index: true, element: null },
        /* 本机专属的窗口（DSH）在线上连路由都不挂：/dsh 会落到下面的 * 兜底回桌面 */
        ...visibleApps().map((app) => ({
          path: `${app.path.slice(1)}/*`,
          element: null,
        })),
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
