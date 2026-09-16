/**
 * 博客列表：卡片网格 + 加载 / 空 / 错误状态。
 */
import { BlogCard } from './BlogCard'
import type { Blog } from '../lib/github'

export interface BlogListProps {
  blogs: Blog[]
  loading?: boolean
  error?: string
  /** 正在使用本地兜底数据 */
  fallback?: boolean
  onTagClick?: (tag: string) => void
  activeTags?: string[]
  onRetry?: () => void
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-caramel-200 bg-caramel-100 dark:border-caramel-700 dark:bg-caramel-800">
      <div className="aspect-[16/9] bg-caramel-200 dark:bg-caramel-700" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 rounded bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-5 w-4/5 rounded bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-3 w-full rounded bg-caramel-200 dark:bg-caramel-700" />
      </div>
    </div>
  )
}

export function BlogList({
  blogs,
  loading = false,
  error = '',
  fallback = false,
  onTagClick,
  activeTags = [],
  onRetry,
}: BlogListProps) {
  if (loading && blogs.length === 0) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          <span>读取 GitHub Issues 失败：{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-caramel-400 px-2 py-0.5 text-xs transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
            >
              重试
            </button>
          )}
        </div>
      )}

      {fallback && (
        <div className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100/70 px-4 py-3 text-xs text-caramel-600 dark:border-caramel-600 dark:bg-caramel-800/70 dark:text-caramel-300">
          当前展示的是内置示例数据（尚未配置 GitHub 仓库）。把 <code>VITE_GH_USER</code> /{' '}
          <code>VITE_GH_REPO</code> 填好，或改用 Issue 作为数据源后即显示真实内容。
        </div>
      )}

      {blogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-caramel-300 px-6 py-16 text-center dark:border-caramel-600">
          <p className="text-caramel-700 dark:text-caramel-200">没有匹配的博客</p>
          <p className="mt-2 text-sm text-caramel-600 dark:text-caramel-300">
            试试清除标签筛选，或换一个分类。
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} onTagClick={onTagClick} activeTags={activeTags} />
          ))}
        </div>
      )}
    </div>
  )
}

export default BlogList
