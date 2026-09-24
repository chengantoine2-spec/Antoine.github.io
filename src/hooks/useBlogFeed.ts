import { useCallback, useEffect, useState } from 'react'
import { loadPosts, type BlogFeed } from '../lib/github'

/** 拉一次博客列表（走缓存），返回 feed / loading / 手动刷新 */
export function useBlogFeed() {
  const [feed, setFeed] = useState<BlogFeed | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(async (force: boolean) => {
    setLoading(true)
    const next = await loadPosts({ force })
    setFeed(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const next = await loadPosts({})
      if (!alive) return
      setFeed(next)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  return { feed, loading, refresh: () => run(true) }
}
