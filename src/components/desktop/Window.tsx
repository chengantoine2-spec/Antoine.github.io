import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getApp } from '../../lib/apps'
import { SNAP_LABEL, snapRect, snapZoneAt, type Rect } from '../../lib/snap'
import { useWindows } from '../../hooks/useWindows'
import { WindowTitleProvider } from '../../hooks/useWindowTitle'
import type { SnapZone, WindowState } from '../../types/desktop'
import { MaximizeGlyph } from '../icons'
import { AppIcon } from './AppIcon'

interface WindowProps {
  win: WindowState
  children: ReactNode
  onClose: () => void
  /** 被点到（抬到最上面）时通知外壳：外壳靠它把 URL / 地址栏切到这个窗口 */
  onActivate?: () => void
  /** 标题变化时上报：标签栏拿它显示文章名 / 项目名 */
  onTitle?: (title: string | null) => void
}

/** 窗口框架：拖动 / 缩放 / 最小化 / 最大化；标题栏文字可被窗口内容覆盖 */
export function Window({ win, children, onClose, onActivate, onTitle }: WindowProps) {
  const { dispatch } = useWindows()
  const app = getApp(win.id)
  const [title, setTitle] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const resize = useRef<{ x: number; y: number } | null>(null)
  /** 窗口本体：算吸附区时要拿窗口层的矩形（endDrag 没有事件可问） */
  const shell = useRef<HTMLElement | null>(null)
  /** 这次拖动是否已经解过吸附（一次拖动只解一次） */
  const unsnapped = useRef(false)

  /* onTitle 每次渲染都可能是新函数，用 ref 兜住，免得"上报 → 外壳 setState → 再上报"转圈 */
  const report = useRef(onTitle)
  report.current = onTitle
  useEffect(() => {
    report.current?.(title)
  }, [title])

  /** 拖动时命中的吸附区 + 目标矩形 + 当时的窗口层尺寸（松手就用它落位） */
  const [snapPreview, setSnapPreview] = useState<
    { zone: SnapZone; rect: Rect; bounds: { w: number; h: number } } | undefined
  >(undefined)

  function layerBox(el: HTMLElement | null): DOMRect | undefined {
    return el?.closest('.desktop__layer')?.getBoundingClientRect() ?? undefined
  }

  function startDrag(e: React.PointerEvent<HTMLElement>) {
    if (win.maximized) return
    unsnapped.current = false
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onDrag(e: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return

    /* 吸附中的窗口：**动起来**才解吸附（只按一下不该把它弄回原样，那样双击解吸附就失效了）。
       按指针在标题栏上的相对位置把 restore 摆回指针下面，所以手感是"从指针那儿弹出来"。 */
    if (win.snap && !unsnapped.current) {
      const box = e.currentTarget.getBoundingClientRect()
      const layer = layerBox(e.currentTarget)
      dispatch({
        type: 'unsnap',
        id: win.id,
        anchor: box.width > 0 ? (e.clientX - box.left) / box.width : 0.5,
        pointer: layer
          ? { x: e.clientX - layer.left, y: e.clientY - layer.top }
          : { x: e.clientX, y: e.clientY },
      })
      unsnapped.current = true
      /* 这一帧只解吸附：几何刚换了基准，位置下一帧再跟着指针走 */
      drag.current = { x: e.clientX, y: e.clientY }
      return
    }

    dispatch({
      type: 'move',
      id: win.id,
      x: win.x + (e.clientX - drag.current.x),
      y: win.y + (e.clientY - drag.current.y),
    })
    drag.current = { x: e.clientX, y: e.clientY }

    /* 指针靠近窗口层的边缘 → 记下要贴哪儿，并给出预览（松手才落位）。
       预览与落位用同一个 snapRect，所以"看到哪就贴到哪" */
    const layer = layerBox(e.currentTarget)
    if (layer) {
      const bounds = { w: layer.width, h: layer.height }
      const hit = snapZoneAt(e.clientX - layer.left, e.clientY - layer.top, bounds)
      setSnapPreview(hit ? { zone: hit, rect: snapRect(hit, bounds), bounds } : undefined)
    }
  }

  function endDrag() {
    if (drag.current && snapPreview) {
      dispatch({ type: 'snap', id: win.id, zone: snapPreview.zone, bounds: snapPreview.bounds })
    }
    setSnapPreview(undefined)
    unsnapped.current = false
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
      ref={shell}
      aria-label={`${app.name} 窗口`}
      data-snap={win.snap ?? ''}
      className={`window absolute flex flex-col overflow-hidden rounded-window border border-edge bg-surface shadow-2xl ${
        win.maximized ? 'window--max' : ''
      }`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => {
        dispatch({ type: 'focus', id: win.id })
        onActivate?.()
      }}
    >
      <header
        className="flex h-9 shrink-0 cursor-default select-none items-center justify-between gap-2 border-b border-edge bg-surface-2 px-3"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() =>
          /* 吸附着的先解吸附（回到自由尺寸），否则才是最大化 / 还原 */
          win.snap
            ? dispatch({ type: 'unsnap', id: win.id })
            : dispatch({ type: 'toggle-maximize', id: win.id })
        }
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

      {/* 吸附预览：拖到边缘时提示"松手会贴成什么样"。
          坐标是相对**窗口层**的（section 是 absolute，包含块就是窗口层），
          z 比所有窗口高，但低于桌面标签栏 */}
      {snapPreview ? (
        <span
          data-snap-preview={snapPreview.zone}
          role="presentation"
          className="pointer-events-none absolute z-[65] rounded-window border-2 border-accent bg-[var(--c-scroll-thumb)]"
          style={snapPreview.rect}
        >
          <span className="absolute left-2 top-2 rounded border border-edge bg-surface px-1.5 py-0.5 text-[11px] text-dim">
            {SNAP_LABEL[snapPreview.zone]}
          </span>
        </span>
      ) : null}
    </section>
  )
}
