/**
 * 饥荒联机版（Don't Starve Together）Wiki 的数据入口（**唯一入口**）。
 *
 * ⚠️ 归属：`src/data/dst/**`、`src/lib/dst/**`、`src/components/program/DstWikiWindow.tsx`
 * 归「wiki 窗口负责人」维护；窗口外壳、任务栏、主题令牌、路由归主管（见 AGENTS.md 的「分工」一节）。
 *
 * 约定：
 * - 纯数据，不要在这里 import React 或做副作用
 * - 正文用「段落数组」而不是 markdown：markdown 渲染器有 100+ KB，wiki 窗口不该背上它
 * - 数值类信息放 facts，渲染成键值对，比塞进正文更好扫
 * - 类型契约只有一份，在 `src/lib/dst/types.ts`；这里**只做装配与反查**
 *
 * 条目按分类拆在 characters / creatures / items / world，配方在 recipes：
 * 全塞一个文件既难 diff，也容易和并行改动撞车。
 */

import { CHARACTERS } from './characters'
import { CREATURES } from './creatures'
import { ITEMS } from './items'
import { RECIPES } from './recipes'
import { WORLD } from './world'
import type { DsCategory, DsEntry, DsRecipe } from '../../lib/dst/types'

export type {
  DsBundle,
  DsCategory,
  DsCharacter,
  DsCreature,
  DsEntry,
  DsItem,
  DsKind,
  DsRecipe,
  DsSection,
  DsStat,
  DsStation,
  DsWorld,
} from '../../lib/dst/types'

export { DS_CATEGORIES, STATION_NAME, isCharacter, isCreature, isItem } from '../../lib/dst/types'

/* 兼容别名：组件与 AGENTS.md 里用的是 DstEntry / DstRecipe 这套名字，
   契约本体在 lib/dst/types.ts 里叫 DsEntry / DsRecipe。两个名字指向同一个类型。 */
export type DstEntry = DsEntry
export type DstRecipe = DsRecipe
export type DstCategory = DsCategory

/** 分类：顺序即左栏展示顺序（与 lib/dst/types.ts 的 DS_CATEGORIES 保持一致） */
export const DST_CATEGORIES: DsCategory[] = [
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
const ALL: DsEntry[] = [...CHARACTERS, ...CREATURES, ...ITEMS, ...WORLD]

/* 按 id 去重：四条数据文件分开维护，可能同时写同一个条目（已经发生过一次：
   蜂后既被放进 items.ts 又被放进 creatures.ts）。**先出现的赢**，所以顺序是
   角色 → 生物 → 物品 → 世界：越靠前的内容越完整，后面的重复项会被丢掉。 */
const UNIQUE = new Map<string, DsEntry>()
for (const entry of ALL) if (!UNIQUE.has(entry.id)) UNIQUE.set(entry.id, entry)

export const DST_ENTRIES: DsEntry[] = [...UNIQUE.values()]

/* ───────────── 配方关系反查 ─────────────
   引用只存 id，展示时用下面这两个 Map 反查。
   这样「这个物品被哪些配方用到」「它是怎么做出来的」都是算出来的，
   不需要在条目里手写第二份 —— 手写的那份一定会和配方表对不上。 */

const BY_ID = new Map(DST_ENTRIES.map((entry) => [entry.id, entry]))

const RECIPES_BY_OUTPUT = new Map<string, DsRecipe[]>()
const RECIPES_USING = new Map<string, DsRecipe[]>()

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

export function findEntry(id: string): DsEntry | undefined {
  return BY_ID.get(id)
}

/** 某个 id 显示成什么名字；查不到就退回 id，不会渲染出空白 */
export function entryName(id: string): string {
  return BY_ID.get(id)?.name ?? id
}

/** 怎么做出来（可能有多条，例如同一种材料的不同配方） */
export function recipesFor(id: string): DsRecipe[] {
  return RECIPES_BY_OUTPUT.get(id) ?? []
}

/** 被用在哪些配方里 */
export function recipesUsing(id: string): DsRecipe[] {
  return RECIPES_USING.get(id) ?? []
}

export { RECIPES }

/** 一个条目的可搜索文本：名字 + 英文名 + 别名 + 摘要 + 正文 + facts。
    索引与查询必须走同一套归一化（见 DstWikiWindow 里的 normalize）。 */
export function searchableText(entry: DsEntry): string {
  return [
    entry.name,
    entry.en ?? '',
    ...(entry.aliases ?? []),
    entry.summary,
    ...entry.body,
    ...(entry.facts ?? []).map((fact) => fact.label + ' ' + fact.value),
    ...(entry.related ?? []).map((id) => entryName(id)),
  ].join(' ')
}