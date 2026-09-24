import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { APPS } from '../lib/apps'
import { DOCK_ORDER, isVertical } from '../lib/dock'
import type { AppId, DockPosition } from '../types/desktop'

const STORAGE_KEY = 'desktop.dock'
const ALL_APP_IDS: AppId[] = APPS.map((app) => app.id)

interface Stored {
  position: DockPosition
  /** null = 长度按内容自适应 */
  length: number | null
  /** null = 使用默认厚度 */
  thickness: number | null
  /** null = 图标大小跟随厚度 */
  iconSize: number | null
  /** 任务栏里显示哪些应用（顺序始终按 APPS） */
  dockApps: AppId[]
}

const DEFAULTS: Stored = {
  position: 'bottom',
  length: null,
  thickness: null,
  iconSize: null,
  dockApps: ALL_APP_IDS,
}

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>
      const position = DOCK_ORDER.includes(v.position as DockPosition)
        ? (v.position as DockPosition)
        : DEFAULTS.position
      /* 只保留仍然存在的应用，顺序固定按 APPS，避免旧数据把顺序搞乱 */
      const dockApps = Array.isArray(v.dockApps)
        ? ALL_APP_IDS.filter((id) => (v.dockApps as AppId[]).includes(id))
        : ALL_APP_IDS
      return {
        position,
        length: typeof v.length === 'number' && v.length > 0 ? v.length : null,
        thickness: typeof v.thickness === 'number' && v.thickness > 0 ? v.thickness : null,
        iconSize: typeof v.iconSize === 'number' && v.iconSize > 0 ? v.iconSize : null,
        dockApps,
      }
    }
  } catch {
    /* 数据坏了就回默认，不影响启动 */
  }
  return DEFAULTS
}

interface DockContextValue {
  position: DockPosition
  length: number | null
  thickness: number | null
  iconSize: number | null
  dockApps: AppId[]
  setPosition: (position: DockPosition) => void
  setLength: (length: number | null) => void
  setThickness: (thickness: number | null) => void
  setIconSize: (iconSize: number | null) => void
  toggleDockApp: (id: AppId) => void
  resetDock: () => void
}

const DockContext = createContext<DockContextValue | null>(null)

export function DockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 写不进去也不影响本次会话 */
    }
  }, [state])

  const setLength = useCallback((length: number | null) => {
    setState((s) => ({ ...s, length }))
  }, [])

  const setThickness = useCallback((thickness: number | null) => {
    setState((s) => ({ ...s, thickness }))
  }, [])

  const setIconSize = useCallback((iconSize: number | null) => {
    setState((s) => ({ ...s, iconSize }))
  }, [])

  const setPosition = useCallback((position: DockPosition) => {
    setState((s) => {
      /* 横竖互换时，旧的宽高没有意义，一起回到自适应 */
      const keep = isVertical(position) === isVertical(s.position)
      return {
        ...s,
        position,
        length: keep ? s.length : null,
        thickness: keep ? s.thickness : null,
      }
    })
  }, [])

  const toggleDockApp = useCallback((id: AppId) => {
    setState((s) => ({
      ...s,
      dockApps: s.dockApps.includes(id)
        ? s.dockApps.filter((x) => x !== id)
        : ALL_APP_IDS.filter((x) => x === id || s.dockApps.includes(x)),
    }))
  }, [])

  const resetDock = useCallback(() => setState(DEFAULTS), [])

  return (
    <DockContext.Provider
      value={{
        position: state.position,
        length: state.length,
        thickness: state.thickness,
        iconSize: state.iconSize,
        dockApps: state.dockApps,
        setPosition,
        setLength,
        setThickness,
        setIconSize,
        toggleDockApp,
        resetDock,
      }}
    >
      {children}
    </DockContext.Provider>
  )
}

export function useDock(): DockContextValue {
  const ctx = useContext(DockContext)
  if (!ctx) throw new Error('useDock 必须在 DockProvider 内使用')
  return ctx
}
