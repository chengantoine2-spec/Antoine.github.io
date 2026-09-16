/**
 * 目录 TOC：随滚动高亮当前标题（IntersectionObserver），点击平滑跳转。
 */
import { useEffect, useMemo, useState } from 'react'
import type { TocItem } from '../lib/text'

export interface TocProps {
  items: TocItem[]
  /** 只显示到该层级，默认 3 */
  maxLevel?: number
  className?: string
}

export function Toc({ items, maxLevel = 3, className = '' }: TocProps) {
  const visible = useMemo(() => items.filter((i) => i.level <= maxLevel), [items, maxLevel])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (visible.length === 0) return
    const elements = visible
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit?.target.id) setActiveId(hit.target.id)
      },
      // 顶部导航 80px + 底部留出空间，避免多个标题同时命中
      { rootMargin: '-80px 0px -70% 0px', threshold: [0, 1] },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [visible])

  if (visible.length === 0) {
    return (
      <p className={`text-sm text-caramel-600 dark:text-caramel-300 ${className}`}>
        这篇没有小标题
      </p>
    )
  }

  return (
    <nav aria-label="目录" className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-caramel-600 dark:text-caramel-300">
        目录
      </p>
      <ul className="space-y-1 border-l border-caramel-200 dark:border-caramel-700">
        {visible.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 10}px` }}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById(item.id)
                  if (!el) return
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setActiveId(item.id)
                  // 同步地址栏，便于分享锚点
                  history.replaceState(null, '', `#${item.id}`)
                }}
                className={`-ml-px block border-l-2 py-1 pl-3 text-sm leading-snug transition ${
                  active
                    ? 'border-caramel-500 font-semibold text-caramel-700 dark:text-caramel-100'
                    : 'border-transparent text-caramel-600 hover:border-caramel-300 hover:text-caramel-700 dark:text-caramel-300 dark:hover:text-caramel-100'
                }`}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Toc
