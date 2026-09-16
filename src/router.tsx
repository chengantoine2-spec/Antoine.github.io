/**
 * 路由表：/ 首页、/blog/:id 详情、/projects 列表、/projects/:id 详情、
 * /me 个人中心（P1 占位 + PAT 登录）、/write 写博客（仅站长）。
 */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'

/** 除首页外按需加载：Markdown 渲染器（react-markdown + highlight）只在需要时进包 */
const Blog = lazy(() => import('./pages/Blog'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Me = lazy(() => import('./pages/Me'))
const Write = lazy(() => import('./pages/Write'))

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-16 sm:px-6" aria-busy="true">
      <div className="h-6 w-1/4 animate-pulse rounded bg-caramel-200 dark:bg-caramel-700" />
      <div className="h-10 w-3/4 animate-pulse rounded bg-caramel-200 dark:bg-caramel-700" />
      <div className="h-40 animate-pulse rounded-2xl bg-caramel-200 dark:bg-caramel-700" />
    </div>
  )
}

const withSuspense = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

/** GitHub Pages 项目站的 base（如 /caramel-blog/），由 vite 注入 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <Home /> },
        { path: 'blog/:id', element: withSuspense(<Blog />) },
        { path: 'projects', element: withSuspense(<Projects />) },
        { path: 'projects/:id', element: withSuspense(<ProjectDetail />) },
        { path: 'me', element: withSuspense(<Me />) },
        { path: 'write', element: withSuspense(<Write />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)

export default router
