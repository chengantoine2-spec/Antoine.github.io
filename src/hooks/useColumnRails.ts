import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WidthHandleShared } from '../components/program/WidthHandle'
import {
  asideCeiling,
  asideRoom,
  clampAside,
  clampNav,
  navCeiling,
  navDefaultWidth,
  navRoom,
  railColumns,
  railVar,
  readRail,
  writeRail,
  type RailColumns,
  type RailSide,
  type RailSpec,
} from '../lib/columnRails'

export interface ColumnRails {
  /** 挂在网格容器上：量的、写的都是它 */
  gridRef: (node: HTMLDivElement | null) => void
  handles: { nav: boolean; aside: boolean }
  nav: WidthHandleShared
  aside: WidthHandleShared
}

interface Geometry {
  container: number
  columns: RailColumns
  /** 左栏 / 右栏此刻的宽度（按默认宽度兜底，方便算上限） */
  nav: number
  aside: number
  /** 这个视图里到底有没有这两条栏（教程区就没有左栏） */
  hasNav: boolean
  hasAside: boolean
}

/**
 * 「内容列 + 两侧栏」窗口的栏宽：把偏好贴成 `--xxx-nav-width` / `--xxx-aside-width`，
 * 内容列始终 `1fr` 吃满剩余空间（拖的是分界）。
 *
 * 和文章页一样**不进 React 状态**：拖动时每个 rAF 只改一次 CSS 变量，不重渲染长列表。
 * 几何与范围在 `lib/columnRails.ts`（新窗口加这套只需抄一份 RailSpec），
 * 手柄是共用的 `components/program/WidthHandle.tsx`（`scale: -1` = 分界跟着指针走）。
 */
export function useColumnRails(spec: RailSpec): ColumnRails {
  const grid = useRef<HTMLDivElement | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  /* 拖动期间不重贴（同 AGENTS 坑 6）：否则观察器一回调就把正在拖的宽度覆盖回去 */
  const dragging = useRef(false)
  const [visible, setVisible] = useState({ nav: false, aside: false })
  const [navValue, setNavValue] = useState(0)
  const [asideValue, setAsideValue] = useState(0)
  const [navMax, setNavMax] = useState(spec.navMin)
  const [asideMax, setAsideMax] = useState(spec.asideMin)

  const measure = useCallback((): Geometry => {
    const el = grid.current
    if (el === null) {
      return { container: 0, columns: 1, nav: 0, aside: 0, hasNav: false, hasAside: false }
    }
    const container = el.clientWidth
    const columns = railColumns(spec, container)
    const node = (selector: string) => {
      const found = el.querySelector(selector)
      return found instanceof HTMLElement ? found : null
    }
    const navEl = node(spec.navSelector)
    const asideEl = node(spec.asideSelector)
    const widthOf = (target: HTMLElement | null) =>
      target === null ? 0 : Math.round(target.getBoundingClientRect().width)
    /* 栏没显示（量出来是 0）时按该断点的默认宽度算，上限判断才有据可依 */
    return {
      container,
      columns,
      nav: widthOf(navEl) || (columns >= 2 ? navDefaultWidth(spec, columns) : 0),
      aside: widthOf(asideEl) || (columns >= 3 ? spec.asideDefault : 0),
      hasNav: navEl !== null,
      hasAside: asideEl !== null,
    }
  }, [spec])

  /** 按存下来的偏好重贴一次；没偏好就把变量摘掉，回落到 CSS 里的默认宽度 */
  const publish = useCallback(() => {
    const el = grid.current
    if (el === null || dragging.current) return
    const { container, columns } = measure()
    const navPref = readRail(spec, 'nav')
    const asidePref = readRail(spec, 'aside')
    /* 算一条栏的上限时，另一条要用"它此刻多宽"（没拖过就是该断点的默认宽度） */
    const navBase = navPref ?? navDefaultWidth(spec, columns)
    const asideBase = asidePref ?? spec.asideDefault

    if (navPref === null) el.style.removeProperty(spec.navVar)
    else {
      el.style.setProperty(
        spec.navVar,
        `${clampNav(spec, navPref, container, asideBase, columns)}px`,
      )
    }
    if (asidePref === null) el.style.removeProperty(spec.asideVar)
    else {
      el.style.setProperty(
        spec.asideVar,
        `${clampAside(spec, asidePref, container, navBase, columns)}px`,
      )
    }

    /* 写完再量，读到的是最终布局 */
    const now = measure()
    const next = {
      nav: now.hasNav && navRoom(spec, now.container, now.aside, now.columns),
      aside: now.hasAside && asideRoom(spec, now.container, now.nav, now.columns),
    }
    setVisible((v) => (v.nav === next.nav && v.aside === next.aside ? v : next))
    setNavValue(now.nav)
    setAsideValue(now.aside)
    setNavMax(Math.max(spec.navMin, navCeiling(spec, now.container, now.aside, now.columns)))
    setAsideMax(Math.max(spec.asideMin, asideCeiling(spec, now.container, now.nav, now.columns)))
  }, [measure, spec])

  const gridRef = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect()
      observer.current = null
      grid.current = node
      if (node === null) return
      observer.current = new ResizeObserver(() => publish())
      observer.current.observe(node)
      /* ref 回调在提交阶段跑，这里同步量一次的 setState 会在绘制前生效，不会闪 */
      publish()
    },
    [publish],
  )

  useEffect(() => () => observer.current?.disconnect(), [])

  /** 拖动中只改 CSS 变量，不落盘也不 setState；返回钳制后的值给落盘用 */
  const apply = useCallback(
    (side: RailSide, width: number): number => {
      const el = grid.current
      if (el === null) return 0
      const { container, columns, nav, aside } = measure()
      if (container <= 0) return 0
      const clamped =
        side === 'nav'
          ? clampNav(spec, width, container, aside, columns)
          : clampAside(spec, width, container, nav, columns)
      el.style.setProperty(railVar(spec, side), `${clamped}px`)
      return clamped
    },
    [measure, spec],
  )

  const currentWidth = useCallback(
    (side: RailSide) => {
      const now = measure()
      return side === 'nav' ? now.nav : now.aside
    },
    [measure],
  )

  const store = useCallback(
    (side: RailSide, width: number) => {
      writeRail(spec, side, width)
      if (side === 'nav') setNavValue(width)
      else setAsideValue(width)
    },
    [spec],
  )

  const bundle = useCallback(
    (side: RailSide, value: number, max: number): WidthHandleShared => ({
      onStart: () => {
        dragging.current = true
        return currentWidth(side)
      },
      onDrag: (width) => {
        apply(side, width)
      },
      onCommit: (width) => {
        const clamped = apply(side, width)
        if (clamped > 0) store(side, clamped)
      },
      onEnd: () => {
        dragging.current = false
        publish()
      },
      onReset: () => {
        /* 清掉这个键 = 回到该断点的默认宽度 */
        writeRail(spec, side, null)
        publish()
      },
      onStep: (delta) => {
        const clamped = apply(side, currentWidth(side) + delta)
        if (clamped > 0) store(side, clamped)
      },
      value,
      max,
    }),
    [apply, currentWidth, publish, spec, store],
  )

  const nav = useMemo(() => bundle('nav', navValue, navMax), [bundle, navValue, navMax])
  const aside = useMemo(() => bundle('aside', asideValue, asideMax), [bundle, asideValue, asideMax])

  return { gridRef, handles: visible, nav, aside }
}
