/* 图标契约：所有应用图标都长这样 —— 24×24 线稿、颜色走 currentColor。

   ⚠️ 这里定的几何是**全站统一**的，别在单个图标里改：
   - viewBox 24×24，内容留 1.5px 视觉边距（也就是大致画在 3~21 之间）
   - 描边 1.6、圆头圆角（round cap / join），fill 默认 none
   - 只有在需要实心小点时（比如「所有项目」的九宫格）才在该元素上写 fill="currentColor"
   - 颜色**只用 currentColor**：不许出现 #fff / rgb() / 具名色 —— 三套主题靠外面传进来的
     text-accent / text-chrome-ink 等令牌类换色，写死就废了
   - `aria-hidden`：图标的无障碍名由外层按钮的 aria-label 负责（验证脚本就靠 button[aria-label="博客"] 点它） */

export interface IconProps {
  /** 尺寸与颜色都从外面来：默认 h-6 w-6，配合 text-accent / text-chrome-ink 用 */
  className?: string
}

/** 每个图标组件都把它铺在 <svg> 上：<svg {...iconBase(className)}> */
export function iconBase(className = 'h-6 w-6') {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}
