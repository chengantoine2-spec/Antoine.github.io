import type { CSSProperties } from 'react'
import { useFullscreen } from '../../hooks/useFullscreen'
import { FullscreenGlyph } from '../icons'

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
      <FullscreenGlyph on={fullscreen} />
    </button>
  )
}
