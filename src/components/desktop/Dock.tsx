import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, visibleApps } from '../../lib/apps'
import { appColorIcon } from '../../lib/appIcons'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import {
  DOCK_BORDER as BORDER,
  DOCK_GAP as GAP,
  DOCK_ICON_FILL,
  DOCK_MARGIN,
  DOCK_PAD as PAD,
  DOCK_THICKNESS,
  MAGNIFY_PEAK,
  MOVE_THRESHOLD,
  SPRING_DAMPING,
  SPRING_STIFFNESS,
  STAY_PAD,
  dampedOffset,
  dockMaxOffset,
  dockMinLength,
  dockStep,
  isVertical,
  magnifyScale,
  maxDockLength,
  maxDockThickness,
  spreadExtraMax,
  spreadShifts,
  wheelChrome,
  wheelViewMin,
  wrapLines,
  wrapPerLine,
  wrapSideGap,
} from '../../lib/dock'
import type { AppId } from '../../types/desktop'
import { AppIcon } from './AppIcon'

/* ══ 任务栏图标区（mode: 'wheel'）：**放大 = 档位 + 让位场 + 一次性扩张，动画全走 CSS transition** ══
   ⭐⭐ **2026-10-07《稳定方案》最终口径**（站主一次定全，规范见 `ARCH-DOCK.md` 开头的同名一节）。
   站主原话：「**冻结怎么会出现这种情况**（图标大小不一、互相压叠、位置停在半途）→
   **清除图标相关记忆，然后重做一款稳定的图标方案**」；随后把口径一次定全：

   1. **档位**（`lib/dock.ts` 的 `magnifyScale()`，唯一一处判断）：
      | 位置 | scale | 位移 |
      |---|---|---|
      | 指针**正对**那一颗（`hot`） | `MAGNIFY_PEAK` = **2.0×**（48 → **96px**） | **0**（自己不动） |
      | 它**主轴紧邻的下一个**（`hot + 1`） | `MAGNIFY_RIGHT_NEIGHBOR` = **1.25×**（→ 60px） | 让开 |
      | **左邻**与其余全部 | **1.0** | 只按让位场平移 |
   2. **整排均匀让开**（`spreadShifts()`）：每颗沿主轴位移，**逐对间隙恒为 `DOCK_GAP`(3px)**；
      `hot` 那颗位移恒 0，其余按"指针到它之间所有对的增量之和"往两边推开。
   3. **任务栏左右扩张**（`spreadExtraMax()`）：扩张量 = 让位后整排伸出内容盒的最大量，
      取"**指针可能停在任何一颗**"的**最坏值** ⇒ **常数** ⇒ 悬停期间宽度恒定（**不可能呼吸**）；
      而且**对称扩张**（左右各相同）⇒ 整排的**屏幕位置不随宽度变化**
      （旧那套"宽度一变整排平移"的抖动在结构上不可能出现）。
   4. **保持放大的范围** = 放大那颗的渲染盒 **+ `STAY_PAD`(2px)**（含上方超出任务栏那截）。

   ⭐ **稳定性来源**：档位 / 位移 / 扩张量**全是纯函数**，只在"指针正对那颗变了"（或离开）时
   **算一次**、写进内联 style，**动画全部交给 CSS transition**
   （`.dock__item { transition: transform 150ms }` ＋ `.dock__view--grow { transition: width/height }`）。
   ⇒ **实现里没有任何 JS 动画状态**：中断 / 反向 / 快速换目标全由浏览器处理 ⇒
     **结构上不可能出现"冻结在半途 / 大小不一 / 位置漂移"**（旧方案的病根是"JS 每帧写 transform
     ＋ 一堆互锁状态机"，那一整套已整条移除）。

   ⛔ **一条都不许加回来**（常量定义留在 `lib/dock.ts` 并标"废弃"，只当沿革看；本文件一个都不引用）：
     · rAF 逐帧链：`paint()` / `tick()` / `scheduleTick()`（每帧写 scale / 写位移 / 写宽度）
     · 强度平滑 `fade` / `target`；连续波峰 `hot` / `hotTarget`；速度 EMA `vEma` / `ASYM_*`
     · 吸附与冻结：`settleTo` / `latched` / `LATCH_*` / `FREEZE_PAD` / `entryDone` / `held()`
     · **peak-hold**（`waveHold`）：扩张量改成"最坏值常数"之后**根本不需要它**（也就没有那个状态）
     · 逐图标缓动（`easeS` / `easeBusy` / `MAGNIFY_TAU` / `MAGNIFY_EASE_TAU`）

   悬停判定：指针在任务栏上时按**主轴最近的那一颗**算 `hot`，**一律用布局坐标算**
   （`mainCentres()` —— `offsetLeft` 不含 transform；用渲染盒会形成自指环、系统性偏一颗，这是历史坑）；
   指针离开任务栏、且**不在"放大那颗 + 2px"的范围里** → `hot = -1` → 全部回 1.0
   （站主：「放大的图标包括周围 2px 范围都保持放大」）。
   `transform-origin` 贴在**栏那一侧**（`globals.css` 的 `[data-dock-pos=…]` 四条），
   所以放大只往栏外长、贴栏那条边原地不动。
   ⚠️ 让位与扩张都**只写 DOM 内联样式**，**绝不写回 `desktop.dock`**（离开时像素级复原）。

   ⚠️⚠️ **任务栏绝不是原生拖拽源**（`nav` 的 `onDragStart` 里 `preventDefault()`）：
   图标是 `<img draggable={false}>`，但实测浏览器**仍会**在这里起一个原生拖拽，
   而**原生拖拽一起浏览器立刻 `pointercancel`** → "竖拖换位"当场死掉（实测 `lifted: 0`、幽灵不出现）。
   别删那一行。

   拖拽浏览（按住沿轴拖/滚轮）与竖向换位**完全保留旧行为**，它们只动 `track` 的 `translate`
   （滚动），与放大再无关系。折行模式（`wrap`）**一个字没动**。 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/* 任务栏上的应用图 = **彩色自绘图标**（`design/icons-app/*.svg` → `lib/appIcons.ts`，本站原创）。
   查不到这张图就退回 `components/icons/**` 的单色功能图标 —— 绝不渲染裂图。
   ⚠️ 菜地身份一个字都没删（`SITE.name` / `AppDef.veggie` / `lib/veggies.ts` 48 张菜图），
   菜图现在只出现在开始菜单与关于窗口。 */
function appGlyph(id: AppId, className: string) {
  const app = getApp(id)
  const src = appColorIcon(id)
  if (src) {
    return (
      <img src={src} alt="" draggable={false} className={`${className} select-none object-contain`} />
    )
  }
  return <AppIcon name={app.icon} className={className} />
}

/* 任务栏内部几何 GAP / PAD / BORDER 从 lib/dock 来（厚度下限要用同一套数），这里只留按钮上限 */
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
  /** 被悬停的按钮本体 */
  el: HTMLElement
  /** 它在图标区里的下标 —— 气泡要按那一颗**放大后**的盒子定位（`hoverStyle`） */
  index: number
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
  const [hover, setHover] = useState<HoverState | null>(null)
  /* 点图标时的"弹一下"（macOS 的启动反馈）：只挂 300ms 的类名，纯离散事件，不进逐帧路径 */
  const [bouncing, setBouncing] = useState<AppId | null>(null)
  /* ⭐ **放大档位**：指针主轴最近的那一颗的下标，`-1` = 指针不在任务栏上（= 全部 1.0）。
     只由 `pointermove` / `pointerleave` 这类**离散事件**写；**没有任何逐帧路径**。
     React 只在"换了一颗"时重渲染 → DOM 上只写一次 `transform: scale()`，
     后续的放大/收回**全是 CSS transition 的事**。 */
  const [hot, setHot] = useState(-1)
  /* ⭐ "指针在**放大那颗凸出栏外的那一截**上"的标记（站主的 +2px 保持范围）。
     只由 `pointerleave` 置真、回到栏内或出了范围置假 —— **纯离散事件**，不进任何逐帧路径。 */
  const [overhang, setOverhang] = useState(false)
  const bar = useRef<HTMLElement | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ px: number; py: number; sx: number; sy: number; moved: boolean } | null>(
    null,
  )
  const grip = useRef<GripState | null>(null)
  const vertical = isVertical(position)

  /* ── 图标区的 ref 与手势状态（拖动过程只动 ref，不进 React 状态）── */
  const viewEl = useRef<HTMLDivElement | null>(null)
  const trackEl = useRef<HTMLDivElement | null>(null)
  /** 拖拽浏览的偏移（**只影响 track 的 translate**，与放大无关） */
  const offset = useRef(0)
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

  /* 当前厚度能塞下几行（竖排时是几列）—— **只有折行模式用**；图标区永远单行 */
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
  /* 折行时两端固定按钮**不对称**（横排只有左端一颗、竖排在末端），图标块会在"两端之间的可用框"里
     居中 → 中线天生偏一点。`wrapSideGap` 返回**带符号**的补偿量（正数补起点、负数补终点）。 */
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
     图标区与折行是同一个 <div> 节点（React 复用），实测 wheel → wrap 之后 scrollLeft 还留着 200，
     图标看着就是"往左偏"、起点那几个还够不到。归零之后装得下时正好落在居中态。 */
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = 0
    el.scrollTop = 0
  }, [mode, length, position, btn, vertical, itemCount])

  /* ⭐ 几何一变（切模式 / 换停靠方向 / 改尺寸 / 图标数变了），指针与旧档位的对应关系就作废了
     —— 必须**当场归零**，否则会留着一颗"没人悬停却放大着"的图标（那正是旧方案那种残留病）。
     纯粹是"离散状态跟着几何复位"，不进任何逐帧路径。 */
  useEffect(() => {
    setHot(-1)
    setOverhang(false)
  }, [mode, position, btn, itemCount, vertical])

  /* ⭐ **栏外那截的守卫**（站主的 +2px 保持范围）：指针停在"放大图标凸出任务栏"的那一截时，
     已经不在图标区视口里了 → 视口再也不会收到 `pointermove`/`pointerleave`，
     于是"继续移出并收起"这件事**没人负责**。所以只在这种状态下挂一个 window 级 `pointermove`：
     **只做一件事 —— 出了"放大那颗渲染盒 + 2px"就收起**。
     ⚠️ 它**不是**第二条"放大用"的 pointermove：只读坐标比矩形，绝不写布局、不排帧、不改档位
        （档位只在"回到栏内"或"离栏"时变，都是离散事件）。 */
  useEffect(() => {
    if (!overhang) return
    const onMove = (ev: PointerEvent) => {
      if (gesture.current) return
      if (insideStayBox(ev)) return
      setOverhang(false)
      setHot(-1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overhang, hot])

  /* ── 图标区的几何 ──
     step = 相邻图标中心距；图标区长度 = 给多少算多少（length === null 时按"装下所有图标"自适应）。
     可视长度至少 3 个图标位（`wheelViewMin`）。 */
  const step = dockStep(btn)
  const chromeLen = wheelChrome(btn)
  const viewMin = wheelViewMin(btn)
  const autoView = Math.max(viewMin, itemCount * step - GAP)
  const viewLen = length === null ? autoView : Math.max(viewMin, length - chromeLen)

  /* ⭐⭐ **放大档位 + 让位场 + 扩张量**（《稳定方案》最终口径；**全是纯函数、只在换档时算一次**）──
     `hot` 一变（或指针离开）这份几何就重算一遍，写进内联 style，动画交给 CSS transition。
     ⚠️ 这里**没有任何逐帧的东西**，也没有任何"插值/缓动状态"——这就是稳定性的全部来源。 */
  const scales = shownApps.map((_, i) => magnifyScale(i, hot))
  const shifts = hot < 0 ? shownApps.map(() => 0) : spreadShifts(scales, hot, btn)
  /* 每颗的位移只在主轴方向上有意义：横排 = translateX，竖排 = translateY */
  const shiftStyle = (i: number): string | null => {
    const sh = shifts[i] ?? 0
    if (hot < 0 || Math.abs(sh) < 0.05) return null
    return vertical ? `translateY(${sh.toFixed(2)}px)` : `translateX(${sh.toFixed(2)}px)`
  }
  /* ⭐ **扩张量（每侧 px）= 最坏值常数**（见 `spreadExtraMax`）：悬停期间宽度恒定 ⇒ 不可能呼吸。
     再按"视口 / 任务栏长度上限"封顶：**撞到上限时最外侧那颗可能轻微伸出任务栏盒**（极端情况，
     回报里写清；默认几何下余量充足）。 */
  const extraWanted = hot < 0 ? 0 : spreadExtraMax(itemCount, btn)
  const viewport = { w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight }
  const capView = Math.min(
    maxDockLength(position, viewport) - chromeLen,
    (vertical ? viewport.h : viewport.w) - DOCK_MARGIN * 2 - chromeLen,
  )
  const extra = Math.max(0, Math.min(extraWanted, (capView - viewLen) / 2))
  const grownView = viewLen + extra * 2
  const grownBar = grownView + chromeLen

  /* ⚠️ 任务栏里**没有任何固定按钮**（启动台 / 全屏 / 位置都搬进了 `MenuBar.tsx`），
     所以这里没有"配平单侧按钮"的内边距，图标区自己就是整条栏的内容。 */

  function openApp(id: AppId) {
    const app = getApp(id)
    /* 这一框可能装着好几个标签：按"哪个框里有这个应用"来找 */
    const win = windows.find((w) => w.tabs.some((tab) => tab.id === id))
    if (win?.minimized) dispatch({ type: 'restore', key: win.key })
    navigate(app.path)
  }

  /* 悬停/聚焦显示名称：用任务栏内坐标的浮层，避免被滚动容器裁掉。
     ⚠️ **只存元素 + 下标**，位置一律在 `hoverStyle` 里现算（见那里的注释）。 */
  function showName(target: HTMLElement, name: string, index: number) {
    setHover({ name, el: target, index })
  }

  /**
   * 气泡位置：**贴在"放大之后"那一颗的上方**，而且**只在 hover 变化时算一次**
   * （state 变才重渲染；没有定时器、没有逐帧写入）。
   *
   * ⚠️ 必须用**渲染盒**（放大是 `transform: scale()`、不动布局）；但**只取渲染盒里
   *    与缩放/让位无关的那条边**（贴栏那条边 —— `transform-origin` 就在它上面，所以它恒等于布局边），
   *    另一半用**布局尺寸 × 档位**推：
   *      · 底栏（原点 `center bottom`）→ 底边不动，放大后的顶边 = 渲染盒底边 − 布局高 × 档位；
   *      · 顶栏（原点 `center top`）  → 顶边不动，放大后的底边 = 渲染盒顶边 + 布局高 × 档位；
   *      · 左/右栏同理（贴屏那条边不动）。
   *    ⇒ 气泡位置**与动画进度无关**（过渡刚开始量、和长满之后量，读数完全一样），
   *      既满足"贴放大后的图标上方"，又不会像旧实现那样"捕到哪一帧就定死在哪一帧"。
   *
   * ⚠️ **主轴中心用"布局几何 + 目标位移"算，不用渲染盒**：现在有让位场（每颗沿主轴平移），
   *    渲染盒在过渡中途量到的是"还在路上"的位置 —— 气泡会跟着一起飘一下再停歪。
   *    布局中心 + `shifts[index]`（目标值，纯函数算出来的）就是它**最终**的位置 ⇒ 一次到位。 */
  function hoverStyle(state: HoverState): CSSProperties {
    const barRect = bar.current?.getBoundingClientRect()
    const el = state.el
    if (!barRect || !el) return {}
    const rect = el.getBoundingClientRect()
    const layoutH = el.offsetHeight || rect.height
    const layoutW = el.offsetWidth || rect.width
    const s = magnifyScale(state.index, hot)
    const grownY = (s - 1) * layoutH
    const grownX = (s - 1) * layoutW
    const sh = hot < 0 ? 0 : shifts[state.index] ?? 0
    /* 主轴中心 = 布局中心 + 目标位移（缩放与位移都不改"布局中心 + 位移"这个量：
       主轴方向的原点在中心，缩放只向两边长）。 */
    const track = el.closest('[data-dock-track]')
    const tr = (track ?? el).getBoundingClientRect()
    const layoutMain = vertical ? tr.top + el.offsetTop : tr.left + el.offsetLeft
    const mainCentre = (layoutMain + (vertical ? layoutH : layoutW) / 2 + sh) - (vertical ? barRect.top : barRect.left)
    switch (position) {
      case 'bottom':
        return {
          left: mainCentre,
          top: rect.bottom - layoutH - barRect.top - grownY - 8,
          transform: 'translate(-50%, -100%)',
        }
      case 'top':
        return {
          left: mainCentre,
          top: rect.top - barRect.top + layoutH + grownY + 8,
          transform: 'translateX(-50%)',
        }
      case 'left':
        return {
          left: rect.left - barRect.left + layoutW + grownX + 8,
          top: mainCentre,
          transform: 'translateY(-50%)',
        }
      default:
        return {
          left: rect.right - layoutW - barRect.left - grownX - 8,
          top: mainCentre,
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

  /* ── 图标区（wheel）：拖动浏览 / 竖拖换位 ────────────────────────────────
     ⚠️ 拖动过程**不进 React 状态**：offset 在 ref 里，直接写 `track` 的 transform。
     只有"换位预览"这种离散事件才 setState（一次拖动最多几次）。
     ⚠️ 拖动**完全不碰放大档位**（`hot` 在拖动期间不动）：拖动改的是滚动，不是悬停。
     ⚠️ 这里原来是"循环"（两份列表 + 取模），已按「跟随 macOS 改成回弹」拆掉 —— 有头有尾：
     `offset` 夹在 [0, maxOffset]，越界只给橡皮筋阻尼、松手弹回端点。 */
  const maxOffset = dockMaxOffset(itemCount, step, viewLen)
  const canDrag = maxOffset > 1
  /** 橡皮筋最多能多拉出去多少（= 视口的 25%）：拖动的原始值夹在这里，再远没有意义 */
  const rubberDim = viewLen * 0.25
  const clampRaw = (v: number) => clamp(v, -rubberDim * 1.5, maxOffset + rubberDim * 1.5)
  const alongOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientY : e.clientX)
  const crossOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientX : e.clientY)

  /** 只画**滚动**：把 track 按当前 offset 平移（越界按苹果的橡皮筋公式衰减）。
   *  ⚠️ 它**只碰 track**，一个图标的 transform 都不碰 —— 放大全是 CSS 的事。 */
  function paintTrack() {
    const track = trackEl.current
    if (!track) return
    const off = dampedOffset(offset.current, maxOffset, viewLen)
    track.style.transform = vertical ? `translate3d(0, ${-off}px, 0)` : `translate3d(${-off}px, 0, 0)`
  }

  function schedulePaint(next: number) {
    offset.current = clampRaw(next)
    paintTrack()
  }

  /* ── 悬停判定：**布局坐标**（历史坑：用渲染盒算会形成自指环、系统性偏一颗）──
     `el.offsetLeft/offsetTop` 是相对 **track** 的布局值，`track.getBoundingClientRect()`
     含浏览产生的 translate ⇒ 图标在视口里的位置 = `(tr.left − vr.left) + offsetLeft`
     （**不要再加减 off**：那会把滚动量算两遍，一滚动就整体偏 `2 × off`）。 */
  function mainCentres() {
    const view = viewEl.current
    const track = trackEl.current
    const els = track ? [...track.querySelectorAll<HTMLElement>('[data-dock-item]')] : []
    const vr = view?.getBoundingClientRect()
    const tr = track?.getBoundingClientRect()
    if (!vr || !tr || els.length === 0) {
      return { els, origin: 0, centre: () => 0, size: () => 0 }
    }
    const origin = vertical ? tr.top - vr.top : tr.left - vr.left
    return {
      els,
      origin,
      centre: (el: HTMLElement) =>
        origin +
        (vertical ? el.offsetTop : el.offsetLeft) +
        (vertical ? el.offsetHeight : el.offsetWidth) / 2,
      size: (el: HTMLElement) => (vertical ? el.offsetHeight : el.offsetWidth),
    }
  }

  /** 指针主轴方向**最近的那一颗**（= `hot`）。夹在两端之间：指针在空白/端头也算最近那颗。 */
  function nearestSlot(e: { clientX: number; clientY: number }): number {
    const view = viewEl.current
    if (!view || itemCount === 0) return -1
    const { els, centre } = mainCentres()
    if (!els.length) return -1
    const vr = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? vr.top : vr.left)
    let idx = 0
    let best = Infinity
    els.forEach((el, i) => {
      const d = Math.abs(centre(el) - p)
      if (d < best) {
        best = d
        idx = i
      }
    })
    return idx
  }

  /** 指针是不是真的压在某个图标上（**点空白不进入换位**）—— 同样只用布局盒。 */
  function iconAtPoint(e: { clientX: number; clientY: number }): number | null {
    const view = viewEl.current
    if (!view || itemCount === 0) return null
    const { els, origin, size } = mainCentres()
    if (!els.length) return null
    const vr = view.getBoundingClientRect()
    const p = alongOf(e) - (vertical ? vr.top : vr.left)
    const hit = els.findIndex((el) => {
      const a = origin + (vertical ? el.offsetTop : el.offsetLeft)
      return p >= a && p <= a + size(el)
    })
    return hit >= 0 ? hit : null
  }

  /** 换档位：**只有真的换了一颗**才 setState（同颗内移动 = 一次渲染都不产生）。 */
  function updateHot(e: { clientX: number; clientY: number }) {
    const next = nearestSlot(e)
    setHot((prev) => (prev === next ? prev : next))
  }

  /** ⭐ 指针是不是还在**"放大那颗的渲染盒 + `STAY_PAD`(2px)"**里（站主：「放大的图标包括周围
   *  2px 范围都保持放大」）。用它决定"离开任务栏边缘时要不要立刻收起"。
   *  ⚠️ 用**渲染盒**（放大 + 让位都在 `transform` 上）：这样"移到放大图标凸出栏外的那一截"、
   *     以及"在放大图标上下 2px 内小范围移动"都算**还在范围里**，不会把放大取消掉。 */
  function insideStayBox(p: { clientX: number; clientY: number }): boolean {
    if (hot < 0) return false
    const el = mainCentres().els[hot]
    if (!el) return false
    const r = el.getBoundingClientRect()
    return (
      p.clientX >= r.left - STAY_PAD &&
      p.clientX <= r.right + STAY_PAD &&
      p.clientY >= r.top - STAY_PAD &&
      p.clientY <= r.bottom + STAY_PAD
    )
  }

  /** 指针是否还在任务栏盒里（拖动松手时用它决定档位复位到哪一颗）。 */
  function insideBar(p: { clientX: number; clientY: number }): boolean {
    const r = bar.current?.getBoundingClientRect()
    return (
      !!r &&
      p.clientX >= r.left - 1 &&
      p.clientX <= r.right + 1 &&
      p.clientY >= r.top - 1 &&
      p.clientY <= r.bottom + 1
    )
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

  /** 指针在任务栏上移动 → 只做一件事：**把档位对准主轴最近的那一颗**。
   *  ⚠️ 不做任何插值、不加任何时间参数 —— 中间过程由 CSS transition 负责（这就是稳定性的来源）。 */
  function wheelMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    const view = viewEl.current
    /* 指针回到图标区里了 → 摘掉栏外守卫 */
    if (overhang) setOverhang(false)
    /* 拖动中不许改档位：手势里指针可能被捕获到栏外，按坐标算会乱跳。 */
    if (!g) updateHot(e)
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
       沿轴动 4px 就是"浏览"；只有**按在图标上**且垂直位移超过 44px 才算"移动"。 */
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
       图标区带 `clip-path`（只裁主轴、交叉轴允许凸出），图标本体留在里面一拖出栏外就会被裁掉。 */
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

    /* 落点下标：指针位置换算成"第几个格子"，夹在 [0, itemCount-1]（列表有头有尾，不绕） */
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
    /* 浏览/换位时常常已经拖到栏外（指针被捕获了，收不到 pointerleave）：
       松手这一刻按真实坐标把档位复位，否则图标会停在"放大着"的状态。 */
    if (e) {
      setOverhang(false)
      if (insideBar(e) || insideStayBox(e)) updateHot(e)
      else setHot(-1)
    }
    if (lift.current) {
      lift.current.el.classList.remove('dock__item--lift')
      lift.current = null
    }
    /* 收掉浮层幽灵（松手或取消都一样） */
    setGhost(null)
    if (!g) {
      paintTrack()
      return
    }
    if (g.kind === 'browse') {
      /* 松手：界内就停在那儿（macOS 的 Dock 不吸附到格子），越界由弹簧弹回端点 */
      settle()
      return
    }
    if (g.kind === 'move' && g.onIcon !== null && g.dragId) {
      /* 落盘：按下时它在 shownApps 里的下标 = g.onIcon，松手时它在预览顺序里的下标就是新位置。 */
      const toIdx = preview ? preview.indexOf(g.dragId) : g.onIcon
      if (toIdx >= 0 && toIdx !== g.onIcon) reorderDockApps(g.onIcon, toIdx)
    }
    setPreview(null)
    paintTrack()
  }

  /** 指针离开任务栏 → **全部回 1.0**（CSS transition 自己收回，不留任何残留状态）。
   *  ⚠️ 只清档位，绝不碰 `offset` / `lift` / 手势状态机（拖动中指针跑远时也会触发 leave）。
   *  ⭐ 但如果指针还在**"放大那颗的渲染盒 + 2px"**里（放大图标凸出栏外的那一截、或贴着它
   *     上下 2px 的地方）→ **保持放大**（站主：「放大的图标包括周围 2px 范围都保持放大」）；
   *     这时挂一个**临时的 window `pointermove` 守卫**负责"真的出了这个范围才收起"
   *     （指针在栏外那截时视口收不到 `pointermove` 了）。守卫只读坐标比矩形，不写布局、不排帧。 */
  function wheelLeave(e?: { clientX: number; clientY: number }) {
    if (gesture.current) return
    if (e && insideStayBox(e)) {
      setOverhang(true)
      return
    }
    setOverhang(false)
    setHot(-1)
  }

  /* ── 回弹：松手 / 滚轮之后回到界内（macOS 滚动视图的行为）──
     - 越界了 → 弹簧弹回端点（`SPRING_STIFFNESS/DAMPING` 取自 playground-macos DockItem，MIT，
       我们不引依赖，用同一组 k/c 自己积分。ζ ≈ 1.09 → 略过阻尼，不过冲，实测 ~100ms 落位）；
     - 界内 → **不吸附到格子**（macOS 的 Dock 是滚动视图，图标跟着指针停在任意位置），只夹一次。
     ⚠️ 这是**滚动**的弹簧，与放大无关（放大没有动画代码，全靠 CSS）。 */
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
      paintTrack()
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
      paintTrack()
      if (Math.abs(x - target) < 0.5 && Math.abs(v) < 8) {
        offset.current = target
        paintTrack()
        springRaf.current = 0
        return
      }
      springRaf.current = requestAnimationFrame(frame)
    }
    springRaf.current = requestAnimationFrame(frame)
  }

  function wheelOnWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    /* 装得下就没什么可滚的（macOS 的 Dock 这时是静止的，不该动） */
    if (!canDrag) return
    const d = vertical ? e.deltaY : e.deltaX || e.deltaY
    /* 滚轮 = 一格一格地走；收尾用同一根弹簧（和拖动松手回弹同一套手感） */
    settle(clamp(offset.current + (d > 0 ? 1 : -1) * step, 0, maxOffset))
  }

  /* 图标区：首帧与几何变化后把**滚动**画一次（换了模式 / 位置 / 尺寸 / 列表顺序 / 长度厚度都要重画，
     否则 DOM 上留下的还是上一次的 translate）。⚠️ 与放大无关。 */
  useEffect(() => {
    if (mode !== 'wheel') return
    /* 几何一变，原来的 offset 可能已经越界（比如任务栏拖长了）—— 夹回界内再画 */
    offset.current = clamp(offset.current, 0, maxOffset)
    paintTrack()
    const view = viewEl.current
    if (!view) return
    const ro = new ResizeObserver(() => paintTrack())
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

  /* 卸载时把没跑完的那一帧弹簧收掉 */
  useEffect(() => () => stopSpring(), [])

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

  /* ⭐ 定长任务栏悬停时也**跟着扩张**（站主：「任务栏也相应左右扩展」）：底板比图标区多出的
     那点固定开销（内边距 + 边框）保持不变 ⇒ 底板宽 = 图标区宽 + `chromeLen`。
     ⚠️ 只写 DOM 内联样式，**绝不写回 `desktop.dock`**（离开时像素级复原）。 */
  if (length !== null) {
    if (vertical) barStyle.height = hot < 0 ? length : grownBar
    else barStyle.width = hot < 0 ? length : grownBar
  }

  /* 图标区的内联几何。`--dock-icon-fill` 挂在这一层 → 整棵子树继承，`.dock__glyph` 读它定图标大小。
     ⚠️ 自定义属性不在 `CSSProperties` 的类型里，所以要 `as unknown as`（TS 只允许这样绕）。
     ⭐ **主轴尺寸随悬停扩张**（站主：「任务栏也相应左右扩展」）：幅度 = `extra`（最坏值常数，
     见 `spreadExtraMax`）⇒ 悬停期间恒定 ⇒ 不可能"呼吸"。
     ⚠️ `length === null` 时**离开就把内联尺寸整个摘掉**（让布局自己给出那个值）——
        这样"复原"是**严格等于布局值**，不存在舍入/漂移。 */
  const wheelViewStyle = {
    /* length 定了就吃掉剩余空间，没定就按内容（= 装下所有图标） */
    flex: length === null ? '0 0 auto' : '1 1 auto',
    '--dock-icon-fill': `${DOCK_ICON_FILL * 100}%`,
    /* ⭐ **主轴裁切余量**（`globals.css` 的 `.dock__view--h/--v` 读它）：
       放大后的最左/最右那颗会往栏外伸出 `(PEAK − 1) · 按钮 / 2`（2.0 → 48px 按钮 **24px**），
       主轴那条 `clip-path` 必须**固定**留出这一截（与"扩张"双保险：扩张撞到视口上限时，
       还有这 24px 兜着，不会把边缘图标切掉）。
       ⚠️ 它是**静态**的（只跟按钮尺寸走、与悬停无关）。 */
    '--dock-clip-pad': `${Math.ceil(((MAGNIFY_PEAK - 1) * btn) / 2)}px`,
  } as unknown as CSSProperties
  if (length !== null) {
    if (vertical) wheelViewStyle.height = hot < 0 ? viewLen : grownView
    else wheelViewStyle.width = hot < 0 ? viewLen : grownView
  } else if (hot >= 0) {
    /* 自适应长度：悬停时写扩张后的尺寸；离开时整条摘掉（复原 = 布局值，像素级） */
    if (vertical) wheelViewStyle.height = grownView
    else wheelViewStyle.width = grownView
  }

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
    /* ⭐ 档位 + 让位：**只写这一处 transform**（`translate` 让位 + `scale` 放大），
       缓动交给 CSS transition。1.0 且不让位的那一档**一个 transform 都不写**
       （`none` 与矩阵之间的插值浏览器自己处理）。 */
    const style: CSSProperties = { ...btnStyle }
    if (loop) {
      const s = magnifyScale(opts.index, hot)
      const shift = shiftStyle(opts.index)
      const parts: string[] = []
      if (shift) parts.push(shift)
      if (s !== 1) parts.push(`scale(${s})`)
      if (parts.length) {
        style.transform = parts.join(' ')
        /* 放大那颗压在邻居圆角之上（macOS 也如此）；正对那颗最上，紧邻次之 */
        style.zIndex = opts.index === hot ? 3 : s !== 1 ? 2 : undefined
      }
    }

    return (
      <button
        key={app.id}
        type="button"
        style={style}
        title={label}
        /* ⚠️ 无障碍名**只用窗口名**：验证脚本（verify.mjs / verify-dst.mjs）都按
           `button[aria-label="博客"]` 这类选择器点按钮，往里塞"菜名"会把它们全弄坏。
           菜名放 title 与悬浮提示里。 */
        aria-label={app.name}
        aria-current={active ? 'page' : undefined}
        data-dock-item={loop ? app.id : undefined}
        data-dock-copy={loop ? '1' : undefined}
        data-dock-index={loop ? opts.index : undefined}
        onClick={() => {
          setBouncing(app.id)
          window.setTimeout(() => setBouncing((b) => (b === app.id ? null : b)), 300)
          openApp(app.id)
        }}
        onMouseEnter={(e) => showName(e.currentTarget, app.name, opts.index)}
        onMouseLeave={() => setHover(null)}
        onFocus={(e) => showName(e.currentTarget, app.name, opts.index)}
        onBlur={() => setHover(null)}
        /* ⚠️ 2026-10-06 站主：「圆角彩色底不要改，其外围还有一个**半透明边框**，把半透明改成**全透明**就行」
           —— 那圈"半透明边框"的真凶**不是 border / outline / box-shadow**，而是**按钮自己的底色**：
            ① `hover:bg-hover`（`--c-hover` = rgba(0,0,0,.05)，就是那层半透明）；
            ② 选中态 `bg-accent`（实心蓝底，在图标外面露出的就是那圈"框"）。两处都已拿掉。
           **保持选中语义**：`aria-current="page"` 还在、跑着的绿点还在 —— 只是不再用底色画框。
           ⚠️ 键盘可达性不许一起拿掉：`:focus-visible` 的焦点环在 `globals.css` 里，别删。 */
        className={`relative grid shrink-0 place-items-center rounded text-chrome-ink ${
          loop ? 'dock__item' : ''
        } ${bouncing === app.id ? 'dock__item--bounce' : ''}`}
      >
        {/* 图标区（wheel）用 `.dock__glyph`（占按钮 100%，macOS 那种填满格子）；
            折行（wrap）仍是 `h-1/2 w-1/2` —— 那是它的旧观感，按规矩不动。 */}
        {appGlyph(app.id, loop ? 'dock__glyph' : 'h-1/2 w-1/2')}
        {running ? (
          <span
            /* 正在跑的小圆点（macOS 的 4px 指示点）：未运行时**不渲染**，所以不占位。 */
            className="absolute bottom-0.5 h-1 w-1 rounded-full bg-chrome-ink"
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
      /* ⚠️⚠️ **任务栏绝不是原生拖拽源** —— 2026-10-07 排查出的真 bug（直接打坏"竖拖换位"）：
         任务栏图标是 `<img draggable={false}>`，但实测浏览器**仍会在这里起一个原生拖拽**
         （`dragstart` 的 `target` 就是那个 IMG，走的是"拖选中内容/图片"那条路径），
         而**原生拖拽一起，浏览器立刻 `pointercancel`** —— 我们的指针手势当场死掉。
         实测事件序列：`pointerdown`（`onIcon: 6`，落点正确）→ 第一次 `pointermove`（`captured: true`）
         → **`dragstart(target=IMG)`** → **`pointercancel`** ⇒ `lifted: 0`、幽灵不出现。
         ⇒ 修法就是这一行 `preventDefault()`：**任务栏里既不许拖图、也不许拖选中文字**
           （换位/浏览本来就全是 `pointer*` 手势，不受影响；**没有**退回逐帧写 transform）。
         ⚠️ 别删它 —— 删了两条拖拽守卫（"竖拖进移动模式"、"拖到栏外仍看得见幽灵"）会重新变红。 */
      onDragStart={(e) => e.preventDefault()}
      /* ⭐ 悬停判定挂**整条任务栏**（不是只挂图标区视口）：放大后图标凸出栏外的那一截仍是
         `nav` 的后代 ⇒ 指针移过去不会触发 `pointerleave`（不再需要旧那套 `overhang` 守卫）。
         事件里**只改一个整数档位**，不做任何插值。 */
      onPointerMove={wheelMove}
      onPointerLeave={wheelLeave}
      onPointerCancel={wheelLeave}      /* justify-center：拖长任务栏后 bar 比内容宽，整组要居中（内容自适应宽度时没有富余空间，不受影响）
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

      {mode === 'wheel' ? (
        /* ── 图标区（默认）：单行、有头有尾（回弹）、放大 = 档位 + CSS transition ──
           ⚠️ 原来是"循环"（两份列表 + 取模归一化），已拆掉 —— 别再改回来（回归断言在 verify 14b/14d）。 */
        <div
          /* key 让两种模式**各用各的 DOM 节点**：两者整棵子树结构不同，但外层都是 <div>，
             不给 key 时 React 会**复用同一个节点**并把它的 `scrollLeft` 一起带过去 ——
             实测 wheel → wrap 之后残留 110，图标看着往左偏。 */
          key="wheel"
          ref={viewEl}
          data-dock-view=""
          /* 停靠方向挂在这儿，给 CSS 用来设放大原点（`globals.css` 里 `[data-dock-pos]` 那几条）：
             原点贴在**栏那一侧**的边上，放大的图标就把整个增量长到栏外（见那几条的注释） */
          data-dock-pos={position}
          onPointerDown={wheelDown}
          onPointerUp={wheelUp}
          onPointerCancel={wheelUp}
          onWheel={wheelOnWheel}
          style={wheelViewStyle}
          /* `dock__view--grow` 只在**自适应长度**时挂：那时主轴尺寸只由"悬停扩张"改写，
             给它一条 CSS transition（`globals.css`），扩张与图标让位**同帧同速**。
             ⚠️ **定长时不挂**：那时主轴尺寸由用户拖拽改写（必须即时跟手），
                挂了 transition 会让拖长度变"黏"。 */
          className={`dock__view ${vertical ? 'dock__view--v' : 'dock__view--h'} ${
            length === null ? 'dock__view--grow' : ''
          }`}
        >
          <div
            ref={trackEl}
            data-dock-track=""
            style={{ gap: GAP }}
            className={`dock__track ${vertical ? 'dock__track--v' : ''}`}
          >
            {/* ⚠️ **只渲染一份**（循环拆掉之后不再需要背靠背的第二份）：
                两份同名按钮会让 `button[aria-label="博客"]` 一次命中两个、Playwright strict mode 报错。 */}
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

      {/* ⚠️ 任务栏里**已经没有固定按钮了**（启动台 / 全屏 / 位置都在 `MenuBar.tsx`）——
          **别把它们加回来**：要加系统级按钮请加到菜单栏。 */}

      {/* 悬停名称浮层：放在滚动容器外，才不会被裁掉。
          ⚠️ 位置**只在 hover 变化时算一次**（`hoverStyle` 用渲染盒的"不动那条边" + 布局尺寸 × 档位），
          所以没有定时器、没有逐帧写入，也就不会有"捕到哪一帧定死在哪一帧"的老毛病。 */}
      {hover ? (
        <span
          role="tooltip"
          style={hoverStyle(hover)}
          /* 站主 2026-10-06：「气泡背景改成**灰色的半透明**状，文字增加对比度，显得更清楚」——
             颜色全在令牌里（`--c-tip-bg` / `--c-tip-ink`，两套主题各一份），组件里不写死颜色。
             对比度按 **alpha 与实际底合成后**算（`verify.mjs` 有那条断言，≥4.5:1）。 */
          className="dock__tip pointer-events-none absolute z-50 whitespace-nowrap px-2 py-1 text-[11px]"
        >
          {hover.name}
        </span>
      ) : null}

      {/* 拖拽幽灵：被拖走的那个图标本体。
          ⚠️ 它**必须挂在外壳层（`document.body` 的浮层）**，不能放进图标区 ——
          图标区带 `clip-path`，会成为后代的包含块，放进去一拖出栏外就被裁掉。
          `pointer-events: none`：它不挡窗口 / 任务栏的任何点击。 */}
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
    </nav>
  )
}
