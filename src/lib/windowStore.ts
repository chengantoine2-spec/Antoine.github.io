import { APPS } from './apps'
import type { AppId, WindowGeometry } from '../types/desktop'

const KEY = 'desktop.windows'

export type GeometryMap = Partial<Record<AppId, WindowGeometry>>

/** 读回记住的窗口几何（含已关闭的窗口；坏数据一律丢弃） */
export function loadGeometry(): GeometryMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, WindowGeometry>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const result: GeometryMap = {}
    for (const app of APPS) {
      const geo = parsed[app.id]
      if (!geo || typeof geo !== 'object') continue
      const nums = [geo.x, geo.y, geo.w, geo.h].map(Number)
      if (nums.some((n) => !Number.isFinite(n))) continue
      result[app.id] = {
        x: nums[0],
        y: nums[1],
        w: nums[2],
        h: nums[3],
        maximized: geo.maximized === true,
      }
    }
    return result
  } catch {
    /* 数据坏了就当没记过 */
    return {}
  }
}

export function saveGeometry(map: GeometryMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* 写不进去也不影响本次会话 */
  }
}

export function clearGeometry(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 同上 */
  }
}
