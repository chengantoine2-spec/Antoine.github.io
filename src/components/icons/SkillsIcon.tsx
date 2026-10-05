import { iconBase, type IconProps } from './base'

/** 技能：一颗星 */
export function SkillsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 3l2.6 5.6 6.1.8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.4l6.1-.8z" />
    </svg>
  )
}
