/**
 * 站点外壳：顶部导航 + 内容出口 + 页脚。
 * 访客看到「登录 / 注册」；登录后显示用户名与资产库入口；管理员额外看到「管理」与「写博客」。
 */
import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from './components/ThemeToggle'
import { SITE } from './lib/github'
import { useAuth, usePat } from './hooks/useAuth'

const NAV = [
  { to: '/', label: '首页', end: true },
  { to: '/projects', label: '项目经历', end: false },
]

export default function App() {
  const { isLoggedIn, isAdmin, username, configured, ready, profile } = useAuth()
  const { hasPat } = usePat()

  const canWrite = hasPat && (!configured || isAdmin)

  return (
    <div className="flex min-h-screen flex-col bg-caramel-50 text-caramel-900 dark:bg-caramel-900 dark:text-caramel-100">
      <header className="no-print sticky top-0 z-40 border-b border-caramel-200 bg-caramel-50/90 backdrop-blur dark:border-caramel-700 dark:bg-caramel-900/90">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2 font-bold">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-xl bg-caramel-500 text-caramel-50"
            >
              布
            </span>
            <span className="text-caramel-800 dark:text-caramel-100">{SITE.title}</span>
          </NavLink>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-caramel-200 font-medium text-caramel-800 dark:bg-caramel-700 dark:text-caramel-100'
                      : 'text-caramel-700 hover:bg-caramel-100 dark:text-caramel-200 dark:hover:bg-caramel-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isLoggedIn && (
              <NavLink
                to="/assets"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-caramel-200 font-medium text-caramel-800 dark:bg-caramel-700 dark:text-caramel-100'
                      : 'text-caramel-700 hover:bg-caramel-100 dark:text-caramel-200 dark:hover:bg-caramel-800'
                  }`
                }
              >
                资产库
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-caramel-200 font-medium text-caramel-800 dark:bg-caramel-700 dark:text-caramel-100'
                      : 'text-caramel-700 hover:bg-caramel-100 dark:text-caramel-200 dark:hover:bg-caramel-800'
                  }`
                }
              >
                管理
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {canWrite && (
              <NavLink
                to="/write"
                className="hidden rounded-full bg-caramel-500 px-3 py-1.5 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 sm:inline-block"
              >
                写博客
              </NavLink>
            )}
            <ThemeToggle />

            {ready && isLoggedIn ? (
              <NavLink
                to="/me"
                title={`${username}${profile?.role === 'admin' ? '（管理员）' : ''}`}
                className="flex h-9 items-center gap-2 rounded-full border border-caramel-200 bg-caramel-100 px-3 text-xs font-medium text-caramel-700 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-200"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-caramel-500 text-[10px] text-caramel-50">
                  {username.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[6rem] truncate">{username}</span>
                {profile?.role === 'admin' && <span className="hidden sm:inline">·管理员</span>}
              </NavLink>
            ) : (
              ready && (
                <span className="flex items-center gap-2 text-sm">
                  <NavLink
                    to="/login"
                    className="rounded-full px-3 py-1.5 text-caramel-700 transition hover:bg-caramel-100 dark:text-caramel-200 dark:hover:bg-caramel-800"
                  >
                    登录
                  </NavLink>
                  <NavLink
                    to="/register"
                    className="rounded-full bg-caramel-500 px-3 py-1.5 font-medium text-caramel-50 transition hover:bg-caramel-600"
                  >
                    注册
                  </NavLink>
                </span>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="no-print mt-10 border-t border-caramel-200 bg-caramel-100 dark:border-caramel-700 dark:bg-caramel-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-caramel-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-caramel-300">
          <p>
            © {new Date().getFullYear()} {SITE.title} · 文章由 GitHub Issues 驱动 · 评论与账号由 Supabase 提供
          </p>
          <p className="flex flex-wrap items-center gap-3">
            <a
              href={`https://github.com/${SITE.user}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-caramel-700 dark:hover:text-caramel-100"
            >
              GitHub
            </a>
            <span aria-hidden="true">·</span>
            <NavLink to="/register" className="hover:text-caramel-700 dark:hover:text-caramel-100">
              注册账号
            </NavLink>
          </p>
        </div>
      </footer>
    </div>
  )
}
