import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { windowReducer } from '../lib/windowManager'
import { clearGeometry, loadGeometry, saveGeometry, type GeometryMap } from '../lib/windowStore'
import type { AppId, DesktopState, WindowAction, WindowGeometry, WindowState } from '../types/desktop'

const EMPTY_STATE: DesktopState = { windows: [], topZ: 1, nextKey: 1 }

interface WindowsContextValue {
  /** 桌面上的**窗口框**（每框一个或多个标签） */
  windows: WindowState[]
  dispatch: React.Dispatch<WindowAction>
  /** 记住的几何（含已关闭的窗口）；只在打开窗口时读一次 */
  geometryOf: (id: AppId) => WindowGeometry | undefined
  /** 忘掉所有窗口的位置记忆，下次打开重新居中 */
  clearWindowMemory: () => void
}

const WindowsContext = createContext<WindowsContextValue | null>(null)

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, EMPTY_STATE)
  const memory = useRef<GeometryMap>(loadGeometry())

  /* 打开 / 移动 / 缩放都记下来；关闭时**故意保留**，下次打开回到原处。
     记住的粒度是**应用**：一框多标签时，这框的几何写给它每个标签的应用 ——
     以后单独打开其中任何一个，都回到这框待过的地方 */
  useEffect(() => {
    let changed = false
    const next: GeometryMap = { ...memory.current }
    for (const win of state.windows) {
      const geo: WindowGeometry = {
        x: win.x,
        y: win.y,
        w: win.w,
        h: win.h,
        maximized: win.maximized,
      }
      for (const tab of win.tabs) {
        const prev = next[tab.id]
        if (
          !prev ||
          prev.x !== geo.x ||
          prev.y !== geo.y ||
          prev.w !== geo.w ||
          prev.h !== geo.h ||
          prev.maximized !== geo.maximized
        ) {
          next[tab.id] = geo
          changed = true
        }
      }
    }
    if (changed) {
      memory.current = next
      saveGeometry(next)
    }
  }, [state.windows])

  const geometryOf = useCallback((id: AppId) => memory.current[id], [])

  const clearWindowMemory = useCallback(() => {
    memory.current = {}
    clearGeometry()
  }, [])

  const value = useMemo(
    () => ({ windows: state.windows, dispatch, geometryOf, clearWindowMemory }),
    [state.windows, geometryOf, clearWindowMemory],
  )

  return <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>
}

export function useWindows(): WindowsContextValue {
  const ctx = useContext(WindowsContext)
  if (!ctx) throw new Error('useWindows 必须在 WindowsProvider 内使用')
  return ctx
}
