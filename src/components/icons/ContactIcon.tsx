import { iconBase, type IconProps } from './base'

/** 联系：信封。封口线从两上角稍往里起笔，不压框线 */
export function ContactIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.8" />
      <path d="M4.6 7.2 12 12.8l7.4-5.6" />
    </svg>
  )
}
