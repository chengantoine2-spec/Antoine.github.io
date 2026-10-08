/* 音乐播放引擎（2026-10-06 收尾那一单把它从 `MusicWindow.tsx` 里提出来）。
 *
 * 为什么单独一层：**菜单栏也要控制播放**（播放/暂停、下一首），而它不该 import 一个窗口组件。
 * 引擎 + 状态放这里，窗口与菜单栏都只是它的视图。
 *
 * 三条要点：
 * 1. **一个 `HTMLAudioElement`（模块级单例）** ⇒ 两个音乐窗口、菜单栏加起来也只有一个在播；
 *    关闭窗口会卸载组件，挂在模块上才能"关窗不停播"。
 * 2. ⚠️ **音频只能走 fetch（带头）→ blob**：`/music/file` 只认 `x-term-token` 请求头，
 *    而 `<audio src>` 发不了自定义头（服务端没有 `?token=` 退路，也不许改）。
 *    所以 `audio.currentSrc` 只能是 `blob:`，真实 URL 记在 `audio.dataset.src` 上。
 * 3. **持久化只写小的**：音量/随机/循环/上次那首/上次位置（`lib/music/prefs.ts`），不存曲库清单。
 */
import { pingTerm, readTermPort, readTermToken, termBase } from '../terminal'
import { readMusicPrefs, writeMusicPrefs, type Repeat } from './prefs'

export interface Track {
  id: string
  file: string
  title: string
  artist: string
  album?: string
  cover?: string
  size?: number
}

export interface MusicSnap {
  /** null = 还在探活 */
  online: boolean | null
  tracks: Track[]
  dir: string
  hint: string
  err: string
  /** 曲目的**真实**来源（`/music/file?path=…`）—— `audio.currentSrc` 只能是 blob */
  src: string
  title: string
  artist: string
  album: string
  cover: string
  paused: boolean
  busy: boolean
  time: number
  dur: number
  vol: number
  shuffle: boolean
  repeat: Repeat
}

const audio: HTMLAudioElement = new Audio()
audio.preload = 'metadata'
audio.dataset.musicAudio = ''

/** ⚠️ `new Audio()` 是**游离节点**，不挂进 DOM 的话 `document.querySelectorAll('audio')` 数到 0
 *  —— "页面里只有一个 audio"这件事就没法断言（第一版验证脚本就是这么红的）。
 *  挂上没有副作用：没有 `controls`、不占位、不可见。 */
function ensureMounted(): void {
  if (!audio.isConnected && typeof document !== 'undefined') document.body.appendChild(audio)
}
ensureMounted()

/** 当前音频的 object URL：换曲先 revoke，否则整首整首地漏内存 */
let audioUrl: string | null = null
/** 封面 object URL 小、数量有限，按路径缓存 */
const covers = new Map<string, string>()

let queue: Track[] = []
let index = -1
let lastPersist = 0

const prefs = readMusicPrefs()
audio.volume = prefs.volume

let snap: MusicSnap = {
  online: null,
  tracks: [],
  dir: '',
  hint: '',
  err: '',
  src: '',
  title: '',
  artist: '',
  album: '',
  cover: '',
  paused: true,
  busy: false,
  time: prefs.position,
  dur: 0,
  vol: prefs.volume,
  shuffle: prefs.shuffle,
  repeat: prefs.repeat,
}

const listeners = new Set<() => void>()
/** ⚠️ 每次 emit 换一个新对象：`useSyncExternalStore` 靠引用比较决定要不要重渲 */
const setSnap = (patch: Partial<MusicSnap>) => {
  snap = { ...snap, ...patch }
  listeners.forEach((l) => l())
}
export const subscribeMusic = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getMusicSnap = () => snap

const mediaUrl = (track: Track, file = track.file): string =>
  `${termBase(readTermPort())}/music/file?path=${encodeURIComponent(file)}`
/** 窗口/菜单栏判断"这首是不是正在放的那首" */
export const trackMediaUrl = mediaUrl

/* ── Media Session（锁屏 / 系统媒体键）───────────────────────────────────────
   ⚠️ 不支持的浏览器（或 `MediaMetadata` 缺失）**必须优雅跳过**，不许抛。 */
function updateMediaSession(): void {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
  if (!ms || typeof MediaMetadata === 'undefined') return
  try {
    ms.metadata = new MediaMetadata({
      title: snap.title || '未命名',
      artist: snap.artist || '',
      album: snap.album || '',
      artwork: snap.cover ? [{ src: snap.cover }] : [],
    })
  } catch {
    /* 某些实现会对 artwork 挑刺，忽略即可 */
  }
}

function wireMediaSession(): void {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
  if (!ms) return
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(action, handler)
    } catch {
      /* 浏览器不认识这个 action 会抛 —— 逐个吞掉，别影响别的 */
    }
  }
  set('play', () => void audio.play())
  set('pause', () => audio.pause())
  set('previoustrack', () => prev())
  set('nexttrack', () => next(false))
  set('seekto', (details) => {
    if (typeof details.seekTime === 'number') seek(details.seekTime)
  })
  set('seekbackward', (details) => seek(audio.currentTime - (details.seekOffset ?? 10)))
  set('seekforward', (details) => seek(audio.currentTime + (details.seekOffset ?? 10)))
}
wireMediaSession()

/* 事件只挂一次（模块级），所有视图共享 */
audio.addEventListener('play', () => setSnap({ paused: false }))
audio.addEventListener('pause', () => {
  setSnap({ paused: true })
  /* 暂停是"用户真的在听"的最强信号：这时把位置落盘 */
  if (snap.src) writeMusicPrefs({ position: audio.currentTime })
})
audio.addEventListener('timeupdate', () => {
  setSnap({ time: audio.currentTime })
  /* 位置每 5 秒落一次盘（`timeupdate` 一秒好几次，不节流会把 localStorage 写爆） */
  const now = Date.now()
  if (snap.src && !audio.paused && now - lastPersist > 5000) {
    lastPersist = now
    writeMusicPrefs({ position: audio.currentTime })
  }
})
audio.addEventListener('durationchange', () =>
  setSnap({ dur: Number.isFinite(audio.duration) ? audio.duration : 0 }),
)
audio.addEventListener('volumechange', () => setSnap({ vol: audio.volume }))
audio.addEventListener('ended', () => {
  setSnap({ paused: true, time: 0 })
  if (snap.src) writeMusicPrefs({ position: 0 })
  next(true)
})
audio.addEventListener('error', () => setSnap({ busy: false, paused: true }))

async function fetchBlob(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'x-term-token': readTermToken() } })
  if (res.status === 401) throw new Error('token 不对')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return URL.createObjectURL(await res.blob())
}

async function loadCover(track: Track) {
  if (!track.cover) return
  const cached = covers.get(track.cover)
  if (cached) {
    setSnap({ cover: cached })
    updateMediaSession()
    return
  }
  try {
    const url = await fetchBlob(mediaUrl(track, track.cover))
    covers.set(track.cover, url)
    /* 期间可能已经换了曲目 —— 只在这首还是当前曲目时才贴上去 */
    if (snap.src === mediaUrl(track)) {
      setSnap({ cover: url })
      updateMediaSession()
    }
  } catch {
    /* 封面拿不到就不显示，不影响播放 */
  }
}

export async function playTrack(track: Track, list: Track[], at: number): Promise<void> {
  return loadTrack(track, list, at, true)
}

/** 装载一首。`autoplay=false` 给"恢复上次那首"用 —— 浏览器会拦自动播放，别硬来 */
async function loadTrack(track: Track, list: Track[], at: number, autoplay: boolean): Promise<void> {
  ensureMounted()
  queue = list
  index = at
  setSnap({
    busy: true,
    title: track.title,
    artist: track.artist,
    album: track.album ?? '',
    cover: '',
    src: '',
    time: 0,
    dur: 0,
  })
  const url = mediaUrl(track)
  try {
    /* 先记真实来源，再换成 blob：验证脚本按 `dataset.src` 认 `/music/file` */
    audio.dataset.src = url
    const objectUrl = await fetchBlob(url)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    audioUrl = objectUrl
    audio.src = objectUrl
    setSnap({ src: url, busy: false })
    /* 用户点了这一首 = 真的改过：把"上次那首"落盘。
       ⚠️ 这里**不写 position**：恢复上次那首走的是同一条装载路径，写 0 会把记住的位置抹掉 */
    writeMusicPrefs({ lastTrackId: track.id })
    updateMediaSession()
    if (autoplay) await audio.play()
    void loadCover(track)
  } catch {
    setSnap({ busy: false, paused: true, src: url })
  }
}

function step(delta: number) {
  if (!queue.length) return
  if (index < 0) {
    void playTrack(queue[0], queue, 0)
    return
  }
  const n = queue.length
  const i = (((index + delta) % n) + n) % n
  void playTrack(queue[i], queue, i)
}

export function next(auto = false): void {
  if (!queue.length) return
  if (auto && snap.repeat === 'one') {
    audio.currentTime = 0
    void audio.play()
    return
  }
  if (snap.shuffle) {
    const i = Math.floor(Math.random() * queue.length)
    void playTrack(queue[i], queue, i)
    return
  }
  if (!auto || snap.repeat === 'all' || index < queue.length - 1) step(1)
}

export const prev = () => step(-1)

export function toggle(): void {
  ensureMounted()
  if (!audio.dataset.src) {
    /* 还没装载过任何一首：**从曲库第一首开始**。
       ⚠️ 不能只看 `queue`：菜单栏那颗播放键可以在"窗口里一次都没点过歌"时按下去，
       而 `queue` 只有 `playTrack` / 恢复上次那首时才会填 —— 那时它是空的。 */
    const list = queue.length ? queue : snap.tracks
    if (list[0]) void playTrack(list[0], list, 0)
    return
  }
  if (audio.paused) void audio.play()
  else audio.pause()
}

export function seek(t: number): void {
  if (!Number.isFinite(t)) return
  const max = Number.isFinite(audio.duration) ? audio.duration : t
  audio.currentTime = Math.min(Math.max(0, t), max)
  setSnap({ time: audio.currentTime })
  writeMusicPrefs({ position: audio.currentTime })
}

export function setVolume(v: number): void {
  const next = Math.min(1, Math.max(0, v))
  audio.volume = next
  /* 用户拖了音量条 = 真的改过 */
  writeMusicPrefs({ volume: next })
}

export function setShuffle(value: boolean): void {
  setSnap({ shuffle: value })
  writeMusicPrefs({ shuffle: value })
}

export function cycleRepeat(): void {
  const nextRepeat: Repeat = snap.repeat === 'off' ? 'all' : snap.repeat === 'all' ? 'one' : 'off'
  setSnap({ repeat: nextRepeat })
  writeMusicPrefs({ repeat: nextRepeat })
}

/* ── 曲库：探活 + 取清单（窗口挂载时调一次；菜单栏据此决定要不要显示控件）── */
let probing: Promise<void> | null = null

export async function loadLibrary(): Promise<void> {
  if (probing) return probing
  probing = (async () => {
    const port = readTermPort()
    setSnap({ online: null, err: '' })
    const alive = await pingTerm(port)
    setSnap({ online: alive })
    if (!alive) {
      setSnap({ tracks: [], dir: '', hint: '', err: '' })
      return
    }
    try {
      const res = await fetch(`${termBase(port)}/music/list`, {
        headers: { 'x-term-token': readTermToken() },
      })
      if (res.status === 401) throw new Error('token 不对 —— 看 `npm run term` 启动时打印的那串，填到「终端」窗口里')
      if (res.status === 403) throw new Error('服务只接受本机页面的请求')
      if (!res.ok) throw new Error(`服务返回 HTTP ${res.status}`)
      const json = (await res.json()) as { tracks?: Track[]; dir?: string; hint?: string }
      const tracks = Array.isArray(json.tracks) ? json.tracks : []
      setSnap({
        tracks,
        dir: String(json.dir ?? ''),
        hint: String(json.hint ?? ''),
        err: '',
      })
      restoreLast(tracks)
    } catch (e) {
      setSnap({ err: e instanceof Error ? e.message : String(e), tracks: [] })
    } finally {
      probing = null
    }
  })()
  return probing
}

/** 上次那首：只在**第一次**拿到曲库时恢复，且**不自动播**（浏览器会拦），只把位置摆好 */
let restored = false
function restoreLast(tracks: Track[]): void {
  if (restored) return
  restored = true
  const last = tracks.find((t) => t.id === prefs.lastTrackId)
  if (!last || !prefs.position) return
  queue = tracks
  index = tracks.indexOf(last)
  void loadTrack(last, tracks, index, false).then(() => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(prefs.position, audio.duration)
    setSnap({ time: audio.currentTime, paused: true })
  })
}
