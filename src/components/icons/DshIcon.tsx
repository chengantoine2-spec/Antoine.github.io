import { iconBase, type IconProps } from './base'

/** DSH：芹菜（三根茎 + 顶端叶片）。
    站叫「芹菜耕地」，DSH 是这块地本身，所以它分到的菜就是站名里那一样。
    全套 11 个图标里唯一画了菜的一张 —— 菜是彩蛋，不是图标主题 */
export function DshIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 20.4V8.4" />
      <path d="M9.2 20.4c-.5-3.7-.3-7.2.6-10.4" />
      <path d="M14.8 20.4c.5-3.7.3-7.2-.6-10.4" />
      <path d="M9.9 9.8 8.1 8a1.5 1.5 0 0 1 2.1-2.1l1.8 1.8 1.8-1.8A1.5 1.5 0 0 1 15.9 8l-1.8 1.8" />
    </svg>
  )
}
