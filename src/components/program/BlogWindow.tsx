import { startTransition, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import { CATEGORIES, formatDate, plainText, type CategoryId } from '../../lib/github'

/** 「博客」窗口：issue 列表 + 分类/标签筛选，点条目进 /blog/:id */
export function BlogWindow() {
  const navigate = useNavigate()
  const { feed, loading, refresh } = useBlogFeed()
  const [category, setCategory] = useState<CategoryId>('all')
  const [tag, setTag] = useState<string | null>(null)

  /* 提前把 markdown 那块 chunk 拉下来：详情页是懒加载的，
     点卡片时才现拉会在同步渲染里挂起（React 会直接抛错）。 */
  useEffect(() => {
    void import('./Markdown')
  }, [])

  const posts = feed?.posts ?? []

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const post of posts) {
      for (const label of post.labels) {
        if (label !== 'daily' && label !== 'project') set.add(label)
      }
    }
    return [...set]
  }, [posts])

  const shown = posts.filter(
    (post) =>
      (category === 'all' || post.category === category) &&
      (tag === null || post.labels.includes(tag)),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
            className={`rounded border px-2.5 py-1 text-xs ${
              category === item.id
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-edge text-ink hover:bg-hover'
            }`}
          >
            {item.name}
          </button>
        ))}

        {tags.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={tag === item}
            onClick={() => setTag(tag === item ? null : item)}
            className={`rounded border px-2.5 py-1 text-xs ${
              tag === item
                ? 'border-accent text-accent'
                : 'border-edge text-dim hover:bg-hover'
            }`}
          >
            #{item}
          </button>
        ))}

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded border border-edge px-2.5 py-1 text-xs text-dim hover:bg-hover disabled:opacity-50"
        >
          {loading ? '读取中…' : '刷新'}
        </button>
      </div>

      {feed?.notice ? (
        <p className="rounded border border-edge bg-surface-2 px-3 py-2 text-xs text-dim">
          {feed.notice}
        </p>
      ) : null}

      {loading && posts.length === 0 ? (
        <p className="text-sm text-dim">正在从 GitHub 读取…</p>
      ) : null}

      {!loading && shown.length === 0 ? (
        <p className="text-sm text-dim">
          {posts.length === 0 ? '还没有文章。' : '这个筛选下没有文章。'}
        </p>
      ) : null}

      <ul className="space-y-2">
        {shown.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => {
                /* startTransition：详情页里有懒加载的 markdown，同步跳转会在渲染中挂起而报错 */
                startTransition(() => navigate(`/blog/${post.id}`))
              }}
              className="flex w-full gap-3 rounded-lg border border-edge bg-surface-2 p-3 text-left transition-colors hover:bg-hover"
            >
              {post.cover ? (
                <span
                  className="h-16 w-24 shrink-0 rounded border border-edge bg-cover bg-center"
                  style={{ backgroundImage: `url("${post.cover}")` }}
                />
              ) : null}

              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{post.title}</span>
                  <span className="shrink-0 text-xs text-dim">{formatDate(post.createdAt)}</span>
                </span>
                <span className="block text-xs leading-relaxed text-dim">
                  {plainText(post.body)}
                </span>
                <span className="flex flex-wrap gap-1 pt-0.5">
                  {post.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim"
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
