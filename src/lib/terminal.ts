/**
 * 「终端」窗口的客户端：跟本机终端服务（tools/term-server.mjs）说话。
 *
 * 服务只监听 127.0.0.1，所以**只有在跑着那个服务的机器上**、且页面本身也在本机时才有终端；
 * 部署到 GitHub Pages 上时它只会如实报「服务未运行」。
 * token 和端口只写进本机浏览器的 localStorage，绝不进仓库。
 */

const TOKEN_KEY = 'desktop.termToken'
const PORT_KEY = 'desktop.termPort'

export const DEFAULT_TERM_PORT = 5180

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 写不进去也不影响本次会话 */
  }
}

export function readTermToken(): string {
  return read(TOKEN_KEY, '')
}

export function saveTermToken(token: string): void {
  write(TOKEN_KEY, token.trim())
}

export function readTermPort(): number {
  const parsed = Number(read(PORT_KEY, String(DEFAULT_TERM_PORT)))
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_TERM_PORT
}

export function saveTermPort(port: number): void {
  write(PORT_KEY, String(port))
}

export function termBase(port: number): string {
  return `http://127.0.0.1:${port}`
}

/** 一个事件：start / out / cd / exit —— 和服务端 NDJSON 协议一一对应 */
export type TermEvent =
  | { type: 'start'; cwd: string; cmd: string }
  | { type: 'out'; data: string }
  | { type: 'cd'; cwd: string; ok: boolean; target: string }
  | { type: 'exit'; code: number }

/** 探活：服务在不在。用 no-cors，所以不需要对方配 CORS（拿到响应即算在跑） */
export async function pingTerm(port: number): Promise<boolean> {
  try {
    const response = await fetch(`${termBase(port)}/api/health`, {
      mode: 'no-cors',
      signal: AbortSignal.timeout(1500),
    })
    return response.type === 'opaque' || response.ok
  } catch {
    return false
  }
}

/**
 * 跑一条命令，边出边回调。返回最终目录（cd 过的话前端要跟着更新）。
 * 用 fetch 的流式 body 读 NDJSON，不需要 WebSocket，也不需要轮询。
 */
export async function runCommand(options: {
  port: number
  token: string
  cmd: string
  signal?: AbortSignal
  onEvent: (event: TermEvent) => void
}): Promise<void> {
  const { port, token, cmd, signal, onEvent } = options
  const response = await fetch(`${termBase(port)}/api/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-term-token': token },
    body: JSON.stringify({ cmd }),
    signal,
  })

  if (response.status === 401) throw new Error('token 不对：看终端服务启动时打印的那串')
  if (response.status === 403) throw new Error('服务只接受本机页面的请求')
  if (!response.ok || !response.body) throw new Error(`终端服务返回 HTTP ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onEvent(JSON.parse(line) as TermEvent)
      } catch {
        /* 半行或坏行：忽略，下一轮会补齐 */
      }
    }
  }
}
