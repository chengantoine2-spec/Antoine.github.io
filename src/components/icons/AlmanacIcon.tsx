import { iconBase, type IconProps } from './base'

/** 黄历：一本翻开的历书 + 书脊上的竖线（日子一页页翻过去的意象） */
export function AlmanacIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      {/* 书页 */}
      <path d="M4 5.5h6.5a1.5 1.5 0 011.5 1.5v11a1.2 1.2 0 00-1.2-1.2H4z" />
      <path d="M20 5.5h-6.5A1.5 1.5 0 0012 7v11a1.2 1.2 0 011.2-1.2H20z" />
      {/* 书脊 */}
      <path d="M12 7v11" />
    </svg>
  )
}
