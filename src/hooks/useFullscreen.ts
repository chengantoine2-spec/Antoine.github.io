import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { matchApp } from '../lib/apps'
import { useWindows } from './useWindows'

/**
 * 浏览器级全屏：连浏览器自己的窗口一起盖住，铺满**整个屏幕** ——
 * 和「窗口最大化」不是一回事（那个只是铺满页面视口）。
 * 设置窗口和任务栏两处按钮都用它，逻辑只此一份。
 *
 * 状态听 fullscreenchange 而不是"我点过没有"，所以按 Esc / F11 退出也能同步按钮。
 */
export function useFullscreen() {
  const { pathname } = useLocation()
  const { windows, dispatch } = useWindows()
  const [fullscreen, setFullscreen] = useState(false)
  /* 极少数环境不支持（比如 iOS Safari），调用方据此决定要不要渲染按钮 */
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null)
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      /* 顺手把当前窗口最大化：否则浏览器进了全屏、窗口还是小的，看着依旧"没铺开" */
      const app = matchApp(pathname)
      const win = app
        ? windows.find((item) => item.tabs.some((tab) => tab.id === app.id))
        : undefined
      if (win && !win.minimized && !win.maximized) {
        dispatch({ type: 'toggle-maximize', key: win.key })
      }
      await document.documentElement.requestFullscreen()
    } catch {
      /* 被拒绝或不支持：什么都不做，按钮状态始终由 fullscreenchange 决定 */
    }
  }, [dispatch, pathname, windows])

  return { fullscreen, supported, toggle }
}
