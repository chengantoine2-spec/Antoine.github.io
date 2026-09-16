/**
 * 首页：日常博客卡片列表 + 分类/标签筛选（筛选条件同步到 URL query）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BlogList } from '../components/BlogList'
import { TagFilter } from '../components/TagFilter'
import { CATEGORIES, SITE, type Category } from '../lib/github'
import { collectTags, filterBlogs, useBlogs } from '../hooks/useBlogs'

export default function Home() {
  const { blogs, loading, error, fallback, reload } = useBlogs()
  const [params, setParams] = useSearchParams()

  const categoryParam = params.get('category')
  const category: Category | 'all' =
    categoryParam === CATEGORIES[0] || categoryParam === CATEGORIES[1] ? categoryParam : 'all'

  const selectedTags = useMemo(
    () => (params.get('tag') || '').split(',').map((t) => t.trim()).filter(Boolean),
    [params],
  )

  const tags = useMemo(() => collectTags(blogs), [blogs])
  const visible = useMemo(
    () => filterBlogs(blogs, { category: category === 'all' ? null : category, tags: selectedTags }),
    [blogs, category, selectedTags],
  )

  const [pending, setPending] = useState(false)
  useEffect(() => setPending(false), [params])

  const update = (next: { category?: Category | 'all'; tags?: string[] }) => {
    const search = new URLSearchParams(params)
    const nextCategory = next.category ?? category
    if (nextCategory === 'all') search.delete('category')
    else search.set('category', nextCategory)

    const nextTags = next.tags ?? selectedTags
    if (nextTags.length === 0) search.delete('tag')
    else search.set('tag', nextTags.join(','))

    setPending(true)
    setParams(search, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-caramel-200 bg-caramel-100 px-6 py-8 dark:border-caramel-700 dark:bg-caramel-800">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel-600 dark:text-caramel-300">
          Caramel Pudding
        </p>
        <h1 className="mt-2 text-3xl font-bold text-caramel-800 sm:text-4xl dark:text-caramel-100">
          {SITE.title}的日常与项目
        </h1>
        <p className="mt-3 max-w-2xl text-caramel-700 dark:text-caramel-200">
          记录厨房里的失败与重来、前端的取舍与踩坑。每篇文章就是一个 GitHub Issue，评论与点赞走 Discussions。
        </p>
        <dl className="mt-6 flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-caramel-600 dark:text-caramel-300">文章</dt>
            <dd className="text-2xl font-bold text-caramel-700 dark:text-caramel-100">{blogs.length}</dd>
          </div>
          <div>
            <dt className="text-caramel-600 dark:text-caramel-300">标签</dt>
            <dd className="text-2xl font-bold text-caramel-700 dark:text-caramel-100">{tags.length}</dd>
          </div>
        </dl>
      </section>

      <TagFilter
        tags={tags}
        selected={selectedTags}
        category={category}
        onCategoryChange={(next) => update({ category: next })}
        onToggle={(tag) =>
          update({
            tags: selectedTags.includes(tag)
              ? selectedTags.filter((t) => t !== tag)
              : [...selectedTags, tag],
          })
        }
        onClear={() => update({ tags: [] })}
      />

      <p className="text-sm text-caramel-600 dark:text-caramel-300" aria-live="polite">
        {loading || pending ? '加载中…' : `共 ${visible.length} 篇`}
      </p>

      <BlogList
        blogs={visible}
        loading={loading}
        error={error}
        fallback={fallback}
        activeTags={selectedTags}
        onTagClick={(tag) =>
          update({
            tags: selectedTags.includes(tag)
              ? selectedTags.filter((t) => t !== tag)
              : [...selectedTags, tag],
          })
        }
        onRetry={reload}
      />
    </div>
  )
}
