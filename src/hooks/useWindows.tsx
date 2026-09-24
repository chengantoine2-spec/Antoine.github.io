import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { initialDesktopState, windowReducer } from '../lib/windowManager'
import type { WindowAction, WindowState } from '../types/desktop'

interface WindowsContextValue {
  windows: WindowState[]
  dispatch: React.Dispatch<WindowAction>
}

const WindowsContext = createContext<WindowsContextValue | null>(null)

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, initialDesktopState)
  const value = useMemo(() => ({ windows: state.windows, dispatch }), [state.windows])

  return <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>
}

export function useWindows(): WindowsContextValue {
  const ctx = useContext(WindowsContext)
  if (!ctx) throw new Error('useWindows 必须在 WindowsProvider 内使用')
  return ctx
}
