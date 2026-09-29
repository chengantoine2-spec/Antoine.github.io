import { Suspense, lazy, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useArticleWidth } from '../../hooks/useArticleWidth'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import { useWindowTitle } from '../../hooks/useWindowTitle'
import { CATEGORIES, charCount, formatDate } from '../../lib/github'
import { extractToc } from '../../lib/toc'
import { WidthHandle } from './WidthHandle'

/* markdown 那一坨（react-markdown + remark-gfm + highlight.js）只在真正打开文章时才加载，
   否则桌面首屏要白白多背 100+ KB gzip（实测 77 → 182 KB）。 */
const Markdown = lazy(() => import('./Markdown').then((mod) => ({ default: mod.Markdown })))

const CATEGORY_NAME = new Map<string, string>(CATEGORIES.map((item) => [item.id, item.name]))

/**
 * 文章详情：路由 /blog/:id，标题栏显示文章标题。
 * 宽窗下左右各挂一条窄栏（文内信息 / 目录 + 更多文章），别让正文孤零零地居中 ——
 * 正文列默认 88ch，多出来的宽度给两栏，行宽不会被拉长。栏数见 globals.css 的 .article__*
 *
 * 正文列宽还能拖：左右两条白色长条就是 DSH 会话页那两条的复刻
 * （拖动条在 components/program/WidthHandle.tsx，几何在 lib/readingWidth.ts）。
 * 拖过之后列宽写 localStorage，窄栏位置不变、正文只在中间变宽；双击手柄回到 88ch。
 */
export function BlogDetailWindow() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { feed, loading } = useBlogFeed()
  const post = feed?.posts.find((item) => String(item.id) === id)
  const { gridRef, handlesVisible, handles } = useArticleWidth()

  useWindowTitle(post?.title ?? '文章')

  const toc = useMemo(() => extractToc(post?.body ?? ''), [post?.body])

  /* 右栏的「更多文章」：按时间倒序，排除当前这篇 */
  const others = useMemo(() => {
    const rest = (feed?.posts ?? []).filter((item) => item.state === 'open' && item.id !== post?.id)
    return [...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  }, [feed, post?.id])

  if (!post) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">{loading ? '正在读取…' : '没有找到这篇文章。'}</p>
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
      <div className="article__grid" ref={gridRef}>
        {/* 左栏：文内信息（窄窗时这些信息在主栏头部，见 .article__meta） */}
        <aside className="article__rail article__rail--left" aria-label="文章信息">
          <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
            <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">文章信息</h3>
            <dl className="space-y-1 px-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-dim">分类</dt>
                <dd className="text-ink">{CATEGORY_NAME.get(post.category) ?? '其他'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-dim">日期</dt>
                <dd className="text-ink">{formatDate(post.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-dim">字数</dt>
                <dd className="text-ink">{charCount(post.body)}</dd>
              </div>
            </dl>
            {post.labels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1 px-1">
                {post.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </aside>

        <div className="article__main space-y-4">
          {/* 两条拖动条贴在正文列左右两侧的空白里（绝对定位，不占位）。
              容器太窄、两侧放不下时 useArticleWidth 会先藏起来，免得顶出横向滚动 */}
          {handlesVisible ? (
            <div className="article__handles">
              <WidthHandle side="left" {...handles} />
              <WidthHandle side="right" {...handles} />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate('/blog')}
            className="text-xs text-dim hover:text-ink"
          >
            ← 文章列表
          </button>

          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">{post.title}</h2>
            {/* 宽窗时这份元信息挪到左栏，这里藏起来免得重复 */}
            <p className="article__meta flex flex-wrap items-center gap-2 text-xs text-dim">
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

        {/* 右栏：目录 + 更多文章 */}
        <aside className="article__rail article__rail--right" aria-label="目录与更多文章">
          {toc.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">目录</h3>
              <ol className="space-y-0.5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById(item.id)?.scrollIntoView({ block: 'start' })
                      }
                      className={`block w-full truncate rounded px-1 py-1 text-left text-xs text-dim hover:bg-hover hover:text-ink ${
                        item.level === 3 ? 'pl-3' : ''
                      }`}
                    >
                      {item.text}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {others.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">更多文章</h3>
              <ol className="space-y-0.5">
                {others.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/blog/${item.id}`)}
                      className="block w-full truncate rounded px-1 py-1 text-left text-xs text-ink hover:bg-hover"
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  )
}
