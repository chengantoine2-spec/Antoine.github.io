/**
 * 博客详情页：/blog/:id
 */
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BlogDetail } from '../components/BlogDetail'
import { useBlog } from '../hooks/useBlogs'

export default function Blog() {
  const { id } = useParams<{ id: string }>()
  const blogId = Number(id)
  const { blog, loading, error } = useBlog(Number.isFinite(blogId) ? blogId : undefined)
  const navigate = useNavigate()

  if (loading && !blog) {
    return (
      <div className="mx-auto w-full max-w-3xl animate-pulse space-y-4 px-4 py-16 sm:px-6">
        <div className="h-6 w-1/4 rounded bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-10 w-3/4 rounded bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-56 rounded-2xl bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-4 w-full rounded bg-caramel-200 dark:bg-caramel-700" />
        <div className="h-4 w-5/6 rounded bg-caramel-200 dark:bg-caramel-700" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">找不到这篇文章</h1>
        <p className="mt-3 text-caramel-600 dark:text-caramel-300">
          {error || `Issue #${id} 可能已关闭、被删除，或仓库还没配置。`}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600"
        >
          返回首页
        </Link>
      </div>
    )
  }

  return <BlogDetail blog={blog} onClosed={() => navigate('/')} />
}
