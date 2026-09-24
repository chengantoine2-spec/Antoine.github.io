import { Link, useLocation } from 'react-router-dom'
import { APPS, matchApp } from '../../lib/apps'

/** Ubuntu 皮肤专用：顶部状态栏 */
export function TopBar() {
  const { pathname } = useLocation()
  const current = matchApp(pathname)

  return (
    <header className="absolute inset-x-0 top-0 z-50 flex h-[34px] items-center justify-between border-b border-edge bg-chrome px-3 text-xs text-chrome-ink">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-semibold tracking-wide">
          桌面
        </Link>
        <nav className="flex items-center gap-3">
          {APPS.slice(0, 5).map((app) => (
            <Link key={app.id} to={app.path} className="opacity-80 hover:opacity-100">
              {app.name}
            </Link>
          ))}
        </nav>
      </div>
      <span className="opacity-70">{current ? current.name : '桌面'}</span>
    </header>
  )
}
