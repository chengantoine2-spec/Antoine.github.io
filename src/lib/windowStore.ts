import { APPS } from './apps'
import type { AppId, WindowGeometry } from '../types/desktop'

const KEY = 'desktop.windows'
const KEY_SESSION = 'desktop.openWindows'

export type GeometryMap = Partial<Record<AppId, WindowGeometry>>

/** 会话记忆：刷新前开着哪些窗口（顺序 = 标签栏顺序） */
export interface OpenWindow {
  id: AppId
  /** 子页面参数（博客/项目详情），没有就是应用根 */
  param?: string
}

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

/** 读回"上次开着哪些窗口"：只认还在登记表里的应用（本机专属窗口换到线上要自动消失） */
export function loadOpenWindows(): OpenWindow[] {
  try {
    const raw = localStorage.getItem(KEY_SESSION)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const result: OpenWindow[] = []
    for (const item of parsed) {
      const id = (item as OpenWindow)?.id
      if (!APPS.some((app) => app.id === id)) continue
      if (result.some((w) => w.id === id)) continue
      const param = (item as OpenWindow).param
      result.push(typeof param === 'string' && param ? { id, param } : { id })
    }
    return result
  } catch {
    return []
  }
}

export function saveOpenWindows(list: OpenWindow[]): void {
  try {
    localStorage.setItem(KEY_SESSION, JSON.stringify(list))
  } catch {
    /* 同上 */
  }
}
