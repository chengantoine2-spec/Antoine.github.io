import { iconBase, type IconProps } from './base'

/** 资产库：一个箱子 */
export function AssetsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M3.5 8.5l8.5-4 8.5 4-8.5 4z" />
      <path d="M3.5 8.5v7l8.5 4 8.5-4v-7" />
    </svg>
  )
}
