import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { DOCK_ORDER, isVertical } from '../lib/dock'
import type { DockPosition } from '../types/desktop'

const STORAGE_KEY = 'desktop.dock'

interface Stored {
  position: DockPosition
  /** null = 长度按内容自适应 */
  length: number | null
  /** null = 使用默认厚度 */
  thickness: number | null
}

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>
      const position = DOCK_ORDER.includes(v.position as DockPosition)
        ? (v.position as DockPosition)
        : 'bottom'
      return {
        position,
        length: typeof v.length === 'number' && v.length > 0 ? v.length : null,
        thickness: typeof v.thickness === 'number' && v.thickness > 0 ? v.thickness : null,
      }
    }
  } catch {
    /* 数据坏了就回默认，不影响启动 */
  }
  return { position: 'bottom', length: null, thickness: null }
}

interface DockContextValue {
  position: DockPosition
  length: number | null
  thickness: number | null
  setPosition: (position: DockPosition) => void
  setLength: (length: number | null) => void
  setThickness: (thickness: number | null) => void
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

  const setPosition = useCallback((position: DockPosition) => {
    setState((s) => {
      /* 横竖互换时，旧的宽高没有意义，一起回到自适应 */
      const keep = isVertical(position) === isVertical(s.position)
      return {
        position,
        length: keep ? s.length : null,
        thickness: keep ? s.thickness : null,
      }
    })
  }, [])

  return (
    <DockContext.Provider
      value={{
        position: state.position,
        length: state.length,
        thickness: state.thickness,
        setPosition,
        setLength,
        setThickness,
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
