import { iconBase, type IconProps } from './base'

/** 设置：六角螺母（六边形 + 中心孔）。
    原来是「圆 + 八根辐条」的简写齿轮 —— 八根只有 1.5 格长的小短线在 16px 下糊成一圈光晕，
    是全套里最花的一张。换成两只元素，形状在小尺寸也立得住 */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 3.6 20 8v8l-8 4.4L4 16V8z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  )
}
