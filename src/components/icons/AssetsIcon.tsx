import { iconBase, type IconProps } from './base'

/** 资产库：一个等轴箱子。
    三根线才是一只箱子：外轮廓（六边形）+ 盖面那道 V + 前棱。
    原先少了前棱，16px 下只是个六边形 —— 也是它和「项目」文件夹撞车的原因之一 */
export function AssetsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 3.9 20.5 8v7.9L12 20.1 3.5 15.9V8z" />
      <path d="M3.5 8 12 12.1 20.5 8" />
      <path d="M12 12.1v8" />
    </svg>
  )
}
