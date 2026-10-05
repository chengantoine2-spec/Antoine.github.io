import { iconBase, type IconProps } from './base'

/** 博客创作：笔 + 底下那一小段"正在写"的墨线。
    只有一支笔看不出「写」，那条线才是它和「博客」的纸分开的关键 */
export function WriteIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M5.8 18.4l.7-3.3L16.4 5.2a1.9 1.9 0 0 1 2.7 2.7L9.2 18z" />
      <path d="M15 6.6l2.4 2.4" />
      <path d="M4.5 20.6h6.2" />
    </svg>
  )
}
