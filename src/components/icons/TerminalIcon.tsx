import { iconBase, type IconProps } from './base'

/** 终端：一块横向屏幕 + 提示符。
    光标是整张图里唯一的实心点（fill="currentColor"，跟「所有项目」的九宫格一个用法），
    16px 下就靠它认出来 */
export function TerminalIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" />
      <path d="M7.4 9.4l2.7 2.7-2.7 2.7" />
      <rect x="13.2" y="13.75" width="3.4" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  )
}
