/**
 * 焦糖布丁色板（唯一颜色来源）
 * tailwind.config.js 里同步扩展了同名色阶；此处导出供 JS 场景（如 Giscus 主题、
 * 图表、内联样式）复用，避免出现第二套硬编码颜色。
 */
export const caramel = {
  50: '#FFF8F0',
  100: '#F7E6D0',
  200: '#EFD3B0',
  300: '#E0B98A',
  400: '#D4A574',
  500: '#C68A5B',
  600: '#A96F44',
  700: '#855434',
  800: '#5C3A22',
  900: '#3D2B1F',
} as const

export type CaramelShade = keyof typeof caramel

export const chartPalette = [
  caramel[500],
  caramel[600],
  caramel[400],
  caramel[700],
  caramel[300],
] as const
