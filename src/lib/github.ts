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
