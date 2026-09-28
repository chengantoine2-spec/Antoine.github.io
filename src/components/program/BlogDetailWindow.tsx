import { Suspense, lazy } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import { useWindowTitle } from '../../hooks/useWindowTitle'
import { formatDate } from '../../lib/github'

/* markdown 那一坨（react-markdown + remark-gfm + highlight.js）只在真正打开文章时才加载，
   否则桌面首屏要白白多背 100+ KB gzip（实测 77 → 182 KB）。 */
const Markdown = lazy(() => import('./Markdown').then((mod) => ({ default: mod.Markdown })))

/** 文章详情：路由 /blog/:id，标题栏显示文章标题 */
export function BlogDetailWindow() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { feed, loading } = useBlogFeed()
  const post = feed?.posts.find((item) => String(item.id) === id)

  useWindowTitle(post?.title ?? '文章')

  if (!post) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">
          {loading ? '正在读取…' : '没有找到这篇文章。'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/blog')}
          className="text-xs text-dim hover:text-ink"
        >
          ← 回到文章列表
        </button>
      </div>
    )
  }

  return (
    <article className="reading">
      <div className="reading__inner space-y-4">
      <button
        type="button"
        onClick={() => navigate('/blog')}
        className="text-xs text-dim hover:text-ink"
      >
        ← 文章列表
      </button>

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">{post.title}</h2>
        <p className="flex flex-wrap items-center gap-2 text-xs text-dim">
          <span>{formatDate(post.createdAt)}</span>
          {post.labels.map((label) => (
            <span key={label} className="rounded border border-edge px-1.5 py-0.5">
              {label}
            </span>
          ))}
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-dim">正在排版…</p>}>
        <Markdown>{post.body}</Markdown>
      </Suspense>

      <footer className="border-t border-edge pt-3">
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline-offset-4 hover:underline"
        >
          在 GitHub 上看原文 ↗
        </a>
      </footer>
      </div>
    </article>
  )
}
