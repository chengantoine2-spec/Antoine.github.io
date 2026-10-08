import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { normalizeForSearch } from '../../lib/github'
import { readTermPort } from '../../lib/terminal'
import {
  cycleRepeat,
  getMusicSnap,
  loadLibrary,
  next,
  playTrack,
  prev,
  seek,
  setShuffle,
  setVolume,
  subscribeMusic,
  toggle,
  trackMediaUrl,
  type Track,
} from '../../lib/music/player'

/* ══ 音乐窗口（2026-10-06）═════════════════════════════════════════════════
   引擎在 `lib/music/player.ts`（模块级单例 audio + 状态广播 + 存档），这一层只是**视图** ——
   菜单栏那组控件读的是同一份状态，所以两边永远一致。

   服务端那半在 `tools/term-server.mjs`（**本单一行都不改它**）：`/music/list` 出清单、
   `/music/file` 出音频与封面，都要 `x-term-token`、都只认本机 Origin。
   ⚠️ `<audio src>` 发不了自定义头 → 音频与封面走 **fetch（带头）→ blob**，
   真实来源记在 `audio.dataset.src` 上（细节见 player.ts 的文件头）。 */

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
  const [q, setQ] = useState('')
  const s = useSyncExternalStore(subscribeMusic, getMusicSnap)

  useEffect(() => {
    void loadLibrary()
  }, [])

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(q)
    if (!needle) return s.tracks
    return s.tracks.filter((t) =>
      normalizeForSearch(`${t.title} ${t.artist} ${t.album ?? ''} ${t.file}`).includes(needle),
    )
  }, [s.tracks, q])

  /* 服务不在：**所有播放控件一律 disable**（项目红线：绝不给点了没反应的按钮） */
  const off = s.online === false
  const ctl = (name: string) => ({ 'data-music-ctl': name, disabled: off }) as const
  const playing = (t: Track) => s.src === trackMediaUrl(t)
  const libName = s.dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '音乐库'

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
          {s.online === null ? '检测中…' : s.online ? '● 服务在线' : '○ 服务未运行'}
        </span>
        <button
          type="button"
          onClick={() => void loadLibrary()}
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
            <div className="rounded-md bg-surface-2 px-2 py-1.5 text-ink" title={s.dir} data-music-dir="">
              {libName}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs text-dim">
            <span>曲目　{s.tracks.length}</span>
            <span>显示　{filtered.length}</span>
            <span>端口　{port}</span>
          </div>
          {s.err ? <div className="text-xs text-dim">{s.err}</div> : null}
          {s.hint ? <div className="text-xs text-dim">{s.hint}</div> : null}
        </aside>

        {/* 中：曲目列表 */}
        <section className="music__pane">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-dim">
              {s.tracks.length === 0
                ? '这个目录里还没有曲目（放几个 mp3/flac/wav/m4a 进去，或写一份 music.json 清单）。'
                : '没有匹配的曲目。'}
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
                      {playing(t) && s.dur > 0 ? fmt(s.dur) : sizeText(t.size)}
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
          {s.cover ? (
            <img src={s.cover} alt="" className="music__thumb aspect-square w-full" />
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
              {s.title || '没有在放的曲目'}
            </div>
            <div className="truncate text-xs text-dim">
              {s.artist || ''}
              {s.album ? ` · ${s.album}` : ''}
            </div>
          </div>

          {/* 进度条：拖动即 seek（seek 会顺手把位置落盘） */}
          <div className="flex items-center gap-2 text-xs text-dim">
            <span data-music-time="">{fmt(s.time)}</span>
            <input
              type="range"
              min={0}
              max={s.dur > 0 ? s.dur : 1}
              step={0.5}
              value={Math.min(s.time, s.dur || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="播放进度"
              className="min-w-0 flex-1 accent-[var(--c-accent)]"
              {...ctl('seek')}
            />
            <span>{fmt(s.dur)}</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              {...ctl('shuffle')}
              aria-pressed={s.shuffle}
              title="随机"
              aria-label="随机"
              onClick={() => setShuffle(!s.shuffle)}
              className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-[var(--c-control-hover)] disabled:opacity-40"
            >
              ⇄
            </button>
            <button
              type="button"
              {...ctl('prev')}
              title="上一首"
              aria-label="上一首"
              onClick={() => prev()}
              className="grid h-8 w-8 place-items-center rounded-md text-ink hover:bg-[var(--c-control-hover)] disabled:opacity-40"
            >
              ⏮
            </button>
            <button
              type="button"
              {...ctl('play')}
              title={s.paused ? '播放' : '暂停'}
              aria-label={s.paused ? '播放' : '暂停'}
              onClick={() => toggle()}
              className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
            >
              {s.paused ? '▶' : '❚❚'}
            </button>
            <button
              type="button"
              {...ctl('next')}
              title="下一首"
              aria-label="下一首"
              onClick={() => next(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-ink hover:bg-[var(--c-control-hover)] disabled:opacity-40"
            >
              ⏭
            </button>
            <button
              type="button"
              {...ctl('repeat')}
              aria-pressed={s.repeat !== 'off'}
              title="循环"
              aria-label="循环"
              onClick={() => cycleRepeat()}
              className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-[var(--c-control-hover)] disabled:opacity-40"
            >
              {s.repeat === 'one' ? '①' : '↻'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-dim">
            <span aria-hidden="true">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.vol}
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
