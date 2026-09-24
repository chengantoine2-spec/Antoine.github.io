import type { ThemeId, WallpaperId } from '../types/desktop'

export const DEFAULT_THEME: ThemeId = 'caramel'
export const DEFAULT_WALLPAPER: WallpaperId = 'gradient'

/** 主题清单：设置窗口按它渲染，顺序即展示顺序 */
export const THEMES: Array<{ id: ThemeId; name: string; hint: string }> = [
  { id: 'caramel', name: '焦糖布丁', hint: '暖棕渐变 · 默认' },
  { id: 'linen', name: '亚麻纸', hint: '米白纸感' },
  { id: 'night', name: '暗夜', hint: '深色' },
]

/** 桌面背景清单 */
export const WALLPAPERS: Array<{ id: WallpaperId; name: string; hint: string }> = [
  { id: 'gradient', name: '主题渐变', hint: '纯 CSS，不加载图片 · 默认' },
  { id: 'image', name: '图片', hint: 'desktop.jpg' },
]

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((w) => w.id === value)
}
