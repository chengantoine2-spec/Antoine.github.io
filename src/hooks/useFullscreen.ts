import { useCallback, useEffect, useState } from 'react'

/**
 * 浏览器级全屏：连浏览器自己的窗口一起盖住，铺满**整个屏幕** ——
 * 和「窗口最大化」不是一回事（那个只是铺满页面视口）。
 * 设置窗口和菜单栏两处按钮都用它，逻辑只此一份。
 *
 * 状态听 fullscreenchange 而不是"我点过没有"，所以按 Esc / F11 退出也能同步按钮。
 *
 * ⚠️ **进全屏不再顺手最大化当前窗口**（2026-10-06 站主报的 bug：
 * 「在窗口全屏之后不能通过拖动边缘拖动窗口了」）。原因：最大化窗口的缩放手柄本来就是禁用的
 * （`Window.tsx` 里最大化就是铺满，不给拖边缘），于是"进全屏 → 顺手最大化 → 边缘拖不动"。
 * 现在进全屏**不改变窗口几何**，窗口保持原尺寸、边缘照常拖；想最大化请点绿点。
 * 这条有回归断言钉着（"进全屏不改变窗口几何"）。
 */
export function useFullscreen() {
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
      await document.documentElement.requestFullscreen()
    } catch {
      /* 被拒绝或不支持：什么都不做，按钮状态始终由 fullscreenchange 决定 */
    }
  }, [])

  return { fullscreen, supported, toggle }
}
