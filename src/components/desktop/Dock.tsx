import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { APPS, getApp } from '../../lib/apps'
import { useSkin } from '../../hooks/useSkin'
import { useWindows } from '../../hooks/useWindows'
import type { AppId } from '../../types/desktop'
import { AppIcon } from './AppIcon'
import { StartMenu } from './StartMenu'

/** Ubuntu = 左侧竖排 Dock；Win11 = 底部居中任务栏。同一份逻辑，只换排布 */
export function Dock() {
  const { skin, setSkin } = useSkin()
  const { windows, dispatch } = useWindows()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const scroller = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null)
  const vertical = skin === 'ubuntu'

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* 打开任何窗口就收起菜单 */
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function openApp(id: AppId) {
    const app = getApp(id)
    const win = windows.find((w) => w.id === id)
    if (win?.minimized) dispatch({ type: 'restore', id })
    navigate(app.path)
  }

  /* 工具条放不下时：按住拖动即可横滑（竖排 Dock 即竖滑），滚轮同样可用 */
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current
    if (!el) return
    drag.current = { px: e.clientX, py: e.clientY, sx: el.scrollLeft, sy: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }

  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current
    const d = drag.current
    if (!el || !d) return
    el.scrollLeft = d.sx - (e.clientX - d.px)
    el.scrollTop = d.sy - (e.clientY - d.py)
  }

  function endDrag() {
    drag.current = null
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scroller.current
    if (!el) return
    if (vertical) el.scrollTop += e.deltaY
    else el.scrollLeft += e.deltaY
  }

  const menuButton = (
    <button
      type="button"
      title="所有项目"
      aria-label="所有项目"
      aria-expanded={menuOpen}
      onClick={() => setMenuOpen((v) => !v)}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded hover:bg-hover ${
        menuOpen ? 'bg-accent text-accent-ink' : 'text-chrome-ink'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="7" r="1.7" />
        <circle cx="12" cy="7" r="1.7" />
        <circle cx="17" cy="7" r="1.7" />
        <circle cx="7" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="17" cy="12" r="1.7" />
        <circle cx="7" cy="17" r="1.7" />
        <circle cx="12" cy="17" r="1.7" />
        <circle cx="17" cy="17" r="1.7" />
      </svg>
    </button>
  )

  return (
    <nav
      aria-label="任务栏"
      className={`absolute z-50 flex gap-1 rounded-dock border border-edge bg-chrome p-1.5 shadow-xl ${
        vertical
          ? 'left-2 top-1/2 max-h-[calc(100vh-2rem)] -translate-y-1/2 flex-col items-center'
          : 'bottom-2 left-1/2 max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center'
      }`}
    >
      {vertical ? null : menuButton}

      {/* 只显示放得下的按钮，其余靠拖动/滚轮查看 */}
      <div
        ref={scroller}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className={`no-scrollbar flex gap-1 ${
          vertical ? 'min-h-0 flex-col overflow-y-auto' : 'min-w-0 overflow-x-auto'
        }`}
      >
        {APPS.map((app) => {
          const running = windows.some((w) => w.id === app.id)
          const active = pathname === app.path || pathname.startsWith(`${app.path}/`)

          return (
            <button
              key={app.id}
              type="button"
              title={app.name}
              aria-label={app.name}
              aria-current={active ? 'page' : undefined}
              onClick={() => openApp(app.id)}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded text-chrome-ink hover:bg-hover ${
                active ? 'bg-accent text-accent-ink' : ''
              }`}
            >
              <AppIcon name={app.icon} className="h-5 w-5" />
              {running ? (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent-ink"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {vertical ? menuButton : null}

      <button
        type="button"
        title="切换皮肤"
        onClick={() => setSkin(vertical ? 'win11' : 'ubuntu')}
        className="grid h-10 w-10 shrink-0 place-items-center rounded border border-edge text-[10px] font-semibold text-chrome-ink hover:bg-hover"
      >
        {vertical ? 'Win11' : 'Ubuntu'}
      </button>

      <StartMenu open={menuOpen} vertical={vertical} onClose={closeMenu} />
    </nav>
  )
}
