import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, visibleApps } from '../../lib/apps'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import {
  DOCK_BORDER as BORDER,
  DOCK_GAP as GAP,
  DOCK_ICON_FILL,
  DOCK_MARGIN,
  DOCK_PAD as PAD,
  DOCK_THICKNESS,
  MAGNIFY_EXP,
  MAGNIFY_MIN,
  MAGNIFY_PEAK,
  MAGNIFY_RADIUS_SLOTS,
  MOVE_THRESHOLD,
  SPRING_DAMPING,
  SPRING_STIFFNESS,
  dampedOffset,
  dockMaxOffset,
  dockMinLength,
  dockStep,
  isVertical,
  maxDockLength,
  maxDockThickness,
  wheelChrome,
  wheelViewMin,
  wrapLines,
  wrapPerLine,
  wrapSideGap,
} from '../../lib/dock'
import type { AppId } from '../../types/desktop'
import { MenuGlyph } from '../icons'
import { AppIcon } from './AppIcon'
import { StartMenu } from './StartMenu'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/* 任务栏上的应用图 = **功能图标**（`components/icons/**`）。
   ⚠️ 2026-10-05 站主曾要求"全部换成蔬菜水果图"，2026-10-06「一切以 macOS 为准」把那条撤了：
   彩色菜图与 macOS 那套圆角单色图标**观感直接冲突**，所以菜图让位、回功能图标。
   ⚠️ **菜地身份一个字都没删**：`SITE.name` / `AppDef.veggie` / `lib/veggies.ts`（48 张菜图）
   全部留在代码里备着（站主原话："菜地名称就保留在文件里面就好，等日后或再优化使用"），
   菜图现在只出现在开始菜单与关于窗口，见 `lib/veggies.ts` 的 `dishRows()`。 */
function appGlyph(id: AppId, className: string) {
  const app = getApp(id)
  return <AppIcon name={app.icon} className={className} />
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
    setLength,
    setThickness,
    reorderDockApps,
  } = useDock()
  const { windows, dispatch } = useWindows()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hover, setHover] = useState<HoverState | null>(null)
  const bar = useRef<HTMLElement | null>(null)
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
  /** 松手回弹的弹簧动画句柄（用 rAF 自己积分，见 settle：不引动画依赖） */
  const springRaf = useRef(0)
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
  /* ── 放大是**指针驱动**的（macOS 的真实行为：谁离指针近谁最大）────────────────
     `pos`：指针在图标区**主轴上的视口坐标**（null = 指针不在图标区上）；
     `fade` / `target`：整体强度 0~1 的平滑量 —— 指针进来推到 1、离开推回 0，
     于是"指针不在 Dock 上时图标全部回到 1×"，而且是**渐变**过去不是突跳。
     ⚠️ 只走 ref，不进 React 状态（每帧 setState 会把图标区整棵子树重渲，手感会飘）。 */
  const pointer = useRef<{ pos: number | null; fade: number; target: number; last: number }>({
    pos: null,
    fade: 0,
    target: 0,
    last: 0,
  })
  /* 换位预览：只有"越过邻居中点"这种离散事件才 setState（每帧不动 state） */
  const [preview, setPreview] = useState<AppId[] | null>(null)
  /* 拖拽幽灵（站主报的 bug：拖出去的图标被图标区裁掉、看不见了）。它是**浮层**，
     挂在 `document.body` 上（见下面的 createPortal）—— 图标区现在带 `clip-path`，
     放进去会被一起裁掉。`ghost` 只在"进入移动模式/松手"这种离散时刻变，跟手靠 ref 直接改 transform。 */
  const [ghost, setGhost] = useState<AppId | null>(null)
  const ghostEl = useRef<HTMLDivElement | null>(null)

  /* 图标边长：设置里选过就用选的，否则跟随厚度；跟随厚度时超过上限不再变大，富余厚度改成多行 */
  const autoBtn = clamp((thickness ?? DOCK_THICKNESS) - (PAD + BORDER) * 2, 28, BTN_MAX)
  /* 手动选了尺寸就以它为准；范围与设置里的档位一致（32~64） */
  const btn = Math.round(iconSize === null ? autoBtn : clamp(iconSize, 32, 64))
  const btnStyle: CSSProperties = { width: btn, height: btn }

  /* 长度下限：**两种模式共用一个值**（见 lib/dock 的 dockMinLength）——
     以前按模式各算各的，同一个存档 length 在两种模式下渲染出的宽度不同，切模式时任务栏
     会突然缩短、图标被挤到滚动区外面，看着像"图标消失"（站主 2026-10-05 报的 bug）。 */
  const minLength = dockMinLength(btn)
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
  /* 折行要补在主轴起点的内边距：两端固定按钮不对称（起点一颗、终点两颗），
     不补的话图标块中线比任务栏中线偏左 22px（站主报的"往左偏"）。见 lib/dock 的 wrapSideGap */
  /* 折行时两端固定按钮**不对称**（横排只有左端一颗「所有项目」、竖排在末端），
     图标块会在"两端之间的可用框"里居中 → 中线天生偏一点。
     `wrapSideGap` 返回**带符号**的补偿量：正数补起点、负数补终点（见它的注释）。
     ⚠️ 用内边距、不是 margin：内边距同时缩小了"用于居中的空闲"，这才是它正好抵消的原因。 */
  const sideGap = mode === 'wrap' ? wrapSideGap(btn, vertical) : 0
  const padStart = Math.max(0, sideGap)
  const padEnd = Math.max(0, -sideGap)
  const itemsStyle: CSSProperties = {
    /* safe center：装得下时每行居中、**装不下时退化成 start**（左边不会被推到滚动原点之外，
       起点那几个图标照样看得见、够得到）—— 这正是折行要的语义。
       ⚠️ 别写成裸 center：溢出时两端同时溢出，左边那半截既看不见也滚不到（坑 5） */
    justifyContent: 'safe center',
  }
  if (mode === 'wrap' && lines > 1 && itemCount > 0) {
    if (vertical) itemsStyle.height = lineSize
    else itemsStyle.width = lineSize
  }

  /* 切模式 / 改几何之后把折行的滚动位置**归零**：
     轮盘与折行是同一个 <div> 节点（React 复用），实测 wheel → wrap 之后 scrollLeft 还留着 200，
     图标看着就是"往左偏"、起点那几个还够不到。归零之后装得下时正好落在居中态。 */
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = 0
    el.scrollTop = 0
  }, [mode, length, position, btn, vertical, itemCount])

  /* ── 轮盘模式的几何 ──
     step = 相邻图标中心距；图标区长度 = 给多少算多少（length === null 时按"装下所有图标"自适应，
     再被 bar 的 87.5vw 上限挤一下，挤掉的部分正好靠循环补上）。
     可视长度至少 3 个图标位：再小，中央放大出来的图标会被裁掉一半 */
  const step = dockStep(btn)
  const chromeLen = wheelChrome(btn)
  const viewMin = wheelViewMin(btn)
  const autoView = Math.max(viewMin, itemCount * step - GAP)
  const viewLen = length === null ? autoView : Math.max(viewMin, length - chromeLen)
  /* ⚠️ 这里**不再有**"交叉轴溢出余量"（原 `--dock-spill` + 负外边距那套）：站主要的是
     "放大的图标从任务栏边**凸出去**"（macOS 那种夸张感），所以图标区交叉轴不裁（见 globals.css
     的 `.dock__view--h/--v`：`clip-path` 只裁主轴），2× 的图标自然凸在栏外，不需要预留空间。
     任务栏厚度照旧 = 1× 图标 + 内边距。 */

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* 打开任何窗口就收起菜单 */
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  /* 面板点开后就保持展开：只有按 Esc、点别处、或换页才收起 */
  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (menuOpen && !bar.current?.contains(target)) setMenuOpen(false)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
  /* ── 图标区的范围（macOS 回弹，2026-10-06）──
     ⚠️ 这里原来是"循环"：渲染两份列表 + `offset` 取模归一化到 [0, cycle)，
     往一个方向一直拖能绕回起点。站主改口「跟随 macOS 改成回弹，一切以 macOS 为准」，
     所以现在**有头有尾**：`offset` 夹在 [0, maxOffset]，越界只给阻尼、松手弹回端点。
     `maxOffset === 0`（装得下）= 根本不可拖，也不该有回弹。 */
  const maxOffset = dockMaxOffset(itemCount, step, viewLen)
  const canDrag = maxOffset > 1
  /** 橡皮筋最多能多拉出去多少（= 视口的 25%）：拖动的原始值夹在这里，再远没有意义 */
  const rubberDim = viewLen * 0.25
  const clampRaw = (v: number) => clamp(v, -rubberDim * 1.5, maxOffset + rubberDim * 1.5)
  const alongOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientY : e.clientX)
  const crossOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientX : e.clientY)

  /** 按当前 offset 与**指针位置**把 track 与每个图标的 scale 画出来。
   *  画的是 `dampedOffset()`：界内原样、越界按苹果的橡皮筋公式衰减（拉 100px 实移不到 100px）。
   *
   *  放大 = **指针驱动**（macOS）：`u = clamp(|图标中心 − 指针| / (RADIUS_SLOTS × step), 0, 1)`、
   *  `scale = 1 + (PEAK − 1) · (1 − u^EXP) · fade`。
   *  - 指针正对的那个图标 ≈ 2×（`u = 0`）；
   *  - 两侧按指数递减，3 格之外回 1.0×；
   *  - `fade` 是整体强度：指针不在图标区上时为 0 → **所有图标都是 1×**（macOS 的 Dock 就是这样，
   *    没有指针扫过时图标不放大）。它由 `tick()` 平滑推进，进/出都是渐变、不突跳。
   *
   *  ⚠️ 2026-10-06 之前是"按图标区**几何中心**"的固定鱼眼（指针在哪儿都放大中间那几个），
   *  那不是 macOS 的行为 —— 已按「一切以 macOS 为准」改成指针驱动，别改回去。 */
  function paint() {
    const view = viewEl.current
    const track = trackEl.current
    if (!view || !track) return
    const off = dampedOffset(offset.current, maxOffset, viewLen)
    track.style.transform = vertical ? `translate3d(0, ${-off}px, 0)` : `translate3d(${-off}px, 0, 0)`
    const items = [...track.querySelectorAll<HTMLElement>('[data-dock-item]')]
    if (!items.length) return
    const { pos, fade } = pointer.current
    const radius = Math.max(1, MAGNIFY_RADIUS_SLOTS * step)
    items.forEach((el) => {
      /* 正在被拖走换位的那个不动它（它已经淡出当占位，跟手的是浮层幽灵） */
      if (lift.current && lift.current.el === el) return
      let s = 1
      if (pos !== null && fade > 0.002) {
        /* 图标中心在**视口坐标**里的位置：布局位置减掉当前偏移 */
        const c = (vertical ? el.offsetTop : el.offsetLeft) + el.offsetWidth / 2 - off
        const u = clamp(Math.abs(c - pos) / radius, 0, 1)
        s = 1 + (MAGNIFY_PEAK - MAGNIFY_MIN) * (1 - Math.pow(u, MAGNIFY_EXP)) * fade
      }
      if (Math.abs(s - 1) > 0.001) {
        el.style.transform = `scale(${s.toFixed(3)})`
        /* 越大的越靠前，免得被邻居压住（指针正对的那个 z 最高） */
        el.style.zIndex = String(1 + Math.round((s - 1) * 20))
      } else {
        el.style.transform = ''
        el.style.zIndex = ''
      }
    })
  }

  /* 放大强度的平滑推进 + 重画。⚠️ **只用 `raf.current` 这一个 rAF 槽**（拖动与强度共用），
     不开第二条循环：谁先要一帧谁排，进来时若已有帧在排队就直接返回。
     `dt` 用真实时间，时间常数 ~90ms —— 指针扫过时图标"跟着鼓起来"，离开时平滑回落。 */
  function tick() {
    const pt = pointer.current
    const now = performance.now()
    const dt = pt.last ? Math.min(0.05, Math.max(0.001, (now - pt.last) / 1000)) : 0.016
    pt.last = now
    pt.fade += (pt.target - pt.fade) * Math.min(1, dt / 0.09)
    const settled = Math.abs(pt.target - pt.fade) < 0.004
    if (settled) pt.fade = pt.target
    paint()
    if (settled) {
      raf.current = 0
    } else {
      raf.current = requestAnimationFrame(tick)
    }
  }
  function scheduleTick() {
    if (raf.current) return
    pointer.current.last = 0
    raf.current = requestAnimationFrame(tick)
  }

  /** 拖动中每帧只排一次 rAF（和放大强度**共用同一个槽**，不开第二条循环） */
  function schedulePaint(next: number) {
    offset.current = clampRaw(next)
    scheduleTick()
  }

  /* 松手 / 滚轮之后**回弹到界内**（macOS 滚动视图的行为）：
     - 越界了 → 弹簧弹回端点（`SPRING_STIFFNESS/DAMPING` 就是 playground-macos DockItem 那组 1700/90，
       我们**不引依赖**，用同样的 k/c 自己积分。ζ = c/(2√k) ≈ 1.09 → 略过阻尼，不过冲，实测 ~100ms 落位）；
     - 界内 → **不吸附到格子**（macOS 的 Dock 是滚动视图，图标跟着指针停在任意位置），只是夹一次。 */
  function stopSpring() {
    if (springRaf.current) {
      cancelAnimationFrame(springRaf.current)
      springRaf.current = 0
    }
  }

  function settle(target = clamp(offset.current, 0, maxOffset)) {
    stopSpring()
    const from = offset.current
    if (Math.abs(target - from) < 0.5) {
      offset.current = target
      paint()
      return
    }
    let x = from
    let v = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000))
      last = now
      /* k 很大（1700），60Hz 下单步会飘 —— 按 8ms 子步进积分，稳一点 */
      const steps = Math.max(1, Math.ceil((dt * 1000) / 8))
      const h = dt / steps
      for (let i = 0; i < steps; i += 1) {
        const a = -SPRING_STIFFNESS * (x - target) - SPRING_DAMPING * v
        v += a * h
        x += v * h
      }
      offset.current = x
      paint()
      if (Math.abs(x - target) < 0.5 && Math.abs(v) < 8) {
        offset.current = target
        paint()
        springRaf.current = 0
        return
      }
      springRaf.current = requestAnimationFrame(frame)
    }
    springRaf.current = requestAnimationFrame(frame)
  }

  /** 指针落在第几个图标上（没有就 null）：用布局位置算，不看 transform。
   *  ⚠️ 循环拆掉之后**不再取模**：下标夹在 [0, itemCount-1]（列表有头有尾，最后一个就是最后一个）。 */
  function iconAtPoint(e: { clientX: number; clientY: number }): number | null {
    const view = viewEl.current
    if (!view || itemCount === 0) return null
    const rect = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? rect.top : rect.left)
    const raw = Math.round((p + offset.current - btn / 2) / step)
    const idx = clamp(raw, 0, itemCount - 1)
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
    /* 手一按下去就掐掉还在跑的回弹，否则跟手会和弹簧打架（macOS 也是"一碰就停"） */
    stopSpring()
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

  /** 指针离开图标区：**只把放大强度的目标置 0**（图标平滑回 1×）。
   *  ⚠️ 这里绝不碰 `offset` / `lift` / 手势状态机 —— 拖动中指针跑远时也会触发 leave，
   *  误动那些就会把"竖拖换位"与幽灵弄坏（上一版就是先红在这两条上）。 */
  function wheelLeave() {
    if (gesture.current) return
    pointer.current.pos = null
    pointer.current.target = 0
    scheduleTick()
  }

  function wheelMove(e: React.PointerEvent<HTMLDivElement>) {
    const view = viewEl.current
    /* ① 指针位置 → 放大中心（**必须在"有没有手势"的判断之前**：鼠标只悬停、没按键也要放大）。
       `pos` 用主轴上的**视口坐标**，和 paint() 里算图标中心时同一套坐标系。 */
    if (view) {
      const rect = view.getBoundingClientRect()
      pointer.current.pos = alongOf(e) - (vertical ? rect.top : rect.left)
      pointer.current.target = 1
      scheduleTick()
    }
    const g = gesture.current
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
    }

    if (g.kind === 'browse') {
      schedulePaint(g.offsetStart - along)
      return
    }

    /* 移动模式：原位置那个**淡出当占位**，跟手的实体是挂在 `document.body` 上的浮层幽灵。
       图标区现在带 `clip-path`（只裁主轴、交叉轴允许凸出），图标本体留在里面一拖出栏外
       就会被裁掉看不见 —— 这就是站主报的那个 bug。 */
    const items = trackEl.current?.querySelectorAll<HTMLElement>('[data-dock-item]')
    if (!items || !g.dragId) return
    const id = g.dragId
    const el = [...items].find((x) => x.dataset.dockItem === id)
    if (el && !lift.current) {
      el.classList.add('dock__item--lift')
      lift.current = { el, id }
      setGhost(id)
    }
    /* 跟手：只写一个元素的 transform（固定定位 + translate 到指针），不进 React 状态 */
    const ge = ghostEl.current
    if (ge) {
      ge.style.transform = `translate3d(${Math.round(e.clientX - btn / 2)}px, ${Math.round(
        e.clientY - btn / 2,
      )}px, 0)`
    }

    /* 落点下标：指针位置换算成"第几个格子"，夹在 [0, itemCount-1]。
       ⚠️ 以前这里要取模（列表是循环的，拖过最后一个绕回队首）；循环拆掉之后**不绕**了 ——
       拖到两端就是两端（macOS 的 Dock 有头有尾）。 */
    const rect = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? rect.top : rect.left)
    const raw = Math.round((p + offset.current - btn / 2) / step)
    const to = clamp(raw, 0, itemCount - 1)
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

  function wheelUp(e?: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    gesture.current = null
    /* 浏览/换位时常常已经拖到图标区外面（指针被捕获了，收不到 pointerleave）：
       松手这一刻按真实坐标复位放大强度，否则图标会停在"放大着"的状态。 */
    const upView = viewEl.current
    if (upView && e) {
      const r = upView.getBoundingClientRect()
      const inside =
        e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2
      pointer.current.pos = inside ? alongOf(e) - (vertical ? r.top : r.left) : null
      pointer.current.target = inside ? 1 : 0
      scheduleTick()
    }
    if (lift.current) {
      lift.current.el.classList.remove('dock__item--lift')
      lift.current.el.style.transform = ''
      lift.current.el.style.zIndex = ''
      lift.current = null
    }
    /* 收掉浮层幽灵（松手或取消都一样） */
    setGhost(null)
    if (!g) {
      paint()
      return
    }
    if (g.kind === 'browse') {
      /* 松手：界内就停在那儿（macOS 的 Dock 不吸附到格子），越界由弹簧弹回端点 */
      settle()
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
    /* 装得下就没什么可滚的（macOS 的 Dock 这时是静止的，不该动） */
    if (!canDrag) return
    const d = vertical ? e.deltaY : e.deltaX || e.deltaY
    /* 滚轮 = 一格一格地走；收尾用同一根弹簧（和拖动松手回弹同一套手感） */
    settle(clamp(offset.current + (d > 0 ? 1 : -1) * step, 0, maxOffset))
  }

  /* 轮盘：首帧与几何变化后重画一次。换了模式 / 位置 / 图标尺寸 / 列表顺序 / 长度厚度都要重画，
     否则 DOM 上留下的还是上一次的 transform。 */
  useEffect(() => {
    if (mode !== 'wheel') return
    /* 几何一变，原来的 offset 可能已经越界（比如任务栏拖长了）—— 夹回界内再画 */
    offset.current = clamp(offset.current, 0, maxOffset)
    paint()
    const view = viewEl.current
    if (!view) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(view)
    return () => {
      ro.disconnect()
      stopSpring()
    }
  }, [mode, position, btn, itemCount, length, thickness, preview, dockApps, maxOffset])

  /* 幽灵一出现就先摆到当前指针位置：否则要等下一个 pointermove 才跟手，
     中间那一帧它会停在左上角（浮层默认位置）闪一下。 */
  useEffect(() => {
    if (!ghost) return
    const g = gesture.current
    const el = ghostEl.current
    if (!g || !el) return
    el.style.transform = `translate3d(${Math.round(g.clientX - btn / 2)}px, ${Math.round(
      g.clientY - btn / 2,
    )}px, 0)`
  }, [ghost, btn])

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

  /* 图标区的内联几何 + 图标填充比。
     `--dock-icon-fill` 挂在这一层 → 整棵子树继承，`.dock__glyph` 读它定图标大小
     （默认 40px 按钮里约 29px；原来 `h-1/2 w-1/2` 只有 20px，见 lib/dock 的 DOCK_ICON_FILL）。
     ⚠️ 自定义属性不在 `CSSProperties` 的类型里，所以要 `as unknown as`（TS 只允许这样绕）。 */
  const wheelViewStyle = {
    /* length 定了就吃掉剩余空间，没定就按内容（= 装下所有图标） */
    flex: length === null ? '0 0 auto' : '1 1 auto',
    ...(vertical ? { height: viewLen } : { width: viewLen }),
    '--dock-icon-fill': `${DOCK_ICON_FILL * 100}%`,
  } as unknown as CSSProperties

  const menuButton = (
    <button
      type="button"
      style={btnStyle}
      title="所有项目"
      aria-label="所有项目"
      aria-expanded={menuOpen}
      onClick={() => {
        setMenuOpen((v) => !v)
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
     ⚠️ `data-dock-copy` **恒为 "1"**：这属性是"渲染两份循环列表"那个年代留下的，现在只剩一份，
     但 `verify.mjs` 里有近十处选择器用它（`[data-dock-item][data-dock-copy="1"]`），
     所以**保留成稳定挂钩**，不再有 `copy === 2` 那种分支。 */
  function iconButton(id: AppId, opts: { index: number; wheel: boolean }) {
    const app = getApp(id)
    const running = windows.some((w) => w.tabs.some((tab) => tab.id === app.id))
    const active = pathname === app.path || pathname.startsWith(`${app.path}/`)
    /* 芹菜耕地的说法：每个窗口是一样菜，提示里带上（菜名留着，只是不再当图标） */
    const label = `${app.name} · ${app.veggie}`
    const loop = opts.wheel

    return (
      <button
        key={app.id}
        type="button"
        style={btnStyle}
        title={label}
        /* ⚠️ 无障碍名**只用窗口名**：验证脚本（verify.mjs / verify-dst.mjs）都按
           `button[aria-label="博客"]` 这类选择器点按钮，往里塞"菜名"会把它们全弄坏。
           菜名放 title 与悬浮提示里。 */
        aria-label={app.name}
        aria-current={active ? 'page' : undefined}
        data-dock-item={loop ? app.id : undefined}
        data-dock-copy={loop ? '1' : undefined}
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
        {/* 图标区（wheel）用 `.dock__glyph`（占按钮 72%，macOS 那种填满格子）；
            折行（wrap）仍是 `h-1/2 w-1/2` —— 那是它的旧观感，按规矩不动。 */}
        {appGlyph(app.id, loop ? 'dock__glyph' : 'h-1/2 w-1/2')}
        {running ? (
          <span
            /* 正在跑的小圆点（macOS 的 4px 指示点）：未运行时**不渲染**，所以不占位。
               底色跟着"有没有被选中"走，两个都是**面向前景**的令牌，两套主题都不会糊。 */
            className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
              active ? 'bg-accent-ink' : 'bg-chrome-ink'
            }`}
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
      /* justify-center：拖长任务栏后 bar 比内容宽，整组要居中（内容自适应宽度时没有富余空间，不受影响）
         底板走 `.dock__panel`（macOS：半透明 + blur 40 + 描边 + 圆角 12 + 投影），颜色全在令牌里 */
      className={`dock__panel absolute z-50 flex justify-center gap-1 p-1.5 ${
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
        /* ── 图标区（默认）：macOS 的观感与行为（2026-10-06「一切以 macOS 为准」）──
           **有头有尾**：只渲染**一份**列表，`offset` 夹在 [0, maxOffset]，越界给橡皮筋阻尼、
           松手用弹簧弹回端点；中央放大峰 2×、边缘回到 1.0×（macOS 不缩边缘图标）。
           ⚠️ 原来是"循环"（两份列表 + 取模归一化），已拆掉 —— 别再改回来，回归断言在 verify 14b/14d。 */
        <div
          /* key 让两种模式**各用各的 DOM 节点**：轮盘与折行整棵子树结构不同，但外层都是 <div>，
             不给 key 时 React 会**复用同一个节点**并把它的 `scrollLeft` 一起带过去 ——
             实测 wheel → wrap 之后残留 110，图标看着往左偏（站主报的"往左偏"里有一半是这个） */
          key="wheel"
          ref={viewEl}
          data-dock-view=""
          /* 停靠方向挂在这儿，给 CSS 用来设放大原点（`globals.css` 里 `[data-dock-pos]` 那几条）：
             原点贴在**栏那一侧**的边上，2× 的图标就把整个增量都长到栏外（见那几条的注释） */
          data-dock-pos={position}
          onPointerDown={wheelDown}
          onPointerMove={wheelMove}
          onPointerLeave={wheelLeave}
          onPointerUp={wheelUp}
          onPointerCancel={wheelUp}
          onWheel={wheelOnWheel}
          style={wheelViewStyle}
          className={`dock__view ${vertical ? 'dock__view--v' : 'dock__view--h'}`}
        >
          <div
            ref={trackEl}
            data-dock-track=""
            style={{ gap: GAP }}
            className={`dock__track ${vertical ? 'dock__track--v' : ''}`}
          >
            {/* ⚠️ **只渲染一份**（循环拆掉之后不再需要背靠背的第二份）。
                这也顺手解决了一个老坑：两份同名按钮会让 `button[aria-label="博客"]` 一次命中两个、
                Playwright strict mode 直接报错 —— 现在每个应用只有一颗按钮。 */}
            {(preview ?? shownApps).map((id, i) => iconButton(id, { index: i, wheel: true }))}
          </div>
        </div>
      ) : (
        /* ── 折行（wrap）：**完全旧行为**，一个字都没改（最多 3 行、静态、不放大、无拖拽手势）──
           只显示放得下的按钮，其余靠拖动/滚轮查看 */
        <div
          key="wrap"
          ref={scroller}
          onPointerDown={wrapStartDrag}
          onPointerMove={wrapOnDrag}
          onPointerUp={wrapEndDrag}
          onPointerCancel={wrapEndDrag}
          onWheel={wrapOnWheel}
          /* 主轴两端按需补内边距（哪边固定按钮少就补哪边，见 wrapSideGap）——它只是内边距，
             既能让装得下时图标块居中，又不会把内容推到滚动原点之外 */
          style={
            padStart || padEnd
              ? vertical
                ? { paddingTop: padStart, paddingBottom: padEnd }
                : { paddingLeft: padStart, paddingRight: padEnd }
              : undefined
          }
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
            {shownApps.map((id, i) => iconButton(id, { index: i, wheel: false }))}
          </div>
        </div>
      )}

      {vertical ? menuButton : null}

      {/* ⚠️ 2026-10-06（macOS P2）：这里**原本**还有「全屏 ⛶」与「任务栏位置」两颗固定按钮，
          现在都挪进顶部菜单栏了（macOS 的 Dock 两端只有启动台与废纸篓，没有这类系统按钮）。
          任务栏这一侧只剩左端的「所有项目」（≈ 启动台）。别把这两颗加回来。 */}

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

      {/* 拖拽幽灵：被拖走的那个图标本体。
          ⚠️ 它**必须挂在外壳层（`document.body` 的浮层）**，不能放进图标区 ——
          图标区带 `clip-path`，会成为后代的包含块，放进去一拖出栏外就被裁掉（站主报的 bug）。
          `pointer-events: none`：它不挡窗口 / 任务栏的任何点击；z 比任务栏高，拖着的时候看得见。 */}
      {ghost
        ? createPortal(
            <div
              ref={ghostEl}
              data-dock-ghost={ghost}
              style={{ width: btn, height: btn }}
              className="dock__ghost grid place-items-center"
            >
              {appGlyph(ghost, 'h-full w-full')}
            </div>,
            document.body,
          )
        : null}

      <StartMenu open={menuOpen} position={position} onClose={closeMenu} />
    </nav>
  )
}
