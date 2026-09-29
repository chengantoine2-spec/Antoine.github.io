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
import { CelestialClock } from './CelestialClock'
import { Window } from './Window'

/** 桌面外壳：所有窗口路由的父布局，路由 ↔ 窗口状态在这里对齐 */
export function DesktopShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { wallpaper, wallpaperFit, wallpaperDim } = useAppearance()
  /* effectiveThickness = 厚度与「按固定图标尺寸算出的下限」取大者。
     必须和任务栏渲染用同一个值，否则任务栏被图标撑高后窗口层还按旧厚度让位，窗口会被压住一截 */
  const { position, effectiveThickness } = useDock()
  const { windows, dispatch, geometryOf } = useWindows()

  /* 四边让位随任务栏位置与实际厚度变化，用行内变量写进窗口层 */
  const insets = dockInsets(position, effectiveThickness)
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
    const bounds = {
      w: rect?.width ?? window.innerWidth,
      h: rect?.height ?? window.innerHeight,
    }
    dispatch({
      type: 'open',
      id: app.id,
      bounds,
      /* app 自己的默认尺寸 + 上次记住的几何（有就恢复原处） */
      size: app.defaultSize,
      geometry: geometryOf(app.id),
    })
  }, [app, dispatch, geometryOf])

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

      {/* 桌面挂件：日月时钟（随时刻变色，入夜换月相）。放在窗口层之前，
          所以窗口始终压在它上面；最大化时它会整个被盖住，和真桌面挂件一样 */}
      <CelestialClock />

      {/* 有窗口最大化时给窗口层提级：任务栏是 z-50，不压过它就还是会盖在窗口上面 */}
      <div
        className={`desktop__layer${
          win && !win.minimized && win.maximized ? ' desktop__layer--over' : ''
        }`}
        ref={layerRef}
      >
        {win && !win.minimized ? (
          <Window key={win.id} win={win} onClose={() => navigate('/')}>
            <Outlet />
          </Window>
        ) : null}
      </div>

      <Dock />
    </div>
  )
}
