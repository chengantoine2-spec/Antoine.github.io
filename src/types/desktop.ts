/** 主题：只影响颜色与圆角 */
export type ThemeId = 'caramel' | 'linen' | 'night'

/** 桌面背景：主题渐变 / 三种纯 CSS 纹理 / 图片 */
export type WallpaperId = 'gradient' | 'grid' | 'noise' | 'stripe' | 'image'

/** 图片背景的填充方式 */
export type WallpaperFit = 'cover' | 'contain' | 'repeat'

/** 任务栏停靠位置；左/右为竖排 */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/** 窗口标签栏（像浏览器的标签页）：顶部一条 / 左侧一条 / 不显示 */
export type TabPosition = 'top' | 'left' | 'off'

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
  | 'wiki'
  | 'dsh'

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
  /**
   * 这块地里的「一样菜」：站名叫芹菜耕地，每个窗口对应一种蔬菜水果。
   * 只出现在提示与菜单里（图标仍是自绘线稿），不参与逻辑。
   */
  veggie: string
  /** 打开时的默认尺寸；不写就用全局默认 760×520。窗口层放不下会自动缩 */
  defaultSize?: { w: number; h: number }
  /**
   * 只在本地（localhost / 127.0.0.1）挂载的窗口：任务栏、所有项目、路由都会跳过它。
   * 给「必须是本机才有意义」的应用用（比如 DSH 快捷入口 —— 线上站点够不到 127.0.0.1）。
   */
  localOnly?: boolean
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
  /**
   * 窗口里的「子页面」参数：博客详情 `/blog/17` → `'17'`，项目详情同理。
   * 一个应用只有一个窗口，所以同一个应用同时只显示一个页面
   * （用户 2026-10-05 定的范围：多窗口 = 不同应用各一个，不做同应用多开）。
   */
  param?: string
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
      /** 目标子页面；**不传 = 回到这个应用的根**（点任务栏图标就该回根） */
      param?: string
    }
  /** 只在窗口内部换页（点卡片进详情），不动几何、不重开 */
  | { type: 'setParam'; id: AppId; param?: string }
  | { type: 'focus'; id: AppId }
  | { type: 'close'; id: AppId }
  | { type: 'closeAll' }
  | { type: 'minimize'; id: AppId }
  | { type: 'restore'; id: AppId }
  | { type: 'toggle-maximize'; id: AppId }
  | { type: 'move'; id: AppId; x: number; y: number }
  | { type: 'resize'; id: AppId; w: number; h: number }
