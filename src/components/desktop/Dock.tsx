import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, visibleApps } from '../../lib/apps'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import {
  DOCK_BORDER as BORDER,
  DOCK_GAP as GAP,
  DOCK_MARGIN,
  DOCK_MIN_LENGTH,
  DOCK_PAD as PAD,
  DOCK_THICKNESS,
  isVertical,
  maxDockLength,
  maxDockThickness,
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
const MAX_LINES = 3

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
    setPosition,
    setLength,
    setThickness,
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

  /* 图标边长：设置里选过就用选的，否则跟随厚度；跟随厚度时超过上限不再变大，富余厚度改成多行 */
  const autoBtn = clamp((thickness ?? DOCK_THICKNESS) - (PAD + BORDER) * 2, 28, BTN_MAX)
  /* 手动选了尺寸就以它为准；范围与设置里的档位一致（32~64） */
  const btn = Math.round(iconSize === null ? autoBtn : clamp(iconSize, 32, 64))
  const btnStyle: CSSProperties = { width: btn, height: btn }

  /* 长度下限：至少要装得下两端固定的三个按钮（开始 / 全屏 / 位置）+ 一个图标。
     低于这个值时它们会被顶出任务栏边界（原来的 DOCK_MIN_LENGTH = 140 就装不下 3×40） */
  const minLength = Math.max(DOCK_MIN_LENGTH, btn * 4 + GAP * 3 + (PAD + BORDER) * 2)
  /* 拖过长度就按它来，但不允许小于下限；length === null 表示"跟着按钮自适应" */
  const length = rawLength === null ? null : Math.max(rawLength, minLength)

  /* 当前厚度能塞下几行（竖排时是几列），最多 3 */
  const crossAvail = (thickness ?? DOCK_THICKNESS) - (PAD + BORDER) * 2
  const lines = Math.round(clamp(Math.floor((crossAvail + GAP) / (btn + GAP)), 1, MAX_LINES))

  /* 本机专属的窗口（DSH）在线上不挂载：任务栏里也不该露出来，折行计算同样按"看得到的"来 */
  const shownApps = dockApps.filter((id) => visibleApps().some((app) => app.id === id))

  /* 多行时给内层一个主轴上限，折行才会发生（内层才是 flex 容器）。
     注意不能只在 length === null 时加 —— 那样拖过长度的任务栏就永远只有一条，只能在一条里滚 */
  const itemCount = shownApps.length
  const perLine = Math.max(1, Math.ceil(itemCount / lines))
  const lineSize = perLine * btn + (perLine - 1) * GAP
  const itemsStyle: CSSProperties = {}
  if (lines > 1 && itemCount > 0) {
    if (vertical) itemsStyle.height = lineSize
    else itemsStyle.width = lineSize
  }

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
    const win = windows.find((w) => w.id === id)
    if (win?.minimized) dispatch({ type: 'restore', id })
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

  /* 工具条放不下时：按住拖动即可横滑（竖排即竖滑），滚轮同样可用。
     注意：这里**不能**在 pointerdown 就 setPointerCapture —— 那会把 pointerup 改派到
     容器，滚动容器里按钮的 click 就永远不会触发（点不动应用）。等真拖出 4px 再抓。 */
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
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

  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
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

  function endDrag() {
    drag.current = null
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scroller.current
    if (!el) return
    if (vertical) el.scrollTop += e.deltaY
    else el.scrollLeft += e.deltaY
  }

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

      {/* 只显示放得下的按钮，其余靠拖动/滚轮查看 */}
      <div
        ref={scroller}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
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
          {shownApps
            .map((id) => {
              const app = getApp(id)
              const running = windows.some((w) => w.id === app.id)
              const active = pathname === app.path || pathname.startsWith(`${app.path}/`)
              /* 芹菜耕地的说法：每个窗口是一样菜，提示里带上 */
              const label = `${app.name} · ${app.veggie}`

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
                  onClick={() => openApp(app.id)}
                  onMouseEnter={(e) => showName(e.currentTarget, label)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => showName(e.currentTarget, label)}
                  onBlur={() => setHover(null)}
                  className={`relative grid shrink-0 place-items-center rounded text-chrome-ink hover:bg-hover ${
                    active ? 'bg-accent text-accent-ink' : ''
                  }`}
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
            })}
        </div>
      </div>

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
