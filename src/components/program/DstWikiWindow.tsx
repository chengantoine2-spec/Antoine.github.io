import { useMemo, useState } from 'react'
import { DST_CATEGORIES, DST_ENTRIES, type DstEntry } from '../../data/dst'

/**
 * 「饥荒 Wiki」窗口。
 *
 * ⚠️ 归属：**这个文件归 wiki 窗口负责人维护**（连同 `src/data/dst/`）。
 * 窗口外壳、任务栏、主题、路由由主管维护 —— 需要新的外壳能力（例如条目要独立路由
 * `/wiki/:id`、要一个新的窗口图标）就跟主管说，别自己改 `router.tsx` / `apps.ts` /
 * `tokens.css` / `globals.css` 里的共享部分。
 *
 * 必须遵守的全站规矩（AGENTS.md 有完整版）：
 * - 颜色只用主题令牌类（`text-ink` / `bg-surface-2` / `border-edge` / `text-dim` …），
 *   一律不许写死 `#fff`、`rgb()`、`bg-white`
 * - 新依赖要主管批准并登记；不要为了这个窗口引 markdown 渲染器 / UI 组件库
 * - 改完跑 `npm run build`；涉及交互跑 `npm run verify`（需要 dev server 在跑）
 * - 版式沿用三栏模式（`.wiki__*`，见 globals.css），栏数跟着窗口宽度走
 */

/** 搜索归一化：抹掉空白并小写，理由见 AGENTS.md「索引和查询必须同一套规则」 */
function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

const CATEGORY_NAME = new Map(DST_CATEGORIES.map((item) => [item.id, item.name]))

export function DstWikiWindow() {
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  /* 索引：名字 + 英文名 + 摘要 + 正文，一次算好 */
  const index = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of DST_ENTRIES) {
      map.set(
        entry.id,
        normalize(`${entry.name} ${entry.en ?? ''} ${entry.summary} ${entry.body.join(' ')}`),
      )
    }
    return map
  }, [])

  const counts = useMemo(() => {
    const map = new Map<string, number>([['all', DST_ENTRIES.length]])
    for (const entry of DST_ENTRIES) map.set(entry.category, (map.get(entry.category) ?? 0) + 1)
    return map
  }, [])

  const keyword = normalize(query)
  const shown = DST_ENTRIES.filter(
    (entry) =>
      (category === 'all' || entry.category === category) &&
      (keyword === '' || (index.get(entry.id) ?? '').includes(keyword)),
  )
  const open = openId === null ? null : (DST_ENTRIES.find((e) => e.id === openId) ?? null)

  function openEntry(entry: DstEntry) {
    setOpenId(entry.id)
    setQuery('')
  }

  return (
    <div className="wiki">
      <div className="wiki__grid">
        {/* 左栏：分类 */}
        <nav className="wiki__nav space-y-3" aria-label="条目分类">
          <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
            <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">分类</h3>
            <div className="wiki__navList">
              {[{ id: 'all', name: '全部' }, ...DST_CATEGORIES].map((item) => {
                const active = category === item.id && open === null
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(item.id)
                      setOpenId(null)
                    }}
                    className={`wiki__navItem border ${
                      active
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-edge text-ink hover:bg-hover'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] opacity-70">
                      {counts.get(item.id) ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </nav>

        {/* 中栏：列表，或某条目的详情 */}
        <div className="wiki__feed space-y-3">
          {open !== null ? (
            <>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="text-xs text-dim hover:text-ink"
              >
                ← 全部条目
              </button>

              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-ink">
                  {open.name}
                  {open.en ? <span className="ml-2 text-sm font-normal text-dim">{open.en}</span> : null}
                </h2>
                <p className="text-xs text-dim">
                  {CATEGORY_NAME.get(open.category) ?? open.category}
                </p>
              </header>

              <div className="wiki__body space-y-3 text-sm leading-relaxed text-ink">
                {open.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {open.related && open.related.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-3">
                  <span className="text-xs text-dim">相关</span>
                  {open.related.map((id) => {
                    const target = DST_ENTRIES.find((e) => e.id === id)
                    if (!target) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openEntry(target)}
                        className="rounded border border-edge px-2 py-1 text-xs text-ink hover:bg-hover"
                      >
                        {target.name}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <>
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
                  placeholder="搜索条目：名字、英文名、摘要、正文"
                  aria-label="搜索 Wiki 条目"
                  className="min-w-[9rem] flex-1 rounded border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                <span className="shrink-0 text-xs text-dim">
                  {keyword === '' ? `共 ${DST_ENTRIES.length} 条` : `找到 ${shown.length} 条`}
                </span>
              </div>

              {shown.length === 0 ? (
                <p className="text-sm text-dim">
                  {DST_ENTRIES.length === 0 ? '条目整理中，稍后就来。' : '没有匹配的条目。'}
                </p>
              ) : null}

              <ul className="space-y-2">
                {shown.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className="flex w-full flex-col gap-1.5 rounded-lg border border-edge bg-surface-2 p-3 text-left transition-colors hover:bg-hover"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-ink">{entry.name}</span>
                        {entry.en ? (
                          <span className="text-xs text-dim">{entry.en}</span>
                        ) : null}
                        <span className="ml-auto shrink-0 rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim">
                          {CATEGORY_NAME.get(entry.category) ?? entry.category}
                        </span>
                      </span>
                      <span className="text-xs leading-relaxed text-dim">{entry.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* 右栏：当前条目的关键数值，没有就显示统计 */}
        <aside className="wiki__aside space-y-3" aria-label="条目速览">
          {open?.facts && open.facts.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">关键数值</h3>
              <dl className="space-y-1 px-1 text-xs">
                {open.facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-2">
                    <dt className="text-dim">{fact.label}</dt>
                    <dd className="text-right text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
            <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">统计</h3>
            <dl className="space-y-1 px-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-dim">条目</dt>
                <dd className="text-ink">{DST_ENTRIES.length} 条</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-dim">分类</dt>
                <dd className="text-ink">{DST_CATEGORIES.length} 类</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
