import type { CSSProperties } from 'react'
import { useFullscreen } from '../../hooks/useFullscreen'

interface FullscreenButtonProps {
  /** icon：任务栏上那种方形图标按钮；text：设置窗口里那种文字按钮 */
  variant?: 'icon' | 'text'
  className?: string
  style?: CSSProperties
}

/**
 * 全屏按钮：任务栏（固定在右边，和「任务栏位置」并排）与设置窗口共用，
 * 逻辑都在 useFullscreen 里。浏览器不支持就整个不渲染。
 */
export function FullscreenButton({ variant = 'icon', className, style }: FullscreenButtonProps) {
  const { fullscreen, supported, toggle } = useFullscreen()

  /* 不支持就不摆一个点了没反应的按钮 */
  if (!supported) return null

  if (variant === 'text') {
    return (
      <button
        type="button"
        aria-pressed={fullscreen}
        onClick={() => void toggle()}
        className={
          className ?? 'rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover'
        }
      >
        {fullscreen ? '退出全屏' : '进入全屏'}
      </button>
    )
  }

  const label = fullscreen ? '退出全屏' : '全屏'
  return (
    <button
      type="button"
      style={style}
      title={label}
      aria-label={label}
      aria-pressed={fullscreen}
      onClick={() => void toggle()}
      className={className ?? 'grid shrink-0 place-items-center rounded text-chrome-ink hover:bg-hover'}
    >
      {/* 四角朝外 = 全屏，四角朝内 = 退出全屏，一眼能看出当前状态 */}
      <svg
        viewBox="0 0 12 12"
        className="h-1/2 w-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {fullscreen ? (
          <>
            <path d="M5 1.5V5H1.5" />
            <path d="M7 1.5V5h3.5" />
            <path d="M5 10.5V7H1.5" />
            <path d="M7 10.5V7h3.5" />
          </>
        ) : (
          <>
            <path d="M1.5 5V1.5H5" />
            <path d="M10.5 5V1.5H7" />
            <path d="M1.5 7v3.5H5" />
            <path d="M10.5 7v3.5H7" />
          </>
        )}
      </svg>
    </button>
  )
}
