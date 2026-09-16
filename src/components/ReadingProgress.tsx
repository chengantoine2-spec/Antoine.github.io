/**
 * 阅读进度条：吸顶细条，按文章区的滚动比例填充。
 */
import { useEffect, useState } from 'react'

export interface ReadingProgressProps {
  /** 计算进度的容器；不传则用整页滚动高度 */
  targetId?: string
  className?: string
}

export function ReadingProgress({ targetId, className = '' }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    const compute = () => {
      frame = 0
      const target = targetId ? document.getElementById(targetId) : null
      if (target) {
        const start = target.offsetTop
        const total = target.scrollHeight - window.innerHeight
        const scrolled = window.scrollY - start
        const ratio = total > 0 ? scrolled / total : 0
        setProgress(Math.min(1, Math.max(0, ratio)))
        return
      }
      const doc = document.documentElement
      const total = doc.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0)
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(compute)
    }

    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [targetId])

  const percent = Math.round(progress * 100)

  return (
    <div
      className={`no-print fixed inset-x-0 top-0 z-50 h-1 bg-caramel-200/70 dark:bg-caramel-700/70 ${className}`}
      role="progressbar"
      aria-label="阅读进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className="h-full bg-caramel-500 transition-[width] duration-150 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default ReadingProgress
