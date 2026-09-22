/**
 * 路由表：文章（GitHub Issues 驱动）、项目经历、账号（注册/登录）、
 * 资产库（物品台账）、管理后台、写博客（管理员 + PAT）。
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
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Assets = lazy(() => import('./pages/Assets'))
const Admin = lazy(() => import('./pages/Admin'))

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

/** GitHub Pages 项目站的 base（如 /Antoine.github.io/），由 vite 注入 */
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
        { path: 'login', element: withSuspense(<Login />) },
        { path: 'register', element: withSuspense(<Register />) },
        { path: 'assets', element: withSuspense(<Assets />) },
        { path: 'admin', element: withSuspense(<Admin />) },
        { path: 'write', element: withSuspense(<Write />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename },
)

export default router
