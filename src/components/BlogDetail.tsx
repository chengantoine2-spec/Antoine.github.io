/**
 * 博客详情：正文渲染 + TOC + 阅读进度 + 注册用户评论 + 管理员操作。
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { CommentSection } from './CommentSection'
import { Cover } from './Cover'
import { ReadingProgress } from './ReadingProgress'
import { Toc } from './Toc'
import { CATEGORY_DAILY, SITE, deleteIssue, type Blog } from '../lib/github'
import { extractHeadings, formatDateTime, formatFull, formatRelative, readingMinutes } from '../lib/text'
import { markdownComponents, rehypePlugins, remarkPlugins } from '../lib/markdown'
import { useAuth, usePat } from '../hooks/useAuth'
import { invalidateBlogs, useBlogs, useNow } from '../hooks/useBlogs'

export interface BlogDetailProps {
  blog: Blog
  onClosed?: () => void
}

export function BlogDetail({ blog, onClosed }: BlogDetailProps) {
  const headings = useMemo(() => extractHeadings(blog.body), [blog.body])
  const { isAdmin } = useAuth()
  const { hasPat } = usePat()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')

  const minutes = useMemo(() => readingMinutes(blog.body), [blog.body])
  const now = useNow()

  // 上一篇 / 下一篇：用列表缓存里的顺序（发布时间倒序）
  const { blogs } = useBlogs()
  const index = blogs.findIndex((b) => b.id === blog.id)
  const prevPost = index > 0 ? blogs[index - 1] : null
  const nextPost = index >= 0 && index < blogs.length - 1 ? blogs[index + 1] : null

  // 回到顶部按钮：滚过一屏才出现
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > window.innerHeight * 0.8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openTag = (tag: string) => navigate(`/?tag=${encodeURIComponent(tag)}`)

  const onClose = async () => {
    if (!confirm(`确定下架《${blog.title}》吗？（GitHub 不支持删除 Issue，这里会关闭并打上 deleted 标签）`)) return
    setClosing(true)
    setCloseError('')
    try {
      await deleteIssue(blog.id)
      invalidateBlogs()
      onClosed?.()
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setClosing(false)
    }
  }

  return (
    <>
      <ReadingProgress targetId="article-body" />

      <article className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-4 text-sm text-caramel-600 dark:text-caramel-300">
          <Link to="/" className="hover:text-caramel-700 dark:hover:text-caramel-100">
            首页
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-caramel-700 dark:text-caramel-100">{blog.title}</span>
        </nav>

        <Cover src={blog.cover} alt={blog.title} label={blog.title} variant="hero" className="mb-6 rounded-2xl" />

        <header className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-caramel-600 dark:text-caramel-300">
            <span className="rounded-full bg-caramel-500 px-2 py-0.5 font-medium text-caramel-50">
              {blog.category === CATEGORY_DAILY ? '日常' : '项目'}
            </span>
            <time dateTime={blog.createdAt} title={`精确时间：${formatFull(blog.createdAt)}`}>
              发布于 {formatDateTime(blog.createdAt)}
            </time>
            <span className="rounded bg-caramel-200 px-1.5 py-0.5 font-medium text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100">
              {formatRelative(blog.createdAt, now)}
            </span>
            {blog.updatedAt && blog.updatedAt !== blog.createdAt && (
              <span title={`精确时间：${formatFull(blog.updatedAt)}`}>
                · 更新于 {formatDateTime(blog.updatedAt)}（{formatRelative(blog.updatedAt, now)}）
              </span>
            )}
            <span>· 阅读约 {minutes} 分钟</span>
            {blog.comments > 0 && <span>· {blog.comments} 条评论</span>}
          </div>

          <h1 className="text-3xl font-bold leading-tight text-caramel-800 sm:text-4xl dark:text-caramel-100">
            {blog.title}
          </h1>

          {blog.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {blog.tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => openTag(tag)}
                    className="rounded-full border border-caramel-200 bg-caramel-100 px-2.5 py-1 text-xs text-caramel-700 transition hover:border-caramel-400 hover:bg-caramel-200 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-200"
                  >
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isAdmin && hasPat && (
            <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-caramel-200 bg-caramel-100 px-3 py-2 text-xs dark:border-caramel-700 dark:bg-caramel-800">
              <span className="font-medium text-caramel-700 dark:text-caramel-200">站长操作</span>
              <Link
                to={`/write?edit=${blog.id}`}
                className="rounded-md border border-caramel-400 px-2 py-0.5 transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
              >
                编辑
              </Link>
              <button
                type="button"
                onClick={onClose}
                disabled={closing}
                className="rounded-md border border-caramel-400 px-2 py-0.5 transition hover:bg-caramel-200 disabled:opacity-60 dark:hover:bg-caramel-700"
              >
                {closing ? '处理中…' : '删除（关闭 Issue）'}
              </button>
              <a
                href={blog.url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-caramel-400 px-2 py-0.5 transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
              >
                在 GitHub 打开
              </a>
              {closeError && <span className="text-caramel-700 dark:text-caramel-200">{closeError}</span>}
            </div>
          )}
        </header>

        {/* 移动端目录 */}
        <details className="no-print mb-6 rounded-xl border border-caramel-200 bg-caramel-100 px-4 py-3 lg:hidden dark:border-caramel-700 dark:bg-caramel-800">
          <summary className="cursor-pointer text-sm font-medium text-caramel-700 dark:text-caramel-200">
            目录
          </summary>
          <Toc items={headings} className="mt-3" />
        </details>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div id="article-body" className="prose-caramel min-w-0">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {blog.body}
            </ReactMarkdown>
          </div>

          <aside className="no-print hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
              <Toc items={headings} />
            </div>
          </aside>
        </div>

        <footer className="mt-12 space-y-6 border-t border-caramel-200 pt-6 dark:border-caramel-700">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-caramel-600 dark:text-caramel-300">
            <span>
              本文发布于 {SITE.title} · 由 GitHub Issue #{blog.id} 驱动
            </span>
            <Link to="/" className="hover:text-caramel-700 dark:hover:text-caramel-100">
              ← 返回首页
            </Link>
          </div>

          {/* 点赞（本期不做）：schema.sql 末尾已留 likes 表结构，启用时在此加回 */}

          <CommentSection blogId={blog.id} />

          {/* 上一篇 / 下一篇：按发布时间倒序，列表页同源数据（走缓存，不额外请求） */}
          {(prevPost || nextPost) && (
            <nav className="no-print grid gap-3 border-t border-caramel-200 pt-6 sm:grid-cols-2 dark:border-caramel-700">
              {prevPost ? (
                <Link
                  to={`/blog/${prevPost.id}`}
                  className="rounded-xl border border-caramel-200 bg-caramel-100 p-3 transition hover:border-caramel-400 dark:border-caramel-700 dark:bg-caramel-800"
                >
                  <span className="text-xs text-caramel-600 dark:text-caramel-300">← 上一篇（更新）</span>
                  <span className="mt-1 block font-medium text-caramel-800 dark:text-caramel-100">
                    {prevPost.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nextPost && (
                <Link
                  to={`/blog/${nextPost.id}`}
                  className="rounded-xl border border-caramel-200 bg-caramel-100 p-3 text-right transition hover:border-caramel-400 sm:text-right dark:border-caramel-700 dark:bg-caramel-800"
                >
                  <span className="text-xs text-caramel-600 dark:text-caramel-300">下一篇（更早）→</span>
                  <span className="mt-1 block font-medium text-caramel-800 dark:text-caramel-100">
                    {nextPost.title}
                  </span>
                </Link>
              )}
            </nav>
          )}
        </footer>
      </article>

      {/* 回到顶部 */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="回到顶部"
          className="no-print fixed bottom-6 right-5 z-40 grid h-10 w-10 place-items-center rounded-full border border-caramel-300 bg-caramel-100 text-caramel-700 shadow-md transition hover:bg-caramel-200 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-100 dark:hover:bg-caramel-700"
        >
          ↑
        </button>
      )}
    </>
  )
}

export default BlogDetail
