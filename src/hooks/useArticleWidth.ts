import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WidthHandleShared } from '../components/program/WidthHandle'
import {
  ARTICLE_HANDLE_ROOM,
  clampArticleWidth,
  maxArticleWidth,
  readArticleWidth,
  resolveRailMode,
  writeArticleWidth,
} from '../lib/readingWidth'

export interface ArticleWidth {
  /** 挂在 .article__grid 上：量的、写的都是它 */
  gridRef: (node: HTMLDivElement | null) => void
  /** 两侧余量够不够放那两条抓取带 */
  handlesVisible: boolean
  handles: WidthHandleShared
}

interface Geometry {
  /** 正文区真正可用的宽度（不含纵向滚动条），钳制用它 */
  available: number
  /** 稳定基准：把滚动条占的那几像素加回来。窄栏让位判定用这个，才不会随滚动条忽隐忽现 */
  stable: number
}

/** 滚动条占掉的那几像素：它随内容长短出现/消失，所以要单独算出来加回稳定基准 */
function scrollbarSpace(el: HTMLElement): number {
  let node = el.parentElement
  while (node !== null && node !== document.body) {
    const style = getComputedStyle(node)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return Math.max(0, node.offsetWidth - node.clientWidth)
    }
    node = node.parentElement
  }
  return 0
}

/**
 * 正文列宽：把「存下来的偏好」贴成 CSS 变量（`--article-main-width`），并按需给
 * `.article__grid` 写 `data-rails` 让窄栏让位。
 *
 * 和 DSH 一样**不进 React 状态**：拖动时每个 rAF 只改一次 CSS 变量，
 * 不触发重渲染 —— 否则长文章的 markdown 会跟着每一帧重算。
 * 只有宽度值（给 aria）、上限与手柄可见性走 state，值没变时 React 自己会跳过重渲染。
 *
 * 几何与钳制规则在 `lib/readingWidth.ts`，手柄在 `components/program/WidthHandle.tsx`，
 * 样式在 `globals.css` 的 `.width-handle` / `.article__grid[data-rails]` 两节。
 */
export function useArticleWidth(): ArticleWidth {
  const grid = useRef<HTMLDivElement | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  /** 拖动中：这期间「存下来的偏好」不算数，别把正在拖的宽度覆盖回去（见下面 publish 的注释） */
  const dragging = useRef(false)
  const [handlesVisible, setHandlesVisible] = useState(false)
  const [value, setValue] = useState(0)
  const [max, setMax] = useState(0)

  const measure = useCallback((): Geometry => {
    const el = grid.current
    if (el === null) return { available: 0, stable: 0 }
    const available = el.clientWidth
    return { available, stable: available + scrollbarSpace(el) }
  }, [])

  /** 量正文列此刻渲染出来的宽度：拖动基准、手柄可见性、aria 都用它 */
  const mainWidth = useCallback((): number => {
    const main = grid.current?.querySelector('.article__main')
    return main instanceof HTMLElement ? main.getBoundingClientRect().width : 0
  }, [])

  /** 按「存下来的偏好」重贴一次：没偏好就把变量摘掉，回落到 CSS 里按行宽自适应的 88ch */
  const publish = useCallback(() => {
    const el = grid.current
    if (el === null) return
    /* ⚠️ 拖动中一律不重贴：拖宽/拖窄会连带窄栏让位，进而让内容高矮变化、滚动条进出，
       于是 ResizeObserver 立刻回调一次 —— 那时若按"存下来的偏好"（没存过就是 null）
       重贴，正在拖的宽度就被抹掉了，表现是拖到一半突然弹回去。踩过。 */
    if (dragging.current) return
    const { available, stable } = measure()

    const preference = readArticleWidth()
    const width = preference === null ? null : clampArticleWidth(preference, available)
    if (width === null) {
      el.style.removeProperty('--article-main-width')
      /* 没存过偏好就不写 data-rails，栏数照旧由 CSS 的容器查询决定 */
      el.removeAttribute('data-rails')
    } else {
      el.style.setProperty('--article-main-width', `${width}px`)
      el.setAttribute('data-rails', resolveRailMode(stable, width))
    }

    /* 变量与栏位都定完再量，读到的才是最终布局 */
    const rendered = mainWidth()
    setValue(Math.round(rendered))
    setMax(maxArticleWidth(available))
    setHandlesVisible(rendered > 0 && available - rendered >= ARTICLE_HANDLE_ROOM)
  }, [mainWidth, measure])

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
    (width: number): number => {
      const el = grid.current
      if (el === null) return 0
      const { available, stable } = measure()
      if (available <= 0) return 0
      const clamped = clampArticleWidth(width, available)
      el.style.setProperty('--article-main-width', `${clamped}px`)
      /* 拖到装不下时窄栏当场让位，指针底下立刻看得到效果 */
      el.setAttribute('data-rails', resolveRailMode(stable, clamped))
      return clamped
    },
    [measure],
  )

  const onStart = useCallback(() => {
    dragging.current = true
    return Math.round(mainWidth())
  }, [mainWidth])

  const onDrag = useCallback(
    (width: number) => {
      apply(width)
    },
    [apply],
  )

  const onCommit = useCallback(
    (width: number) => {
      const clamped = apply(width)
      if (clamped === 0) return
      writeArticleWidth(clamped)
      setValue(clamped)
    },
    [apply],
  )

  const onEnd = useCallback(() => {
    dragging.current = false
    publish()
  }, [publish])

  const onReset = useCallback(() => {
    writeArticleWidth(null)
    publish()
  }, [publish])

  const onStep = useCallback(
    (delta: number) => {
      const clamped = apply(mainWidth() + delta)
      if (clamped === 0) return
      writeArticleWidth(clamped)
      setValue(clamped)
    },
    [apply, mainWidth],
  )

  const handles = useMemo<WidthHandleShared>(
    () => ({ onStart, onDrag, onCommit, onEnd, onReset, onStep, value, max }),
    [onStart, onDrag, onCommit, onEnd, onReset, onStep, value, max],
  )

  return { gridRef, handlesVisible, handles }
}
