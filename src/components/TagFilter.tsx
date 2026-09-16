/**
 * 标签系统：分类切换（全部 / daily / project）+ 多标签筛选（点击增删，与语义）。
 */
import { useMemo } from 'react'
import { CATEGORY_DAILY, CATEGORY_PROJECT, type Category } from '../lib/github'

export interface TagFilterProps {
  tags: Array<{ name: string; count: number }>
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
  category: Category | 'all'
  onCategoryChange: (category: Category | 'all') => void
}

const CATEGORY_ITEMS: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: CATEGORY_DAILY, label: '日常' },
  { value: CATEGORY_PROJECT, label: '项目' },
]

export function TagFilter({
  tags,
  selected,
  onToggle,
  onClear,
  category,
  onCategoryChange,
}: TagFilterProps) {
  const hasSelection = selected.length > 0
  const visible = useMemo(() => tags.slice(0, 24), [tags])

  return (
    <section className="space-y-3" aria-label="筛选">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-caramel-200 bg-caramel-100 p-0.5 dark:border-caramel-700 dark:bg-caramel-800">
          {CATEGORY_ITEMS.map((item) => {
            const active = category === item.value
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => onCategoryChange(item.value)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  active
                    ? 'bg-caramel-500 text-caramel-50 shadow-sm'
                    : 'text-caramel-700 hover:bg-caramel-200 dark:text-caramel-200 dark:hover:bg-caramel-700'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {hasSelection && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-dashed border-caramel-400 px-3 py-1 text-xs text-caramel-600 transition hover:bg-caramel-100 dark:text-caramel-300 dark:hover:bg-caramel-800"
          >
            清除筛选（{selected.length}）
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {visible.map(({ name, count }) => {
            const active = selected.includes(name)
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(name)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-caramel-500 bg-caramel-500 text-caramel-50'
                      : 'border-caramel-200 bg-caramel-100 text-caramel-700 hover:border-caramel-400 hover:bg-caramel-200 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-200 dark:hover:border-caramel-500'
                  }`}
                >
                  #{name}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
