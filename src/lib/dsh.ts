/* DSH 快捷入口的地址配置。

   DSH 是本机服务（默认 http://127.0.0.1:3080），但**地址不该写死**：
   `dsh web` 的 host/port 可以改，官方桌面端更是用系统分配的端口。
   所以存 localStorage，窗口里可以随时改，坏数据回默认。

   ⚠️ 默认地址要跟**当前页面的主机名**保持一致（localhost 对 localhost、127.0.0.1 对 127.0.0.1）。
   原因不是洁癖：DSH 的登录 Cookie 是 `HttpOnly; SameSite=Strict`
   （见 `@deepseek-ai/dsh-client-connection` 的 cookie 写入），而浏览器眼里
   `localhost` 与 `127.0.0.1` 是**两个不同的站点** —— 一边登录、另一边内嵌，
   Cookie 不会被带上，iframe 里只会显示一行 `unauthorized`。 */

const PORT = 3080

const KEY = 'desktop.dshUrl'

/** 当前页面的主机名（拿不到就用回环 IP） */
function pageHost(): string {
  try {
    if (typeof location !== 'undefined' && location.hostname) return location.hostname
  } catch {
    /* 服务端渲染 / 异常环境：回默认 */
  }
  return '127.0.0.1'
}

/** 跟着页面主机名走的默认地址 */
export function defaultDshUrl(): string {
  return `http://${pageHost()}:${PORT}`
}

export const DSH_DEFAULT_URL = defaultDshUrl()

/** 只认 http(s) 绝对地址；没存过或存坏了都回默认 */
export function readDshUrl(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null && /^https?:\/\/\S+$/i.test(raw)) return raw
  } catch {
    /* 读不到就回默认 */
  }
  return defaultDshUrl()
}

/** 传 null = 回到默认地址（窗口里的「复位」） */
export function writeDshUrl(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    /* 写不进去也不影响这次会话 */
  }
}

/** 地址里的主机名（只用于显示；坏地址返回空串，别让界面崩） */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** 地址里的主机名和当前页面是不是同一个「站点」。
    内嵌要求一致，否则 DSH 的 SameSite=Strict 登录 Cookie 过不去。 */
export function sameSiteHost(url: string): boolean {
  try {
    return new URL(url).hostname === pageHost()
  } catch {
    return true
  }
}

/** 把地址的主机名换成当前页面的主机名，端口与路径原样保留（窗口里的「改成一致」） */
export function alignDshHost(url: string): string {
  try {
    const next = new URL(url)
    next.hostname = pageHost()
    return next.toString().replace(/\/$/, '')
  } catch {
    return defaultDshUrl()
  }
}
