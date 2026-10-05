/** 主题：只影响颜色与圆角 */
export type ThemeId = 'caramel' | 'linen' | 'night'

/** 桌面背景：主题渐变 / 三种纯 CSS 纹理 / 图片 */
export type WallpaperId = 'gradient' | 'grid' | 'noise' | 'stripe' | 'image'

/** 图片背景的填充方式 */
export type WallpaperFit = 'cover' | 'contain' | 'repeat'

/** 任务栏停靠位置；左/右为竖排 */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/**
 * 任务栏图标区的展示模式（用户 2026-10-05 追加：「旧的展示方式也作为可选项放进设置里面」）：
 * - `wheel`：新的**循环轮盘** —— 永远单行/单列、首尾相接循环、中央放大、按住拖动浏览、竖拖换位（**默认**）
 * - `wrap`：**完全旧行为** —— 最多 3 行折行、静态、不放大、没有拖拽手势，顺序仍由设置里那份清单决定
 */
export type DockMode = 'wheel' | 'wrap'

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

/** 一个窗口框的位置与大小（含最大化状态），用于记忆 */
export interface WindowGeometry {
  x: number
  y: number
  w: number
  h: number
  maximized: boolean
}

/**
 * 吸附 / 平铺区：拖到屏幕边缘对半分屏，四角是四分之一，上边是最大化。
 * 拖动时的预览与松手后的落位共用 `lib/snap.ts` 的同一份几何。
 */
export type SnapZone = 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br'

/** 框里的一个标签：一个应用 + 它当前停在的子页面 */
export interface WindowTab {
  id: AppId
  /** 子页面参数：博客详情 `/blog/17` → `'17'`；应用根就是 undefined */
  param?: string
}

/**
 * **一个窗口框**（不是"一个应用"）：框里可以有多个标签（合并后）。
 * 用户 2026-10-05 拍板的模型：标签活在各自窗口框的边框里面，框可以合并 / 拆分。
 */
export interface WindowState {
  /** 框 id：`w1`、`w2`…，由 reducer 的 nextKey 递增 */
  key: string
  /** 至少一个标签；顺序 = 标签栏顺序 */
  tabs: WindowTab[]
  /** 当前标签下标（一定落在 tabs 范围内） */
  active: number
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
  /** 当前吸附在哪个区（没吸附就是 undefined） */
  snap?: SnapZone
  /** 吸附前的矩形：解吸附时回到这里 */
  restore?: { x: number; y: number; w: number; h: number }
}

export interface DesktopState {
  windows: WindowState[]
  topZ: number
  /** 下一个可用的框号 */
  nextKey: number
}

/** 刷新恢复用的一帧（`desktop.openWindows` 里的形状） */
export interface SessionFrame {
  tabs: WindowTab[]
  active: number
  /** 老数据可能没有几何：那就按应用记住的 / 居中落位 */
  geometry?: WindowGeometry
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
  | { type: 'focusFrame'; key: string }
  /** 切到框里第 index 个标签（越界就当没发生） */
  | { type: 'activate'; key: string; index: number }
  | { type: 'closeFrame'; key: string }
  /** 关掉一个标签；最后一个被关掉 = 整个框关掉 */
  | { type: 'closeTab'; key: string; index: number }
  | { type: 'closeAll' }
  | { type: 'minimize'; key: string }
  | { type: 'restore'; key: string }
  | { type: 'toggle-maximize'; key: string }
  | { type: 'move'; key: string; x: number; y: number }
  | { type: 'resize'; key: string; w: number; h: number }
  /** 贴到某个吸附区（rect = **窗口层坐标**的目标矩形，外壳按整个视口算好再减掉层偏移） */
  | { type: 'snap'; key: string; zone: SnapZone; rect: { x: number; y: number; w: number; h: number } }
  /**
   * 解吸附：回到 `restore` 里的矩形。
   * 拖动时带上 anchor（指针在标题栏宽度里的相对位置 0~1）与 pointer（指针在窗口层里的坐标），
   * 就能把窗口"摆回指针下面"，不会跳一下。
   */
  | { type: 'unsnap'; key: string; anchor?: number; pointer?: { x: number; y: number } }
  /** 改某个标签的子页面（点卡片进详情这种） */
  | { type: 'setParam'; key: string; index: number; param?: string }
  /** 把 fromKey 那一框整个并进 intoKey：标签接在后头，被拖过来的那个成为活动标签 */
  | { type: 'merge'; fromKey: string; intoKey: string }
  /** 把框里第 index 个标签拆出去单独成一框（位置给指针附近那个矩形） */
  | { type: 'detach'; key: string; index: number; x: number; y: number; w: number; h: number }
  /** 框内标签换位置（拖拽排序） */
  | { type: 'reorder'; key: string; from: number; to: number }
  /** 刷新恢复：直接照着会话记忆把框建起来（老格式由 lib/windowStore 归一化成这个形状） */
  | { type: 'hydrate'; frames: SessionFrame[]; bounds: { w: number; h: number } }
