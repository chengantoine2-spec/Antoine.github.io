import type { DesktopState, WindowAction, WindowState } from '../types/desktop'

const DEFAULT_W = 760
const DEFAULT_H = 520
const MIN_W = 360
const MIN_H = 240

export const initialDesktopState: DesktopState = { windows: [], topZ: 1 }

const GAP = 24

/** 新窗口落位：一律居中；窗口层放不下时先缩到能放下，再居中 */
function centerSpot(bounds: { w: number; h: number }) {
  const w = Math.max(MIN_W, Math.min(DEFAULT_W, bounds.w - GAP))
  const h = Math.max(MIN_H, Math.min(DEFAULT_H, bounds.h - GAP))
  return {
    w,
    h,
    x: Math.max(0, Math.round((bounds.w - w) / 2)),
    y: Math.max(0, Math.round((bounds.h - h) / 2)),
  }
}

function update(
  state: DesktopState,
  id: WindowState['id'],
  patch: (win: WindowState) => WindowState,
): DesktopState {
  return { ...state, windows: state.windows.map((w) => (w.id === id ? patch(w) : w)) }
}

/** 纯函数窗口管理器：不碰 DOM、不读 localStorage，方便后续单独测试与移植 */
export function windowReducer(state: DesktopState, action: WindowAction): DesktopState {
  switch (action.type) {
    case 'open': {
      const exist = state.windows.find((w) => w.id === action.id)
      const z = state.topZ + 1
      if (exist) {
        return {
          topZ: z,
          windows: state.windows.map((w) =>
            w.id === action.id ? { ...w, minimized: false, z } : w,
          ),
        }
      }
      const spot = centerSpot(action.bounds)
      const win: WindowState = {
        id: action.id,
        x: spot.x,
        y: spot.y,
        w: spot.w,
        h: spot.h,
        z,
        minimized: false,
        maximized: false,
      }
      return { topZ: z, windows: [...state.windows, win] }
    }

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

    case 'move':
      return update(state, action.id, (w) => ({
        ...w,
        x: Math.max(0, Math.round(action.x)),
        y: Math.max(0, Math.round(action.y)),
      }))

    case 'resize':
      return update(state, action.id, (w) => ({
        ...w,
        w: Math.max(MIN_W, Math.round(action.w)),
        h: Math.max(MIN_H, Math.round(action.h)),
      }))

    default:
      return state
  }
}
