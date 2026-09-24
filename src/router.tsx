import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DesktopShell } from './components/desktop/DesktopShell'
import { AboutWindow } from './components/program/AboutWindow'
import { AppPlaceholder } from './components/program/AppPlaceholder'
import { SettingsWindow } from './components/program/SettingsWindow'
import { APPS } from './lib/apps'
import type { AppId } from './types/desktop'

/** 已实现的窗口；没登记的仍走 AppPlaceholder */
const WINDOWS: Partial<Record<AppId, ReactElement>> = {
  about: <AboutWindow />,
  settings: <SettingsWindow />,
}

/** GitHub Pages 项目站的 base（如 /my-repo/）由 vite 注入；本地是 '/' */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/** 桌面是布局路由，每个窗口一条真实路由：可刷新、可分享、可直接深链。
    窗口内容统一放 src/components/program/。 */
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <DesktopShell />,
      children: [
        { index: true, element: null },
        ...APPS.map((app) => ({
          path: app.path.slice(1),
          element: WINDOWS[app.id] ?? <AppPlaceholder id={app.id} />,
        })),
        { path: 'blog/:id', element: <AppPlaceholder id="blog" route="/blog/:id" /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
