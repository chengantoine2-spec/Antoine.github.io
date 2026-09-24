import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { SkinId } from '../types/desktop'
/* 走 import 而不是 public/ 绝对路径：部署到 GitHub Pages 子路径时不会失效 */
import win11Wallpaper from '../assets/wallpapers/win11.jpg'

const STORAGE_KEY = 'desktop.skin'

function readStoredSkin(): SkinId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'win11' || v === 'ubuntu') return v
  } catch {
    /* 隐私模式下读不到时用默认皮肤 */
  }
  return 'ubuntu'
}

interface SkinContextValue {
  skin: SkinId
  setSkin: (skin: SkinId) => void
}

const SkinContext = createContext<SkinContextValue | null>(null)

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<SkinId>(readStoredSkin)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.skin = skin
    /* Win11 用照片壁纸；Ubuntu 保留 tokens.css 里的渐变 */
    if (skin === 'win11') root.style.setProperty('--c-wallpaper', `url("${win11Wallpaper}")`)
    else root.style.removeProperty('--c-wallpaper')
    try {
      localStorage.setItem(STORAGE_KEY, skin)
    } catch {
      /* 写不进去也不影响本次会话 */
    }
  }, [skin])

  const setSkin = useCallback((next: SkinId) => setSkinState(next), [])

  return <SkinContext.Provider value={{ skin, setSkin }}>{children}</SkinContext.Provider>
}

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext)
  if (!ctx) throw new Error('useSkin 必须在 SkinProvider 内使用')
  return ctx
}
