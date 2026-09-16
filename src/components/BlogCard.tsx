/**
 * 博客卡片：封面缩略图 + 标题 + 摘要 + 标签 + 元信息。
 */
import { Link } from 'react-router-dom'
import { Cover } from './Cover'
import { formatDateTime, formatFull, formatRelative, readingMinutes } from '../lib/text'
import { CATEGORY_DAILY, type Blog } from '../lib/github'
import { useNow } from '../hooks/useBlogs'

export interface BlogCardProps {
  blog: Blog
  onTagClick?: (tag: string) => void
  /** 标签是否处于选中态 */
  activeTags?: string[]
}

export function BlogCard({ blog, onTagClick, activeTags = [] }: BlogCardProps) {
  const now = useNow()
  const updated = blog.updatedAt && blog.updatedAt !== blog.createdAt ? blog.updatedAt : ''

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-caramel-200 bg-caramel-100 shadow-sm transition hover:-translate-y-0.5 hover:border-caramel-400 hover:shadow-md dark:border-caramel-700 dark:bg-caramel-800">
      <Link to={`/blog/${blog.id}`} className="block" aria-label={blog.title}>
        <Cover src={blog.cover} alt={blog.title} label={blog.title} variant="card" />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-caramel-600 dark:text-caramel-300">
          <span className="rounded-full bg-caramel-500 px-2 py-0.5 font-medium text-caramel-50">
            {blog.category === CATEGORY_DAILY ? '日常' : '项目'}
          </span>
          <time dateTime={blog.createdAt} title={`发布于 ${formatFull(blog.createdAt)}`}>
            {formatDateTime(blog.createdAt)}
          </time>
          <span className="rounded bg-caramel-200 px-1.5 py-0.5 font-medium text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100">
            {formatRelative(blog.createdAt, now)}
          </span>
          {updated && (
            <span title={`更新于 ${formatFull(updated)}`}>· 更新于 {formatRelative(updated, now)}</span>
          )}
          <span>· 阅读约 {readingMinutes(blog.body)} 分钟</span>
          {blog.comments > 0 && <span>· {blog.comments} 评论</span>}
        </div>

        <h2 className="text-lg font-bold leading-snug text-caramel-800 dark:text-caramel-100">
          <Link to={`/blog/${blog.id}`} className="transition hover:text-caramel-600 dark:hover:text-caramel-300">
            {blog.title}
          </Link>
        </h2>

        {blog.summary && (
          <p className="line-clamp-2 text-sm leading-relaxed text-caramel-700 dark:text-caramel-200">
            {blog.summary}
          </p>
        )}

        {blog.tags.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {blog.tags.slice(0, 4).map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => onTagClick?.(tag)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    activeTags.includes(tag)
                      ? 'border-caramel-500 bg-caramel-500 text-caramel-50'
                      : 'border-caramel-200 bg-caramel-50 text-caramel-600 hover:border-caramel-400 hover:bg-caramel-200 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-300'
                  }`}
                >
                  #{tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export default BlogCard
