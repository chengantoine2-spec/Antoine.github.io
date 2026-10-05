import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, visibleApps } from '../../lib/apps'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import {
  DOCK_BORDER as BORDER,
  DOCK_GAP as GAP,
  DOCK_MARGIN,
  DOCK_PAD as PAD,
  DOCK_THICKNESS,
  MAGNIFY_AMP,
  MAGNIFY_RADIUS_RATIO,
  MOVE_THRESHOLD,
  SNAP_MS,
  dockMinLength,
  dockStep,
  isVertical,
  maxDockLength,
  maxDockThickness,
  wheelChrome,
  wheelViewMin,
  wrapLines,
  wrapPerLine,
} from '../../lib/dock'
import type { AppId } from '../../types/desktop'
import { MenuGlyph, PositionGlyph } from '../icons'
import { AppIcon } from './AppIcon'
import { DockPositionMenu } from './DockPositionMenu'
import { FullscreenButton } from './FullscreenButton'
import { StartMenu } from './StartMenu'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/* 任务栏内部几何 GAP / PAD / BORDER 现在从 lib/dock 来 —— 厚度下限要用同一套数，
   这里只留按钮边长上限 */
/** 按钮最大边长：再厚就去多排一行，而不是把图标撑大（设置里手选最大能到 64） */
const BTN_MAX = 64

/** 八条拖拽边（四边 + 四个倒角）：拖离中心的方向算变大 */
interface ResizeEdge {
  key: string
  /** 横向拖动作用到哪一维：t=厚度，l=长度；null = 该轴不参与 */
  x: 't' | 'l' | null
  y: 't' | 'l' | null
  signX: number
  signY: number
  cursor: string
  pos: string
}

function resizeEdges(vertical: boolean): ResizeEdge[] {
  /* 横排任务栏：左右改长度、上下改厚度；竖排反过来 */
  const mapX: 't' | 'l' = vertical ? 't' : 'l'
  const mapY: 't' | 'l' = vertical ? 'l' : 't'
  const defs: Array<{
    key: string
    x: boolean
    y: boolean
    signX: number
    signY: number
    cursor: string
    pos: string
  }> = [
    { key: 'top', x: false, y: true, signX: 0, signY: -1, cursor: 'ns-resize', pos: 'inset-x-2 top-0 h-1.5' },
    { key: 'bottom', x: false, y: true, signX: 0, signY: 1, cursor: 'ns-resize', pos: 'inset-x-2 bottom-0 h-1.5' },
    { key: 'left', x: true, y: false, signX: -1, signY: 0, cursor: 'ew-resize', pos: 'inset-y-2 left-0 w-1.5' },
    { key: 'right', x: true, y: false, signX: 1, signY: 0, cursor: 'ew-resize', pos: 'inset-y-2 right-0 w-1.5' },
    { key: 'tl', x: true, y: true, signX: -1, signY: -1, cursor: 'nwse-resize', pos: 'left-0 top-0 h-3 w-3' },
    { key: 'tr', x: true, y: true, signX: 1, signY: -1, cursor: 'nesw-resize', pos: 'right-0 top-0 h-3 w-3' },
    { key: 'bl', x: true, y: true, signX: -1, signY: 1, cursor: 'nesw-resize', pos: 'left-0 bottom-0 h-3 w-3' },
    { key: 'br', x: true, y: true, signX: 1, signY: 1, cursor: 'nwse-resize', pos: 'right-0 bottom-0 h-3 w-3' },
  ]
  return defs.map((d) => ({
    key: d.key,
    x: d.x ? mapX : null,
    y: d.y ? mapY : null,
    signX: d.signX,
    signY: d.signY,
    cursor: d.cursor,
    pos: d.pos,
  }))
}

interface HoverState {
  name: string
  /** 被悬停按钮的视口矩形 */
  rect: DOMRect
  /** 任务栏自身的视口矩形，用来换算成任务栏内坐标 */
  bar: DOMRect
}

interface GripState {
  px: number
  py: number
  startT: number
  startL: number
  x: { dim: 't' | 'l'; sign: number } | null
  y: { dim: 't' | 'l'; sign: number } | null
}

/** 任务栏：位置可切到下/上/左/右（左右为竖排），厚度与长度靠拖边缘调整 */
export function Dock() {
  const {
    position,
    length: rawLength,
    thickness,
    minThickness,
    iconSize,
    dockApps,
    mode,
    setPosition,
    setLength,
    setThickness,
    reorderDockApps,
  } = useDock()
  const { windows, dispatch } = useWindows()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [posOpen, setPosOpen] = useState(false)
  const [hover, setHover] = useState<HoverState | null>(null)
  const bar = useRef<HTMLElement | null>(null)
  const posWrap = useRef<HTMLDivElement | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ px: number; py: number; sx: number; sy: number; moved: boolean } | null>(
    null,
  )
  const grip = useRef<GripState | null>(null)
  const vertical = isVertical(position)

  /* ── 轮盘模式的 ref 与手势状态（拖动过程只动 ref，不进 React 状态）── */
  const viewEl = useRef<HTMLDivElement | null>(null)
  const trackEl = useRef<HTMLDivElement | null>(null)
  const offset = useRef(0)
  const raf = useRef(0)
  const gesture = useRef<{
    axisStart: number
    crossStart: number
    offsetStart: number
    onIcon: number | null
    /** 按下的那个应用（换位预览换的是它，不能再用下标找 —— 下标会随预览变） */
    dragId: AppId | null
    kind: 'browse' | 'move' | null
    to: number
    clientX: number
    clientY: number
    /** 已经抓住指针了没（一动就抓，见 wheelMove 里的说明） */
    captured: boolean
  } | null>(null)
  const lift = useRef<{ el: HTMLElement; id: AppId } | null>(null)
  /* 换位预览：只有"越过邻居中点"这种离散事件才 setState（每帧不动 state） */
  const [preview, setPreview] = useState<AppId[] | null>(null)

  /* 图标边长：设置里选过就用选的，否则跟随厚度；跟随厚度时超过上限不再变大，富余厚度改成多行 */
  const autoBtn = clamp((thickness ?? DOCK_THICKNESS) - (PAD + BORDER) * 2, 28, BTN_MAX)
  /* 手动选了尺寸就以它为准；范围与设置里的档位一致（32~64） */
  const btn = Math.round(iconSize === null ? autoBtn : clamp(iconSize, 32, 64))
  const btnStyle: CSSProperties = { width: btn, height: btn }

  /* 长度下限：**两种模式各算各的**（见 lib/dock 的 dockMinLength）。
     wheel = 三个固定按钮 + 图标区至少 3 个图标位；wrap = 旧的"至少装得下固定按钮 + 一个图标" */
  const minLength = dockMinLength(mode, btn)
  /* 拖过长度就按它来，但不允许小于下限；length === null 表示"跟着按钮自适应" */
  const length = rawLength === null ? null : Math.max(rawLength, minLength)

  /* 当前厚度能塞下几行（竖排时是几列）—— **只有折行模式用**；轮盘永远单行 */
  const crossAvail = (thickness ?? DOCK_THICKNESS) - (PAD + BORDER) * 2
  const lines = mode === 'wrap' ? wrapLines(crossAvail, btn) : 1

  /* 本机专属的窗口（DSH）在线上不挂载：任务栏里也不该露出来，折行计算同样按"看得到的"来 */
  const shownApps = dockApps.filter((id) => visibleApps().some((app) => app.id === id))
  const itemCount = shownApps.length

  /* ── 折行模式的几何（旧行为，一个字都不改）──
     多行时给内层一个主轴上限，折行才会发生（内层才是 flex 容器）。
     注意不能只在 length === null 时加 —— 那样拖过长度的任务栏就永远只有一条，只能在一条里滚 */
  const perLine = wrapPerLine(itemCount, lines)
  const lineSize = perLine * btn + (perLine - 1) * GAP
  const itemsStyle: CSSProperties = {}
  if (mode === 'wrap' && lines > 1 && itemCount > 0) {
    if (vertical) itemsStyle.height = lineSize
    else itemsStyle.width = lineSize
  }

  /* ── 轮盘模式的几何 ──
     step = 相邻图标中心距；图标区长度 = 给多少算多少（length === null 时按"装下所有图标"自适应，
     再被 bar 的 87.5vw 上限挤一下，挤掉的部分正好靠循环补上）。
     可视长度至少 3 个图标位：再小，中央放大出来的图标会被裁掉一半 */
  const step = dockStep(btn)
  const chromeLen = wheelChrome(btn)
  const viewMin = wheelViewMin(btn)
  const autoView = Math.max(viewMin, itemCount * step - GAP)
  const viewLen = length === null ? autoView : Math.max(viewMin, length - chromeLen)
  /* 交叉轴上给放大后的图标留的"溢出余量"：中央 1.5× 的图标会比图标位高一截，
     不留这点余量就会被图标区的裁剪切掉上下两边（视口靠负外边距 + 等量内边距实现） */
  const spill = Math.ceil((btn * MAGNIFY_AMP) / 2) + 2

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* 打开任何窗口就收起菜单 */
  useEffect(() => {
    setMenuOpen(false)
    setPosOpen(false)
  }, [pathname])

  /* 面板点开后就保持展开：只有选位置、按 Esc、点别处、或换页才收起 */
  useEffect(() => {
    if (!posOpen && !menuOpen) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (posOpen && !posWrap.current?.contains(target)) setPosOpen(false)
      if (menuOpen && !bar.current?.contains(target)) setMenuOpen(false)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPosOpen(false)
      setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [posOpen, menuOpen])

  function openApp(id: AppId) {
    const app = getApp(id)
    /* 这一框可能装着好几个标签：按"哪个框里有这个应用"来找 */
    const win = windows.find((w) => w.tabs.some((tab) => tab.id === id))
    if (win?.minimized) dispatch({ type: 'restore', key: win.key })
    navigate(app.path)
  }

  /* 悬停/聚焦显示名称：用任务栏内坐标的浮层，避免被滚动容器裁掉 */
  function showName(target: HTMLElement, name: string) {
    const barRect = bar.current?.getBoundingClientRect()
    if (!barRect) return
    setHover({ name, rect: target.getBoundingClientRect(), bar: barRect })
  }

  function hoverStyle(state: HoverState): CSSProperties {
    const cx = state.rect.left - state.bar.left + state.rect.width / 2
    const cy = state.rect.top - state.bar.top + state.rect.height / 2
    switch (position) {
      case 'bottom':
        return {
          left: cx,
          top: state.rect.top - state.bar.top - 8,
          transform: 'translate(-50%, -100%)',
        }
      case 'top':
        return {
          left: cx,
          top: state.rect.bottom - state.bar.top + 8,
          transform: 'translateX(-50%)',
        }
      case 'left':
        return {
          left: state.rect.right - state.bar.left + 8,
          top: cy,
          transform: 'translateY(-50%)',
        }
      default:
        return {
          left: state.rect.left - state.bar.left - 8,
          top: cy,
          transform: 'translate(-100%, -50%)',
        }
    }
  }

  /* ── 折行模式（wrap）的滚动：旧行为 ──
     工具条放不下时：按住拖动即可横滑（竖排即竖滑），滚轮同样可用。
     注意：这里**不能**在 pointerdown 就 setPointerCapture —— 那会把 pointerup 改派到
     容器，滚动容器里按钮的 click 就永远不会触发（点不动应用）。等真拖出 4px 再抓。 */
  function wrapStartDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current
    if (!el) return
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      sx: el.scrollLeft,
      sy: el.scrollTop,
      moved: false,
    }
  }

  function wrapOnDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current
    const d = drag.current
    if (!el || !d) return
    if (!d.moved) {
      if (Math.abs(e.clientX - d.px) < 4 && Math.abs(e.clientY - d.py) < 4) return
      d.moved = true
      el.setPointerCapture(e.pointerId)
    }
    el.scrollLeft = d.sx - (e.clientX - d.px)
    el.scrollTop = d.sy - (e.clientY - d.py)
  }

  function wrapEndDrag() {
    drag.current = null
  }

  function wrapOnWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scroller.current
    if (!el) return
    if (vertical) el.scrollTop += e.deltaY
    else el.scrollLeft += e.deltaY
  }

  /* ── 轮盘模式（wheel）：按住拖动浏览 / 竖拖换位 ──────────────────────────────
     ⚠️ 拖动过程**不进 React 状态**：offset 在 ref 里，用 rAF 直接改 track 的 transform、
     逐个改图标 scale。每帧 setState 会把图标区整棵子树重渲，手感会飘。
     只有"换位预览"这种离散事件才 setState（一次拖动最多几次）。 */
  const cycle = itemCount * step
  const normalize = (v: number) => (cycle > 0 ? ((v % cycle) + cycle) % cycle : 0)
  const alongOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientY : e.clientX)
  const crossOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientX : e.clientY)

  /** 按当前 offset 把 track 与每个图标的 scale 画出来（同时负责"循环归一化"） */
  function paint() {
    const view = viewEl.current
    const track = trackEl.current
    if (!view || !track) return
    /* 归一化到 [0, cycle)：两份列表背靠背，平移一个 cycle 画面完全一样，所以这次跳变看不见 */
    const off = normalize(offset.current)
    track.style.transform = vertical ? `translate3d(0, ${-off}px, 0)` : `translate3d(${-off}px, 0, 0)`
    const vLen = vertical ? view.clientHeight : view.clientWidth
    if (!vLen) return
    const half = vLen / 2
    const R = Math.max(1, vLen * MAGNIFY_RADIUS_RATIO)
    const items = track.querySelectorAll<HTMLElement>('[data-dock-item]')
    items.forEach((el) => {
      /* 正在被拖起来换位的那个不动它（它自己跟手，paint 一插手就会把它拽回去） */
      if (lift.current && lift.current.el === el) return
      const c = (vertical ? el.offsetTop : el.offsetLeft) + el.offsetWidth / 2 - off
      const d = Math.abs(c - half)
      const t = d >= R ? 0 : 1 - d / R
      const s = 1 + MAGNIFY_AMP * t * t
      if (s > 1.001) {
        el.style.transform = `scale(${s.toFixed(3)})`
        el.style.zIndex = String(1 + Math.round(t * 10))
      } else {
        el.style.transform = ''
        el.style.zIndex = ''
      }
    })
  }

  /** 拖动中每帧只排一次 rAF */
  function schedulePaint(next: number) {
    offset.current = next
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      paint()
    })
  }

  /** 松手吸附到最近的格子：先瞬时归一化（画面一样、看不见），再缓动 SNAP_MS */
  function snapToGrid() {
    const track = trackEl.current
    offset.current = normalize(offset.current)
    let target = Math.round(offset.current / step) * step
    if (target >= cycle) target -= cycle
    offset.current = target
    if (!track) return
    track.classList.add('dock__track--anim')
    paint()
    window.setTimeout(() => {
      track.classList.remove('dock__track--anim')
      /* 缓动结束后把内部值也收回 [0, cycle)，纯记账，画面不动 */
      offset.current = normalize(offset.current)
    }, SNAP_MS + 40)
  }

  /** 指针落在第几个图标上（没有就 null）：用布局位置算，不看 transform */
  function iconAtPoint(e: { clientX: number; clientY: number }): number | null {
    const view = viewEl.current
    if (!view || itemCount === 0) return null
    const rect = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? rect.top : rect.left)
    const off = normalize(offset.current)
    const i = Math.round((p + off - btn / 2) / step)
    const idx = ((i % itemCount) + itemCount) % itemCount
    /* 再确认指针真的压在某个图标上（点空白不进入换位） */
    const items = trackEl.current?.querySelectorAll<HTMLElement>('[data-dock-item]')
    const hit = items ? [...items].some((el) => {
      const r = el.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    }) : false
    return hit ? idx : null
  }

  function wheelDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const onIcon = iconAtPoint(e)
    gesture.current = {
      axisStart: alongOf(e),
      crossStart: crossOf(e),
      offsetStart: offset.current,
      onIcon,
      dragId: onIcon === null ? null : shownApps[onIcon],
      kind: null,
      to: onIcon ?? 0,
      clientX: e.clientX,
      clientY: e.clientY,
      captured: false,
    }
    lift.current = null
  }

  function wheelMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    const view = viewEl.current
    if (!g || !view) return
    g.clientX = e.clientX
    g.clientY = e.clientY
    const along = alongOf(e) - g.axisStart
    const cross = crossOf(e) - g.crossStart

    /* ⚠️ **一动就抓指针**（2px），不能等到判定出手势再抓：
       竖向拖到 44px 时指针早就离开图标区了（图标区才 60 多 px 高），
       没有捕获的话后续 pointermove 会派给底下的元素、根本回不到这里 ——
       表现就是"竖拖永远进不了移动模式"（实测踩过）。
       2px 门槛保证"只点一下"不会抓（抓了之后 click 会派给容器，见「坑 2」）。 */
    if (!g.captured && (Math.abs(along) >= 2 || Math.abs(cross) >= 2)) {
      view.setPointerCapture(e.pointerId)
      g.captured = true
    }

    /* 判定手势，一次拖动只判一次：
       沿轴动 4px 就是"浏览"；只有**按在图标上**且垂直位移超过 44px 才算"移动"。
       —— 用户明确要求：日常左右滑动不要误触发换位。 */
    if (!g.kind) {
      if (Math.abs(along) >= 4) g.kind = 'browse'
      else if (g.onIcon !== null && Math.abs(cross) >= MOVE_THRESHOLD) g.kind = 'move'
      else return
      if (g.kind === 'browse') trackEl.current?.classList.remove('dock__track--anim')
    }

    if (g.kind === 'browse') {
      schedulePaint(g.offsetStart - along)
      return
    }

    /* 移动模式：被拖的图标跟手；越过邻居中点就实时预览换位 */
    const items = trackEl.current?.querySelectorAll<HTMLElement>('[data-dock-item]')
    if (!items || !g.dragId) return
    const id = g.dragId
    const el = [...items].find((x) => x.dataset.dockItem === id && x.getAttribute('data-dock-copy') === '1')
    if (el) {
      if (!lift.current) {
        el.classList.add('dock__item--lift')
        lift.current = { el, id }
      }
      const rect = view.getBoundingClientRect()
      const pAlong = alongOf(e) - (vertical ? rect.top : rect.left)
      const pCross = crossOf(e) - (vertical ? rect.left : rect.top)
      const lAlong = (vertical ? el.offsetTop : el.offsetLeft) + btn / 2
      const lCross = (vertical ? el.offsetLeft : el.offsetTop) + btn / 2
      const off = normalize(offset.current)
      const dAlong = pAlong - (lAlong - off)
      const dCross = pCross - lCross
      el.style.transform = vertical
        ? `translate(${dCross}px, ${dAlong}px) scale(1.15)`
        : `translate(${dAlong}px, ${dCross}px) scale(1.15)`
      el.style.zIndex = '40'
    }

    /* 落点下标：指针位置换算成"第几个格子"。**要取模** —— 列表是循环的，
       把最后一个图标继续往右拖，落点应该是队首（第 0 个），不是卡在末尾 */
    const rect = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? rect.top : rect.left)
    const off = normalize(offset.current)
    const raw = Math.round((p + off - btn / 2) / step)
    const to = ((raw % itemCount) + itemCount) % itemCount
    if (to !== g.to) {
      g.to = to
      const order = [...(preview ?? shownApps)]
      const from = order.indexOf(id)
      if (from >= 0 && from !== to) {
        order.splice(from, 1)
        order.splice(to, 0, id)
        setPreview(order)
      }
    }
  }

  function wheelUp() {
    const g = gesture.current
    gesture.current = null
    if (lift.current) {
      lift.current.el.classList.remove('dock__item--lift')
      lift.current.el.style.transform = ''
      lift.current.el.style.zIndex = ''
      lift.current = null
    }
    if (!g) {
      paint()
      return
    }
    if (g.kind === 'browse') {
      snapToGrid()
      return
    }
    if (g.kind === 'move' && g.onIcon !== null && g.dragId) {
      /* 落盘：按下时它在 shownApps 里的下标 = g.onIcon，松手时它在预览顺序里的下标就是新位置。
         写回 desktop.dock.dockApps，刷新后还在。 */
      const toIdx = preview ? preview.indexOf(g.dragId) : g.onIcon
      if (toIdx >= 0 && toIdx !== g.onIcon) reorderDockApps(g.onIcon, toIdx)
    }
    setPreview(null)
    paint()
  }

  function wheelOnWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const d = vertical ? e.deltaY : e.deltaX || e.deltaY
    /* 滚轮 = 一格一格地浏览（方向与拖动一致）；落点本来就是整数格，吸附只是顺手归一化 */
    offset.current += (d > 0 ? 1 : -1) * step
    snapToGrid()
  }

  /* 轮盘：首帧与几何变化后重画一次。换了模式 / 位置 / 图标尺寸 / 列表顺序 / 长度厚度都要重画，
     否则 DOM 上留下的还是上一次的 transform。 */
  useEffect(() => {
    if (mode !== 'wheel') return
    paint()
    const view = viewEl.current
    if (!view) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(view)
    return () => ro.disconnect()
  }, [mode, position, btn, itemCount, length, thickness, preview, dockApps])

  /* 卸载时把没跑完的那一帧 rAF 收掉 */
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    },
    [],
  )

  /* 拖任意一条边或倒角改尺寸；双击恢复该边负责的那一维 */
  function startGrip(edge: ResizeEdge, e: React.PointerEvent<HTMLSpanElement>) {
    e.stopPropagation()
    const el = bar.current
    if (!el) return
    grip.current = {
      px: e.clientX,
      py: e.clientY,
      startT: vertical ? el.offsetWidth : el.offsetHeight,
      startL: vertical ? el.offsetHeight : el.offsetWidth,
      x: edge.x ? { dim: edge.x, sign: edge.signX } : null,
      y: edge.y ? { dim: edge.y, sign: edge.signY } : null,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onGrip(e: React.PointerEvent<HTMLSpanElement>) {
    const g = grip.current
    if (!g) return
    const { px, py, startT, startL, x, y } = g
    const viewport = { w: window.innerWidth, h: window.innerHeight }

    const apply = (axis: { dim: 't' | 'l'; sign: number }, delta: number) => {
      if (axis.dim === 't') {
        /* 厚度这一维贴边固定，拖多少就变多少 */
        setThickness(
          /* 下限跟着固定图标尺寸走，别让人拖到把图标裁掉 */
          clamp(startT + delta * axis.sign, minThickness, maxDockThickness(position, viewport)),
        )
      } else {
        /* 长度这一维是居中的，两边各长一半，所以被拖的那条边正好跟手 */
        setLength(
          clamp(startL + delta * axis.sign * 2, minLength, maxDockLength(position, viewport)),
        )
      }
    }

    if (x) apply(x, e.clientX - px)
    if (y) apply(y, e.clientY - py)
  }

  function endGrip() {
    grip.current = null
  }

  /* 位置用内联几何：tailwind 里没法按四个方向动态拼类名 */
  const barStyle: CSSProperties = {}
  if (vertical) {
    barStyle.top = '50%'
    barStyle.transform = 'translateY(-50%)'
    if (position === 'left') barStyle.left = DOCK_MARGIN
    else barStyle.right = DOCK_MARGIN
    barStyle.maxWidth = '12.5vw'
    barStyle.maxHeight = '75vh'
    if (length !== null) barStyle.height = length
    if (thickness !== null) barStyle.width = thickness
  } else {
    barStyle.left = '50%'
    barStyle.transform = 'translateX(-50%)'
    if (position === 'top') barStyle.top = DOCK_MARGIN
    else barStyle.bottom = DOCK_MARGIN
    barStyle.maxWidth = '87.5vw'
    barStyle.maxHeight = '25vh'
    if (length !== null) barStyle.width = length
    if (thickness !== null) barStyle.height = thickness
  }

  const menuButton = (
    <button
      type="button"
      style={btnStyle}
      title="所有项目"
      aria-label="所有项目"
      aria-expanded={menuOpen}
      onClick={() => {
        setMenuOpen((v) => !v)
        setPosOpen(false)
      }}
      className={`grid shrink-0 place-items-center rounded hover:bg-hover ${
        menuOpen ? 'bg-accent text-accent-ink' : 'text-chrome-ink'
      }`}
    >
      {/* 九宫格的画在 components/icons/glyphs/MenuGlyph.tsx */}
      <MenuGlyph className="h-1/2 w-1/2" />
    </button>
  )

  /* 一个应用图标按钮：两种模式共用。
     `copy`：1 = 正本（带无障碍名），2 = 循环用的副本。
     ⚠️ **副本绝不能带 `aria-label`**：两份同名按钮会让 Playwright 的
     `button[aria-label="博客"]` 一次命中两个，strict mode 直接报错 —— 两个验证脚本都会炸。
     副本同时 `aria-hidden` + `tabIndex=-1`，键盘与读屏只走正本。 */
  function iconButton(id: AppId, opts: { copy: 1 | 2; index: number; wheel: boolean }) {
    const app = getApp(id)
    const running = windows.some((w) => w.tabs.some((tab) => tab.id === app.id))
    const active = pathname === app.path || pathname.startsWith(`${app.path}/`)
    /* 芹菜耕地的说法：每个窗口是一样菜，提示里带上 */
    const label = `${app.name} · ${app.veggie}`
    const loop = opts.wheel

    return (
      <button
        key={`${opts.copy}-${app.id}`}
        type="button"
        style={btnStyle}
        title={label}
        /* ⚠️ 无障碍名**只用窗口名**：验证脚本（verify.mjs / verify-dst.mjs）都按
           `button[aria-label="博客"]` 这类选择器点按钮，往里塞"菜名"会把它们全弄坏。
           菜名放 title 与悬浮提示里。 */
        aria-label={opts.copy === 1 ? app.name : undefined}
        aria-hidden={loop && opts.copy === 2 ? true : undefined}
        tabIndex={loop && opts.copy === 2 ? -1 : undefined}
        aria-current={active ? 'page' : undefined}
        data-dock-item={loop ? app.id : undefined}
        data-dock-copy={loop ? String(opts.copy) : undefined}
        data-dock-index={loop ? opts.index : undefined}
        onClick={() => openApp(app.id)}
        onMouseEnter={(e) => showName(e.currentTarget, label)}
        onMouseLeave={() => setHover(null)}
        onFocus={(e) => showName(e.currentTarget, label)}
        onBlur={() => setHover(null)}
        className={`relative grid shrink-0 place-items-center rounded text-chrome-ink hover:bg-hover ${
          loop ? 'dock__item' : ''
        } ${active ? 'bg-accent text-accent-ink' : ''}`}
      >
        <AppIcon name={app.icon} className="h-1/2 w-1/2" />
        {running ? (
          <span
            className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent-ink"
            aria-hidden="true"
          />
        ) : null}
      </button>
    )
  }

  return (
    <nav
      ref={bar}
      aria-label="任务栏"
      style={barStyle}
      onMouseLeave={() => setHover(null)}
      /* justify-center：拖长任务栏后 bar 比内容宽，整组要居中（内容自适应宽度时没有富余空间，不受影响） */
      className={`absolute z-50 flex justify-center gap-1 rounded-dock border border-edge bg-chrome p-1.5 shadow-xl ${
        vertical ? 'flex-col items-center' : 'items-center'
      }`}
    >
      {/* 四边 + 四个倒角都可拖拽：拉离中心即变大 */}
      {resizeEdges(vertical).map((edge) => (
        <span
          key={edge.key}
          role="separator"
          aria-label="拖动边缘调整任务栏尺寸"
          title="拖动调整尺寸，双击恢复自适应"
          onPointerDown={(e) => startGrip(edge, e)}
          onPointerMove={onGrip}
          onPointerUp={endGrip}
          onPointerCancel={endGrip}
          onDoubleClick={() => {
            /* 双击任意边缘 = 回到最合适的自适应高宽（两维一起） */
            setThickness(null)
            setLength(null)
          }}
          style={{ cursor: edge.cursor }}
          className={`absolute z-10 ${edge.pos}`}
        />
      ))}

      {vertical ? null : menuButton}

      {mode === 'wheel' ? (
        /* ── 循环轮盘（默认）──
           视口里放**两份**背靠背的列表，offset 归一化到 [0, N*step)：往一个方向一直拖能绕回起点，
           永远不到头（也不会像滚动那样到头卡住）。中央放大按"离视口中心的距离"衰减。 */
        <div
          ref={viewEl}
          data-dock-view=""
          onPointerDown={wheelDown}
          onPointerMove={wheelMove}
          onPointerUp={wheelUp}
          onPointerCancel={wheelUp}
          onWheel={wheelOnWheel}
          style={{
            /* length 定了就吃掉剩余空间，没定就按内容（= 装下所有图标，超了由循环补） */
            flex: length === null ? '0 0 auto' : '1 1 auto',
            ...(vertical ? { height: viewLen } : { width: viewLen }),
            ['--dock-spill' as string]: `${spill}px`,
          }}
          className={`dock__view ${vertical ? 'dock__view--v' : 'dock__view--h'}`}
        >
          <div
            ref={trackEl}
            data-dock-track=""
            style={{ gap: GAP }}
            className={`dock__track ${vertical ? 'dock__track--v' : ''}`}
          >
            {[1, 2].map((copy) =>
              (preview ?? shownApps).map((id, i) =>
                iconButton(id, { copy: copy === 1 ? 1 : 2, index: i, wheel: true }),
              ),
            )}
          </div>
        </div>
      ) : (
        /* ── 折行（wrap）：**完全旧行为**，一个字都没改（最多 3 行、静态、不放大、无拖拽手势）──
           只显示放得下的按钮，其余靠拖动/滚轮查看 */
        <div
          ref={scroller}
          onPointerDown={wrapStartDrag}
          onPointerMove={wrapOnDrag}
          onPointerUp={wrapEndDrag}
          onPointerCancel={wrapEndDrag}
          onWheel={wrapOnWheel}
          /* 视口本身不设 justify/align —— 居中交给里面那层用 m-auto。
             滚动容器上直接写 justify-center 时，内容一旦超出，超出的那一侧会落到
             滚动原点之外：滚轮和拖动都永远够不到（小任务栏时最左 / 最上的图标就是这么丢的）。
             max-h/max-w 卡住交叉轴，装不下就在容器内滚，绝不顶出任务栏 */
          className={`no-scrollbar flex min-h-0 min-w-0 max-h-full max-w-full ${
            length !== null ? 'flex-1' : ''
          } ${vertical ? 'flex-col overflow-y-auto' : 'overflow-x-auto'}`}
        >
          {/* m-auto 两头都管：有富余就居中，真超出时自动变 0，内容从滚动原点开始，两端都够得到 */}
          <div
            style={itemsStyle}
            className={`m-auto flex shrink-0 gap-1 ${lines > 1 ? 'flex-wrap' : 'flex-nowrap'} ${
              vertical ? 'flex-col' : ''
            }`}
          >
            {shownApps.map((id, i) => iconButton(id, { copy: 1, index: i, wheel: false }))}
          </div>
        </div>
      )}

      {vertical ? menuButton : null}

      {/* 全屏按钮：固定在任务栏上，和「任务栏位置」并排（设置窗口里也有一个） */}
      <FullscreenButton style={btnStyle} />

      {/* 位置按钮：点开后保持展开 */}
      <div ref={posWrap} className="relative shrink-0">
        <button
          type="button"
          style={btnStyle}
          title="任务栏位置"
          aria-label="任务栏位置"
          aria-haspopup="menu"
          aria-expanded={posOpen}
          onClick={() => {
            setPosOpen((v) => !v)
            setMenuOpen(false)
          }}
          className={`grid place-items-center rounded hover:bg-hover ${
            posOpen ? 'bg-accent text-accent-ink' : 'text-chrome-ink'
          }`}
        >
          <PositionGlyph position={position} className="h-1/2 w-1/2" />
        </button>

        <DockPositionMenu
          open={posOpen}
          position={position}
          onPick={(next) => {
            setPosition(next)
            setPosOpen(false)
          }}
        />
      </div>

      {/* 悬停名称浮层：放在滚动容器外，才不会被裁掉 */}
      {hover ? (
        <span
          role="tooltip"
          style={hoverStyle(hover)}
          className="pointer-events-none absolute z-50 whitespace-nowrap rounded border border-edge bg-surface px-2 py-1 text-[11px] text-ink shadow-lg"
        >
          {hover.name}
        </span>
      ) : null}

      <StartMenu open={menuOpen} position={position} onClose={closeMenu} />
    </nav>
  )
}
