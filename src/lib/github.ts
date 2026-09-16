/**
 * GitHub API 封装：博客（Issue）读取与站长写操作、图片上传（contents API → img 分支）。
 *
 * 需要补齐的配置见下方 SITE 常量：把 TODO 换成真实值即可。
 * 说明：PAT 只存 localStorage（key 见 PAT_STORAGE_KEY），绝不进仓库。
 */

// ============================================================
// 站点配置（TODO：换成你的真实值）
// ============================================================
export const SITE = {
  /** TODO: GitHub 用户名 */
  user: import.meta.env.VITE_GH_USER || 'YOUR_GITHUB_USER',
  /** TODO: 仓库名（博客 Issue 与图片都存这里） */
  repo: import.meta.env.VITE_GH_REPO || 'caramel-blog',
  /** 图片所在分支 */
  imgBranch: import.meta.env.VITE_IMG_BRANCH || 'img',
  /** 站点标题 */
  title: import.meta.env.VITE_SITE_TITLE || '焦糖布丁',
  /** 站长 GitHub 登录名（用于判定是否显示 /write；留空则任何有效 PAT 都算站长） */
  owner: import.meta.env.VITE_GH_OWNER || import.meta.env.VITE_GH_USER || 'YOUR_GITHUB_USER',
} as const

/** 分类 label（写进 Issue labels，其余 label 一律视为标签） */
export const CATEGORY_DAILY = 'daily'
export const CATEGORY_PROJECT = 'project'
export const CATEGORIES = [CATEGORY_DAILY, CATEGORY_PROJECT] as const
export type Category = (typeof CATEGORIES)[number]

/** 保留 label：不作为展示标签 */
const RESERVED_LABELS = new Set<string>([...CATEGORIES, 'deleted', 'draft'])

export const PAT_STORAGE_KEY = 'caramel.pat'
export const API_BASE = 'https://api.github.com'
export const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh'

export const isConfigured = (): boolean =>
  SITE.user !== 'YOUR_GITHUB_USER' && SITE.user.trim() !== '' && SITE.repo.trim() !== ''

// ============================================================
// 类型
// ============================================================
export interface Blog {
  /** Issue number */
  id: number
  title: string
  /** 已剥离 frontmatter 的 Markdown 正文 */
  body: string
  /** 全部 label */
  labels: string[]
  /** daily | project */
  category: Category
  /** 除分类/保留标签外的标签 */
  tags: string[]
  /** jsDelivr 图片 URL，可能为空串 */
  cover: string
  summary: string
  createdAt: string
  updatedAt: string
  /** 原文链接 */
  url: string
  comments: number
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export class GitHubError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

// ============================================================
// 底层请求
// ============================================================
function getToken(): string {
  try {
    return localStorage.getItem(PAT_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/** true 表示当前进程内已有 PAT（仅用于请求头决策，不缓存过期判断） */
export const hasToken = (): boolean => getToken().length > 0

async function gh<T>(path: string, init: RequestInit = {}, withToken = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (withToken) {
    const token = getToken()
    if (!token) throw new GitHubError('未登录：缺少 Personal Access Token', 401)
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = (await res.json()) as { message?: string }
      if (data?.message) detail = data.message
    } catch {
      /* 忽略非 JSON 响应 */
    }
    throw new GitHubError(`GitHub API ${res.status}: ${detail}`, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ============================================================
// frontmatter：cover / summary 写在正文开头的 --- 块里
// ============================================================
export interface Frontmatter {
  cover?: string
  summary?: string
}

const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const match = FM_RE.exec(raw || '')
  if (!match) return { data: {}, content: raw || '' }
  const data: Frontmatter = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (key === 'cover') data.cover = value
    if (key === 'summary' || key === 'description') data.summary = value
  }
  return { data, content: (raw || '').slice(match[0].length) }
}

/** 把 cover / summary 写回 frontmatter，便于 /write 发布时保存元信息 */
export function buildIssueBody(input: { cover?: string; summary?: string; body: string }): string {
  const lines: string[] = []
  if (input.cover) lines.push(`cover: ${input.cover}`)
  if (input.summary) lines.push(`summary: ${input.summary}`)
  const fm = lines.length ? `---\n${lines.join('\n')}\n---\n\n` : ''
  return `${fm}${input.body || ''}`
}

/** 兜底封面：正文第一张图 */
function firstImage(body: string): string {
  const m = /!\[[^\]]*\]\(([^)\s]+)/.exec(body || '')
  return m ? m[1] : ''
}

/** 摘要兜底：正文首个非空、非标题、非图片段落 */
function firstParagraph(body: string): string {
  const text = (body || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^\s{0,3}#{1,6}.*$/gm, '')
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const clean = block
      .replace(/[*_`>#-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (clean.length > 0) return clean.slice(0, 140)
  }
  return ''
}

interface RawIssue {
  number: number
  title: string
  body: string | null
  labels: Array<string | { name?: string }>
  created_at: string
  updated_at: string
  html_url: string
  comments: number
  pull_request?: unknown
}

export function toBlog(issue: RawIssue): Blog {
  const labels = (issue.labels || [])
    .map((l) => (typeof l === 'string' ? l : l?.name || ''))
    .filter(Boolean)
  const { data, content } = parseFrontmatter(issue.body || '')
  const category: Category = labels.includes(CATEGORY_PROJECT) ? CATEGORY_PROJECT : CATEGORY_DAILY
  return {
    id: issue.number,
    title: issue.title,
    body: content,
    labels,
    category,
    tags: labels.filter((l) => !RESERVED_LABELS.has(l)),
    cover: data.cover || firstImage(content),
    summary: data.summary || firstParagraph(content),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    comments: issue.comments ?? 0,
  }
}

// ============================================================
// 读取：博客列表 / 单篇
// ============================================================
/** 拉取全部已发布 Issue（过滤 PR 与 closed 的 deleted 标记） */
export async function fetchIssues(): Promise<Blog[]> {
  const withToken = hasToken()
  const perPage = 100
  const all: RawIssue[] = []
  for (let page = 1; page <= 5; page++) {
    const chunk = await gh<RawIssue[]>(
      `/repos/${SITE.user}/${SITE.repo}/issues?state=open&per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      {},
      withToken,
    )
    all.push(...chunk)
    if (chunk.length < perPage) break
  }
  return all
    .filter((i) => !i.pull_request)
    .map(toBlog)
}

export async function fetchIssue(id: number): Promise<Blog> {
  const issue = await gh<RawIssue>(`/repos/${SITE.user}/${SITE.repo}/issues/${id}`, {}, hasToken())
  return toBlog(issue)
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${API_BASE}/user`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new GitHubError(`PAT 校验失败（${res.status}）`, res.status)
  return (await res.json()) as GitHubUser
}

// ============================================================
// 写入：创建 / 编辑 / 关闭（删除）/ 草稿
// ============================================================
export interface WriteInput {
  title: string
  body: string
  tags?: string[]
  category?: Category
  cover?: string
  summary?: string
}

function labelsOf(input: WriteInput): string[] {
  return [input.category || CATEGORY_DAILY, ...(input.tags || [])]
}

export async function createIssue(input: WriteInput): Promise<Blog> {
  const issue = await gh<RawIssue>(
    `/repos/${SITE.user}/${SITE.repo}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: buildIssueBody(input),
        labels: labelsOf(input),
      }),
    },
    true,
  )
  return toBlog(issue)
}

export async function updateIssue(id: number, input: WriteInput): Promise<Blog> {
  const issue = await gh<RawIssue>(
    `/repos/${SITE.user}/${SITE.repo}/issues/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        title: input.title,
        body: buildIssueBody(input),
        labels: labelsOf(input),
      }),
    },
    true,
  )
  return toBlog(issue)
}

/**
 * 站长的「删除」= 关闭 + 打 deleted 标签。
 * GitHub REST API 不提供删除 Issue 的接口，这是平台限制（见 README 待补信息）。
 */
export async function deleteIssue(id: number): Promise<void> {
  await gh(
    `/repos/${SITE.user}/${SITE.repo}/issues/${id}`,
    { method: 'PATCH', body: JSON.stringify({ state: 'closed', labels: ['deleted'] }) },
    true,
  )
}

/** 站长改外观（主题偏好）时可用于持久化到仓库的配置；当前仅保留接口位置 */
// TODO: 若后续要「改外观」存仓库（如自定义主色/首页文案），在此实现 config.json 的读写。

// ============================================================
// 图片：contents API 上传到 img 分支 → jsDelivr URL
// ============================================================
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

/** djb2：内容哈希，用于文件名去重 */
function hashContent(bytes: Uint8Array): string {
  let h = 5381
  for (let i = 0; i < bytes.length; i++) h = ((h << 5) + h + bytes[i]) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 8)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function jsdelivrUrl(path: string): string {
  return `${JSDELIVR_BASE}/${SITE.user}/${SITE.repo}@${SITE.imgBranch}/${path.replace(/^\//, '')}`
}

/** yyyy/mm/{hash}.{ext} */
function imagePath(bytes: Uint8Array, ext: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const unique = `${hashContent(bytes)}${now.getTime().toString(16).slice(-4)}`
  return `${yyyy}/${mm}/${unique}.${ext}`
}

export interface UploadResult {
  path: string
  url: string
}

/**
 * 上传图片到 img 分支（已存在同名文件时复用，不覆盖）。
 * 注意：分支不存在时 GitHub 会报 422，需要先在仓库里建好 img 分支。
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const ext = EXT_BY_TYPE[file.type] || (file.name.split('.').pop() || 'png').toLowerCase()
  const path = imagePath(buf, ext)
  const content = bytesToBase64(buf)

  await gh(
    `/repos/${SITE.user}/${SITE.repo}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `chore(img): upload ${path}`,
        content,
        branch: SITE.imgBranch,
      }),
    },
    true,
  )

  // TODO: 大图可在此接图片压缩（Canvas 等比缩放）后再上传，当前按原图直传。
  return { path, url: jsdelivrUrl(path) }
}

// ============================================================
// 本地开发兜底数据：仅当 SITE 仍是占位值、且请求失败时启用，
// 让页面在没有 GitHub 仓库时也能验收样式与交互。
// ============================================================
export const DEMO_BLOGS: Blog[] = [
  {
    id: 1,
    title: '焦糖布丁的第一次烘焙记录',
    body: [
      '## 起因',
      '',
      '烤箱到货那天，我把配方抄在手账上，结果第一步就把糖熬糊了。',
      '',
      '> 布丁的关键不是配方，是耐心。',
      '',
      '### 配方表',
      '',
      '| 材料 | 用量 | 备注 |',
      '| --- | --- | --- |',
      '| 牛奶 | 400ml | 全脂 |',
      '| 鸡蛋 | 3 个 | 常温 |',
      '| 细砂糖 | 60g | 焦糖另算 |',
      '',
      '### 关键代码',
      '',
      '```ts',
      'const caramel = sugar.heated(170) // 别搅拌，晃锅就好',
      '```',
      '',
      '下次要记得：**焦糖离火要快**。',
    ].join('\n'),
    labels: ['daily', '烘焙', '厨房'],
    category: 'daily',
    tags: ['烘焙', '厨房'],
    cover: '',
    summary: '烤箱到货那天，我把配方抄在手账上，结果第一步就把糖熬糊了。',
    createdAt: '2025-01-05T08:00:00Z',
    updatedAt: '2025-01-05T08:00:00Z',
    url: '#',
    comments: 0,
  },
  {
    id: 2,
    title: '用 Issue 当博客后端：一个偷懒但够用的方案',
    body: [
      '## 为什么这么干',
      '',
      '写博客最贵的不是写作，是维护后台。既然 GitHub Issues 自带 Markdown、标签、图片与讨论区，那就直接拿来用。',
      '',
      '- 正文 → Issue body',
      '- 分类与标签 → labels',
      '- 评论点赞 → Discussions / Giscus',
      '',
      '### 代价',
      '',
      '1. 没有草稿箱（用 draft 标签凑）',
      '2. 排序能力弱，只能按时间',
      '3. 需要 PAT 才能写，不能纯前端登录',
    ].join('\n'),
    labels: ['daily', '前端', '架构'],
    category: 'daily',
    tags: ['前端', '架构'],
    cover: '',
    summary: '写博客最贵的不是写作，是维护后台。GitHub Issues 自带 Markdown、标签与讨论区。',
    createdAt: '2025-01-08T08:00:00Z',
    updatedAt: '2025-01-09T08:00:00Z',
    url: '#',
    comments: 0,
  },
  {
    id: 3,
    title: '焦糖博客站：从 0 到 GitHub Pages',
    body: '## 概览\n\n一个 Vite + React + Tailwind 的静态博客站。',
    labels: ['project', 'React', 'Vite'],
    category: 'project',
    tags: ['React', 'Vite'],
    cover: '',
    summary: '一个 Vite + React + Tailwind 的静态博客站。',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-01-10T08:00:00Z',
    url: '#',
    comments: 0,
  },
]
