import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getApp, matchWindowRoute, pathOf } from '../../lib/apps'
import { dockInsets } from '../../lib/dock'
import { MENUBAR_H, workTop } from '../../lib/menubar'
import { snapRect } from '../../lib/snap'
import { loadSession, saveSession } from '../../lib/windowStore'
import { toSessionFrames } from '../../lib/windowManager'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import type { AppId, SnapZone } from '../../types/desktop'
/* 桌面壁纸走 import：部署到子路径时不会失效，也和其它资源一起被指纹化 */
import desktopWallpaper from '../../assets/wallpapers/desktop.jpg'
import { WindowTitleProvider } from '../../hooks/useWindowTitle'
import { WindowView } from '../program/views'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { Window } from './Window'

/** 窗口层尺寸：让位之后留给窗口的那块地方（任务栏不算） */
function layerBounds(el: HTMLElement | null): { w: number; h: number } {
  const rect = el?.getBoundingClientRect()
  return { w: rect?.width ?? window.innerWidth, h: rect?.height ?? window.innerHeight }
}

/**
 * 桌面外壳：所有窗口框都挂在这里，路由 ↔ 窗口状态在这里对齐。
 *
 * **一框多标签**（用户 2026-10-05 拍板）：
 * - `state.windows` 里的每一项是**一个框**（`key` + `tabs[]` + `active`），不是"一个应用"
 * - 拖标题栏盖到另一框上松手 = 合并；把标签拖出框外松手 = 拆帧（都在 Window / FrameTabs 里判手势）
 * - 框上 `data-window-slot` 与 `aria-label` 跟着**当前激活标签**走，所以老选择器继续能用
 * - 非活动标签的内容**照样挂着**（display:none），切回来时滚动位置、加载好的数据都在
 *
 * 路由只表示**当前聚焦框的活动标签**：`/blog` 打开并聚焦博客，`/blog/17` 再把它的子页面切到第 17 篇。
 */
export function DesktopShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { wallpaper, wallpaperFit, wallpaperDim } = useAppearance()
  /* effectiveThickness = 厚度与「按固定图标尺寸算出的下限」取大者。
     必须和任务栏渲染用同一个值，否则任务栏被图标撑高后窗口层还按旧厚度让位，窗口会被压住一截 */
  const { position, effectiveThickness } = useDock()
  const { windows, dispatch, geometryOf } = useWindows()

  const layerRef = useRef<HTMLDivElement | null>(null)
  const [titles, setTitles] = useState<Partial<Record<AppId, string>>>({})
  /** 拖动窗口时命中的目标框（给它加 data-merge-target 高亮 + 松手合并） */
  const [mergeHover, setMergeHover] = useState<string | undefined>(undefined)

  const insets = dockInsets(position, effectiveThickness, MENUBAR_H)
  /* 四边让位随任务栏位置与实际厚度变化，用行内变量写进窗口层。
     标签栏画在窗框**里面**，不占窗口层的空间 —— 所以窗口能一路拖到最左 / 最上。
     ⚠️ 顶部还多了**菜单栏**（macOS P2）：`dockInsets` 的第三参把 `--menubar-h` 算进 top，
     于是最大化 / 铺满都停在菜单栏下沿，不会把它盖住（macOS 的行为）。 */
  const insetVars = {
    '--inset-top': `${insets.top}px`,
    '--inset-right': `${insets.right}px`,
    '--inset-bottom': `${insets.bottom}px`,
    '--inset-left': `${insets.left}px`,
  } as CSSProperties

  const route = matchWindowRoute(location.pathname)
  const routeId = route?.app.id
  const routeParam = route?.param

  /* 刷新恢复：把上次开着的**框**（含标签、几何）建回来。只做一次。
     老格式（数组）由 loadSession 归一化成"一框一标签"，缺几何的按应用记住的位置兜底 */
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = loadSession()
    if (saved.length === 0) return
    dispatch({
      type: 'hydrate',
      bounds: layerBounds(layerRef.current),
      frames: saved.map((frame) => ({
        ...frame,
        geometry: frame.geometry ?? geometryOf(frame.tabs[0].id),
      })),
    })
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

  /* 会话记忆：把每个框的标签 + 活动下标 + 几何都存下来 */
  useEffect(() => {
    if (!restored.current) return
    saveSession(toSessionFrames(windows))
  }, [windows])

  /** 关掉某个标签；当前聚焦的就是它时，把 URL 交给同框的邻居，框空了就回桌面 */
  const closeTab = useCallback(
    (key: string, index: number) => {
      const frame = windows.find((w) => w.key === key)
      const closing = frame?.tabs[index]
      dispatch({ type: 'closeTab', key, index })
      if (!frame || !closing || closing.id !== routeId) return
      const rest = frame.tabs.filter((_, i) => i !== index)
      const nextTab = rest[Math.min(index, rest.length - 1)]
      if (nextTab) {
        navigate(pathOf(nextTab.id, nextTab.param))
        return
      }
      /* 这一框空了：焦点交给别的框最上面那个 */
      const others = windows.filter((w) => w.key !== key && !w.minimized).sort((a, b) => a.z - b.z)
      const other = others[others.length - 1]
      const tab = other?.tabs[other.active]
      navigate(tab ? pathOf(tab.id, tab.param) : '/')
    },
    [dispatch, navigate, routeId, windows],
  )

  const closeFrame = useCallback(
    (key: string) => {
      const frame = windows.find((w) => w.key === key)
      dispatch({ type: 'closeFrame', key })
      const activeTab = frame?.tabs[frame.active]
      if (!frame || !activeTab || activeTab.id !== routeId) return
      const others = windows.filter((w) => w.key !== key && !w.minimized).sort((a, b) => a.z - b.z)
      const other = others[others.length - 1]
      const tab = other?.tabs[other.active]
      navigate(tab ? pathOf(tab.id, tab.param) : '/')
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

  /* 有没有窗口**伸到任务栏那一条上**（最大化、或吸附到屏幕真正的边缘）：
     有就把窗口层提到任务栏之上（z-60），否则那种窗口会被任务栏挡住一截 ——
     用户 2026-10-05 报的「任务栏不要挡住窗口」。平时不提级，这样任务栏自己的弹出层
     （开始菜单、位置菜单）仍然压得住窗口层，否则它们会被一整层盖住、点不动（踩过）。 */
  const box = layerRef.current?.getBoundingClientRect()
  const layerW = box?.width ?? window.innerWidth - insets.left - insets.right
  const layerH = box?.height ?? window.innerHeight - insets.top - insets.bottom
  const overlapsDock = windows.some(
    (w) =>
      !w.minimized &&
      /* 最大化：几何还是"还原尺寸"，但视觉上铺满视口 —— 得单独算一档 */
      (w.maximized || w.x < -1 || w.y < -1 || w.x + w.w > layerW + 1 || w.y + w.h > layerH + 1),
  )

  /**
   * 菜单栏「显示」里的平铺：把**视口坐标的吸附矩形**换成**窗口层坐标**再 dispatch。
   * 和拖动吸附（`Window.tsx`）用的是同一份 `snapRect` + 同一个上边界 `workTop()`，
   * 所以"菜单里点平铺"和"拖到边缘"落位完全一致（看到哪就贴到哪）。
   */
  const tile = useCallback(
    (zone: SnapZone) => {
      const target = windows.find((w) => !w.minimized && w.tabs[w.active]?.id === routeId)
      if (!target) return
      const layer = layerRef.current?.getBoundingClientRect()
      const vp = { w: window.innerWidth, h: window.innerHeight }
      const r = snapRect(zone, vp, workTop())
      dispatch({
        type: 'snap',
        key: target.key,
        zone,
        rect: layer ? { x: r.x - layer.left, y: r.y - layer.top, w: r.w, h: r.h } : r,
      })
    },
    [windows, routeId, dispatch],
  )

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

      {/* 顶部菜单栏（macOS P2）：层次靠它自己的 z-70 —— 它压着窗口层与任务栏，
          而窗口层的 `--inset-top` 已经把这条让出来了，所以正常不会有窗口盖到它。 */}
      <MenuBar onTile={tile} />

      {/* 窗口层平时在任务栏下面（让开始菜单之类的弹出层能压住它）；
          有窗口伸到任务栏那一条上时才提级，见上面 overlapsDock */}
      <div className={`desktop__layer${overlapsDock ? ' desktop__layer--over' : ''}`} ref={layerRef}>
        {windows.map((win) => {
          const activeTab = win.tabs[Math.min(win.active, win.tabs.length - 1)]
          return (
            <div
              key={win.key}
              /* 拖动时悬在它上面 = 松手会并进来，给一圈高亮让用户看得见 */
              className={
                (win.minimized ? 'hidden ' : '') +
                (mergeHover === win.key ? 'outline outline-2 outline-accent' : '')
              }
              /* 宿主契约：`data-window-slot` = **当前激活标签的 app id**（不是框 id），
                 `data-frame` 才是框 id；`data-merge-target` 是拖动时给目标框的高亮 */
              data-window-slot={activeTab.id}
              data-frame={win.key}
              data-frame-active={activeTab.id}
              data-merge-target={mergeHover === win.key ? '' : undefined}
            >
              <Window
                win={win}
                titles={titles}
                onMergeHover={setMergeHover}
                /* ⚠️ 参数是**目标框**的 key（由被拖的那个窗口算出来），
                   `win.key` 是发起拖动的这一框 —— 别写反了，写反就变成"并进自己"，
                   reducer 一看 fromKey === intoKey 直接 no-op，表现是"怎么拖都不合并"（踩过） */
                onMergeIn={(intoKey) =>
                  dispatch({ type: 'merge', fromKey: win.key, intoKey })
                }
                onSelectTab={(index) => navigate(pathOf(win.tabs[index].id, win.tabs[index].param))}
                onCloseTab={(index) => closeTab(win.key, index)}
                onReorderTab={(from, to) => dispatch({ type: 'reorder', key: win.key, from, to })}
                onDetachTab={(index, clientX, clientY) => {
                  /* 拆出去那一框落在指针附近：默认给它和原框一样的尺寸，左上角贴着指针 */
                  const layer = layerRef.current?.getBoundingClientRect()
                  const x = layer ? clientX - layer.left - 40 : clientX - 40
                  const y = layer ? clientY - layer.top - 12 : clientY - 12
                  dispatch({
                    type: 'detach',
                    key: win.key,
                    index,
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    w: win.w,
                    h: win.h,
                  })
                }}
                onCloseFrame={() => closeFrame(win.key)}
                onActivate={() => navigate(pathOf(activeTab.id, activeTab.param))}
                onTitle={(t) => reportTitle(activeTab.id, t)}
              >
                <WindowView id={activeTab.id} param={activeTab.param} />
              </Window>

              {/* 非活动标签：只挂内容不画框（display:none），切回来时状态还在 */}
              {win.tabs.map((tab, index) =>
                index === win.active ? null : (
                  <div key={tab.id} className="hidden" data-tab-content={tab.id}>
                    <WindowTitleProvider setTitle={(t) => reportTitle(tab.id, t)}>
                      <WindowView id={tab.id} param={tab.param} />
                    </WindowTitleProvider>
                  </div>
                ),
              )}
            </div>
          )
        })}
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
