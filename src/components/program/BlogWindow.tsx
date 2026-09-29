import { startTransition, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SITE } from '../../data/site'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import {
  CATEGORIES,
  charCount,
  formatDate,
  normalizeForSearch,
  plainText,
  type BlogPost,
  type CategoryId,
} from '../../lib/github'

/** 分类 id → 中文名；卡片头上的"圆牌"取它的第一个字（对应贴吧那边的吧头像） */
const CATEGORY_NAME = new Map<string, string>(CATEGORIES.map((item) => [item.id, item.name]))

function categoryMark(post: BlogPost): string {
  return (CATEGORY_NAME.get(post.category) ?? '其他').slice(0, 1)
}

/**
 * 「博客」窗口：贴吧式排版 —— 左栏分类 / 标签，中栏搜索 + 卡片流，右栏最新与统计。
 * 栏数跟着窗口宽度走（容器查询在 globals.css 的 .blog 那一段），窄窗自动堆成一列。
 */
export function BlogWindow() {
  const navigate = useNavigate()
  const { feed, loading, refresh } = useBlogFeed()
  const [category, setCategory] = useState<CategoryId>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  /* 提前把 markdown 那块 chunk 拉下来：详情页是懒加载的，
     点卡片时才现拉会在同步渲染里挂起（React 会直接抛错）。 */
  useEffect(() => {
    void import('./Markdown')
  }, [])

  /* 公开列表只显示已发布的；下架的文章不在这里出现（创作窗口里仍能看到并恢复） */
  const posts = useMemo(
    () => (feed?.posts ?? []).filter((post) => post.state === 'open'),
    [feed],
  )

  /* 搜索索引：标题 + 正文 + 标签。索引与查询都过 normalizeForSearch（抹掉空白与标点），
     所以「焦糖 布丁」也能命中「焦糖布丁」；两边规则一旦不一致就会出现"正文搜不到" */
  const haystack = useMemo(() => {
    const map = new Map<number, string>()
    for (const post of posts) {
      map.set(post.id, normalizeForSearch(`${post.title} ${post.body} ${post.labels.join(' ')}`))
    }
    return map
  }, [posts])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const label of post.labels) {
        if (label === 'daily' || label === 'project') continue
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [posts])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([['all', posts.length]])
    for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
    return counts
  }, [posts])

  const keyword = normalizeForSearch(query)
  const filtering = keyword !== '' || category !== 'all' || tag !== null

  const shown = posts.filter(
    (post) =>
      (category === 'all' || post.category === category) &&
      (tag === null || post.labels.includes(tag)) &&
      (keyword === '' || (haystack.get(post.id) ?? '').includes(keyword)),
  )

  const recent = useMemo(
    () => [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [posts],
  )

  const lastUpdated = useMemo(
    () => posts.reduce((acc, post) => (post.updatedAt > acc ? post.updatedAt : acc), ''),
    [posts],
  )

  function openPost(id: number) {
    /* startTransition：详情页里有懒加载的 markdown，同步跳转会在渲染中挂起而报错 */
    startTransition(() => navigate(`/blog/${id}`))
  }

  return (
    <div className="blog">
      <div className="blog__grid">
        {/* ── 左栏：分类与标签（贴吧的「首页 / 我常逛的吧」）── */}
        <nav className="blog__nav space-y-3" aria-label="文章分类与标签">
          <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
            <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">分类</h3>
            <div className="blog__navList">
              {CATEGORIES.map((item) => {
                const active = category === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(item.id)}
                    className={`blog__navItem border ${
                      active
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-edge text-ink hover:bg-hover'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] opacity-70">
                      {categoryCounts.get(item.id) ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {tags.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">标签</h3>
              <div className="blog__navList">
                {tags.map(([name, count]) => {
                  const active = tag === name
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTag(active ? null : name)}
                      className={`blog__navItem border ${
                        active
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-edge text-dim hover:bg-hover'
                      }`}
                    >
                      <span className="truncate">#{name}</span>
                      <span className="ml-auto shrink-0 text-[11px] opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}
        </nav>

        {/* ── 中栏：搜索 + 卡片流（贴吧的帖子列表）── */}
        <div className="blog__feed space-y-3">
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-2 p-2.5"
            role="search"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('')
              }}
              placeholder="搜索文章：标题、正文、标签"
              aria-label="搜索文章"
              className="min-w-[9rem] flex-1 rounded border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query !== '' ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded border border-edge px-2.5 py-1.5 text-xs text-dim hover:bg-hover"
              >
                清除
              </button>
            ) : null}
            <span className="shrink-0 text-xs text-dim">
              {loading ? '读取中…' : filtering ? `找到 ${shown.length} 篇` : `共 ${posts.length} 篇`}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="shrink-0 rounded border border-edge px-2.5 py-1.5 text-xs text-dim hover:bg-hover disabled:opacity-50"
            >
              刷新
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
              {posts.length === 0
                ? '还没有文章。'
                : keyword !== ''
                  ? `没有匹配「${query.trim()}」的文章。`
                  : '这个筛选下没有文章。'}
            </p>
          ) : null}

          <ul className="space-y-2">
            {shown.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => openPost(post.id)}
                  className="flex w-full flex-col gap-2 rounded-lg border border-edge bg-surface-2 p-3 text-left transition-colors hover:bg-hover"
                >
                  {/* 卡片头：分类圆牌 + 分类名 + 日期（对应贴吧的「吧名 · 关注数」那一行） */}
                  <span className="flex items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-accent text-[11px] font-medium text-accent-ink">
                      {categoryMark(post)}
                    </span>
                    <span className="text-xs font-medium text-ink">
                      {CATEGORY_NAME.get(post.category) ?? '其他'}
                    </span>
                    <span className="text-xs text-dim">{formatDate(post.createdAt)}</span>
                    {post.cover ? (
                      <span className="ml-auto rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim">
                        图文
                      </span>
                    ) : null}
                  </span>

                  <span className="text-sm font-medium leading-snug text-ink">{post.title}</span>

                  {/* 正文预览：贴吧是图文混排，这里封面缩略图 + 摘要 */}
                  <span className="blog__cardBody">
                    {post.cover ? (
                      <img
                        src={post.cover}
                        alt=""
                        loading="lazy"
                        className="blog__cardCover border border-edge bg-surface"
                      />
                    ) : null}
                    <span className="min-w-0 text-xs leading-relaxed text-dim">
                      {plainText(post.body, 150)}
                    </span>
                  </span>

                  {/* 卡片脚：标签 + 字数（替代贴吧的「分享 · 评论 · 赞」） */}
                  <span className="flex flex-wrap items-center gap-1">
                    {post.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim"
                      >
                        {label}
                      </span>
                    ))}
                    <span className="ml-auto shrink-0 text-[11px] text-dim">
                      {charCount(post.body)} 字
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── 右栏：站标 + 最新发布 + 统计（贴吧右栏的热榜与推广位）── */}
        <aside className="blog__aside space-y-3" aria-label="站点信息与最新文章">
          <section className="flex items-center gap-3 rounded-lg border border-edge bg-surface-2 p-3">
            <img
              src={SITE.logo}
              alt=""
              width={36}
              height={36}
              className="logo-mark h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{SITE.name}</p>
              <p className="truncate text-xs text-dim">{SITE.tagline}</p>
            </div>
          </section>

          {recent.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">最新发布</h3>
              <ol className="space-y-0.5">
                {recent.map((post, index) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      onClick={() => openPost(post.id)}
                      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs text-ink hover:bg-hover"
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] ${
                          index < 3 ? 'bg-accent text-accent-ink' : 'text-dim'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate">{post.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
            <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">统计</h3>
            <dl className="space-y-1 px-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-dim">文章</dt>
                <dd className="text-ink">{posts.length} 篇</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-dim">标签</dt>
                <dd className="text-ink">{tags.length} 个</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-dim">最近更新</dt>
                <dd className="text-ink">{lastUpdated ? formatDate(lastUpdated) : '—'}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
