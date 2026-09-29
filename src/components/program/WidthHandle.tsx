import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** 一条手柄要的全部回调与状态；useArticleWidth 直接把它摊给两条手柄 */
export interface WidthHandleShared {
  /** 按下时取当前正文列宽，作为拖动的基准 */
  onStart: () => number
  /** 拖动中：只要新宽度，不落盘、不进 React 状态（每帧 setState 会把 markdown 一起重渲染） */
  onDrag: (width: number) => void
  /** 松手：位移过才落盘 */
  onCommit: (width: number) => void
  /** 松手 / 取消后统一收尾（按存下来的偏重重贴一次，取消时也能回到原状） */
  onEnd: () => void
  /** 双击复位：清掉偏好，回到自适应的行宽 */
  onReset: () => void
  /** 键盘微调（方向键 24px，按住 Shift 96px） */
  onStep: (delta: number) => void
  value: number
  max: number
}

export interface WidthHandleProps extends WidthHandleShared {
  side: 'left' | 'right'
}

/**
 * 正文列宽拖动条 —— DSH 会话页那两条白色长条的同款实现：
 * 指针捕获 + rAF 节流 + 对称位移（×2）+ 把指针 Y 写进 CSS 变量，
 * 交由 CSS 的 `::after` 画出那条跟着指针上下渐隐的 3px 长条。
 *
 * 注意与「坑 2」的区别：那条坑说的是**滚动容器**别在 pointerdown 就抢指针
 * （里面的按钮会点不动）。这里是专用的抓取带，带子里没有可点的东西，
 * 按下就捕获反而是必须的 —— 指针移出窗口也不会丢事件。
 * 另外单独给了 touch-action: none（在 CSS 里），触屏拖动才不会变成滚页面。
 */
export function WidthHandle(props: WidthHandleProps) {
  const { side, onStart, onDrag, onCommit, onEnd, onReset, onStep } = props
  const [dragging, setDragging] = useState(false)
  const base = useRef(0)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)

  /** 指针位移换算成列宽：右侧往右、左侧往左才是变宽；列是居中的，所以 ×2 */
  const outwardWidth = () => {
    const dx = latest.current - origin.current
    const outward = side === 'right' ? dx : -dx
    return base.current + outward * 2
  }

  const cancelFrame = () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = e.clientX
    latest.current = e.clientX
    base.current = onStart()
    setDragging(true)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    /* 长条跟着指针的上下位置走：写在这个手柄自己的变量上，CSS 用 calc 取 */
    const box = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--width-handle-pointer-y', `${e.clientY - box.top}px`)
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      onDrag(outwardWidth())
    })
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    cancelFrame()
    latest.current = e.clientX
    /* 只是点了一下（没位移）就别落盘，免得把"点一下"变成一次宽度写入 */
    if (latest.current !== origin.current) onCommit(outwardWidth())
    setDragging(false)
    onEnd()
  }

  function onPointerCancel() {
    cancelFrame()
    setDragging(false)
    onEnd()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const grow = side === 'right' ? e.key === 'ArrowRight' : e.key === 'ArrowLeft'
    onStep((grow ? 1 : -1) * (e.shiftKey ? 96 : 24))
  }

  return (
    <div
      className="width-handle"
      data-side={side}
      data-width-handle={side}
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={`拖动调整正文宽度（${side === 'right' ? '右' : '左'}侧），双击复位`}
      aria-valuenow={Math.round(props.value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(props.max)}
      tabIndex={0}
      title="拖动改正文列宽，双击复位"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  )
}
