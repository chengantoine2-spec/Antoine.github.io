import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readTabPosition, writeTabPosition } from '../lib/tabs'
import type { TabPosition } from '../types/desktop'

interface TabsContextValue {
  position: TabPosition
  setPosition: (position: TabPosition) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

/** 窗口标签栏设置：位置存 localStorage（desktop.tabs），设置窗口与桌面外壳共用 */
export function TabsProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<TabPosition>(readTabPosition)

  const setPosition = useCallback((next: TabPosition) => {
    writeTabPosition(next)
    setPositionState(next)
  }, [])

  const value = useMemo(() => ({ position, setPosition }), [position, setPosition])

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs 必须在 TabsProvider 内使用')
  return ctx
}
