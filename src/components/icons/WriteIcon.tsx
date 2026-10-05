import { iconBase, type IconProps } from './base'

/** 博客创作：一支笔 */
export function WriteIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M4 20l4-.9L19.2 7.9a1.9 1.9 0 0 0 0-2.7l-.4-.4a1.9 1.9 0 0 0-2.7 0L4.9 16z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  )
}
