import { snapRect } from './snap'
import type { DesktopState, WindowAction, WindowGeometry, WindowState } from '../types/desktop'

const DEFAULT_W = 760
const DEFAULT_H = 520
const MIN_W = 360
const MIN_H = 240
const GAP = 24
/** 拖动窗口时指针大约落在标题栏往下这么深的位置 —— 解吸附时用它把窗口摆回指针下 */
const TITLE_GRAB_Y = 18

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** 把记住的几何夹进当前窗口层：换了小屏也不会把窗口丢到看不见的地方 */
function clampGeometry(geo: WindowGeometry, bounds: { w: number; h: number }): WindowGeometry {
  const w = clamp(Math.round(geo.w), MIN_W, Math.max(MIN_W, bounds.w - GAP))
  const h = clamp(Math.round(geo.h), MIN_H, Math.max(MIN_H, bounds.h - GAP))
  return {
    w,
    h,
    x: clamp(Math.round(geo.x), 0, Math.max(0, bounds.w - w)),
    y: clamp(Math.round(geo.y), 0, Math.max(0, bounds.h - h)),
    maximized: geo.maximized,
  }
}

/** 新窗口落位：按 app 的默认尺寸居中；放不下就缩到能放下 */
function centerSpot(bounds: { w: number; h: number }, size?: { w: number; h: number }): WindowGeometry {
  const target = size ?? { w: DEFAULT_W, h: DEFAULT_H }
  const w = Math.max(MIN_W, Math.min(target.w, bounds.w - GAP))
  const h = Math.max(MIN_H, Math.min(target.h, bounds.h - GAP))
  return {
    w,
    h,
    x: Math.max(0, Math.round((bounds.w - w) / 2)),
    y: Math.max(0, Math.round((bounds.h - h) / 2)),
    maximized: false,
  }
}

function update(
  state: DesktopState,
  id: WindowState['id'],
  patch: (win: WindowState) => WindowState,
): DesktopState {
  return { ...state, windows: state.windows.map((w) => (w.id === id ? patch(w) : w)) }
}

/** 纯函数窗口管理器：不碰 DOM、不读 localStorage，方便单独测试与移植 */
export function windowReducer(state: DesktopState, action: WindowAction): DesktopState {
  switch (action.type) {
    case 'open': {
      const exist = state.windows.find((w) => w.id === action.id)
      const z = state.topZ + 1
      if (exist) {
        /* 已经开着：抬到最上面、取消最小化，并把页面切到目标子页面 */
        return {
          topZ: z,
          windows: state.windows.map((w) =>
            w.id === action.id ? { ...w, minimized: false, z, param: action.param } : w,
          ),
        }
      }
      /* 记得住就用记得的，否则按默认尺寸居中 */
      const spot = action.geometry
        ? clampGeometry(action.geometry, action.bounds)
        : centerSpot(action.bounds, action.size)
      const win: WindowState = {
        id: action.id,
        ...spot,
        z,
        minimized: false,
        param: action.param,
      }
      return { topZ: z, windows: [...state.windows, win] }
    }

    case 'setParam':
      return update(state, action.id, (w) => ({ ...w, param: action.param }))

    case 'focus': {
      const z = state.topZ + 1
      return {
        topZ: z,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, z } : w)),
      }
    }

    case 'close':
      return { ...state, windows: state.windows.filter((w) => w.id !== action.id) }

    case 'closeAll':
      return state.windows.length === 0 ? state : { ...state, windows: [] }

    case 'minimize':
      return update(state, action.id, (w) => ({ ...w, minimized: true }))

    case 'restore': {
      const z = state.topZ + 1
      return {
        ...update(state, action.id, (w) => ({ ...w, minimized: false, z })),
        topZ: z,
      }
    }

    case 'toggle-maximize':
      return update(state, action.id, (w) => ({ ...w, maximized: !w.maximized }))

    /* 拖到屏幕边缘松手：贴到那一区，并把吸附前的矩形记下来（解吸附时回去） */
    case 'snap': {
      const rect = snapRect(action.zone, action.bounds)
      return update(state, action.id, (w) => ({
        ...w,
        ...rect,
        snap: action.zone,
        maximized: false,
        /* 已经吸附着再换区，别把"最初的自由尺寸"弄丢 */
        restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h },
      }))
    }

    case 'unsnap':
      return update(state, action.id, (w) => {
        if (!w.restore) return { ...w, snap: undefined }
        const r = w.restore
        /* 拖动解的吸附：窗口按指针的抓取比例摆回去，手感上"从指针那儿弹出来" */
        const x =
          action.anchor !== undefined && action.pointer
            ? Math.round(action.pointer.x - action.anchor * r.w)
            : r.x
        const y = action.pointer ? Math.round(action.pointer.y - TITLE_GRAB_Y) : r.y
        return {
          ...w,
          x: Math.max(0, x),
          y: Math.max(0, y),
          w: r.w,
          h: r.h,
          snap: undefined,
          restore: undefined,
        }
      })

    case 'move':
      return update(state, action.id, (w) => ({
        ...w,
        x: Math.max(0, Math.round(action.x)),
        y: Math.max(0, Math.round(action.y)),
      }))

    case 'resize':
      return update(state, action.id, (w) => ({
        ...w,
        /* 手动改大小 = 不再是"贴着的"那个形状了 */
        snap: undefined,
        restore: undefined,
        w: Math.max(MIN_W, Math.round(action.w)),
        h: Math.max(MIN_H, Math.round(action.h)),
      }))

    default:
      return state
  }
}
