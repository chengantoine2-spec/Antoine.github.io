/** 主题：只影响颜色与圆角 */
export type ThemeId = 'caramel' | 'linen' | 'night'

/** 桌面背景：主题渐变 / 三种纯 CSS 纹理 / 图片 */
export type WallpaperId = 'gradient' | 'grid' | 'noise' | 'stripe' | 'image'

/** 图片背景的填充方式 */
export type WallpaperFit = 'cover' | 'contain' | 'repeat'

/** 任务栏停靠位置；左/右为竖排 */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

export type IconName =
  | 'about'
  | 'projects'
  | 'blog'
  | 'write'
  | 'skills'
  | 'contact'
  | 'terminal'
  | 'assets'
  | 'settings'

export type AppId = IconName

export interface AppDef {
  id: AppId
  /** 窗口名 */
  name: string
  /** 路由 */
  path: string
  /** 数据源 */
  source: string
  icon: IconName
  /** 打开时的默认尺寸；不写就用全局默认 760×520。窗口层放不下会自动缩 */
  defaultSize?: { w: number; h: number }
}

/** 一个窗口的位置与大小（含最大化状态），用于记忆 */
export interface WindowGeometry {
  x: number
  y: number
  w: number
  h: number
  maximized: boolean
}

export interface WindowState {
  id: AppId
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
}

export interface DesktopState {
  windows: WindowState[]
  topZ: number
}

export type WindowAction =
  /** bounds = 窗口层尺寸；geometry = 记住的几何（有就恢复，没有就按 size 居中） */
  | {
      type: 'open'
      id: AppId
      bounds: { w: number; h: number }
      size?: { w: number; h: number }
      geometry?: WindowGeometry
    }
  | { type: 'focus'; id: AppId }
  | { type: 'close'; id: AppId }
  | { type: 'closeAll' }
  | { type: 'minimize'; id: AppId }
  | { type: 'restore'; id: AppId }
  | { type: 'toggle-maximize'; id: AppId }
  | { type: 'move'; id: AppId; x: number; y: number }
  | { type: 'resize'; id: AppId; w: number; h: number }
