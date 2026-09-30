import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WidthHandleShared } from '../components/program/WidthHandle'
import {
  BLOG_ASIDE_DEFAULT,
  BLOG_ASIDE_MIN,
  BLOG_NAV_MIN,
  asideCeiling,
  asideRoom,
  blogColumns,
  clampAside,
  clampNav,
  navCeiling,
  navDefaultWidth,
  navRoom,
  readAsideWidth,
  readNavWidth,
  writeAsideWidth,
  writeNavWidth,
  type BlogColumns,
} from '../lib/blogRails'

export interface BlogRails {
  /** 挂在 .blog__grid 上：量的、写的都是它 */
  gridRef: (node: HTMLDivElement | null) => void
  handles: { nav: boolean; aside: boolean }
  nav: WidthHandleShared
  aside: WidthHandleShared
}

interface Geometry {
  container: number
  columns: BlogColumns
  /** 左栏 / 右栏此刻的宽度（按默认宽度兜底，方便算上限） */
  nav: number
  aside: number
}

/**
 * 博客首页左右两条侧栏的宽度：把偏好贴成 CSS 变量（`--blog-nav-width` /
 * `--blog-aside-width`），中栏（卡片流）始终 `1fr` 吃满剩余空间。
 *
 * 和文章页一样**不进 React 状态**：拖动时每个 rAF 只改一次 CSS 变量，不重渲染长列表。
 * 几何与钳制规则在 `lib/blogRails.ts`，手柄是共用的 `components/program/WidthHandle.tsx`
 * （这里用 `scale: -1`，也就是"分界跟着指针走"的分隔条模型）。
 */
export function useBlogRails(): BlogRails {
  const grid = useRef<HTMLDivElement | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  /* 拖动期间不重贴（同 AGENTS 坑 6）：否则观察器一回调就把正在拖的宽度覆盖回去 */
  const dragging = useRef(false)
  const [visible, setVisible] = useState({ nav: false, aside: false })
  const [navValue, setNavValue] = useState(0)
  const [asideValue, setAsideValue] = useState(0)
  const [navMax, setNavMax] = useState(BLOG_NAV_MIN)
  const [asideMax, setAsideMax] = useState(BLOG_ASIDE_MIN)

  const measure = useCallback((): Geometry => {
    const el = grid.current
    if (el === null) return { container: 0, columns: 1, nav: 0, aside: 0 }
    const container = el.clientWidth
    const columns = blogColumns(container)
    const widthOf = (selector: string) => {
      const node = el.querySelector(selector)
      return node instanceof HTMLElement ? Math.round(node.getBoundingClientRect().width) : 0
    }
    /* 栏没显示（量出来是 0）时按该断点的默认宽度算，上限判断才有据可依 */
    return {
      container,
      columns,
      nav: widthOf('.blog__nav') || (columns >= 2 ? navDefaultWidth(columns) : 0),
      aside: widthOf('.blog__aside') || (columns >= 3 ? BLOG_ASIDE_DEFAULT : 0),
    }
  }, [])

  /** 按存下来的偏好重贴一次；没偏好就把变量摘掉，回落到 CSS 里的默认宽度 */
  const publish = useCallback(() => {
    const el = grid.current
    if (el === null || dragging.current) return
    const { container, columns } = measure()
    const navPref = readNavWidth()
    const asidePref = readAsideWidth()
    /* 算一条栏的上限时，另一条要用"它此刻多宽"（没拖过就是该断点的默认宽度） */
    const navBase = navPref ?? navDefaultWidth(columns)
    const asideBase = asidePref ?? BLOG_ASIDE_DEFAULT

    if (navPref === null) el.style.removeProperty('--blog-nav-width')
    else {
      el.style.setProperty(
        '--blog-nav-width',
        `${clampNav(navPref, container, asideBase, columns)}px`,
      )
    }
    if (asidePref === null) el.style.removeProperty('--blog-aside-width')
    else {
      el.style.setProperty(
        '--blog-aside-width',
        `${clampAside(asidePref, container, navBase, columns)}px`,
      )
    }

    /* 写完再量，读到的是最终布局 */
    const now = measure()
    const next = {
      nav: navRoom(now.container, now.aside, now.columns),
      aside: asideRoom(now.container, now.nav, now.columns),
    }
    setVisible((v) => (v.nav === next.nav && v.aside === next.aside ? v : next))
    setNavValue(now.nav)
    setAsideValue(now.aside)
    setNavMax(Math.max(BLOG_NAV_MIN, navCeiling(now.container, now.aside, now.columns)))
    setAsideMax(Math.max(BLOG_ASIDE_MIN, asideCeiling(now.container, now.nav, now.columns)))
  }, [measure])

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
    (side: 'nav' | 'aside', width: number): number => {
      const el = grid.current
      if (el === null) return 0
      const { container, columns, nav, aside } = measure()
      if (container <= 0) return 0
      if (side === 'nav') {
        const clamped = clampNav(width, container, aside, columns)
        el.style.setProperty('--blog-nav-width', `${clamped}px`)
        return clamped
      }
      const clamped = clampAside(width, container, nav, columns)
      el.style.setProperty('--blog-aside-width', `${clamped}px`)
      return clamped
    },
    [measure],
  )

  const currentWidth = useCallback(
    (side: 'nav' | 'aside') => {
      const now = measure()
      return side === 'nav' ? now.nav : now.aside
    },
    [measure],
  )

  const store = useCallback((side: 'nav' | 'aside', width: number) => {
    if (side === 'nav') {
      writeNavWidth(width)
      setNavValue(width)
    } else {
      writeAsideWidth(width)
      setAsideValue(width)
    }
  }, [])

  const bundle = useCallback(
    (side: 'nav' | 'aside', value: number, max: number): WidthHandleShared => ({
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
        if (side === 'nav') writeNavWidth(null)
        else writeAsideWidth(null)
        publish()
      },
      onStep: (delta) => {
        const clamped = apply(side, currentWidth(side) + delta)
        if (clamped > 0) store(side, clamped)
      },
      value,
      max,
    }),
    [apply, currentWidth, publish, store],
  )

  const nav = useMemo(() => bundle('nav', navValue, navMax), [bundle, navValue, navMax])
  const aside = useMemo(() => bundle('aside', asideValue, asideMax), [bundle, asideValue, asideMax])

  return { gridRef, handles: visible, nav, aside }
}
