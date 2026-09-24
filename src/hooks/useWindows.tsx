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

const EMPTY_STATE: DesktopState = { windows: [], topZ: 1 }

interface WindowsContextValue {
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

  /* 打开 / 移动 / 缩放都记下来；关闭时**故意保留**，下次打开回到原处 */
  useEffect(() => {
    let changed = false
    const next: GeometryMap = { ...memory.current }
    for (const win of state.windows) {
      const prev = next[win.id]
      if (
        !prev ||
        prev.x !== win.x ||
        prev.y !== win.y ||
        prev.w !== win.w ||
        prev.h !== win.h ||
        prev.maximized !== win.maximized
      ) {
        next[win.id] = { x: win.x, y: win.y, w: win.w, h: win.h, maximized: win.maximized }
        changed = true
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
