/**
 * 博客数据源 hook：读 GitHub Issues，模块级缓存 + 订阅，避免多页面重复请求。
 * 未配置仓库（SITE 仍是占位值）时回落到 DEMO_BLOGS，方便本地验收样式与交互。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  DEMO_BLOGS,
  explainGitHubError,
  fetchIssue,
  fetchIssues,
  isConfigured,
  type Blog,
} from '../lib/github'

export interface BlogState {
  blogs: Blog[]
  loading: boolean
  error: string
  /** 当前展示的是本地兜底数据（未配置仓库或请求失败） */
  fallback: boolean
}

let cache: Blog[] | null = null
let inflight: Promise<Blog[]> | null = null
let cachedAt = 0

/** 缓存有效期：超过就重新拉取，保证发布后首页能立刻看到新文章 */
const CACHE_TTL_MS = 20_000

/** 发布 / 改稿 / 删除后调用，让列表下次进入时重新拉取 */
export function invalidateBlogs(): void {
  cache = null
  cachedAt = 0
}

function load(force = false): Promise<Blog[]> {
  const fresh = cache && Date.now() - cachedAt < CACHE_TTL_MS
  if (!force && fresh) return Promise.resolve(cache as Blog[])
  if (inflight) return inflight
  inflight = fetchIssues()
    .then((blogs) => {
      cache = blogs
      cachedAt = Date.now()
      return blogs
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 站内所有与博客相关的页面共用这份状态 */
export function useBlogs(): BlogState & { reload: () => void } {
  const [state, setState] = useState<BlogState>(() => ({
    blogs: cache ?? [],
    loading: !cache,
    error: '',
    fallback: false,
  }))

  const run = useCallback((force: boolean) => {
    if (!isConfigured()) {
      setState({ blogs: DEMO_BLOGS, loading: false, error: '', fallback: true })
      return
    }
    // 已有数据时后台静默刷新，避免列表闪一下骨架屏
    setState((s) => ({ ...s, loading: s.blogs.length === 0, error: '' }))
    load(force)
      .then((blogs) => setState({ blogs, loading: false, error: '', fallback: false }))
      .catch((err: unknown) => {
        const msg = explainGitHubError(err)
        // 首次加载失败时给出兜底内容，避免整站空白
        setState((s) => ({
          blogs: s.blogs.length ? s.blogs : DEMO_BLOGS,
          loading: false,
          error: msg,
          fallback: s.blogs.length === 0,
        }))
      })
  }, [])

  useEffect(() => {
    run(false)
  }, [run])

  return { ...state, reload: () => run(true) }
}

/** 单篇：优先命中列表缓存，否则单独拉取 */
export function useBlog(id: number | undefined): {
  blog: Blog | null
  loading: boolean
  error: string
} {
  const { blogs, loading, error, fallback } = useBlogs()
  const [single, setSingle] = useState<Blog | null>(null)
  const [singleError, setSingleError] = useState('')

  useEffect(() => {
    if (id == null || Number.isNaN(id)) return
    const hit = blogs.find((b) => b.id === id)
    if (hit) {
      setSingle(hit)
      return
    }
    if (loading || fallback || !isConfigured()) return
    let alive = true
    fetchIssue(id)
      .then((blog) => {
        if (alive) setSingle(blog)
      })
      .catch((err: unknown) => {
        if (alive) setSingleError(err instanceof Error ? err.message : '加载失败')
      })
    return () => {
      alive = false
    }
  }, [id, blogs, loading, fallback])

  return { blog: single, loading, error: error || singleError }
}

/** 分类 + 标签筛选：标签为「与」语义，分类为单选 */
export function filterBlogs(
  blogs: Blog[],
  opts: { category?: string | null; tags?: string[] },
): Blog[] {
  const { category, tags = [] } = opts
  return blogs.filter((b) => {
    if (category && b.category !== category) return false
    return tags.every((t) => b.labels.includes(t))
  })
}

/** 汇总所有标签及出现次数（按次数降序） */
export function collectTags(blogs: Blog[]): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const b of blogs) for (const t of b.tags) map.set(t, (map.get(t) || 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
