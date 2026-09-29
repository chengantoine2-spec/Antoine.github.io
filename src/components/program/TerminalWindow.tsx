import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_TERM_PORT,
  pingTerm,
  readTermPort,
  readTermToken,
  runCommand,
  saveTermPort,
  saveTermToken,
} from '../../lib/terminal'

const HELP = `可用命令（跑在本机，浏览器只是块屏）
  dir / ls            看当前目录
  cd ..               换目录（~ 是用户主目录）
  git status          仓库状态
  npm run build       构建
  cls / clear         清屏
  help                这张表

服务没起来？在项目目录里跑：npm run term`

/** 终端窗口：接本机终端服务（tools/term-server.mjs），在网页里跑真命令 */
export function TerminalWindow() {
  const [port, setPort] = useState(() => readTermPort())
  const [token, setToken] = useState(() => readTermToken())
  const [online, setOnline] = useState<boolean | null>(null)
  const [output, setOutput] = useState('')
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyAt, setHistoryAt] = useState(-1)

  const abort = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  const probe = useCallback(async (target: number) => {
    setOnline(null)
    setOnline(await pingTerm(target))
  }, [])

  useEffect(() => {
    void probe(port)
  }, [probe, port])

  /* 有新输出就贴到底部 */
  useEffect(() => {
    const box = scroller.current
    if (box) box.scrollTop = box.scrollHeight
  }, [output])

  const prompt = `${cwd ?? '~'}> `

  async function run(raw: string) {
    const cmd = raw.trim()
    if (!cmd) return
    setHistory((list) => [cmd, ...list].slice(0, 50))
    setHistoryAt(-1)
    setInput('')

    if (cmd === 'clear' || cmd === 'cls') {
      setOutput('')
      return
    }
    if (cmd === 'help') {
      setOutput((text) => `${text}${HELP}\n`)
      return
    }
    if (busy) return

    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setOutput((text) => `${text}${prompt}${cmd}\n`)

    try {
      await runCommand({
        port,
        token,
        cmd,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'out') {
            setOutput((text) => text + event.data)
          } else if (event.type === 'cd') {
            if (event.ok) setCwd(event.cwd)
            else setOutput((text) => `${text}找不到目录：${event.target}\n`)
          } else if (event.type === 'exit' && event.code !== 0 && event.code !== 130) {
            setOutput((text) => `${text}[退出码 ${event.code}]\n`)
          }
        },
      })
      setOnline(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('aborted')) {
        setOutput((text) => `${text}${message}\n`)
        setOnline(false)
      }
    } finally {
      setOutput((text) => (text.endsWith('\n') || text === '' ? text : `${text}\n`))
      setBusy(false)
      abort.current = null
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void run(input)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyAt + 1, history.length - 1)
      if (next >= 0) {
        setHistoryAt(next)
        setInput(history[next])
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = historyAt - 1
      setHistoryAt(next)
      setInput(next >= 0 ? history[next] : '')
      return
    }
    if (e.key === 'c' && e.ctrlKey) {
      abort.current?.abort()
      setInput('')
    }
  }

  function connect() {
    saveTermPort(port)
    saveTermToken(token)
    void probe(port)
  }

  return (
    <div className="space-y-3">
      {/* 连接栏：地址是写死的本机服务，端口和 token 存本机浏览器 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-2 p-2.5 text-xs">
        <span className={online ? 'text-accent' : 'text-dim'}>
          {online === null ? '检测中…' : online ? '● 服务在线' : '○ 服务未运行'}
        </span>
        <label className="flex items-center gap-1 text-dim">
          端口
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value) || DEFAULT_TERM_PORT)}
            aria-label="终端服务端口"
            className="w-20 rounded border border-edge bg-surface px-2 py-1 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 items-center gap-1 text-dim">
          token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="启动终端服务时打印的那串"
            aria-label="终端服务 token"
            className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-ink placeholder:text-dim focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={connect}
          className="rounded border border-edge px-2.5 py-1 text-ink hover:bg-hover"
        >
          连接
        </button>
        <button
          type="button"
          onClick={() => setOutput('')}
          className="rounded border border-edge px-2.5 py-1 text-dim hover:bg-hover"
        >
          清屏
        </button>
      </div>

      {online === false ? (
        <p className="rounded border border-edge bg-surface-2 px-3 py-2 text-xs leading-relaxed text-dim">
          没连上本机终端服务。在项目目录里跑 <code className="font-mono text-ink">npm run term</code>
          ，把它打印的 token 填到上面（只存在这台浏览器里）。<br />
          服务只监听 127.0.0.1，所以线上站点连不上本机 —— 这是设计如此，不是坏了。
        </p>
      ) : null}

      {/* 输出区 */}
      <div
        ref={scroller}
        className="h-[52vh] min-h-[16rem] overflow-auto rounded-lg border border-edge bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink"
      >
        {output ? (
          <pre className="whitespace-pre-wrap break-words">{output}</pre>
        ) : (
          <p className="text-dim">在上面的输入行敲命令，回车执行；↑ ↓ 翻历史，Ctrl+C 中止。</p>
        )}
      </div>

      {/* 输入行 */}
      <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2 font-mono text-xs">
        <span className="shrink-0 text-dim">{prompt}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          aria-label="终端输入"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-dim focus:outline-none disabled:opacity-50"
          placeholder={busy ? '命令执行中…（Ctrl+C 中止）' : 'help 看可用命令'}
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            className="shrink-0 rounded border border-edge px-2 py-0.5 text-dim hover:bg-hover"
          >
            中止
          </button>
        ) : null}
      </div>
    </div>
  )
}
