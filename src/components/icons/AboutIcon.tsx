import { iconBase, type IconProps } from './base'

/** 关于：一个人像（窗口里讲的是"这是谁"） */
export function AboutIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.3 3.1-5.4 7-5.4s7 2.1 7 5.4" />
    </svg>
  )
}
