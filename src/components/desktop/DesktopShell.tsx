import { useEffect, useRef, type CSSProperties } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { matchApp } from '../../lib/apps'
import { dockInsets } from '../../lib/dock'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
/* 桌面壁纸走 import：部署到子路径时不会失效，也和其它资源一起被指纹化 */
import desktopWallpaper from '../../assets/wallpapers/desktop.jpg'
import { Dock } from './Dock'
import { Window } from './Window'

/** 桌面外壳：所有窗口路由的父布局，路由 ↔ 窗口状态在这里对齐 */
export function DesktopShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { wallpaper, wallpaperFit, wallpaperDim } = useAppearance()
  const { position, thickness } = useDock()
  const { windows, dispatch } = useWindows()

  /* 四边让位随任务栏位置与实际厚度变化，用行内变量写进窗口层 */
  const insets = dockInsets(position, thickness ?? undefined)
  const insetVars = {
    '--inset-top': `${insets.top}px`,
    '--inset-right': `${insets.right}px`,
    '--inset-bottom': `${insets.bottom}px`,
    '--inset-left': `${insets.left}px`,
  } as CSSProperties

  const layerRef = useRef<HTMLDivElement | null>(null)
  const app = matchApp(pathname)

  useEffect(() => {
    if (!app) {
      dispatch({ type: 'closeAll' })
      return
    }
    /* 以窗口层为准居中：任务栏占掉的高度不算，窗口不会压到任务栏下面 */
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
    <div className="relative h-full w-full overflow-hidden bg-chrome" style={insetVars}>
      {/* 背景层：渐变 / 纯 CSS 纹理；选了图片时才多一层图片，再叠可选暗化 */}
      <div
        className={`desktop__wall desktop__wall--${wallpaper === 'image' ? 'gradient' : wallpaper}`}
        aria-hidden="true"
      />

      {wallpaper === 'image' ? (
        <div
          className={`desktop__media desktop__media--${wallpaperFit}`}
          style={{ backgroundImage: `url("${desktopWallpaper}")` }}
          aria-hidden="true"
        />
      ) : null}

      {wallpaperDim > 0 ? (
        <div
          className="desktop__dim"
          style={{ backgroundColor: `rgba(0, 0, 0, ${wallpaperDim})` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="desktop__layer" ref={layerRef}>
        {win && !win.minimized ? (
          <Window win={win} onClose={() => navigate('/')}>
            <Outlet />
          </Window>
        ) : null}
      </div>

      <Dock />
    </div>
  )
}
