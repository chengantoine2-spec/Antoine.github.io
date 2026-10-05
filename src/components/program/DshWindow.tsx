import { useCallback, useEffect, useState } from 'react'
import { IS_LOCAL_HOST } from '../../lib/apps'
import { DSH_DEFAULT_URL, readDshUrl, writeDshUrl } from '../../lib/dsh'
import { AppIcon } from '../desktop/AppIcon'

/** 探活结果。线上（HTTPS）根本探不到 127.0.0.1，所以那边直接是 blocked */
type Probe = 'checking' | 'online' | 'offline' | 'blocked'

const PROBE_TEXT: Record<Probe, string> = {
  checking: '探测中…',
  online: '在线',
  offline: '没探测到',
  blocked: '线上无法探测',
}

const PROBE_HINT: Record<Probe, string> = {
  checking: '正在敲一下这个地址，看本机 DSH 在不在。',
  online: '已经探测到本机 DSH —— 直接打开就是你的会话，用的是当前浏览器的登录态。',
  offline: '这个地址上没有回应。多半是 DSH 没在跑，或者在跑但端口不是这个（地址可以在下面改）。',
  blocked:
    '线上站点是 HTTPS，按浏览器规则不能请求 http://127.0.0.1，也不能把它嵌进 iframe —— 所以这个入口只在本地出现。',
}

/**
 * DSH 快捷入口（「芹菜耕地」里那块地本身）。
 *
 * 只是个**启动器**，不代理任何东西：DSH 是本机服务，网页没法替它干活。
 * - 本地打开站点时：能探活（no-cors），显示在线/离线
 * - 线上打开站点时：这个窗口压根不挂载（`apps.ts` 里 `localOnly: true`）
 */
export function DshWindow() {
  const [url, setUrl] = useState(readDshUrl)
  const [draft, setDraft] = useState(url)
  const [probe, setProbe] = useState<Probe>(IS_LOCAL_HOST ? 'checking' : 'blocked')

  useEffect(() => {
    if (!IS_LOCAL_HOST) {
      setProbe('blocked')
      return
    }
    let cancelled = false
    setProbe('checking')
    /* no-cors：DSH 不发 CORS 头，普通 fetch 一定被拦成 TypeError，分不清"没跑"和"跨域"。
       用 no-cors 只要对面回了任何 HTTP 响应（哪怕 401）就算在线 —— 这正是我们要判断的。 */
    fetch(url, { mode: 'no-cors' })
      .then(() => {
        if (!cancelled) setProbe('online')
      })
      .catch(() => {
        if (!cancelled) setProbe('offline')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const open = useCallback(() => {
    /* 用命名窗口：再点一次是复用同一个窗口（像应用一样），不会堆出一串标签 */
    const win = window.open(url, 'dsh-web', 'popup=yes,width=1280,height=860')
    win?.focus()
  }, [url])

  function save() {
    const next = draft.trim()
    if (!/^https?:\/\/\S+$/i.test(next)) return
    writeDshUrl(next)
    setUrl(next)
  }

  function reset() {
    writeDshUrl(null)
    setUrl(DSH_DEFAULT_URL)
    setDraft(DSH_DEFAULT_URL)
  }

  return (
    <div className="space-y-4">
      <section className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3">
        <AppIcon name="dsh" className="h-8 w-8 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            DSH <span className="text-xs font-normal text-dim">· 芹菜（这块地的入口）</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-dim">
            DeepSeek Harness 是本机服务：浏览器只当屏幕，会话、插件和命令都在你自己那台电脑上跑。
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-edge bg-surface-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-dim">状态</h3>
          <span
            data-probe={probe}
            className={`rounded border px-2 py-0.5 text-[11px] ${
              probe === 'online' ? 'border-accent text-ink' : 'border-edge text-dim'
            }`}
          >
            {PROBE_TEXT[probe]}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-dim">{PROBE_HINT[probe]}</p>
      </section>

      <section className="rounded-lg border border-edge bg-surface-2 p-3">
        <h3 className="text-xs font-medium text-dim">地址</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            aria-label="DSH 地址"
            spellCheck={false}
            className="min-w-[12rem] flex-1 rounded border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            className="rounded border border-edge px-2.5 py-1.5 text-xs text-dim hover:bg-hover hover:text-ink"
          >
            保存
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded border border-edge px-2.5 py-1.5 text-xs text-dim hover:bg-hover hover:text-ink"
          >
            复位
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-dim">
          默认 {DSH_DEFAULT_URL}。`dsh web` 的 host/port 可以改，官方桌面端用的是系统分配端口 ——
          端口换了在这里改。
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={open}
          className="rounded border border-accent bg-accent px-3 py-1.5 text-xs text-accent-ink hover:opacity-90"
        >
          打开 DSH（独立窗口）
        </button>
        <span className="text-xs text-dim">用当前浏览器的登录态，不经过这个页面</span>
      </div>

      <section className="rounded-lg border border-edge bg-surface-2 p-3 text-xs leading-relaxed text-dim">
        <p>
          前提：本机跑着 DSH —— 在「终端」窗口里执行 <code className="text-ink">dsh web</code>，
          默认就是上面那个地址。
        </p>
        <p className="mt-1">
          为什么不能像别的窗口那样嵌进来：线上站点是 HTTPS，浏览器既不允许它请求 http://127.0.0.1，
          也不允许把 http 的页面放进 iframe；而且 DSH 自己不发 CORS 头（请求会被拦成跨域错误）。
          所以这个入口是「本地专用」，线上不挂载。
        </p>
      </section>
    </div>
  )
}
