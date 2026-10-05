import { iconBase, type IconProps } from './base'

/** 联系：信封 */
export function ContactIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  )
}
