/**
 * 博客详情：正文渲染 + TOC + 阅读进度 + 点赞/评论（Giscus）+ 站长操作。
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Cover } from './Cover'
import { Giscus } from './Giscus'
import { ReadingProgress } from './ReadingProgress'
import { Toc } from './Toc'
import { CATEGORY_DAILY, SITE, deleteIssue, type Blog } from '../lib/github'
import { extractHeadings, formatDate, readingMinutes } from '../lib/text'
import { markdownComponents, rehypePlugins, remarkPlugins } from '../lib/markdown'
import { useAuth } from '../hooks/useAuth'

export interface BlogDetailProps {
  blog: Blog
  onClosed?: () => void
}

export function BlogDetail({ blog, onClosed }: BlogDetailProps) {
  const headings = useMemo(() => extractHeadings(blog.body), [blog.body])
  const { isOwner, pat } = useAuth()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')

  const minutes = useMemo(() => readingMinutes(blog.body), [blog.body])

  const openTag = (tag: string) => navigate(`/?tag=${encodeURIComponent(tag)}`)

  const onClose = async () => {
    if (!confirm(`确定下架《${blog.title}》吗？（GitHub 不支持删除 Issue，这里会关闭并打上 deleted 标签）`)) return
    setClosing(true)
    setCloseError('')
    try {
      await deleteIssue(blog.id)
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-caramel-600 dark:text-caramel-300">
            <span className="rounded-full bg-caramel-500 px-2 py-0.5 font-medium text-caramel-50">
              {blog.category === CATEGORY_DAILY ? '日常' : '项目'}
            </span>
            <time dateTime={blog.createdAt}>发布于 {formatDate(blog.createdAt)}</time>
            {blog.updatedAt && blog.updatedAt !== blog.createdAt && (
              <span>· 更新于 {formatDate(blog.updatedAt)}</span>
            )}
            <span>· 约 {minutes} 分钟</span>
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

          {isOwner && pat && (
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

          <section id="likes" className="rounded-2xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800">
            <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">点赞</h2>
            <p className="mt-1 text-sm text-caramel-600 dark:text-caramel-300">
              点赞即 Giscus 的 👍 reaction，由 GitHub Discussions 托管，前端不存数据。
            </p>
          </section>

          <section id="comments" className="space-y-3">
            <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">评论</h2>
            <Giscus blogId={blog.id} title={blog.title} />
          </section>
        </footer>
      </article>
    </>
  )
}

export default BlogDetail
