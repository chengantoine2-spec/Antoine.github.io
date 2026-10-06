import type { ThemeId, WallpaperFit, WallpaperId } from '../types/desktop'

export const DEFAULT_THEME: ThemeId = 'caramel'
export const DEFAULT_WALLPAPER: WallpaperId = 'gradient'
export const DEFAULT_WALLPAPER_FIT: WallpaperFit = 'cover'
export const DEFAULT_WALLPAPER_DIM = 0

/** 主题清单：设置窗口按它渲染，顺序即展示顺序。
 *
 *  ⚠️ **现在只有两套**（macOS 浅 / 深，站主 2026-10-06「一切以 macOS 为准」，规格见
 *  `MACOS-BRIEF.md` 第 2.1 节）。但 `id` **仍然是历史键名** `caramel` / `night`：
 *  `ThemeId` 定义在 `src/types/desktop.ts`，改键名要连 `hooks/useAppearance.tsx` 一起动，
 *  那两个文件不在本轮改动范围。
 *  取名不对应的问题用**别名选择器**在 `tokens.css` 里抹平了：
 *    `caramel` / `linen` / `light` → 浅色；`night` / `dark` → 深色。
 *  所以老存档天然平滑：存 `caramel`/`linen` 的人看到新浅色，存 `night` 的人看到新深色。
 *  ⚠️ `linen` 已经从这份清单里去掉 → 老 `linen` 存档过不了 `isThemeId`、会落回 `DEFAULT_THEME`
 *  （= 浅色），结果一样是"平滑落到浅色"，**不要为了它再加回一条**。 */
export const THEMES: Array<{ id: ThemeId; name: string; hint: string }> = [
  { id: 'caramel', name: '浅色', hint: 'macOS 浅色 · 默认' },
  { id: 'night', name: '深色', hint: 'macOS 深色' },
]

/** 桌面背景清单；纹理全部是纯 CSS，不加载任何素材 */
export const WALLPAPERS: Array<{ id: WallpaperId; name: string; hint: string }> = [
  { id: 'gradient', name: '主题渐变', hint: '跟随主题 · 默认' },
  { id: 'grid', name: '网格纹理', hint: '纯 CSS' },
  { id: 'noise', name: '噪点纹理', hint: '纯 CSS' },
  { id: 'stripe', name: '斜纹纹理', hint: '纯 CSS' },
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

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((w) => w.id === value)
}

export function isWallpaperFit(value: unknown): value is WallpaperFit {
  return WALLPAPER_FITS.some((f) => f.id === value)
}
