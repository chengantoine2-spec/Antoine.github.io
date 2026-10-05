import { iconBase, type IconProps } from './base'

/** 博客：竖长的纸 + 右上折角。
    刻意不用方框：方框加三行字和「终端」的横向屏幕在 16px 下是同一坨 */
export function BlogIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M13.8 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.7z" />
      <path d="M13.8 3.5v5.2H19" />
      <path d="M8.6 12.6h6.8M8.6 15.6h6.8M8.6 18.6h3.4" />
    </svg>
  )
}
