import type {
  AppId,
  DesktopState,
  SessionFrame,
  WindowAction,
  WindowGeometry,
  WindowState,
} from '../types/desktop'

const DEFAULT_W = 760
const DEFAULT_H = 520
const MIN_W = 360
const MIN_H = 240
const GAP = 24
/** 拖动窗口时指针大约落在标题栏往下这么深的位置 —— 解吸附时用它把窗口摆回指针下 */
const TITLE_GRAB_Y = 18
/** 新窗口层叠错开的步长与循环档数（错开太多会跑出屏幕，所以错几档就回到原位） */
const CASCADE_X = 32
const CASCADE_Y = 28
const CASCADE_STEPS = 5

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** 把记住的几何夹进当前窗口层：换了小屏也不会把窗口丢到看不见的地方 */
function clampGeometry(geo: WindowGeometry, bounds: { w: number; h: number }): WindowGeometry {
  const w = clamp(Math.round(geo.w), MIN_W, Math.max(MIN_W, bounds.w - GAP))
  const h = clamp(Math.round(geo.h), MIN_H, Math.max(MIN_H, bounds.h - GAP))
  return {
    w,
    h,
    x: clamp(Math.round(geo.x), 0, Math.max(0, bounds.w - w)),
    y: clamp(Math.round(geo.y), 0, Math.max(0, bounds.h - h)),
    maximized: geo.maximized,
  }
}

/** 新窗口落位：按 app 的默认尺寸居中；放不下就缩到能放下。
 *  ⚠️ 再按"已开窗口数"往右下**层叠错开**一点：全都正居中时，后开的窗口会把先开的
 *  整个盖住（大窗套小窗），下面那扇的标题栏 / 标签就完全点不到了 ——
 *  用户报的"合并之后点不到之前的窗口"就是这种完全遮挡。错开之后总能抓到下面的标题栏。 */
function centerSpot(
  bounds: { w: number; h: number },
  size?: { w: number; h: number },
  step = 0,
): WindowGeometry {
  const target = size ?? { w: DEFAULT_W, h: DEFAULT_H }
  const w = Math.max(MIN_W, Math.min(target.w, bounds.w - GAP))
  const h = Math.max(MIN_H, Math.min(target.h, bounds.h - GAP))
  const n = step % CASCADE_STEPS
  return {
    w,
    h,
    x: clamp(Math.round((bounds.w - w) / 2) + n * CASCADE_X, 0, Math.max(0, bounds.w - w)),
    y: clamp(Math.round((bounds.h - h) / 2) + n * CASCADE_Y, 0, Math.max(0, bounds.h - h)),
    maximized: false,
  }
}

function frameOf(state: DesktopState, key: string): WindowState | undefined {
  return state.windows.find((w) => w.key === key)
}

/** 改一帧 */
function patchFrame(
  state: DesktopState,
  key: string,
  patch: (win: WindowState) => WindowState,
): DesktopState {
  return { ...state, windows: state.windows.map((w) => (w.key === key ? patch(w) : w)) }
}

/** 抬到最上面 */
function raise(state: DesktopState, key: string): DesktopState {
  const z = state.topZ + 1
  return { ...patchFrame(state, key, (w) => ({ ...w, z })), topZ: z }
}

/** 这个应用现在停在哪个框的第几个标签上 */
function findTab(state: DesktopState, id: AppId): { key: string; index: number } | undefined {
  for (const win of state.windows) {
    const index = win.tabs.findIndex((t) => t.id === id)
    if (index >= 0) return { key: win.key, index }
  }
  return undefined
}

/** 纯函数窗口管理器：不碰 DOM、不读 localStorage，方便单独测试与移植 */
export function windowReducer(state: DesktopState, action: WindowAction): DesktopState {
  switch (action.type) {
    case 'open': {
      const hit = findTab(state, action.id)
      if (hit) {
        /* 已经开着：切到那个标签、写进目标子页面、取消最小化，然后抬到最上面 */
        const next = patchFrame(state, hit.key, (w) => ({
          ...w,
          active: hit.index,
          minimized: false,
          tabs: w.tabs.map((t, i) => (i === hit.index ? { ...t, param: action.param } : t)),
        }))
        return raise(next, hit.key)
      }
      const spot = action.geometry
        ? clampGeometry(action.geometry, action.bounds)
        : /* 层叠步长 = 已经开着几个框 —— 免得新窗口正正盖住旧窗口，把它的标题栏闷死 */
          centerSpot(action.bounds, action.size, state.windows.length)
      const win: WindowState = {
        key: `w${state.nextKey}`,
        tabs: [{ id: action.id, param: action.param }],
        active: 0,
        ...spot,
        z: state.topZ + 1,
        minimized: false,
      }
      return { topZ: state.topZ + 1, nextKey: state.nextKey + 1, windows: [...state.windows, win] }
    }

    case 'focusFrame':
      return raise(state, action.key)

    case 'activate': {
      const win = frameOf(state, action.key)
      if (!win || action.index < 0 || action.index >= win.tabs.length) return state
      return raise(patchFrame(state, action.key, (w) => ({ ...w, active: action.index })), action.key)
    }

    case 'closeFrame':
      return { ...state, windows: state.windows.filter((w) => w.key !== action.key) }

    case 'closeTab': {
      const win = frameOf(state, action.key)
      if (!win || action.index < 0 || action.index >= win.tabs.length) return state
      const tabs = win.tabs.filter((_, i) => i !== action.index)
      /* 最后一个标签被关掉 = 这个框也没了 */
      if (tabs.length === 0) {
        return { ...state, windows: state.windows.filter((w) => w.key !== action.key) }
      }
      /* 活动下标跟着"原来那个活动标签"走：关它左边就左移一位，关它自己就顺延到右邻（没有就左邻） */
      const active =
        action.index < win.active
          ? win.active - 1
          : action.index === win.active
            ? Math.min(action.index, tabs.length - 1)
            : win.active
      return patchFrame(state, action.key, (w) => ({ ...w, tabs, active }))
    }

    case 'closeAll':
      return state.windows.length === 0 ? state : { ...state, windows: [] }

    case 'minimize':
      return patchFrame(state, action.key, (w) => ({ ...w, minimized: true }))

    case 'restore':
      return raise(patchFrame(state, action.key, (w) => ({ ...w, minimized: false })), action.key)

    case 'toggle-maximize':
      return patchFrame(state, action.key, (w) => ({ ...w, maximized: !w.maximized }))

    /* 拖到屏幕边缘松手：贴到那一区，并把吸附前的矩形记下来（解吸附时回去）。
       目标矩形由外壳按**整个视口**算好（不是窗口层 —— 层被任务栏让过位，贴不到真正的底边） */
    case 'snap': {
      const win = frameOf(state, action.key)
      if (!win) return state
      return patchFrame(state, action.key, (w) => ({
        ...w,
        x: Math.max(0, Math.round(action.rect.x)),
        y: Math.max(0, Math.round(action.rect.y)),
        w: Math.round(action.rect.w),
        h: Math.round(action.rect.h),
        snap: action.zone,
        maximized: false,
        /* 已经吸附着再换区，别把"最初的自由尺寸"弄丢 */
        restore: w.restore ?? { x: win.x, y: win.y, w: win.w, h: win.h },
      }))
    }

    case 'unsnap': {
      const win = frameOf(state, action.key)
      if (!win) return state
      if (!win.restore) return patchFrame(state, action.key, (w) => ({ ...w, snap: undefined }))
      const r = win.restore
      /* 拖动解的吸附：窗口按指针的抓取比例摆回去，手感上"从指针那儿弹出来" */
      const x =
        action.anchor !== undefined && action.pointer
          ? Math.round(action.pointer.x - action.anchor * r.w)
          : r.x
      const y = action.pointer ? Math.round(action.pointer.y - TITLE_GRAB_Y) : r.y
      return patchFrame(state, action.key, (w) => ({
        ...w,
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: r.w,
        h: r.h,
        snap: undefined,
        restore: undefined,
      }))
    }

    case 'move':
      return patchFrame(state, action.key, (w) => ({
        ...w,
        x: Math.max(0, Math.round(action.x)),
        y: Math.max(0, Math.round(action.y)),
      }))

    case 'resize':
      return patchFrame(state, action.key, (w) => ({
        ...w,
        /* 手动改大小 = 不再是"贴着的"那个形状了 */
        snap: undefined,
        restore: undefined,
        w: Math.max(MIN_W, Math.round(action.w)),
        h: Math.max(MIN_H, Math.round(action.h)),
      }))

    case 'setParam':
      return patchFrame(state, action.key, (w) => ({
        ...w,
        tabs: w.tabs.map((t, i) => (i === action.index ? { ...t, param: action.param } : t)),
      }))

    /* 合并：把 fromKey 整个并进 intoKey，标签接在后头，被拖过来的那个成为活动标签 */
    case 'merge': {
      const from = frameOf(state, action.fromKey)
      const into = frameOf(state, action.intoKey)
      if (!from || !into || from.key === into.key) return state
      const merged = patchFrame(state, into.key, (w) => ({
        ...w,
        tabs: [...w.tabs, ...from.tabs],
        active: w.tabs.length,
        minimized: false,
      }))
      const without = { ...merged, windows: merged.windows.filter((w) => w.key !== from.key) }
      return raise(without, into.key)
    }

    /* 拆帧：把标签拿出来单独成一框（位置用指针附近那个矩形） */
    case 'detach': {
      const win = frameOf(state, action.key)
      if (!win || win.tabs.length < 2) return state
      const index = clamp(action.index, 0, win.tabs.length - 1)
      const tab = win.tabs[index]
      const tabs = win.tabs.filter((_, i) => i !== index)
      const active = index < win.active ? win.active - 1 : Math.min(win.active, tabs.length - 1)
      /* 拆出来的那一框用外壳给的矩形（指针附近），只做最小值保护 */
      const spot = {
        x: Math.max(0, Math.round(action.x)),
        y: Math.max(0, Math.round(action.y)),
        w: Math.max(MIN_W, Math.round(action.w)),
        h: Math.max(MIN_H, Math.round(action.h)),
        maximized: false,
      }
      const detached: WindowState = {
        key: `w${state.nextKey}`,
        tabs: [tab],
        active: 0,
        ...spot,
        z: state.topZ + 1,
        minimized: false,
      }
      return {
        topZ: state.topZ + 1,
        nextKey: state.nextKey + 1,
        windows: [
          ...patchFrame(state, win.key, (w) => ({ ...w, tabs, active })).windows,
          detached,
        ],
      }
    }

    /* 帧内拖拽排序：活动下标跟着那个被拖的标签走 */
    case 'reorder': {
      const win = frameOf(state, action.key)
      if (!win || win.tabs.length < 2) return state
      const from = clamp(action.from, 0, win.tabs.length - 1)
      const to = clamp(action.to, 0, win.tabs.length - 1)
      if (from === to) return state
      const tabs = [...win.tabs]
      const [item] = tabs.splice(from, 1)
      tabs.splice(to, 0, item)
      let active = win.active
      if (win.active === from) active = to
      else if (from < win.active && to >= win.active) active = win.active - 1
      else if (from > win.active && to <= win.active) active = win.active + 1
      return patchFrame(state, action.key, (w) => ({ ...w, tabs, active }))
    }

    /* 刷新恢复：照着会话记忆把框建起来（几何缺了就按应用默认尺寸居中） */
    case 'hydrate': {
      let nextKey = state.nextKey
      let topZ = state.topZ
      const windows: WindowState[] = []
      for (const frame of action.frames) {
        if (!frame || !Array.isArray(frame.tabs) || frame.tabs.length === 0) continue
        const spot = frame.geometry
          ? clampGeometry(frame.geometry, action.bounds)
          : centerSpot(action.bounds)
        topZ += 1
        windows.push({
          key: `w${nextKey}`,
          tabs: frame.tabs,
          active: clamp(Number(frame.active) || 0, 0, frame.tabs.length - 1),
          ...spot,
          z: topZ,
          minimized: false,
        })
        nextKey += 1
      }
      if (windows.length === 0) return state
      return {
        topZ,
        nextKey,
        /* 会话里的框排在后面：路由那一扇（如果有）仍然在最上面 */
        windows: [...state.windows, ...windows],
      }
    }

    default:
      return state
  }
}

/** 会话快照 → hydrate 用的帧（给外壳用，免得它自己拼） */
export function toSessionFrames(windows: WindowState[]): SessionFrame[] {
  return windows.map((w) => ({
    tabs: w.tabs,
    active: w.active,
    geometry: { x: w.x, y: w.y, w: w.w, h: w.h, maximized: w.maximized },
  }))
}
