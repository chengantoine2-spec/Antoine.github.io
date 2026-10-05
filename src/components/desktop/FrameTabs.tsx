import { useRef, useState } from 'react'
import { getApp } from '../../lib/apps'
import type { AppId, WindowTab } from '../../types/desktop'
import { AppIcon } from './AppIcon'

interface FrameTabsProps {
  /** 框里的标签，顺序 = 标签栏顺序 */
  tabs: WindowTab[]
  active: number
  /** 标签标题（文章名 / 项目名），拿不到就退回应用名 */
  titles: Partial<Record<AppId, string>>
  onSelect: (index: number) => void
  onClose: (index: number) => void
  /** 拖拽排序：把第 from 个放到第 to 个位置 */
  onReorder: (from: number, to: number) => void
  /** 拖出框外（竖直方向跑出去 24px）= 拆成独立窗口，位置给指针那儿 */
  onDetach: (index: number, clientX: number, clientY: number) => void
}

/**
 * 窗口框**里面**的标签栏（标题栏正下面那一行）。
 *
 * 用户 2026-10-05 拍板：
 * - 「标签栏应该做在窗口的边框里面」→ 它就是这一框的标签行，不再是桌面顶部那条全局悬浮栏
 * - 「标签栏拖拽排序（像浏览器那样拖着换位置）」→ 按住标签左右拖
 * - 「把标签拖出框外松手 = 拆回独立窗口」→ 竖直方向离开标签行 24px 就算
 *
 * 拖拽全程用 pointer 事件 + setPointerCapture，不引任何依赖。
 */
export function FrameTabs({
  tabs,
  active,
  titles,
  onSelect,
  onClose,
  onReorder,
  onDetach,
}: FrameTabsProps) {
  const strip = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ index: number; startX: number; startY: number; moved: boolean } | null>(null)
  /**
   * 刚拖完的那一刻浏览器会在标签上补一个 click —— 那个要吞掉。
   * ⚠️ 用**时间戳**而不是布尔标志：布尔标志会被"拖完没人补 click"的情况漏掉，
   * 于是下一次真正的点击被误吞（踩过：拖完排序后点标签切不过去）。
   */
  const dragEndedAt = useRef(0)
  const [dropAt, setDropAt] = useState<number | undefined>(undefined)
  /** 拖动中是否已经离开标签行（提示"松手就拆出去"） */
  const [tearing, setTearing] = useState(false)

  function tabEls(): HTMLElement[] {
    return Array.from(strip.current?.querySelectorAll<HTMLElement>('[data-tab]') ?? [])
  }

  function onTabPointerDown(e: React.PointerEvent<HTMLElement>, index: number) {
    /* 别让窗框的标题栏把这当成"拖窗口" */
    e.stopPropagation()
    drag.current = { index, startX: e.clientX, startY: e.clientY, moved: false }
    /* ⚠️ 这里**绝对不能** setPointerCapture：一旦在 pointerdown 就抓指针，浏览器会把随后的
       `click` 派给被捕获的这个 span（而不是里层那个按钮），按钮的 onClick 永远不触发 ——
       表现就是"合并之后标签点不动、切不回原来那个窗口"（踩过）。
       等真拖动超过阈值再抓，见下面的 onTabPointerMove（同 AGENTS「坑 2」）。 */
  }

  function onTabPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    if (!d.moved) {
      d.moved = true
      /* 到这一步才确定是拖动（不是点击），可以安全地抓指针了 */
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    const self = tabEls()[d.index]
    if (self) {
      const r = self.getBoundingClientRect()
      /* 竖直方向跑出标签行 = 要拆帧（只提示，松手才做） */
      const out = e.clientY - r.bottom > 24 || r.top - e.clientY > 24
      setTearing(out)
      if (out) {
        setDropAt(undefined)
        return
      }
    }

    /* 落点：跟每个标签的中心比，第一个"指针在它左半边"的就是插入位置 */
    const els = tabEls()
    let to = els.length - 1
    for (let i = 0; i < els.length; i += 1) {
      const r = els[i].getBoundingClientRect()
      if (e.clientX < r.left + r.width / 2) {
        to = i
        break
      }
    }
    setDropAt(to)
  }

  function onTabPointerUp(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current
    drag.current = null
    const to = dropAt
    const wasTearing = tearing
    setDropAt(undefined)
    setTearing(false)
    if (!d || !d.moved) return
    dragEndedAt.current = Date.now()
    if (wasTearing) {
      onDetach(d.index, e.clientX, e.clientY)
      return
    }
    if (to !== undefined && to !== d.index) onReorder(d.index, to)
  }

  return (
    <div
      ref={strip}
      data-frame-tabs=""
      role="tablist"
      aria-label="窗口标签栏"
      /* 占满这一行剩下的宽度（右边留给窗口按钮）；**空白处的 pointerdown 要冒泡给标题栏**，
         这样"拖这一行的空档"仍然是移动 / 合并整扇窗（浏览器同款手感） */
      className="no-scrollbar flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto"
    >
      {tabs.map((tab, index) => {
        const app = getApp(tab.id)
        const label = titles[tab.id] ?? app.name
        const isActive = index === active
        return (
          <span
            key={tab.id}
            data-tab={tab.id}
            data-active={isActive ? 'true' : 'false'}
            data-dropping={dropAt === index ? 'true' : 'false'}
            onPointerDown={(e) => onTabPointerDown(e, index)}
            onPointerMove={onTabPointerMove}
            onPointerUp={onTabPointerUp}
            onPointerCancel={() => {
              drag.current = null
              setDropAt(undefined)
              setTearing(false)
            }}
            /* 双击标签不该最大化窗口（空白处的双击才是） */
            onDoubleClick={(e) => e.stopPropagation()}
            title={`${app.name} · ${label}`}
            className={`group flex h-[26px] max-w-[13rem] shrink-0 cursor-default items-center gap-1.5 rounded-md border px-2 text-xs ${
              isActive
                ? 'border-edge bg-surface text-ink shadow-sm'
                : 'border-transparent text-dim hover:bg-hover hover:text-ink'
            } ${dropAt === index ? 'border-accent' : ''} ${tearing && drag.current?.index === index ? 'opacity-60' : ''}`}
          >
            <button
              type="button"
              data-tab-select={tab.id}
              onClick={() => {
                /* 刚拖完（<250ms）的那一下是浏览器补的 click，别当成"切标签" */
                if (Date.now() - dragEndedAt.current < 250) return
                onSelect(index)
              }}
              className="flex min-w-0 items-center gap-1.5 text-left"
            >
              <AppIcon name={app.icon} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
            <button
              type="button"
              data-tab-close={tab.id}
              aria-label={`关闭 ${app.name} 标签`}
              title="关闭这个标签"
              onClick={() => onClose(index)}
              /* 「左侧那个删除窗口的小按钮」：悬停也要露出按钮形状，和标题行那三个同一套
                 （用户 2026-10-05）。用 --c-control-hover 而不是 --c-hover：后者是给任务栏那种
                 深色面设计的浅色叠加，在这个浅色标签上几乎看不见 */
              className="grid h-4 w-4 shrink-0 place-items-center rounded text-[11px] opacity-60 hover:bg-[var(--c-control-hover)] hover:text-ink hover:opacity-100"
            >
              &#215;
            </button>
          </span>
        )
      })}
    </div>
  )
}
