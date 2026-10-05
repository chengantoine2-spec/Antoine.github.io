import { iconBase, type IconProps } from './base'

/** 项目：文件夹 */
export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z" />
      <path d="M3.5 7.5V5.5h6l1.6 2" />
    </svg>
  )
}
