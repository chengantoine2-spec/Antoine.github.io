import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getApp, matchWindowRoute, pathOf, visibleApps } from '../../lib/apps'
import { dockInsets } from '../../lib/dock'
import { tabInsets } from '../../lib/tabs'
import { loadOpenWindows, saveOpenWindows } from '../../lib/windowStore'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useTabs } from '../../hooks/useTabs'
import { useWindows } from '../../hooks/useWindows'
import type { AppId, WindowState } from '../../types/desktop'
/* 桌面壁纸走 import：部署到子路径时不会失效，也和其它资源一起被指纹化 */
import desktopWallpaper from '../../assets/wallpapers/desktop.jpg'
import { WindowView } from '../program/views'
import { Dock } from './Dock'
import { CelestialClock } from './CelestialClock'
import { Window } from './Window'
import { WindowTabs } from './WindowTabs'

/** 窗口层尺寸：让位之后留给窗口的那块地方（任务栏与标签栏都不算） */
function layerBounds(el: HTMLElement | null): { w: number; h: number } {
  const rect = el?.getBoundingClientRect()
  return { w: rect?.width ?? window.innerWidth, h: rect?.height ?? window.innerHeight }
}

/**
 * 桌面外壳：所有窗口都挂在这里，路由 ↔ 窗口状态在这里对齐。
 *
 * **能同时开多个窗口**（用户 2026-10-05：可叠加、像浏览器一样有标签栏）：
 * - 窗口列表是唯一事实来源（`useWindows` 的 reducer 里本来就是 `windows[]` + z 序）
 * - 路由只表示**当前聚焦的那个窗口**：`/blog` 打开/聚焦博客窗口，`/blog/17` 还会把它的
 *   子页面切到第 17 篇。深链、刷新、前进后退照旧可用
 * - 窗口内容由 `components/program/views.tsx` 按 id 渲染 —— 不再靠 `<Outlet />`，
 *   因为一个 Outlet 渲染不了好几个窗口
 * - 关掉当前聚焦的窗口 → 焦点交给剩下最上面那个；一个都不剩就回桌面（`/`）
 */
export function DesktopShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { wallpaper, wallpaperFit, wallpaperDim } = useAppearance()
  /* effectiveThickness = 厚度与「按固定图标尺寸算出的下限」取大者。
     必须和任务栏渲染用同一个值，否则任务栏被图标撑高后窗口层还按旧厚度让位，窗口会被压住一截 */
  const { position, effectiveThickness } = useDock()
  const { position: tabPosition } = useTabs()
  const { windows, dispatch, geometryOf } = useWindows()

  const layerRef = useRef<HTMLDivElement | null>(null)
  const [titles, setTitles] = useState<Partial<Record<AppId, string>>>({})

  const insets = dockInsets(position, effectiveThickness)
  const tabs = tabInsets(tabPosition)
  /* 四边让位随任务栏 / 标签栏的位置与实际厚度变化，用行内变量写进窗口层 */
  const insetVars = {
    '--inset-top': `${insets.top}px`,
    '--inset-right': `${insets.right}px`,
    '--inset-bottom': `${insets.bottom}px`,
    '--inset-left': `${insets.left}px`,
    '--tabs-top': `${tabs.top}px`,
    '--tabs-left': `${tabs.left}px`,
  } as CSSProperties

  const route = matchWindowRoute(location.pathname)
  const routeId = route?.app.id
  const routeParam = route?.param

  /* 刷新后把上次开着的窗口开回来（像浏览器恢复标签页）。只做一次 */
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = loadOpenWindows()
    if (saved.length === 0) return
    const bounds = layerBounds(layerRef.current)
    for (const item of saved) {
      const app = visibleApps().find((a) => a.id === item.id)
      if (!app) continue
      dispatch({
        type: 'open',
        id: app.id,
        bounds,
        size: app.defaultSize,
        geometry: geometryOf(app.id),
        param: item.param,
      })
    }
  }, [dispatch, geometryOf])

  /* 路由 → 打开 / 聚焦那个窗口。依赖 location.key 而不是 pathname：
     点任务栏图标回到"已经是当前地址"的窗口时也要生效（比如它正被最小化着）。 */
  useEffect(() => {
    if (!routeId) return
    const app = getApp(routeId)
    dispatch({
      type: 'open',
      id: app.id,
      bounds: layerBounds(layerRef.current),
      size: app.defaultSize,
      geometry: geometryOf(app.id),
      param: routeParam,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, routeId, routeParam, dispatch, geometryOf])

  /* 会话记忆：刷新前开着哪些窗口（顺序 = 标签栏顺序） */
  useEffect(() => {
    if (!restored.current) return
    saveOpenWindows(windows.map((w) => (w.param ? { id: w.id, param: w.param } : { id: w.id })))
  }, [windows])

  const closeWindow = useCallback(
    (id: AppId) => {
      dispatch({ type: 'close', id })
      if (id !== routeId) return
      /* 关掉的是当前聚焦的窗口：焦点交给剩下最上面那个 */
      const rest = windows.filter((w) => w.id !== id && !w.minimized).sort((a, b) => a.z - b.z)
      const next: WindowState | undefined = rest[rest.length - 1]
      navigate(next ? pathOf(next.id, next.param) : '/')
    },
    [dispatch, navigate, routeId, windows],
  )

  const reportTitle = useCallback((id: AppId, title: string | null) => {
    setTitles((prev) => {
      const current = prev[id]
      const next = title ?? undefined
      if (current === next) return prev
      if (next === undefined) {
        if (!(id in prev)) return prev
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: next }
    })
  }, [])

  /* 按 z 从小到大渲染：后画的在上面，和 reducer 里的 z 序一致 */
  const ordered = useMemo(() => [...windows].sort((a, b) => a.z - b.z), [windows])
  const anyMaximized = windows.some((w) => w.maximized && !w.minimized)

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

      {/* 标签栏：z 比最大化的窗口层（60）还高 —— 否则窗口一最大化就再也切不了窗口了 */}
      <WindowTabs
        windows={ordered}
        activeId={routeId}
        position={tabPosition}
        titles={titles}
        onSelect={(id) => {
          const win = windows.find((w) => w.id === id)
          if (win) navigate(pathOf(win.id, win.param))
        }}
        onClose={closeWindow}
      />

      {/* 有窗口最大化时给窗口层提级：任务栏是 z-50，不压过它就还是会盖在窗口上面 */}
      <div className={`desktop__layer${anyMaximized ? ' desktop__layer--over' : ''}`} ref={layerRef}>
        {ordered.map((win) => (
          /* 最小化 = display:none，**不卸载**：窗口里的滚动位置、加载好的数据都留着 */
          <div key={win.id} className={win.minimized ? 'hidden' : ''} data-window-slot={win.id}>
            <Window
              win={win}
              onClose={() => closeWindow(win.id)}
              onActivate={() => navigate(pathOf(win.id, win.param))}
              onTitle={(title) => reportTitle(win.id, title)}
            >
              <WindowView id={win.id} param={win.param} />
            </Window>
          </div>
        ))}
      </div>

      {/* 路由出口：窗口内容已经不从这儿渲染了，但留着 Outlet 让 /blog/:id 这类子路由
          继续"匹配得到" —— 否则深链会直接掉进 404 兜底 */}
      <div className="hidden" aria-hidden="true">
        <Outlet />
      </div>

      <Dock />
    </div>
  )
}
