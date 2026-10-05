import { iconBase, type IconProps } from './base'

/** 博客：一页带文字的纸 */
export function BlogIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  )
}
