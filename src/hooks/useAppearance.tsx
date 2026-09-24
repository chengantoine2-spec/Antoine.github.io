import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_THEME, DEFAULT_WALLPAPER, isThemeId, isWallpaperId } from '../lib/theme'
import type { ThemeId, WallpaperId } from '../types/desktop'

const THEME_KEY = 'desktop.theme'
const WALLPAPER_KEY = 'desktop.wallpaper'

/** 从 localStorage 读一个受枚举约束的值，读不到/值非法就回默认 */
function readStored<T>(key: string, fallback: T, guard: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (guard(raw)) return raw
  } catch {
    /* 隐私模式下读不到就用默认值 */
  }
  return fallback
}

interface AppearanceContextValue {
  theme: ThemeId
  wallpaper: WallpaperId
  setTheme: (theme: ThemeId) => void
  setWallpaper: (wallpaper: WallpaperId) => void
  resetAppearance: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    readStored(THEME_KEY, DEFAULT_THEME, isThemeId),
  )
  const [wallpaper, setWallpaperState] = useState<WallpaperId>(() =>
    readStored(WALLPAPER_KEY, DEFAULT_WALLPAPER, isWallpaperId),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* 写不进去也不影响本次会话 */
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(WALLPAPER_KEY, wallpaper)
    } catch {
      /* 同上 */
    }
  }, [wallpaper])

  const setTheme = useCallback((next: ThemeId) => setThemeState(next), [])
  const setWallpaper = useCallback((next: WallpaperId) => setWallpaperState(next), [])
  const resetAppearance = useCallback(() => {
    setThemeState(DEFAULT_THEME)
    setWallpaperState(DEFAULT_WALLPAPER)
  }, [])

  return (
    <AppearanceContext.Provider
      value={{ theme, wallpaper, setTheme, setWallpaper, resetAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance 必须在 AppearanceProvider 内使用')
  return ctx
}
