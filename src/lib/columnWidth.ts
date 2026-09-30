/* 列宽偏好的通用存取与钳制。
   文章正文列（hooks/useArticleWidth.ts）与博客首页两条侧栏（hooks/useBlogRails.ts）共用，
   免得"读偏好 / 写偏好 / 钳制"三件事各写一份。

   约定（见 AGENTS）：读取一律走 guard，坏数据回默认，绝不让启动崩掉；
   写不进去也只是这次拖动不落盘，不影响当前会话。 */

/** 读存下来的像素值；没存过或存坏了都回 null（= 用 CSS 里的默认宽度） */
export function readStoredWidth(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** 传 null = 清掉这个键（双击手柄就是回到默认宽度） */
export function writeStoredWidth(key: string, width: number | null): void {
  try {
    if (width === null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(Math.round(width)))
  } catch {
    /* 写不进去也不影响这次拖动 */
  }
}

/** 钳进 [min, max]；max 比 min 还小时按 min 算（窗口特别窄时不要让值变成负数） */
export function clampWidth(width: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(width), min), Math.max(min, Math.round(max)))
}
