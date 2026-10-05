/* DSH 快捷入口的地址配置。

   DSH 是本机服务（默认 http://127.0.0.1:3080），但**地址不该写死**：
   `dsh web` 的 host/port 可以改，官方桌面端更是用系统分配的端口。
   所以存 localStorage，窗口里可以随时改，坏数据回默认。 */

export const DSH_DEFAULT_URL = 'http://127.0.0.1:3080'

const KEY = 'desktop.dshUrl'

/** 只认 http(s) 绝对地址；没存过或存坏了都回默认 */
export function readDshUrl(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null && /^https?:\/\/\S+$/i.test(raw)) return raw
  } catch {
    /* 读不到就回默认 */
  }
  return DSH_DEFAULT_URL
}

/** 传 null = 回到默认地址（窗口里的「复位」） */
export function writeDshUrl(value: string | null): void {
  try {
    if (value === null || value === DSH_DEFAULT_URL) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    /* 写不进去也不影响这次会话 */
  }
}
