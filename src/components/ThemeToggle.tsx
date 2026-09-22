/**
 * 亮/暗主题切换：默认亮色，偏好存 localStorage。
 * html 上的 class 由 index.html 的内联脚本在首屏前设置，避免闪烁。
 */
import { useCallback, useEffect, useState } from 'react'

export const THEME_KEY = 'caramel.theme'
export type Theme = 'light' | 'dark'

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* 忽略隐私模式 */
  }
  return 'light' // 站点规则：默认亮色
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  window.dispatchEvent(new CustomEvent<Theme>('caramel:theme', { detail: theme }))
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* 忽略 */
      }
      return next
    })
  }, [])

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? '切换到亮色主题' : '切换到暗色主题'}
      title={isDark ? '亮色' : '暗色'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-caramel-200 bg-caramel-100 text-caramel-700 transition hover:border-caramel-400 hover:bg-caramel-200 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-100 dark:hover:bg-caramel-700 ${className}`}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  )
}
