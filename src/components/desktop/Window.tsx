import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getApp } from '../../lib/apps'
import { SNAP_LABEL, snapRect, snapZoneAt, type Rect } from '../../lib/snap'
import { useWindows } from '../../hooks/useWindows'
import { WindowTitleProvider } from '../../hooks/useWindowTitle'
import type { AppId, SnapZone, WindowState, WindowTab } from '../../types/desktop'
import { MaximizeGlyph } from '../icons'
import { FrameTabs } from './FrameTabs'

interface WindowProps {
  /** 这一框（含它全部标签） */
  win: WindowState
  children: ReactNode
  /** 标签标题（文章名 / 项目名） */
  titles?: Partial<Record<AppId, string>>
  /** 标题栏那个 × = 关掉**整个框** */
  onCloseFrame: () => void
  onSelectTab: (index: number) => void
  onCloseTab: (index: number) => void
  onReorderTab: (from: number, to: number) => void
  onDetachTab: (index: number, clientX: number, clientY: number) => void
  /** 拖动中落在别的框上：把目标框 key 报上去（外壳给它加高亮），松手就并进去 */
  onMergeHover: (key?: string) => void
  onMergeIn: (key: string) => void
  /** 被点到（抬到最上面）时通知外壳：外壳靠它把 URL / 地址栏切到这一框的活动标签 */
  onActivate?: () => void
  /** 活动标签的标题变化时上报：标题栏与标签栏拿它显示文章名 / 项目名 */
  onTitle?: (title: string | null) => void
}

/**
 * 窗口框架：拖动 / 缩放 / 最小化 / 最大化；**标签栏画在框里面**（标题栏正下面一行）。
 *
 * 用户 2026-10-05 拍板的手势：
 * - 拖**标题栏**盖到另一扇窗上松手 = 合并成一框多标签（目标框高亮，见 `data-merge-target`）
 * - 拖**标签**出框外松手 = 拆回独立窗口（FrameTabs 负责判定）
 * - 拖动时**先判有没有落在别的窗口上**（有 = 合并），没有再判边缘吸附区 —— 两者互斥
 */
export function Window({
  win,
  children,
  titles,
  onCloseFrame,
  onSelectTab,
  onCloseTab,
  onReorderTab,
  onDetachTab,
  onMergeHover,
  onMergeIn,
  onActivate,
  onTitle,
}: WindowProps) {
  const { dispatch } = useWindows()
  const activeTab: WindowTab = win.tabs[Math.min(win.active, win.tabs.length - 1)]
  const app = getApp(activeTab.id)
  const [title, setTitle] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const resize = useRef<{ x: number; y: number } | null>(null)
  /** 窗口本体：算吸附区时要拿窗口层的矩形（endDrag 没有事件可问） */
  const shell = useRef<HTMLElement | null>(null)
  /** 这次拖动是否已经解过吸附（一次拖动只解一次） */
  const unsnapped = useRef(false)
  /** 拖动时命中的"要合并进去"的框 */
  const mergeTarget = useRef<string | undefined>(undefined)

  /* onTitle 每次渲染都可能是新函数，用 ref 兜住，免得"上报 → 外壳 setState → 再上报"转圈 */
  const report = useRef(onTitle)
  report.current = onTitle
  useEffect(() => {
    report.current?.(title)
  }, [title])

  /** 拖动时命中的吸附区 + 目标矩形（矩形是**窗口层坐标**：算的时候用整个视口，落位前减掉层偏移） */
  const [snapPreview, setSnapPreview] = useState<
    { zone: SnapZone; rect: Rect } | undefined
  >(undefined)
  /** 拖动时指针落在哪个框上（自己的 key 除外）；有值就是"松手会并进去" */
  const [overFrame, setOverFrame] = useState<string | undefined>(undefined)

  function layerBox(el: HTMLElement | null): DOMRect | undefined {
    return el?.closest('.desktop__layer')?.getBoundingClientRect() ?? undefined
  }

  /**
   * 指针下面是**别的**框吗？是就返回它的 key。
   * 用 elementsFromPoint（复数）：被拖的窗口就在指针底下，单数版永远只返回它自己。
   * 判据是"往上找到最近的 [data-frame]"—— 这样落在对方**任何位置**都算（不必精确压它的标题栏），
   * 手感才对得上"拖到另一扇窗上松手"。
   */
  function frameUnderPointer(x: number, y: number): string | undefined {
    const stack = document.elementsFromPoint(x, y) as HTMLElement[]
    for (const el of stack) {
      const key = el.closest?.('[data-frame]')?.getAttribute('data-frame') ?? undefined
      if (key && key !== win.key) return key
    }
    return undefined
  }

  function startDrag(e: React.PointerEvent<HTMLElement>) {
    if (win.maximized) return
    unsnapped.current = false
    mergeTarget.current = undefined
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
        key: win.key,
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
      key: win.key,
      x: win.x + (e.clientX - drag.current.x),
      y: win.y + (e.clientY - drag.current.y),
    })
    drag.current = { x: e.clientX, y: e.clientY }

    /* 先判"落在别的框上"（= 合并），命中就不再判吸附 —— 两者互斥 */
    const hit = frameUnderPointer(e.clientX, e.clientY)
    if (hit !== mergeTarget.current) {
      mergeTarget.current = hit
      setOverFrame(hit)
      onMergeHover(hit)
    }
    if (hit) {
      setSnapPreview(undefined)
      return
    }

    /* 指针靠近**屏幕**边缘 → 记下要贴哪儿，并给出预览（松手才落位）。
       预览与落位用同一个 snapRect，所以"看到哪就贴到哪"。
       ⚠️ 基准是**整个视口**，不是 `.desktop__layer` —— 层已经被任务栏让过位，
       拿它算的话"拖到底边"只能贴到任务栏上沿（用户 2026-10-05 报的就是这个）。
       窗口的 left/top 是相对层的，所以算完要减掉层的偏移。 */
    const layer = layerBox(e.currentTarget)
    if (layer) {
      const vp = { w: window.innerWidth, h: window.innerHeight }
      const zone = snapZoneAt(e.clientX, e.clientY, vp)
      const r = zone ? snapRect(zone, vp) : undefined
      setSnapPreview(
        zone && r
          ? { zone, rect: { x: r.x - layer.left, y: r.y - layer.top, w: r.w, h: r.h } }
          : undefined,
      )
    }
  }

  function endDrag() {
    const target = mergeTarget.current
    if (drag.current && target) {
      onMergeIn(target)
    } else if (drag.current && snapPreview) {
      dispatch({ type: 'snap', key: win.key, zone: snapPreview.zone, rect: snapPreview.rect })
    }
    if (mergeTarget.current) onMergeHover(undefined)
    mergeTarget.current = undefined
    setOverFrame(undefined)
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
      key: win.key,
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
      /* 宿主契约：框上这两样都跟**当前激活标签**走（`data-window-slot` / aria-label） */
      aria-label={`${app.name} 窗口`}
      data-snap={win.snap ?? ''}
      data-merge-hover={overFrame ?? ''}
      data-frame-body={win.key}
      className={`window absolute flex flex-col overflow-hidden rounded-window border border-edge bg-surface shadow-2xl ${
        win.maximized ? 'window--max' : ''
      }`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => {
        dispatch({ type: 'focusFrame', key: win.key })
        onActivate?.()
      }}
    >
      {/* **一行到底**（2026-10-05 用户："图一只有一行，为什么我们有两行"）：
          标签行与窗口按钮同排，跟浏览器一样 —— 不再有"标题栏 + 标签行"两行。
          - 拖标签 = 换顺序；竖直拖出框外 = 拆成独立窗口
          - 拖这一行的**空白处** = 移动窗口；拖到别的框上 = 合并
          宿主契约：那三个窗口按钮放在 `[data-window-controls]` 里 —— 标签按钮也在 `<header>` 里了，
          所以别再按 `header button` 去数标题栏按钮 */}
      <header
        data-frame-head={win.key}
        className="flex h-9 shrink-0 cursor-default select-none items-center gap-2 border-b border-edge bg-surface-2 pl-1.5 pr-2"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() =>
          /* 吸附着的先解吸附（回到自由尺寸），否则才是最大化 / 还原 */
          win.snap
            ? dispatch({ type: 'unsnap', key: win.key })
            : dispatch({ type: 'toggle-maximize', key: win.key })
        }
      >
        <FrameTabs
          tabs={win.tabs}
          active={win.active}
          titles={titles ?? {}}
          onSelect={onSelectTab}
          onClose={onCloseTab}
          onReorder={onReorderTab}
          onDetach={onDetachTab}
        />

        <span
          data-window-controls=""
          className="flex shrink-0 items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            /* ⚠️ 字形尺寸回到原来的 12px（用户 2026-10-05 中途改主意：「图标改回原来的样式」）；
               悬停时露出的"按钮形状"用 --c-control-hover —— 比 --c-hover 实、比 --c-accent 淡 */
            className="grid h-6 w-6 place-items-center rounded text-xs text-dim hover:bg-[var(--c-control-hover)] hover:text-ink"
            aria-label="最小化"
            onClick={() => dispatch({ type: 'minimize', key: win.key })}
          >
            &#8211;
          </button>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-[var(--c-control-hover)] hover:text-ink"
            aria-label={win.maximized ? '还原' : '最大化'}
            aria-pressed={win.maximized}
            onClick={() => dispatch({ type: 'toggle-maximize', key: win.key })}
          >
            {/* 最大化 / 还原的图形在 components/icons/glyphs/MaximizeGlyph.tsx（默认就是 12px） */}
            <MaximizeGlyph maximized={win.maximized} />
          </button>
          <button
            type="button"
            /* 关闭 = 破坏性操作，悬停给**红底**（用户 2026-10-05：「删除键要改成红色背景」）；
               红底 + 浅字走 --c-danger / --c-danger-fg，三套主题各一份 */
            className="grid h-6 w-6 place-items-center rounded text-xs text-dim hover:bg-[var(--c-danger)] hover:text-[var(--c-danger-fg)]"
            aria-label="关闭"
            /* 这一行的 × = 关掉整个框（标签上那个 × 才只关一个标签） */
            onClick={onCloseFrame}
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

      {/* 拖动时落在别的框上：提示"松手并进去"（overFrame 是那个框的 key） */}
      {overFrame ? (
        <span
          data-merge-drop=""
          className="pointer-events-none absolute left-2 top-2 z-[66] rounded border border-accent bg-surface px-1.5 py-0.5 text-[11px] text-ink"
        >
          松手合并进那一扇窗
        </span>
      ) : null}

      {/* 吸附预览：拖到边缘时提示"松手会贴成什么样"。
          坐标是相对**窗口层**的（section 是 absolute，包含块就是窗口层），
          z 比所有窗口高 */}
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
