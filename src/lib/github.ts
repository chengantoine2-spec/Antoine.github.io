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
  /** GraphQL 删除要用的全局 id */
  nodeId: string
  title: string
  body: string
  /** 全部标签原文 */
  labels: string[]
  /** daily / project / other */
  category: 'daily' | 'project' | 'other'
  /** open = 线上可见；closed = 已下架（仅创作窗口能看到） */
  state: 'open' | 'closed'
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
  node_id: string
  title: string
  body: string | null
  labels: Array<{ name?: string } | string>
  state: string
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
    nodeId: issue.node_id,
    title: issue.title,
    body,
    labels,
    category: labels.includes('project') ? 'project' : labels.includes('daily') ? 'daily' : 'other',
    state: issue.state === 'closed' ? 'closed' : 'open',
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

/** 读取用的头：本机有 Token 就带上（未认证 60 次/小时 → 认证后 5000 次/小时） */
function readHeaders(withToken: boolean): HeadersInit {
  const token = withToken ? readToken() : ''
  return token
    ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }
    : { Accept: 'application/vnd.github+json' }
}

/**
 * 带 Token 读一次；若 401/403（Token 过期或权限不够）就退回匿名再读一次。
 * 否则一个失效的 Token 会把"看文章"也一起弄坏。
 */
async function fetchRead(url: string): Promise<Response> {
  const hasToken = readToken() !== ''
  let response = await fetch(url, { headers: readHeaders(true) })
  if (hasToken && (response.status === 401 || response.status === 403)) {
    response = await fetch(url, { headers: readHeaders(false) })
  }
  return response
}

export async function loadPosts(options: { force?: boolean } = {}): Promise<BlogFeed> {
  const cached = readCache()

  /* 有 Token 时额度是 5000 次/小时，缓存缩短到 1 分钟：
     刚发布/删掉的文章马上就能看到，不会因为 10 分钟缓存以为"文章不见了" */
  const ttl = readToken() ? 60 * 1000 : TTL_MS

  if (!options.force && cached && Date.now() - cached.fetchedAt < ttl) {
    return { posts: cached.posts, fetchedAt: cached.fetchedAt, stale: false, notice: null }
  }

  try {
    const response = await fetchRead(`${API}?state=all&per_page=50&sort=created&direction=desc`)

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

/** 彻底删除一篇文章。REST 没有删 issue 的接口，只能走 GraphQL deleteIssue */
export async function deleteIssue(token: string, nodeId: string): Promise<void> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: writeHeaders(token),
    body: JSON.stringify({
      query: 'mutation($id:ID!){deleteIssue(input:{issueId:$id}){repository{name}}}',
      variables: { id: nodeId },
    }),
  })
  if (!response.ok) throw new Error(await readError(response))
  const data = (await response.json()) as { errors?: Array<{ message?: string }> }
  if (data.errors?.length) {
    throw new Error(`删除失败：${data.errors[0].message ?? 'GitHub 拒绝了这次删除'}`)
  }
}

/* ───────────── 图片：存 img 分支，走 jsDelivr 加速（与旧站约定一致） ─────────────
   上传要 Token；**浏览已存图片不需要 Token**（公开仓库直接读）。
   路径形如 2026/09/<随机>.png，对外 URL 是
   https://cdn.jsdelivr.net/gh/<owner>/<repo>@img/<路径> */

const IMG_BRANCH = 'img'
const CONTENTS_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const TREE_API = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${IMG_BRANCH}?recursive=1`
const CDN = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${IMG_BRANCH}`

const IMG_CACHE_KEY = 'desktop.imgTree'
const IMG_TTL_MS = 10 * 60 * 1000
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i

export interface StoredImage {
  path: string
  url: string
  name: string
}

function toStoredImage(path: string): StoredImage {
  return { path, url: `${CDN}/${path}`, name: path.split('/').pop() ?? path }
}

/** 列出 img 分支里已有的图片（不需要 Token；结果缓存 10 分钟） */
export async function listImages(options: { force?: boolean } = {}): Promise<StoredImage[]> {
  if (!options.force) {
    try {
      const raw = localStorage.getItem(IMG_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { images?: StoredImage[]; fetchedAt?: number }
        if (Array.isArray(parsed.images) && Date.now() - (parsed.fetchedAt ?? 0) < IMG_TTL_MS) {
          return parsed.images
        }
      }
    } catch {
      /* 缓存坏了就当没有 */
    }
  }

  const response = await fetchRead(TREE_API)
  if (!response.ok) throw new Error(await readError(response))

  const data = (await response.json()) as { tree?: Array<{ path?: string; type?: string }> }
  const images = (data.tree ?? [])
    .filter((node) => node.type === 'blob' && node.path && IMAGE_RE.test(node.path))
    .map((node) => toStoredImage(node.path as string))
    /* 路径带年月，倒序即最新的在前 */
    .sort((a, b) => (a.path < b.path ? 1 : -1))

  try {
    localStorage.setItem(IMG_CACHE_KEY, JSON.stringify({ images, fetchedAt: Date.now() }))
  } catch {
    /* 写不进去不影响浏览 */
  }
  return images
}

export function clearImageCache(): void {
  try {
    localStorage.removeItem(IMG_CACHE_KEY)
  } catch {
    /* 同上 */
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

function randomId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 上传一张图到 img 分支，返回可直接写进正文的 jsDelivr URL */
export async function uploadImage(token: string, file: File): Promise<StoredImage> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const now = new Date()
  const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${dir}/${randomId()}.${ext}`

  const response = await fetch(`${CONTENTS_API}/${path}`, {
    method: 'PUT',
    headers: writeHeaders(token),
    body: JSON.stringify({
      message: `upload ${path}`,
      content: bytesToBase64(bytes),
      branch: IMG_BRANCH,
    }),
  })
  if (!response.ok) throw new Error(await readError(response))

  clearImageCache()
  return toStoredImage(path)
}
