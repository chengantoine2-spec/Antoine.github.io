/**
 * 博客数据源：GitHub Issues。
 * 约定（与旧站一致）：一篇文章 = 一个 issue；分类用 daily / project 标签，其余标签当 tag；
 * 封面取正文里第一张图片（图片走 img 分支 + jsDelivr 加速）。
 *
 * 未认证的 GitHub API 限流是 60 次/小时/IP，所以结果缓存在 localStorage（TTL 10 分钟），
 * 限流或断网时回退到缓存并给出说明，而不是空白页。
 */

const OWNER = 'chengantoine2-spec'
const REPO = 'Antoine.github.io'
const API = `https://api.github.com/repos/${OWNER}/${REPO}/issues`

export const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'daily', name: '日常' },
  { id: 'project', name: '项目' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export interface BlogPost {
  id: number
  title: string
  body: string
  /** 全部标签原文 */
  labels: string[]
  /** daily / project / other */
  category: 'daily' | 'project' | 'other'
  /** 正文里第一张图，作为封面 */
  cover: string | null
  createdAt: string
  updatedAt: string
  url: string
}

export interface BlogFeed {
  posts: BlogPost[]
  /** 数据时间戳（毫秒） */
  fetchedAt: number
  /** true = 这次没拿到新数据，用的是缓存 */
  stale: boolean
  /** 回退时的说明；null 表示这次是新拉的 */
  notice: string | null
}

const CACHE_KEY = 'desktop.blog'
const TTL_MS = 10 * 60 * 1000

interface RawIssue {
  number: number
  title: string
  body: string | null
  labels: Array<{ name?: string } | string>
  created_at: string
  updated_at: string
  html_url: string
  pull_request?: unknown
}

function labelNames(issue: RawIssue): string[] {
  return (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
    .filter(Boolean)
}

function pickCover(body: string): string | null {
  const match = body.match(/!\[[^\]]*\]\(([^)\s]+)/)
  return match ? match[1] : null
}

function toPost(issue: RawIssue): BlogPost {
  const labels = labelNames(issue)
  const body = issue.body ?? ''
  return {
    id: issue.number,
    title: issue.title,
    body,
    labels,
    category: labels.includes('project') ? 'project' : labels.includes('daily') ? 'daily' : 'other',
    cover: pickCover(body),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
  }
}

function readCache(): { posts: BlogPost[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { posts?: BlogPost[]; fetchedAt?: number }
    if (!Array.isArray(parsed.posts) || typeof parsed.fetchedAt !== 'number') return null
    return { posts: parsed.posts, fetchedAt: parsed.fetchedAt }
  } catch {
    return null
  }
}

function writeCache(posts: BlogPost[]): number {
  const fetchedAt = Date.now()
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ posts, fetchedAt }))
  } catch {
    /* 写不进去也不影响本次阅读 */
  }
  return fetchedAt
}

/** 清掉缓存（设置里的"刷新博客缓存"用） */
export function clearBlogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* 同上 */
  }
}

export async function loadPosts(options: { force?: boolean } = {}): Promise<BlogFeed> {
  const cached = readCache()

  if (!options.force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { posts: cached.posts, fetchedAt: cached.fetchedAt, stale: false, notice: null }
  }

  try {
    const response = await fetch(`${API}?state=all&per_page=50&sort=created&direction=desc`, {
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      const limited = response.status === 403 || response.status === 429
      const notice = limited
        ? 'GitHub API 暂时限流（未登录时每小时 60 次），下面显示的是缓存内容，过一会儿再试即可。'
        : `GitHub 返回 ${response.status}，下面显示的是缓存内容。`
      if (cached) return { posts: cached.posts, fetchedAt: cached.fetchedAt, stale: true, notice }
      return { posts: [], fetchedAt: 0, stale: true, notice }
    }

    const raw = (await response.json()) as RawIssue[]
    const posts = raw.filter((issue) => !issue.pull_request).map(toPost)
    const fetchedAt = writeCache(posts)
    return { posts, fetchedAt, stale: false, notice: null }
  } catch {
    const notice = '拿不到 GitHub 数据（网络或限流），下面显示的是缓存内容。'
    if (cached) return { posts: cached.posts, fetchedAt: cached.fetchedAt, stale: true, notice }
    return { posts: [], fetchedAt: 0, stale: true, notice: '拿不到 GitHub 数据（网络或限流），稍后再试。' }
  }
}

/** 把 markdown 压成一行纯文本，用于列表摘要 */
export function plainText(body: string, limit = 90): string {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/* ───────────── 写入：需要你自己在本机填一个 PAT ─────────────
   安全边界说清楚：
   - Token 只写进这台浏览器的 localStorage（键 desktop.ghToken），**不会进仓库、不会进代码**；
     但它对同源的任何脚本都可读，所以别在公共电脑上填，用完可以「清除」。
   - 写操作是浏览器直连 api.github.com 并带上这个 Token；需要一个能写 Issues 的
     fine-grained token（Issues: Read and write）或 classic token（scope: public_repo / repo）。
   - 任何访客都能打开「写作」窗口，但没有 Token 就什么都写不了。 */

const TOKEN_KEY = 'desktop.ghToken'

export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 写不进去也不影响 */
  }
}

export interface IssueDraft {
  title: string
  body: string
  labels: string[]
}

function writeHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return 'Token 无效或已过期（401）'
  if (response.status === 403) return 'Token 权限不足（403）：需要 Issues 读写权限'
  if (response.status === 404) return '找不到仓库，或这个 Token 没有该仓库权限（404）'
  if (response.status === 422) return 'GitHub 拒绝了这次提交（422）：标题不能为空，或字段不合法'
  try {
    const data = (await response.json()) as { message?: string }
    return data.message ?? `GitHub 返回 ${response.status}`
  } catch {
    return `GitHub 返回 ${response.status}`
  }
}

/** 验证 Token 并返回登录名；失败抛中文错误 */
export async function verifyToken(token: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', { headers: writeHeaders(token) })
  if (!response.ok) throw new Error(await readError(response))
  const user = (await response.json()) as { login?: string }
  return user.login ?? '(未知账号)'
}

export async function createIssue(token: string, draft: IssueDraft): Promise<number> {
  const response = await fetch(API, {
    method: 'POST',
    headers: writeHeaders(token),
    body: JSON.stringify(draft),
  })
  if (!response.ok) throw new Error(await readError(response))
  const issue = (await response.json()) as { number: number }
  return issue.number
}

export async function updateIssue(
  token: string,
  issueNumber: number,
  draft: IssueDraft,
): Promise<void> {
  const response = await fetch(`${API}/${issueNumber}`, {
    method: 'PATCH',
    headers: writeHeaders(token),
    body: JSON.stringify(draft),
  })
  if (!response.ok) throw new Error(await readError(response))
}

export async function setIssueState(
  token: string,
  issueNumber: number,
  state: 'open' | 'closed',
): Promise<void> {
  const response = await fetch(`${API}/${issueNumber}`, {
    method: 'PATCH',
    headers: writeHeaders(token),
    body: JSON.stringify({ state }),
  })
  if (!response.ok) throw new Error(await readError(response))
}
