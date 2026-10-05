import { iconBase, type IconProps } from './base'

/** 终端：一块屏幕 + 提示符 */
export function TerminalIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7.5 10l2.5 2-2.5 2M12.5 14h4" />
    </svg>
  )
}
