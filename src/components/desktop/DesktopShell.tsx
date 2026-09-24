import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { matchApp } from '../../lib/apps'
import { useSkin } from '../../hooks/useSkin'
import { useWindows } from '../../hooks/useWindows'
import { Dock } from './Dock'
import { TopBar } from './TopBar'
import { Window } from './Window'

/** 桌面外壳：所有窗口路由的父布局，路由 ↔ 窗口状态在这里对齐 */
export function DesktopShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { skin } = useSkin()
  const { windows, dispatch } = useWindows()

  const layerRef = useRef<HTMLDivElement | null>(null)
  const app = matchApp(pathname)

  useEffect(() => {
    if (!app) {
      dispatch({ type: 'closeAll' })
      return
    }
    /* 以窗口层为准居中：顶栏/任务栏占掉的高度不算，窗口不会压到任务栏下面 */
    const rect = layerRef.current?.getBoundingClientRect()
    dispatch({
      type: 'open',
      id: app.id,
      bounds: {
        w: rect?.width ?? window.innerWidth,
        h: rect?.height ?? window.innerHeight,
      },
    })
  }, [app, dispatch])

  const win = app ? windows.find((w) => w.id === app.id) : undefined

  return (
    <div className="relative h-full w-full overflow-hidden bg-chrome">
      <div className="desktop__wall" aria-hidden="true" />

      <div className="desktop__layer" ref={layerRef}>
        {win && !win.minimized ? (
          <Window win={win} onClose={() => navigate('/')}>
            <Outlet />
          </Window>
        ) : null}
      </div>

      {skin === 'ubuntu' ? <TopBar /> : null}
      <Dock />
    </div>
  )
}
