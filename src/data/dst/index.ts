/**
 * 饥荒联机版（Don't Starve Together）Wiki 的数据。
 *
 * ⚠️ 归属：`src/data/dst/` 与 `src/components/program/DstWikiWindow.tsx` 归「wiki 窗口负责人」维护；
 * 窗口外壳、任务栏、主题令牌、路由都由主管维护（见 AGENTS.md 的「分工」一节）。
 *
 * 约定：
 * - 纯数据，不要在这里 import React 或做副作用
 * - 正文用「段落数组」而不是 markdown：markdown 渲染器有 100+ KB，wiki 窗口不该背上它
 * - 数值类信息放 facts，渲染成键值对，比塞进正文更好扫
 *
 * 这个文件负责**契约与装配**：类型、分类表、配方关系反查；具体条目按分类拆在
 * `characters.ts` / `items.ts` / `creatures.ts` / `world.ts`，配方在 `recipes.ts`。
 * 拆开的理由：条目会持续变多，全塞一个文件既难 diff 也容易和并行改动撞车。
 */

import { CHARACTERS } from './characters'
import { CREATURES } from './creatures'
import { ITEMS } from './items'
import { RECIPES } from './recipes'
import { WORLD } from './world'

/** 配方里的一项材料（或产出） */
export interface DstIngredient {
  /** 对应某个 DstEntry.id */
  id: string
  count: number
}

/** 配方：一个产出 + 若干材料。产出也可能是「站台」类条目（营火、科学机器） */
export interface DstRecipe {
  /** 产出条目 id */
  output: string
  /** 产出数量，不写 = 1 */
  count?: number
  /** 材料 */
  ingredients: DstIngredient[]
  /** 制作站台的中文名，如「科学机器」「炼金引擎」「随时可做」 */
  station: string
  /** 补充说明，如「需要先在科学机器旁解锁」 */
  note?: string
}

export interface DstEntry {
  /** 稳定 id，用作 React key；改了等于换条目。只用小写英文与连字符 */
  id: string
  /** 中文名 */
  name: string
  /** 英文名，便于和官方 wiki 对照 */
  en?: string
  /** 分类 id，取值见 DST_CATEGORIES */
  category: string
  /** 一句话摘要，列表里显示 */
  summary: string
  /** 正文，按段落拆开 */
  body: string[]
  /** 关键数值 / 标签，例如「生命 150」 */
  facts?: Array<{ label: string; value: string }>
  /**
   * 其它常见叫法：俗称、旧译名、错别字、英文缩写。
   * **直接喂给搜索**（含拼音首字母），所以要写「玩家真的会打进去的词」，
   * 不要把摘要再抄一遍 —— 摘要本来就在索引里。
   */
  aliases?: string[]
  /** 物品栏 / 小节分组，用于左栏二级筛选（如「武器」「护甲」） */
  group?: string
  /** 相关条目 id */
  related?: string[]
}

export interface DstCategory {
  id: string
  name: string
  /** 一句话说明 */
  hint?: string
}

/** 分类：顺序即左栏展示顺序 */
export const DST_CATEGORIES: DstCategory[] = [
  { id: 'character', name: '角色', hint: '可用人物与特性' },
  { id: 'creature', name: '生物', hint: '敌对 / 中立生物' },
  { id: 'item', name: '物品', hint: '工具、装备与材料' },
  { id: 'food', name: '料理', hint: '食物与配方' },
  { id: 'world', name: '世界', hint: '季节、地形与机制' },
]

/**
 * 全部条目。
 *
 * 数值一律按游戏内原始单位。**拿不准的宁可留空或写进正文说明，也不要填一个看起来像真的错数** ——
 * 这个站的定位是「查得到、可以信」，一条错数值比缺一条更伤。
 */
export const DST_ENTRIES: DstEntry[] = [
  ...CHARACTERS,
  ...CREATURES,
  ...ITEMS,
  ...WORLD,
]

/* ───────────── 配方关系反查 ─────────────
   引用只存 id（见各条目），展示时用下面这两个 Map 反查。
   这样「这个物品被哪些配方用到」「它是怎么做出来的」都是算出来的，
   不需要在条目里手写第二份 —— 手写的那份一定会和配方表对不上。 */

const BY_ID = new Map(DST_ENTRIES.map((entry) => [entry.id, entry]))

const RECIPES_BY_OUTPUT = new Map<string, DstRecipe[]>()
const RECIPES_USING = new Map<string, DstRecipe[]>()

for (const recipe of RECIPES) {
  const made = RECIPES_BY_OUTPUT.get(recipe.output)
  if (made) made.push(recipe)
  else RECIPES_BY_OUTPUT.set(recipe.output, [recipe])

  for (const ingredient of recipe.ingredients) {
    const used = RECIPES_USING.get(ingredient.id)
    if (used) used.push(recipe)
    else RECIPES_USING.set(ingredient.id, [recipe])
  }
}

export function findEntry(id: string): DstEntry | undefined {
  return BY_ID.get(id)
}

/** 某个 id 显示成什么名字；查不到就退回 id，不会渲染出空白 */
export function entryName(id: string): string {
  return BY_ID.get(id)?.name ?? id
}

/** 怎么做出来（可能有多条，例如同一种材料的不同配方） */
export function recipesFor(id: string): DstRecipe[] {
  return RECIPES_BY_OUTPUT.get(id) ?? []
}

/** 被用在哪些配方里 */
export function recipesUsing(id: string): DstRecipe[] {
  return RECIPES_USING.get(id) ?? []
}

/** 全部配方（只读用） */
export { RECIPES }

/** 一个条目的可搜索文本：名字 + 英文名 + 别名 + 摘要 + 正文 + facts。
    索引与查询必须走同一套归一化（见 DstWikiWindow 里的 normalize）。 */
export function searchableText(entry: DstEntry): string {
  return [
    entry.name,
    entry.en ?? '',
    ...(entry.aliases ?? []),
    entry.summary,
    ...entry.body,
    ...(entry.facts ?? []).map((fact) => `${fact.label} ${fact.value}`),
  ].join(' ')
}
