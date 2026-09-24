import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DesktopShell } from './components/desktop/DesktopShell'
import { AppPlaceholder } from './components/program/AppPlaceholder'
import { SettingsWindow } from './components/program/SettingsWindow'
import { APPS } from './lib/apps'

/** 桌面是布局路由，每个窗口一条真实路由：可刷新、可分享、可直接深链。
    窗口内容统一放 src/components/program/，未实现的先用 AppPlaceholder。 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <DesktopShell />,
    children: [
      { index: true, element: null },
      ...APPS.map((app) => ({
        path: app.path.slice(1),
        element:
          app.id === 'settings' ? <SettingsWindow /> : <AppPlaceholder id={app.id} />,
      })),
      { path: 'blog/:id', element: <AppPlaceholder id="blog" route="/blog/:id" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
