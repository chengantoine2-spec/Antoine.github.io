import { iconBase, type IconProps } from './base'

/** 项目：文件夹。左上那道 2 格高的台阶是它的身份证 ——
    16px 下台阶一糊，「项目」就和「资产库」的箱子撞车了 */
export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M3.5 7a1.6 1.6 0 0 1 1.6-1.6h3.3a1.6 1.6 0 0 1 1.3.7l.8 1.2a1.6 1.6 0 0 0 1.3.7h6.7a1.6 1.6 0 0 1 1.6 1.6v8.2a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6z" />
    </svg>
  )
}
