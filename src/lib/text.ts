/**
 * 纯文本工具：无 React / 无渲染器依赖，供列表卡片等轻量组件使用，
 * 避免为了「格式化日期」把 react-markdown + highlight 拖进首屏包。
 * （文件边界外的唯一新增文件，原因见 README「与 AGENTS.md 的偏差」。）
 */

export interface TocItem {
  id: string
  text: string
  level: number
}

/** 生成锚点 slug：保留中日韩字符，去掉标点，空白转连字符 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[!-/:-@[-`{-~\u2000-\u206f\u3001-\u303f\uff01-\uff5e]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** 渲染侧标题 id：与 extractHeadings 的算法保持一致 */
export function headingId(text: string, line?: number): string {
  const base = slugify(text) || 'section'
  return line ? `${base}-${line}` : base
}

/** 保留行号的「清空」：把内容换成等量空行，保证 TOC 行号与源码行号一致 */
function blankOut(text: string): string {
  return text.replace(/[^\n]/g, '')
}

/** 剥掉围栏代码块与 frontmatter，避免把代码里的 # 当标题（行数保持不变） */
export function strippable(markdown: string): string {
  let text = markdown || ''
  const fm = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text)
  if (fm) text = blankOut(fm[0]) + text.slice(fm[0].length)
  text = text.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, blankOut)
  text = text.replace(/^~~~[^\n]*\n[\s\S]*?^~~~[^\n]*$/gm, blankOut)
  // TODO: 未闭合的围栏（写到一半的草稿）暂不做特殊处理
  return text
}

/**
 * 抽取目录：行号取源码行号，与 Markdown 渲染时 hast node.position.start.line 一致，
 * 因此锚点天然对齐，不需要 rehype-slug 这类额外依赖。
 */
export function extractHeadings(markdown: string): TocItem[] {
  const lines = strippable(markdown).split(/\r?\n/)
  const items: TocItem[] = []
  lines.forEach((raw, index) => {
    const m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(raw)
    if (!m) return
    const text = m[2]
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .trim()
    if (!text) return
    items.push({ id: headingId(text, index + 1), text, level: m[1].length })
  })
  return items
}

/** 展示格式化：2025-01-05 15:20（本地时区） */
export function formatDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 精确到秒，用于 title 提示 */
export function formatFull(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}

/**
 * 展示格式化：刚刚 / 12 分钟前 / 3 小时前 / 5 天前 / 2 个月前
 * now 可传入以便随页面停留时间刷新（见 useNow）
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = now - then
  if (diff < 0) return '刚刚'
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  if (diff < MIN) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))} 个月前`
  return `${Math.floor(diff / (365 * DAY))} 年前`
}

/** 阅读时长（按中文 ~350 字/分钟估算） */
export function readingMinutes(markdown: string): number {
  const text = strippable(markdown).replace(/```[\s\S]*?```/g, '')
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(cjk / 350 + words / 200))
}
