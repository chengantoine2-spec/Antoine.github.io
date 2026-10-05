import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DesktopShell } from './components/desktop/DesktopShell'
import { AboutWindow } from './components/program/AboutWindow'
import { AppPlaceholder } from './components/program/AppPlaceholder'
import { BlogDetailWindow } from './components/program/BlogDetailWindow'
import { BlogWindow } from './components/program/BlogWindow'
import { DstWikiWindow } from './components/program/DstWikiWindow'
import { DshWindow } from './components/program/DshWindow'
import { ProjectDetailWindow } from './components/program/ProjectDetailWindow'
import { ProjectsWindow } from './components/program/ProjectsWindow'
import { SettingsWindow } from './components/program/SettingsWindow'
import { TerminalWindow } from './components/program/TerminalWindow'
import { WriteWindow } from './components/program/WriteWindow'
import { visibleApps } from './lib/apps'
import type { AppId } from './types/desktop'

/** 已实现的窗口；没登记的仍走 AppPlaceholder */
const WINDOWS: Partial<Record<AppId, ReactElement>> = {
  about: <AboutWindow />,
  blog: <BlogWindow />,
  dsh: <DshWindow />,
  projects: <ProjectsWindow />,
  settings: <SettingsWindow />,
  terminal: <TerminalWindow />,
  wiki: <DstWikiWindow />,
  write: <WriteWindow />,
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
        /* 本机专属的窗口（DSH）在线上连路由都不挂：/dsh 会落到下面的 * 兜底回桌面 */
        ...visibleApps().map((app) => ({
          path: app.path.slice(1),
          element: WINDOWS[app.id] ?? <AppPlaceholder id={app.id} />,
        })),
        { path: 'projects/:id', element: <ProjectDetailWindow /> },
        { path: 'blog/:id', element: <BlogDetailWindow /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)
