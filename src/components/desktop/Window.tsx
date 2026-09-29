import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getApp } from '../../lib/apps'
import { useWindows } from '../../hooks/useWindows'
import { WindowTitleProvider } from '../../hooks/useWindowTitle'
import type { WindowState } from '../../types/desktop'
import { AppIcon } from './AppIcon'

interface WindowProps {
  win: WindowState
  children: ReactNode
  onClose: () => void
}

/** 窗口框架：拖动 / 缩放 / 最小化 / 最大化；标题栏文字可被窗口内容覆盖 */
export function Window({ win, children, onClose }: WindowProps) {
  const { dispatch } = useWindows()
  const app = getApp(win.id)
  const [title, setTitle] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const resize = useRef<{ x: number; y: number } | null>(null)

  /* 浏览器级全屏：连浏览器自己的窗口一起盖住，铺满整个屏幕（不同于窗口最大化）。
     用户按 Esc / F11 也能进出，所以状态听 fullscreenchange，而不是"我点过没有" */
  const [fullscreen, setFullscreen] = useState(false)
  /* 极少数环境不支持（比如 iOS Safari），那就别摆一个点了没反应的按钮 */
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null)
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      /* 顺手最大化：否则浏览器进了全屏、窗口还是小的，看着依旧"没铺开" */
      if (!win.maximized) dispatch({ type: 'toggle-maximize', id: win.id })
      await document.documentElement.requestFullscreen()
    } catch {
      /* 被拒绝或不支持：什么都不做，按钮状态始终由 fullscreenchange 决定 */
    }
  }

  function startDrag(e: React.PointerEvent<HTMLElement>) {
    if (win.maximized) return
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onDrag(e: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return
    dispatch({
      type: 'move',
      id: win.id,
      x: win.x + (e.clientX - drag.current.x),
      y: win.y + (e.clientY - drag.current.y),
    })
    drag.current = { x: e.clientX, y: e.clientY }
  }

  function endDrag() {
    drag.current = null
  }

  function startResize(e: React.PointerEvent<HTMLElement>) {
    e.stopPropagation()
    resize.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onResize(e: React.PointerEvent<HTMLElement>) {
    if (!resize.current) return
    dispatch({
      type: 'resize',
      id: win.id,
      w: win.w + (e.clientX - resize.current.x),
      h: win.h + (e.clientY - resize.current.y),
    })
    resize.current = { x: e.clientX, y: e.clientY }
  }

  function endResize() {
    resize.current = null
  }

  return (
    <section
      aria-label={`${app.name} 窗口`}
      className={`window absolute flex flex-col overflow-hidden rounded-window border border-edge bg-surface shadow-2xl ${
        win.maximized ? 'window--max' : ''
      }`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => dispatch({ type: 'focus', id: win.id })}
    >
      <header
        className="flex h-9 shrink-0 cursor-default select-none items-center justify-between gap-2 border-b border-edge bg-surface-2 px-3"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => dispatch({ type: 'toggle-maximize', id: win.id })}
      >
        <span className="flex items-center gap-2 text-xs font-medium text-ink">
          <AppIcon name={app.icon} className="h-4 w-4 text-accent" />
          {title ?? app.name}
        </span>

        <span className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded text-xs text-dim hover:bg-hover hover:text-ink"
            aria-label="最小化"
            onClick={() => dispatch({ type: 'minimize', id: win.id })}
          >
            &#8211;
          </button>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-hover hover:text-ink"
            aria-label={win.maximized ? '还原' : '最大化'}
            aria-pressed={win.maximized}
            onClick={() => dispatch({ type: 'toggle-maximize', id: win.id })}
          >
            {/* 用矢量而不是 □ 字形：还原态是"两个叠起来的方块"，字形里没有可靠的，
                而且矢量能跟着 text-dim / hover:text-ink 走，不写死颜色 */}
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
              {win.maximized ? (
                <>
                  <rect x="1.5" y="3.5" width="7" height="7" rx="1.2" />
                  <path d="M4.2 3.4V2.9A1.1 1.1 0 0 1 5.3 1.8H9.6A1.1 1.1 0 0 1 10.7 2.9V7.2A1.1 1.1 0 0 1 9.6 8.3H8.4" />
                </>
              ) : (
                <rect x="1.5" y="1.5" width="9" height="9" rx="1.3" />
              )}
            </svg>
          </button>
          {canFullscreen ? (
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-hover hover:text-ink"
              aria-label={fullscreen ? '退出全屏' : '全屏'}
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
            >
              {/* 全屏 / 退出全屏：四角朝外 vs 朝内，一眼能看出当前状态 */}
              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {fullscreen ? (
                  <>
                    <path d="M5 1.5V5H1.5" />
                    <path d="M7 1.5V5h3.5" />
                    <path d="M5 10.5V7H1.5" />
                    <path d="M7 10.5V7h3.5" />
                  </>
                ) : (
                  <>
                    <path d="M1.5 5V1.5H5" />
                    <path d="M10.5 5V1.5H7" />
                    <path d="M1.5 7v3.5H5" />
                    <path d="M10.5 7v3.5H7" />
                  </>
                )}
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded text-xs text-dim hover:bg-accent hover:text-accent-ink"
            aria-label="关闭"
            onClick={onClose}
          >
            &#215;
          </button>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-5 text-sm">
        <WindowTitleProvider setTitle={setTitle}>{children}</WindowTitleProvider>
      </div>

      {win.maximized ? null : (
        <span
          className="window__resize"
          role="presentation"
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      )}
    </section>
  )
}
