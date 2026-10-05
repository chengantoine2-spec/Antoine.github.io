import { APPS } from './apps'
import type { AppId, SessionFrame, WindowGeometry, WindowTab } from '../types/desktop'

const KEY = 'desktop.windows'
const KEY_SESSION = 'desktop.openWindows'

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

function readGeometry(raw: unknown): WindowGeometry | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const geo = raw as WindowGeometry
  const nums = [geo.x, geo.y, geo.w, geo.h].map(Number)
  if (nums.some((n) => !Number.isFinite(n))) return undefined
  return { x: nums[0], y: nums[1], w: nums[2], h: nums[3], maximized: geo.maximized === true }
}

function readTabs(raw: unknown): WindowTab[] {
  if (!Array.isArray(raw)) return []
  const tabs: WindowTab[] = []
  for (const item of raw) {
    const id = (item as WindowTab)?.id
    if (!APPS.some((app) => app.id === id)) continue
    if (tabs.some((t) => t.id === id)) continue
    const param = (item as WindowTab).param
    tabs.push(typeof param === 'string' && param ? { id, param } : { id })
  }
  return tabs
}

/**
 * 读回上次开着的**框**（含标签与几何）。
 * - 新格式：`{ frames: [{ tabs, active, x, y, w, h, maximized }] }`
 * - 老格式（数组）：每个元素就是一个窗口 → **当成"一框一标签"**
 * 坏数据一律丢掉；已下线的应用（比如线上没有的 DSH）自动消失。
 */
export function loadSession(): SessionFrame[] {
  try {
    const raw = localStorage.getItem(KEY_SESSION)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    const list = Array.isArray(parsed)
      ? /* 老格式：一框一标签、没有几何 */
        (parsed as Array<WindowTab & { geometry?: unknown }>).map((item) => ({
          tabs: [item],
          active: 0,
        }))
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { frames?: unknown }).frames)
        ? ((parsed as { frames: unknown[] }).frames as Record<string, unknown>[])
        : []

    const frames: SessionFrame[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const tabs = readTabs(row.tabs)
      if (tabs.length === 0) continue
      const active = Number(row.active)
      frames.push({
        tabs,
        active: Number.isFinite(active) ? clampIndex(active, tabs.length) : 0,
        geometry: readGeometry(row),
      })
    }
    return frames
  } catch {
    return []
  }
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(Math.round(index), 0), Math.max(0, length - 1))
}

export function saveSession(frames: SessionFrame[]): void {
  try {
    localStorage.setItem(KEY_SESSION, JSON.stringify({ frames }))
  } catch {
    /* 同上 */
  }
}
