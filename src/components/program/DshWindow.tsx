import { useCallback, useEffect, useState } from 'react'
import { IS_LOCAL_HOST } from '../../lib/apps'
import {
  DSH_DEFAULT_URL,
  alignDshHost,
  hostOf,
  readDshUrl,
  sameSiteHost,
  writeDshUrl,
} from '../../lib/dsh'
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
  online: '探到了本机 DSH。直接在窗口里打开，用的是当前浏览器的登录态。',
  offline: '这个地址上没有回应。多半是 DSH 没在跑，或者在跑但端口不是这个（地址可以在下面改）。',
  blocked: '线上站点是 HTTPS，按浏览器规则不能请求 http://127.0.0.1，也不能把它嵌进 iframe。',
}

/**
 * DSH 快捷入口（「芹菜耕地」里那块地本身）。
 *
 * **就地打开，不跳出去**：窗口里直接内嵌 DSH 页面（iframe），地址栏 / 刷新 / 独立窗口都是备选。
 * - 本地打开站点时：能探活（no-cors），能把 DSH 嵌进这个窗口
 * - 线上打开站点时：这个窗口压根不挂载（`apps.ts` 里 `localOnly: true`）
 *
 * 两个必须记住的前提（都实测过，别想当然）：
 * 1. DSH 不回 `X-Frame-Options` / `frame-ancestors`，所以**能**被 iframe 嵌（实测：iframe 触发 load，
 *    控制台没有「Refused to display」）。线上不能嵌是因为 HTTPS 页不能加载 http://127.0.0.1，不是被对面拒绝。
 * 2. DSH 的登录 Cookie 是 `SameSite=Strict`，所以**站点与 DSH 的主机名必须一致**
 *    （都 localhost 或都 127.0.0.1）。不一致时下面会出现「改成一致」，否则 iframe 里只有一行 unauthorized。
 */
export function DshWindow() {
  const [url, setUrl] = useState(readDshUrl)
  const [draft, setDraft] = useState(url)
  const [probe, setProbe] = useState<Probe>(IS_LOCAL_HOST ? 'checking' : 'blocked')
  /* 内嵌视图开关：默认是说明卡，点「在窗口里打开 DSH」才挂 iframe
     （免得一进窗口就朝对面发请求） */
  const [embed, setEmbed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)

  const hostMismatch = !sameSiteHost(url)

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

  /* iframe 的 load 事件只有"文档到了"这一个信号：对面是 401 也会触发 load。
     所以超时只用来提示"可能没起来"，不假装能判断登录态。 */
  useEffect(() => {
    if (!embed || loaded) return
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(timer)
  }, [embed, loaded, reloadKey])

  const apply = useCallback((next: string) => {
    writeDshUrl(next)
    setUrl(next)
    setDraft(next)
  }, [])

  function save() {
    const next = draft.trim()
    if (!/^https?:\/\/\S+$/i.test(next)) return
    apply(next)
    if (embed) reload()
  }

  function reset() {
    writeDshUrl(null)
    setUrl(DSH_DEFAULT_URL)
    setDraft(DSH_DEFAULT_URL)
    if (embed) reload()
  }

  function reload() {
    setLoaded(false)
    setSlow(false)
    setReloadKey((n) => n + 1)
  }

  function open() {
    setEmbed(true)
    reload()
  }

  /* 独立窗口只是备选：命名窗口，再点一次复用同一个，不堆标签 */
  const openOutside = useCallback(() => {
    window.open(url, 'dsh-web', 'popup=yes,width=1280,height=860')?.focus()
  }, [url])

  const addressRow = (
    <div className="flex flex-wrap items-center gap-2">
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
        {embed ? '保存并刷新' : '保存'}
      </button>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-edge px-2.5 py-1.5 text-xs text-dim hover:bg-hover hover:text-ink"
      >
        复位
      </button>
    </div>
  )

  const statusRow = (
    <div className="flex flex-wrap items-center gap-2">
      <span
        data-probe={probe}
        className={`rounded border px-2 py-0.5 text-[11px] ${
          probe === 'online' ? 'border-accent text-ink' : 'border-edge text-dim'
        }`}
      >
        {PROBE_TEXT[probe]}
      </span>
      <span className="text-xs text-dim">{PROBE_HINT[probe]}</span>
    </div>
  )

  /* ⚠️ 根容器的高度必须是「父容器内容高 + 上下内边距（2×20px）」：
     父级（Window 的正文区）是 `p-5`，这里用 `-m-5` 把内边距吃掉、再补回来那 40px，
     整个正文盒才刚好被填满。只写 h-full 会矮 40px —— 窗口底下留一条 40px 空白
     （用户看到的"白边"就是这么来的，实测 winBottom - frameBottom = 41px）。
     verify.mjs 里有一条专门钉这个：iframe 必须一直贴到窗口底。 */
  return (
    <div
      className="-m-5 flex h-[calc(100%+2.5rem)] min-h-0 flex-col"
      data-embed={embed ? 'on' : 'off'}
    >
      {embed ? (
        <>
          {/* 内嵌时的工具条：**只占一行、不折行**，剩下的高度全给 DSH。
              地址框 flex-1 min-w-0 会被压缩，按钮 shrink-0 不会被压扁。 */}
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-hidden border-b border-edge bg-surface-2 px-2 py-1.5">
            <span
              data-probe={probe}
              title={PROBE_HINT[probe]}
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${
                probe === 'online' ? 'border-accent text-ink' : 'border-edge text-dim'
              }`}
            >
              {PROBE_TEXT[probe]}
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
              aria-label="DSH 地址"
              spellCheck={false}
              className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-[11px] text-ink placeholder:text-dim focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={save}
              title="保存地址并刷新"
              className="shrink-0 rounded border border-edge px-2 py-1 text-[11px] text-dim hover:bg-hover hover:text-ink"
            >
              保存
            </button>
            <button
              type="button"
              onClick={reload}
              className="shrink-0 rounded border border-edge px-2 py-1 text-[11px] text-dim hover:bg-hover hover:text-ink"
            >
              刷新
            </button>
            <button
              type="button"
              onClick={reset}
              title="地址复位成默认"
              className="shrink-0 rounded border border-edge px-2 py-1 text-[11px] text-dim hover:bg-hover hover:text-ink"
            >
              复位
            </button>
            <button
              type="button"
              onClick={openOutside}
              title="在独立窗口打开（内嵌有问题的备选）"
              className="shrink-0 rounded border border-edge px-2 py-1 text-[11px] text-dim hover:bg-hover hover:text-ink"
            >
              独立窗口
            </button>
            <button
              type="button"
              onClick={() => setEmbed(false)}
              title="回到说明卡"
              className="shrink-0 rounded border border-edge px-2 py-1 text-[11px] text-dim hover:bg-hover hover:text-ink"
            >
              返回
            </button>
          </div>

          {hostMismatch ? (
            <div className="flex shrink-0 flex-nowrap items-center gap-2 border-b border-edge bg-surface-2 px-2 py-1 text-[11px] text-dim">
              <span className="min-w-0 flex-1 truncate">
                站点（{location.hostname}）与 DSH 的主机名不一样 —— 登录 Cookie 是 SameSite=Strict，
                跨主机名不会带上，这里只会显示一行 &ldquo;dsh web authentication required&rdquo;。
              </span>
              <button
                type="button"
                onClick={() => {
                  apply(alignDshHost(url))
                  reload()
                }}
                className="shrink-0 rounded border border-edge px-2 py-0.5 text-[11px] text-dim hover:bg-hover hover:text-ink"
              >
                改成一致
              </button>
            </div>
          ) : null}

          <iframe
            key={reloadKey}
            src={url}
            title="DeepSeek Harness"
            data-dsh-frame=""
            onLoad={() => {
              setLoaded(true)
              setSlow(false)
            }}
            /* 只开需要的：DSH 里有复制按钮与语音输入 */
            allow="clipboard-read; clipboard-write; microphone"
            className="h-full min-h-0 w-full flex-1 border-0 bg-surface"
          />

          {slow && !loaded ? (
            <p className="shrink-0 border-t border-edge bg-surface-2 px-2.5 py-1.5 text-[11px] text-dim">
              还没加载出来 —— 确认本机跑着 <code className="text-ink">dsh web</code>，
              或点「在独立窗口打开」看那边的提示。
            </p>
          ) : null}
        </>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-5">
          <section className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3">
            <AppIcon name="dsh" className="h-8 w-8 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                DSH <span className="text-xs font-normal text-dim">· 芹菜（这块地的入口）</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-dim">
                DeepSeek Harness 是本机服务：浏览器只当屏幕，会话、插件和命令都在你自己那台电脑上跑。
                点下面的按钮<span className="text-ink">就在这个窗口里</span>打开它。
              </p>
            </div>
          </section>

          <section className="space-y-1.5 rounded-lg border border-edge bg-surface-2 p-3">
            {statusRow}
          </section>

          <section className="space-y-1.5 rounded-lg border border-edge bg-surface-2 p-3">
            <h3 className="text-xs font-medium text-dim">地址</h3>
            {addressRow}
            {hostMismatch ? (
              <p className="text-xs leading-relaxed text-dim">
                现在填的是 {hostOf(url)}，而本站开在 {location.hostname} —— 不是同一个站点，
                DSH 的 SameSite=Strict 登录 Cookie 不会带过去，内嵌只会显示一行
                &ldquo;dsh web authentication required&rdquo;。
                <button
                  type="button"
                  onClick={() => apply(alignDshHost(url))}
                  className="ml-1 rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim hover:bg-hover hover:text-ink"
                >
                  改成一致
                </button>
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-dim">
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
              在窗口里打开 DSH
            </button>
            <button
              type="button"
              onClick={openOutside}
              className="rounded border border-edge px-3 py-1.5 text-xs text-dim hover:bg-hover hover:text-ink"
            >
              在独立窗口打开
            </button>
          </div>

          <section className="space-y-1 rounded-lg border border-edge bg-surface-2 p-3 text-xs leading-relaxed text-dim">
            <p>
              前提：本机跑着 DSH —— 在「终端」窗口里执行 <code className="text-ink">dsh web</code>。
            </p>
            <p>
              第一次进来如果看到 <code className="text-ink">dsh web authentication required</code>
              （DSH 对未登录请求的原话）：把 `dsh web` 启动时打印的那条带
              <code className="text-ink">?token=…</code> 的地址
              <span className="text-ink">整段粘到上面的地址框</span>再点保存 ——
              登录会在同一个窗口里完成，之后就不用了。
            </p>
            <p>
              为什么这个窗口只在本地出现：线上站点是 HTTPS，浏览器既不允许它请求 http://127.0.0.1，
              也不允许把 http 的页面放进 iframe。DSH 那边其实没有拒绝被嵌（不回 X-Frame-Options），
              挡住的是浏览器自己的混内容规则。
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
