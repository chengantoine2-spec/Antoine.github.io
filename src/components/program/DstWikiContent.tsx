/**
 * 「饥荒 Wiki」窗口的内容实现 —— 重量都在这里，由 `DstWikiWindow.tsx` 懒加载。
 *
 * ⚠️ 归属：本文件与 `DstWikiWindow.tsx`、`src/data/dst/`、`src/lib/dst/` 都归
 * wiki 窗口负责人维护（见 AGENTS.md 的「分工」一节）。窗口外壳、任务栏、主题、
 * 路由归主管 —— 需要新的外壳能力就跟主管提，别自己改 `router.tsx` / `apps.ts` /
 * `tokens.css` / `globals.css` 里的共享部分。
 *
 * 全站规矩（AGENTS.md 有完整版）：
 * - 颜色只用主题令牌类（`text-ink` / `bg-surface-2` / `border-edge` / `text-dim` …），
 *   不许写死 `#fff`、`rgb()`、`bg-white`
 * - 版式沿用三栏模式（`.wiki__*`，见 globals.css），栏数跟着窗口宽度走
 * - 正文用「段落数组 + facts」表达，不为这个窗口引 markdown 渲染器
 * - 搜索逻辑在 `src/lib/dst/search.ts`（能脱离 React 跑回归），不要抄回本文件
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import { formatDate, isWikiGuide, normalizeForSearch, plainText } from '../../lib/github'
import {
  DST_CATEGORIES,
  DST_ENTRIES,
  RECIPES,
  entryName,
  recipesFor,
  recipesUsing,
  type DstEntry,
  type DstRecipe,
} from '../../data/dst'
/* 搜索逻辑全部在 src/lib/dst/search.ts：索引构建、打分、排序。
   抽出去是为了能脱离 React 用真实数据跑回归 —— 假命中光靠肉眼在页面上看不出来。
   ⚠️ 这里**不要**静态 import `../../lib/dst/pinyin`：那会把 `pinyin-pro`（约 300 KB）
   顺着首屏链路折叠进桌面那个 chunk（实测过）。拼音模块改成运行时动态 import。 */
import {
  attachPinyin,
  buildIndex,
  normalize,
  searchIndex,
  type IndexRow,
  type PinyinFormer,
} from '../../lib/dst/search'

const CATEGORY_NAME = new Map(DST_CATEGORIES.map((item) => [item.id, item.name]))

/** 配方里的站台存的是 id（`science` / `none`…），展示必须换成中文名 ——
    否则详情页会出现「科学机器」与「science」并存的两种写法 */
const STATION_LABEL: Record<string, string> = {
  none: '随时可做',
  science: '科学机器',
  alchemy: '炼金引擎',
  shadow: '暗影操纵者',
  lunar: '月亮祭坛',
  ancient: '远古伪科学站',
  seafaring: '航海',
  cooking: '烹饪锅',
}

function stationName(station: string): string {
  return STATION_LABEL[station] ?? station
}

/** 小节 id → 中文名（左栏二级筛选与详情页标签共用） */
const SECTION_NAME: Record<string, string> = {
  material: '材料',
  tool: '工具',
  light: '照明',
  weapon: '武器',
  armor: '护甲',
  clothes: '衣物',
  magic: '魔法',
  food: '食材',
  cook: '料理',
}

function DstWikiContent() {
  const navigate = useNavigate()
  const { feed, loading: guideLoading } = useBlogFeed()
  /* 两个区：资料 = 结构化条目；教程 = 带 `wiki` 标签的博客文章（新手教程就发在这里） */
  const [mode, setMode] = useState<'data' | 'guide'>('data')
  const [guideQuery, setGuideQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [group, setGroup] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<IndexRow[]>(() => buildIndex(DST_ENTRIES))
  const [pinyinReady, setPinyinReady] = useState(false)

  /* 拼音支持在**运行时**动态加载：整条链（本组件 → pinyin.ts → pinyin-pro）
     因此不会进入桌面首屏的 chunk。加载完把索引补全，之后的搜索就支持全拼与首字母了。
     加载慢或失败都只是「拼音暂时不可用」，中文 / 英文 / 别名的搜索不受影响。 */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const mod = (await import('../../lib/dst/pinyin')) as {
          getPinyin: () => Promise<unknown>
          makePinyinFormer: (fn: unknown) => PinyinFormer
        }
        const fn = await mod.getPinyin()
        if (!alive || !fn) return
        /* 注入绑定好的转换器：search.ts 因此不需要静态依赖 pinyin.ts */
        setRows((current) => attachPinyin(current, DST_ENTRIES, mod.makePinyinFormer(fn)))
        setPinyinReady(true)
      } catch {
        /* 拿不到拼音库就退回纯文本检索，不打断窗口 */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const counts = useMemo(() => {
    const map = new Map<string, number>([['all', DST_ENTRIES.length]])
    for (const entry of DST_ENTRIES) map.set(entry.category, (map.get(entry.category) ?? 0) + 1)
    return map
  }, [])

  /* 当前分类下有哪些小节分组（只对物品 / 料理有意义），用于二级筛选 */
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of DST_ENTRIES) {
      if (category !== 'all' && entry.category !== category) continue
      if (!entry.section) continue
      map.set(entry.section, (map.get(entry.section) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [category])

  const keyword = normalize(query)

  /* 先按分类 / 小节缩小范围，再交给搜索模块排序。
     搜索模块只认索引行，所以这里把「行」映射回「条目」；用一个 Map 避免每条都线性查找。 */
  const shown = useMemo(() => {
    const byId = new Map(DST_ENTRIES.map((entry) => [entry.id, entry]))
    const pool = DST_ENTRIES.filter(
      (entry) =>
        (category === 'all' || entry.category === category) &&
        (group === null || entry.section === group),
    )
    const poolIds = new Set(pool.map((entry) => entry.id))
    return searchIndex(
      rows.filter((row) => poolIds.has(row.id)),
      keyword,
    )
      .map((row) => byId.get(row.id))
      .filter((entry): entry is DstEntry => entry !== undefined)
  }, [category, group, keyword, rows])

  const open = openId === null ? null : (DST_ENTRIES.find((e) => e.id === openId) ?? null)

  /* ── 教程区：带 `wiki` 标签的博客文章 ──
     教程不是结构化数据，硬塞进条目里会两头不讨好：所以它们仍然是普通文章，
     只是打了 wiki 标签。这里按标签挑出来，搜索复用博客那套 normalizeForSearch。 */
  const guides = useMemo(
    () =>
      (feed?.posts ?? [])
        .filter((post) => post.state === 'open' && isWikiGuide(post))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [feed],
  )

  const guideKeyword = normalizeForSearch(guideQuery)
  const shownGuides = guideKeyword
    ? guides.filter((post) =>
        normalizeForSearch(`${post.title} ${post.body} ${post.labels.join(' ')}`).includes(
          guideKeyword,
        ),
      )
    : guides

  function selectCategory(next: string) {
    setCategory(next)
    setGroup(null)
    setOpenId(null)
  }

  function openEntry(entry: DstEntry) {
    setOpenId(entry.id)
    setQuery('')
  }

  /* 配方反查：能怎么做出来 / 被用在哪些配方里。
     数据只存 id，这里现算 —— 手写第二份一定会和配方表对不上。 */
  function renderRecipe(recipe: DstRecipe, showIngredients: boolean) {
    return (
      <li key={recipe.output + recipe.station + recipe.ingredients.map((i) => i.id).join('-')}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {showIngredients ? (
            <>
              {recipe.ingredients.map((ingredient) => (
                <button
                  key={ingredient.id}
                  type="button"
                  onClick={() => {
                    const target = DST_ENTRIES.find((e) => e.id === ingredient.id)
                    if (target) openEntry(target)
                  }}
                  className="rounded border border-edge px-1.5 py-0.5 text-ink hover:bg-hover"
                >
                  {entryName(ingredient.id)} ×{ingredient.count}
                </button>
              ))}
              <span className="text-dim">→</span>
              <span className="text-ink">
                {entryName(recipe.output)}
                {recipe.count && recipe.count > 1 ? ` ×${recipe.count}` : ''}
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                const target = DST_ENTRIES.find((e) => e.id === recipe.output)
                if (target) openEntry(target)
              }}
              className="rounded border border-edge px-1.5 py-0.5 text-ink hover:bg-hover"
            >
              {entryName(recipe.output)}
            </button>
          )}
          <span className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim">
            {stationName(recipe.station)}
          </span>
        </div>
        {recipe.note ? <p className="mt-1 text-[11px] text-dim">{recipe.note}</p> : null}
      </li>
    )
  }

  const madeBy = open ? recipesFor(open.id) : []
  const usedIn = open ? recipesUsing(open.id) : []
  const startItems = open?.related?.filter((id) => DST_ENTRIES.some((e) => e.id === id)) ?? []

  return (
    <div className="wiki">
      {/* 两个区：资料（结构化条目）/ 教程（带 wiki 标签的博客文章） */}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Wiki 分区">
        {(
          [
            { id: 'data', name: '资料', hint: `条目 ${DST_ENTRIES.length} 条` },
            { id: 'guide', name: '新手教程', hint: `教程 ${guides.length} 篇` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => {
              setMode(tab.id)
              setOpenId(null)
            }}
            className={`rounded border px-3 py-1.5 text-xs ${
              mode === tab.id
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-edge text-ink hover:bg-hover'
            }`}
          >
            {tab.name}
            <span className="ml-1.5 opacity-70">{tab.hint}</span>
          </button>
        ))}
      </div>

      {mode === 'guide' ? (
        /* ── 教程区：中栏列教程，右栏说明怎么投稿 ── */
        <div className="wiki__grid">
          <div className="wiki__feed space-y-3">
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-2 p-2.5"
              role="search"
            >
              <input
                type="search"
                value={guideQuery}
                onChange={(e) => setGuideQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setGuideQuery('')
                }}
                placeholder="搜索教程：标题、正文"
                aria-label="搜索 Wiki 教程"
                className="min-w-[9rem] flex-1 rounded border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              <span className="shrink-0 text-xs text-dim">
                {guideLoading
                  ? '读取中…'
                  : guideKeyword === ''
                    ? `共 ${guides.length} 篇`
                    : `找到 ${shownGuides.length} 篇`}
              </span>
            </div>

            {guideLoading && guides.length === 0 ? (
              <p className="text-sm text-dim">正在读取教程…</p>
            ) : null}

            {!guideLoading && guides.length === 0 ? (
              <p className="text-sm text-dim">
                还没有教程文章。在「博客创作」窗口里把分类选成「饥荒 Wiki」发布，就会出现在这里。
              </p>
            ) : null}

            {!guideLoading && guides.length > 0 && shownGuides.length === 0 ? (
              <p className="text-sm text-dim">没有匹配「{guideQuery.trim()}」的教程。</p>
            ) : null}

            <ul className="space-y-2">
              {shownGuides.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/blog/${post.id}`)}
                    className="flex w-full flex-col gap-1.5 rounded-lg border border-edge bg-surface-2 p-3 text-left transition-colors hover:bg-hover"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink">{post.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-dim">
                        {formatDate(post.createdAt)}
                      </span>
                    </span>
                    <span className="text-xs leading-relaxed text-dim">
                      {plainText(post.body, 140)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <aside className="wiki__aside space-y-3" aria-label="教程说明">
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">教程从哪来</h3>
              <p className="px-1 text-xs leading-relaxed text-dim">
                教程就是博客文章：在「博客创作」窗口里把分类选成
                <span className="text-ink">「饥荒 Wiki」</span>
                ，发布后会带上 <code className="font-mono text-ink">wiki</code> 标签，
                自动出现在这里，同时不会混进博客的日常 / 项目列表。
              </p>
            </section>

            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">统计</h3>
              <dl className="space-y-1 px-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-dim">教程</dt>
                  <dd className="text-ink">{guides.length} 篇</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-dim">资料条目</dt>
                  <dd className="text-ink">{DST_ENTRIES.length} 条</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      ) : null}

      {mode === 'data' ? (
      <div className="wiki__grid">
        {/* ── 左栏：分类（+ 物品小节） ── */}
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
                    onClick={() => selectCategory(item.id)}
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

          {groups.length > 1 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">小节</h3>
              <div className="wiki__navList">
                <button
                  type="button"
                  aria-pressed={group === null}
                  onClick={() => setGroup(null)}
                  className={`wiki__navItem border ${
                    group === null
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-edge text-dim hover:bg-hover'
                  }`}
                >
                  <span className="truncate">不限</span>
                </button>
                {groups.map(([id, count]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={group === id}
                    onClick={() => {
                      setGroup(group === id ? null : id)
                      setOpenId(null)
                    }}
                    className={`wiki__navItem border ${
                      group === id
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-edge text-dim hover:bg-hover'
                    }`}
                  >
                    <span className="truncate">{SECTION_NAME[id] ?? id}</span>
                    <span className="ml-auto shrink-0 text-[11px] opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </nav>

        {/* ── 中栏：列表，或某条目的详情 ── */}
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
                <p className="flex flex-wrap items-center gap-2 text-xs text-dim">
                  <span>{CATEGORY_NAME.get(open.category) ?? open.category}</span>
                  {open.section ? (
                    <span className="rounded border border-edge px-1.5 py-0.5">
                      {SECTION_NAME[open.section] ?? open.section}
                    </span>
                  ) : null}
                </p>
              </header>

              {open.aliases && open.aliases.length > 0 ? (
                <p className="text-[11px] text-dim">别名：{open.aliases.join(' · ')}</p>
              ) : null}

              <div className="wiki__body space-y-3 text-sm leading-relaxed text-ink">
                {open.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {/* 配方反查：能怎么做出来 */}
              {madeBy.length > 0 ? (
                <section className="space-y-1.5 border-t border-edge pt-3">
                  <h3 className="text-xs font-medium text-dim">制作配方</h3>
                  <ul className="space-y-1.5">{madeBy.map((recipe) => renderRecipe(recipe, true))}</ul>
                </section>
              ) : null}

              {/* 配方反查：被用在哪些配方里 */}
              {usedIn.length > 0 ? (
                <section className="space-y-1.5 border-t border-edge pt-3">
                  <h3 className="text-xs font-medium text-dim">作为材料用于</h3>
                  <ul className="space-y-1.5">{usedIn.map((recipe) => renderRecipe(recipe, false))}</ul>
                </section>
              ) : null}

              {startItems.length > 0 ? (
                <section className="space-y-1.5 border-t border-edge pt-3">
                  <h3 className="text-xs font-medium text-dim">相关条目</h3>
                  <div className="flex flex-wrap gap-2">
                    {startItems.map((id) => {
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
                </section>
              ) : null}

              <p className="border-t border-edge pt-3 text-[11px] leading-relaxed text-dim">
                {open.note ? `${open.note}　` : ''}
                数值按当前联机版整理，游戏更新后可能变动；发现对不上的地方欢迎在博客里告诉我。
              </p>
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
                  placeholder="搜索：中文 / 拼音 / 首字母 / 英文（如 金斧头、jinfutou、jft）"
                  aria-label="搜索 Wiki 条目"
                  className="min-w-[9rem] flex-1 rounded border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {query !== '' ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="shrink-0 rounded border border-edge px-2 py-1.5 text-xs text-dim hover:bg-hover"
                  >
                    清除
                  </button>
                ) : null}
                <span className="shrink-0 text-xs text-dim">
                  {keyword === '' ? `共 ${shown.length} 条` : `找到 ${shown.length} 条`}
                </span>
              </div>

              <p className="text-[11px] text-dim">
                {pinyinReady
                  ? '拼音检索已就绪：可以打全拼（jinfutou）或首字母（jft）'
                  : '拼音检索准备中…中文 / 英文 / 别名现在就能搜'}
              </p>

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
                        {entry.en ? <span className="text-xs text-dim">{entry.en}</span> : null}
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

        {/* ── 右栏：当前条目的关键数值与配方，没有就显示统计 ── */}
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

          {madeBy.length > 0 ? (
            <section className="rounded-lg border border-edge bg-surface-2 p-2.5">
              <h3 className="mb-1.5 px-1 text-xs font-medium text-dim">材料清单</h3>
              <ul className="space-y-1 px-1 text-xs">
                {madeBy[0].ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="flex justify-between gap-2">
                    <span className="text-dim">{entryName(ingredient.id)}</span>
                    <span className="text-ink">×{ingredient.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 px-1 text-[11px] text-dim">{stationName(madeBy[0].station)}</p>
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
              <div className="flex justify-between gap-2">
                <dt className="text-dim">配方</dt>
                <dd className="text-ink">{RECIPES.length} 条</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
      ) : null}
    </div>
  )
}

export default DstWikiContent
