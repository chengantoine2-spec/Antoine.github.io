import type { ThemeId, WallpaperFit, WallpaperId } from '../types/desktop'

export const DEFAULT_THEME: ThemeId = 'light'
export const DEFAULT_WALLPAPER: WallpaperId = 'gradient'
export const DEFAULT_WALLPAPER_FIT: WallpaperFit = 'cover'
export const DEFAULT_WALLPAPER_DIM = 0

/** 主题清单：设置窗口按它渲染，顺序即展示顺序。
 *
 *  只有两套（macOS 浅 / 深，站主 2026-10-06「一切以 macOS 为准」，规格见 `MACOS-BRIEF.md` 第 2 节）。
 *  `id` 就是正名 `light` / `dark`；2026-10-06 之前是 `caramel` / `linen` / `night`（暖色三套），
 *  老存档由下面的 normalizeTheme() 迁移，`tokens.css` 里也留着老键名的别名选择器兜底。 */
export const THEMES: Array<{ id: ThemeId; name: string; hint: string }> = [
  { id: 'light', name: '浅色', hint: 'macOS 浅色 · 默认' },
  { id: 'dark', name: '深色', hint: 'macOS 深色' },
]

/** 桌面背景清单；纹理与渐变全部是纯 CSS，不加载任何素材 */
export const WALLPAPERS: Array<{ id: WallpaperId; name: string; hint: string }> = [
  { id: 'gradient', name: '主题渐变', hint: '跟随主题 · 默认' },
  { id: 'grid', name: '网格纹理', hint: '纯 CSS' },
  { id: 'noise', name: '噪点纹理', hint: '纯 CSS' },
  { id: 'stripe', name: '斜纹纹理', hint: '纯 CSS' },
  { id: 'aurora', name: '极光', hint: 'macOS 味道 · 青紫光晕' },
  { id: 'sunset', name: '晚霞', hint: 'macOS 味道 · 暖橘粉' },
  { id: 'mist', name: '海雾', hint: 'macOS 味道 · 冷蓝雾' },
  { id: 'violet', name: '紫夜', hint: 'macOS 味道 · 靛紫' },
  { id: 'image', name: '图片', hint: 'desktop.jpg' },
]

/** 填充方式：只对图片背景生效 */
export const WALLPAPER_FITS: Array<{ id: WallpaperFit; name: string; hint: string }> = [
  { id: 'cover', name: '铺满裁切', hint: 'cover' },
  { id: 'contain', name: '完整显示', hint: 'contain' },
  { id: 'repeat', name: '平铺', hint: 'repeat' },
]

/** 暗化蒙层档位（0~0.45），让浅色壁纸上的图标与窗口更清楚 */
export const DIM_LEVELS = [0, 0.15, 0.3, 0.45]

/** 任务栏图标边长档位；null = 跟随任务栏厚度（跟着厚度时上限见 Dock 的 BTN_MAX） */
export const ICON_SIZES: Array<{ id: number | null; name: string }> = [
  { id: null, name: '跟随厚度' },
  { id: 32, name: '小' },
  { id: 40, name: '中' },
  { id: 48, name: '大' },
  { id: 56, name: '特大' },
  { id: 64, name: '超大' },
]

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

/** 历史键名 -> 正名。**别删**（老存档里存的就是这些值） */
const LEGACY_THEME: Record<string, ThemeId> = { caramel: 'light', linen: 'light', night: 'dark' }

/** 读存档用：新键名与历史键名都算合法（历史值随后交给 normalizeTheme 迁移） */
export function isStoredTheme(value: unknown): value is ThemeId {
  return isThemeId(value) || (typeof value === 'string' && value in LEGACY_THEME)
}

/** 把存档里的主题值迁移成正名：caramel / linen -> light，night -> dark，其它 -> 默认 */
export function normalizeTheme(value: unknown): ThemeId {
  if (isThemeId(value)) return value
  if (typeof value === 'string' && value in LEGACY_THEME) return LEGACY_THEME[value]
  return DEFAULT_THEME
}

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((w) => w.id === value)
}

export function isWallpaperFit(value: unknown): value is WallpaperFit {
  return WALLPAPER_FITS.some((f) => f.id === value)
}
