import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_THEME,
  DEFAULT_WALLPAPER,
  DEFAULT_WALLPAPER_DIM,
  DEFAULT_WALLPAPER_FIT,
  isStoredTheme,
  normalizeTheme,
  isWallpaperFit,
  isWallpaperId,
} from '../lib/theme'
import type { ThemeId, WallpaperFit, WallpaperId } from '../types/desktop'

const THEME_KEY = 'desktop.theme'
const WALLPAPER_KEY = 'desktop.wallpaper'
const FIT_KEY = 'desktop.wallpaperFit'
const DIM_KEY = 'desktop.wallpaperDim'

/** 从 localStorage 读一个受约束的值，读不到/值非法就回默认 */
function readStored<T>(key: string, fallback: T, guard: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (guard(raw)) return raw
  } catch {
    /* 隐私模式下读不到就用默认值 */
  }
  return fallback
}

function readDim(): number {
  try {
    const raw = Number(localStorage.getItem(DIM_KEY))
    if (Number.isFinite(raw) && raw >= 0 && raw <= 0.6) return raw
  } catch {
    /* 同上 */
  }
  return DEFAULT_WALLPAPER_DIM
}

interface AppearanceContextValue {
  theme: ThemeId
  wallpaper: WallpaperId
  wallpaperFit: WallpaperFit
  wallpaperDim: number
  setTheme: (theme: ThemeId) => void
  setWallpaper: (wallpaper: WallpaperId) => void
  setWallpaperFit: (fit: WallpaperFit) => void
  setWallpaperDim: (dim: number) => void
  resetAppearance: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    normalizeTheme(readStored(THEME_KEY, DEFAULT_THEME, isStoredTheme)),
  )
  const [wallpaper, setWallpaperState] = useState<WallpaperId>(() =>
    readStored(WALLPAPER_KEY, DEFAULT_WALLPAPER, isWallpaperId),
  )
  const [wallpaperFit, setFitState] = useState<WallpaperFit>(() =>
    readStored(FIT_KEY, DEFAULT_WALLPAPER_FIT, isWallpaperFit),
  )
  const [wallpaperDim, setDimState] = useState<number>(readDim)

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
      localStorage.setItem(FIT_KEY, wallpaperFit)
      localStorage.setItem(DIM_KEY, String(wallpaperDim))
    } catch {
      /* 同上 */
    }
  }, [wallpaper, wallpaperFit, wallpaperDim])

  const setTheme = useCallback((next: ThemeId) => setThemeState(next), [])
  const setWallpaper = useCallback((next: WallpaperId) => setWallpaperState(next), [])
  const setWallpaperFit = useCallback((next: WallpaperFit) => setFitState(next), [])
  const setWallpaperDim = useCallback((next: number) => setDimState(next), [])
  const resetAppearance = useCallback(() => {
    setThemeState(DEFAULT_THEME)
    setWallpaperState(DEFAULT_WALLPAPER)
    setFitState(DEFAULT_WALLPAPER_FIT)
    setDimState(DEFAULT_WALLPAPER_DIM)
  }, [])

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        wallpaper,
        wallpaperFit,
        wallpaperDim,
        setTheme,
        setWallpaper,
        setWallpaperFit,
        setWallpaperDim,
        resetAppearance,
      }}
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
