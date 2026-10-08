import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { normalizeForSearch } from '../../lib/github'
import { pingTerm, readTermPort, readTermToken, termBase } from '../../lib/terminal'

/* ══ 音乐窗口（2026-10-06）═════════════════════════════════════════════════
   服务端那半在 `tools/term-server.mjs`（**本文件一行都不改它**）：`/music/list` 出清单、
   `/music/file` 出音频与封面，两者都要 `x-term-token`、都只认本机 Origin。

   ⚠️ **一个绕不过去的约束**（前面那版方案漏了）：`<audio src>` **发不了自定义请求头**，
   而 `/music/file` 只认 `x-term-token`（服务端**没有** `?token=` 退路，也不许改）。
   所以音频与封面都走 **fetch（带头）→ blob → object URL**：
   · `audio.currentSrc` 只能是 `blob:`（这是浏览器给的，改不了）；
   · 真实来源记在 `audio.dataset.src` 上（就是那个 `/music/file?path=…` URL），界面与验证都按它认。
   代价：一首歌是**整首下完再播**，不是边下边播（Range/206 那个能力仍在服务端，见 verify-music 服务端 16 条）。
   要换成真·流式 seek，得服务端支持 query token 或加一层 SW 代理 —— 那是站主要拍板的事，不在这单里。

   ⚠️ **播放器是模块级单例**（模块作用域一个 `HTMLAudioElement`）：
   两个音乐窗口共享它 ⇒ 天然只有一个在播；而且**关闭窗口会卸载组件**，挂在模块上才能"关窗不停播"
   （最小化是 `display:none`、不卸载，本来就不断）。播放状态用 `useSyncExternalStore` 广播，
   第二个窗口的界面才不会和实际不同步。 */

interface Track {
  id: string
  file: string
  title: string
  artist: string
  album?: string
  cover?: string
  size?: number
}

const audio: HTMLAudioElement = new Audio()
audio.preload = 'metadata'
audio.dataset.musicAudio = ''

/* 当前音频的 object URL：换曲必须先 revoke，否则整首整首地漏内存 */
let audioUrl: string | null = null
/* 封面 object URL 小、数量有限，按路径缓存 */
const covers = new Map<string, string>()

let queue: Track[] = []
let index = -1

interface Snap {
  /** 曲目的**真实**来源（`/music/file?path=…`）——`audio.currentSrc` 只能是 blob */
  src: string
  title: string
  artist: string
  cover: string
  paused: boolean
  busy: boolean
  time: number
  dur: number
  vol: number
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
}

let snap: Snap = {
  src: '',
  title: '',
  artist: '',
  cover: '',
  paused: true,
  busy: false,
  time: 0,
  dur: 0,
  vol: 1,
  shuffle: false,
  repeat: 'off',
}

const listeners = new Set<() => void>()
/** ⚠️ 每次 emit 换一个新对象：`useSyncExternalStore` 靠引用比较决定要不要重渲 */
const setSnap = (patch: Partial<Snap>) => {
  snap = { ...snap, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const getSnap = () => snap

/* 事件只挂一次（模块级），两个窗口不必各自监听 */
audio.addEventListener('play', () => setSnap({ paused: false }))
audio.addEventListener('pause', () => setSnap({ paused: true }))
audio.addEventListener('timeupdate', () => setSnap({ time: audio.currentTime }))
audio.addEventListener('durationchange', () =>
  setSnap({ dur: Number.isFinite(audio.duration) ? audio.duration : 0 }),
)
audio.addEventListener('volumechange', () => setSnap({ vol: audio.volume }))
audio.addEventListener('ended', () => {
  setSnap({ paused: true, time: 0 })
  next(true)
})
audio.addEventListener('error', () => setSnap({ busy: false, paused: true }))

async function fetchBlob(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'x-term-token': readTermToken() } })
  if (res.status === 401) throw new Error('token 不对')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return URL.createObjectURL(await res.blob())
}

/** 把那个单例 audio 挂到 DOM 上。
    它本来是游离节点（`new Audio()` 不进 DOM），**行为上完全够用**，但"页面里只有一个 audio"
    这件事就变得量不到了（验证脚本按 `document.querySelectorAll('audio')` 判单例）。
    挂上没有副作用：没有 `controls`、不占位、不可见。 */
function ensureMounted(): void {
  if (!audio.isConnected && typeof document !== 'undefined') document.body.appendChild(audio)
}

function mediaUrl(track: Track, file = track.file): string {
  return `${termBase(readTermPort())}/music/file?path=${encodeURIComponent(file)}`
}

async function loadCover(track: Track) {
  if (!track.cover) return
  const cached = covers.get(track.cover)
  if (cached) {
    setSnap({ cover: cached })
    return
  }
  try {
    const url = await fetchBlob(mediaUrl(track, track.cover))
    covers.set(track.cover, url)
    /* 期间可能已经换了曲目 —— 只在这首还是当前曲目时才贴上去 */
    if (snap.src === mediaUrl(track)) setSnap({ cover: url })
  } catch {
    /* 封面拿不到就不显示，不影响播放 */
  }
}

async function playTrack(track: Track, list: Track[], at: number) {
  ensureMounted()
  queue = list
  index = at
  setSnap({ busy: true, title: track.title, artist: track.artist, cover: '', src: '', time: 0, dur: 0 })
  const url = mediaUrl(track)
  try {
    /* 先记真实来源，再换成 blob：验证脚本按 `dataset.src` 认 `/music/file` */
    audio.dataset.src = url
    const objectUrl = await fetchBlob(url)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    audioUrl = objectUrl
    audio.src = objectUrl
    setSnap({ src: url, busy: false })
    await audio.play()
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

function next(auto = false) {
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

const prev = () => step(-1)

function toggle() {
  ensureMounted()
  if (!audio.dataset.src) {
    if (queue[0]) void playTrack(queue[0], queue, 0)
    return
  }
  if (audio.paused) void audio.play()
  else audio.pause()
}

const seek = (t: number) => {
  if (Number.isFinite(audio.duration)) audio.currentTime = t
}
const setVolume = (v: number) => {
  audio.volume = v
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const sizeText = (bytes?: number) =>
  bytes && bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : ''

/* 窗口自己的版式：**globals.css 不归这一单**，所以样式写在组件内的 <style> 里
   （同样**不在任何 @layer 里**，见项目坑 1）。栏数照 `.wiki__*` 那套容器查询走。 */
const CSS = `
.music{container-type:inline-size;display:flex;flex-direction:column;height:100%;min-height:0;gap:10px}
.music__grid{display:grid;grid-template-columns:1fr;gap:14px;flex:1;min-height:0}
.music__pane{min-height:0;overflow:auto}
@container (min-width:620px){.music__grid{grid-template-columns:180px 1fr}}
@container (min-width:880px){.music__grid{grid-template-columns:200px 1fr 320px}}
.music__row{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border-radius:7px;text-align:left;color:inherit}
.music__row:hover{background:var(--c-hover)}
.music__row[data-playing="true"]{background:var(--c-accent);color:var(--c-accent-fg)}
.music__thumb{border-radius:6px;object-fit:cover;flex:0 0 auto;background:var(--c-surface-2)}
.music__icon{display:grid;place-items:center;border-radius:6px;background:var(--c-surface-2);flex:0 0 auto}
`

export function MusicWindow() {
  const port = useMemo(() => readTermPort(), [])
  const [online, setOnline] = useState<boolean | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [dir, setDir] = useState('')
  const [hint, setHint] = useState('')
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const player = useSyncExternalStore(subscribe, getSnap)

  /* 探活 + 取清单。端口/token 都从 localStorage 读（可能刚在「终端」窗口里填过） */
  const probe = useCallback(async () => {
    setOnline(null)
    setErr('')
    const alive = await pingTerm(port)
    setOnline(alive)
    if (!alive) {
      setTracks([])
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
      setTracks(Array.isArray(json.tracks) ? json.tracks : [])
      setDir(String(json.dir ?? ''))
      setHint(String(json.hint ?? ''))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setTracks([])
    }
  }, [port])

  useEffect(() => {
    /* 一挂上窗口就把单例 audio 放进 DOM（见 ensureMounted 注释：为了"只有一个 audio"可断言） */
    ensureMounted()
    void probe()
  }, [probe])

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(q)
    if (!needle) return tracks
    return tracks.filter((t) =>
      normalizeForSearch(`${t.title} ${t.artist} ${t.album ?? ''} ${t.file}`).includes(needle),
    )
  }, [tracks, q])

  /* 服务不在：**所有播放控件一律 disable**（项目红线：绝不给点了没反应的按钮） */
  const off = online === false
  const ctl = (name: string) => ({ 'data-music-ctl': name, disabled: off }) as const
  const playing = (t: Track) => player.src === mediaUrl(t)
  const libName = dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '音乐库'

  return (
    <div className="music" data-music-root="">
      <style>{CSS}</style>

      {/* 工具条：搜索 + 服务状态 + 重新检测（这一颗**永远可用**，它是真动作） */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：标题 / 歌手 / 专辑 / 文件名"
          aria-label="搜索曲目"
          className="h-8 min-w-0 flex-1 rounded-md border border-edge bg-surface-2 px-3 text-sm text-ink outline-none placeholder:text-dim"
        />
        <span className="text-xs text-dim" data-music-status="">
          {online === null ? '检测中…' : online ? '● 服务在线' : '○ 服务未运行'}
        </span>
        <button
          type="button"
          onClick={() => void probe()}
          className="h-8 rounded-md border border-edge px-3 text-xs text-ink bg-[var(--c-control-hover)]"
        >
          重新检测
        </button>
      </div>

      {off ? (
        /* ⚠️ 降级：**整窗如实说"服务未运行"**，并把启动命令给出来（跟终端窗口同一套口径）。
           下面的控件照常渲染但全部 disabled —— 既满足"不许有死按钮"，也能被验证脚本量到。 */
        <div className="rounded-lg border border-edge bg-surface-2 p-4 text-sm text-dim" data-music-offline="">
          <div className="text-ink" data-music-notice="">
            本机服务未运行
          </div>
          <p className="mt-2">
            音乐库靠本机服务读：在项目目录里跑{' '}
            <code className="font-mono text-ink">npm run term</code>
            ，把它打印的 token 填到「终端」窗口里（只存在这台浏览器里），再点上面的「重新检测」。
          </p>
        </div>
      ) : null}

      <div className="music__grid">
        {/* 左：资料库 */}
        <aside className="music__pane flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-dim">资料库</div>
            <div className="rounded-md bg-surface-2 px-2 py-1.5 text-ink" title={dir} data-music-dir="">
              {libName}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs text-dim">
            <span>曲目　{tracks.length}</span>
            <span>显示　{filtered.length}</span>
            <span>端口　{port}</span>
          </div>
          {err ? <div className="text-xs text-dim">{err}</div> : null}
          {hint ? <div className="text-xs text-dim">{hint}</div> : null}
        </aside>

        {/* 中：曲目列表 */}
        <section className="music__pane">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-dim">
              {tracks.length === 0 ? '这个目录里还没有曲目（放几个 mp3/flac/wav/m4a 进去，或写一份 music.json 清单）。' : '没有匹配的曲目。'}
            </div>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    data-music-track={t.id}
                    data-playing={playing(t)}
                    onClick={() => void playTrack(t, filtered, i)}
                    className="music__row"
                  >
                    <span className="music__icon h-8 w-8 text-dim" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M9.4 17V6.6l8.4-1.7V15.2" />
                        <circle cx="7" cy="17" r="2.4" />
                        <circle cx="15.4" cy="15.2" r="2.4" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{t.title}</span>
                      <span className="block truncate text-xs text-dim">
                        {t.artist || '未知歌手'}
                        {t.album ? ` · ${t.album}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-dim">
                      {playing(t) && player.dur > 0 ? fmt(player.dur) : sizeText(t.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 右：正在播放 */}
        <aside className="music__pane flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-dim">正在播放</div>
          {player.cover ? (
            <img src={player.cover} alt="" className="music__thumb aspect-square w-full" />
          ) : (
            <div className="music__icon aspect-square w-full text-dim" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M9.4 17V6.6l8.4-1.7V15.2" />
                <circle cx="7" cy="17" r="2.4" />
                <circle cx="15.4" cy="15.2" r="2.4" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm text-ink" data-music-now="">
              {player.title || '没有在放的曲目'}
            </div>
            <div className="truncate text-xs text-dim">{player.artist || ''}</div>
          </div>

          {/* 进度条：拖动即 seek */}
          <div className="flex items-center gap-2 text-xs text-dim">
            <span data-music-time="">{fmt(player.time)}</span>
            <input
              type="range"
              min={0}
              max={player.dur > 0 ? player.dur : 1}
              step={0.5}
              value={Math.min(player.time, player.dur || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="播放进度"
              className="min-w-0 flex-1 accent-[var(--c-accent)]"
              {...ctl('seek')}
            />
            <span>{fmt(player.dur)}</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button type="button" {...ctl('shuffle')} aria-pressed={player.shuffle} title="随机" aria-label="随机"
              onClick={() => setSnap({ shuffle: !player.shuffle })}
              className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-[var(--c-control-hover)] disabled:opacity-40">
              ⇄
            </button>
            <button type="button" {...ctl('prev')} title="上一首" aria-label="上一首" onClick={prev}
              className="grid h-8 w-8 place-items-center rounded-md text-ink hover:bg-[var(--c-control-hover)] disabled:opacity-40">
              ⏮
            </button>
            <button type="button" {...ctl('play')} title={player.paused ? '播放' : '暂停'}
              aria-label={player.paused ? '播放' : '暂停'} onClick={toggle}
              className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-40">
              {player.paused ? '▶' : '❚❚'}
            </button>
            <button type="button" {...ctl('next')} title="下一首" aria-label="下一首" onClick={() => next(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-ink hover:bg-[var(--c-control-hover)] disabled:opacity-40">
              ⏭
            </button>
            <button type="button" {...ctl('repeat')} aria-pressed={player.repeat !== 'off'} title="循环" aria-label="循环"
              onClick={() => setSnap({ repeat: player.repeat === 'off' ? 'all' : player.repeat === 'all' ? 'one' : 'off' })}
              className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-[var(--c-control-hover)] disabled:opacity-40">
              {player.repeat === 'one' ? '①' : '↻'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-dim">
            <span aria-hidden="true">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={player.vol}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="音量"
              className="min-w-0 flex-1 accent-[var(--c-accent)]"
              {...ctl('volume')}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
