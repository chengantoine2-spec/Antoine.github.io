import { useRef, useState, type ReactNode } from 'react'
import { getApp } from '../../lib/apps'
import { useWindows } from '../../hooks/useWindows'
import { WindowTitleProvider } from '../../hooks/useWindowTitle'
import type { WindowState } from '../../types/desktop'
import { MaximizeGlyph } from '../icons'
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
            {/* 最大化 / 还原的图形在 components/icons/glyphs/MaximizeGlyph.tsx */}
            <MaximizeGlyph maximized={win.maximized} />
          </button>
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
