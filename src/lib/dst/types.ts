/**
 * 饥荒 Wiki 的数据契约（**唯一一份**）。
 *
 * 为什么放在 `src/lib/dst/` 而不是和数据挤在一起：
 * 数据文件（`src/data/dst/*.ts`）要 import 这些类型，窗口组件也要 import；
 * 类型单独一个文件，谁都不会因为「引了别人的数据文件」而多打一个 chunk。
 *
 * 设计原则（改数据前先读这段）：
 * 1. **id 用稳定 slug，永远不用中文名**。中文名放 name，常见叫法 / 错别字 / 英文缩写放 aliases。
 *    中文译名会变（「薇克伯顿 / 薇克巴顿」都有人写），改了名不该断掉链接。
 * 2. **引用只存 id**（配方材料、掉落物…），展示时反查。于是「这个物品被哪些配方用到」
 *    是算出来的，不需要手写第二份 —— 手写的那份一定会腐坏。
 * 3. 数值一律按「游戏内原始单位」。攻击力写成玩家伤害，而不是「多少下打死」；换算交给 UI。
 * 4. 拿不准的数值宁可留空（字段可选），也不要填一个看起来像真的错数。
 */

/** 条目大类：与 src/data/dst/index.ts 的 DST_CATEGORIES 的 id 一一对应 */
export type DsKind = 'character' | 'creature' | 'item' | 'food' | 'world'

/** 物品 / 食物的小节分组，用于左栏二级筛选 */
export type DsSection =
  | 'material'
  | 'tool'
  | 'light'
  | 'weapon'
  | 'armor'
  | 'clothes'
  | 'magic'
  | 'food'
  | 'cook'

/** 制作站台：决定配方归属哪一档 */
export type DsStation =
  | 'none'
  | 'science'
  | 'alchemy'
  | 'shadow'
  | 'lunar'
  | 'ancient'
  | 'seafaring'
  | 'cooking'

/** 站台中文名（配方表与词条共用，避免同一句话写两遍） */
export const STATION_NAME: Record<DsStation, string> = {
  none: '随时可做',
  science: '科学机器',
  alchemy: '炼金引擎',
  shadow: '暗影操纵者',
  lunar: '月亮祭坛',
  ancient: '远古伪科学站',
  seafaring: '航海',
  cooking: '烹饪锅',
}

/** 一条数值展示（右栏「关键数值」就是这些） */
export interface DsStat {
  label: string
  /** 展示用文本，已带单位（如 "43"、"10 天"、"25%"） */
  value: string
}

/** 所有条目共有的字段 —— 与组件消费的形状保持一致 */
export interface DsEntryBase {
  /** 稳定 id，只用小写英文与连字符；改了等于换条目 */
  id: string
  /** 中文名 */
  name: string
  /** 英文名，便于和官方 wiki 对照 */
  en?: string
  /** 分类 id，取值见 DST_CATEGORIES */
  category: string
  /** 一句话摘要，列表里显示 */
  summary: string
  /** 正文，按段落拆开（不引 markdown 渲染器） */
  body: string[]
  /** 关键数值 / 标签，渲染成键值对 */
  facts?: DsStat[]
  /** 其它常见叫法：俗称、旧译名、错别字、英文缩写。直接喂给搜索（含拼音首字母） */
  aliases?: string[]
  /** 物品 / 食物的小节分组 */
  section?: DsSection
  /** 相关条目 id */
  related?: string[]
  /** 数据来源 / 版本标注，显示在详情页底部，提醒读者「数值可能随版本变动」 */
  note?: string
}

/**
 * 条目的**判别字段是 `category`**，不是 `kind`。
 *
 * 窗口组件按 category 分栏、按 name/en/summary/body/facts 渲染，
 * 它不需要（也不该需要）知道具体是角色还是物品；所以这些细分类型全部是可选的补充形状，
 * 数据文件只写自己有的字段即可 —— 少写一个 kind 不会炸构建。
 */
export type DsEntry = DsEntryBase

/** 角色形状：在条目基础上多出三维与特性 */
export interface DsCharacter extends DsEntryBase {
  kind?: 'character'
  health: number
  hunger: number
  sanity: number
  /** 上手难度 1~3 */
  difficulty: 1 | 2 | 3
  /** 特殊机制（一句话一条） */
  perks: string[]
  /** 开局自带的物品 id（引用物品条目的 id） */
  startItems?: string[]
}

/** 物品 / 食物形状 */
export interface DsItem extends DsEntryBase {
  kind?: 'item' | 'food'
  /** 堆叠上限 */
  stack?: number
  /** 耐久（使用次数或点数） */
  durability?: number
  /** 武器伤害 */
  damage?: number
  /** 护甲吸收率 0~1 */
  absorb?: number
  /** 食用回复 */
  food?: { hunger?: number; sanity?: number; health?: number }
  /** 作为燃料的燃料值 */
  fuel?: number
  /** 保暖 / 降温值 */
  insulation?: number
  /** 获取方式（非配方的来源） */
  obtain?: string
}

/** 生物形状 */
export interface DsCreature extends DsEntryBase {
  kind?: 'creature'
  health?: number
  damage?: number
  attackPeriod?: number
  /** 态度：敌对 / 中立 / 被动 */
  attitude?: 'hostile' | 'neutral' | 'passive'
  /** 掉落物 */
  drops?: Array<{ id: string; chance?: number }>
}

/** 世界 / 机制条目：纯文字 */
export interface DsWorld extends DsEntryBase {
  kind?: 'world'
}

/** 分类导航的一项 */
export interface DsCategory {
  id: string
  name: string
  hint?: string
}

/** 分类：顺序即左栏展示顺序（与 src/data/dst/index.ts 的 DST_CATEGORIES 保持一致） */
export const DS_CATEGORIES: DsCategory[] = [
  { id: 'character', name: '角色', hint: '可用人物与特性' },
  { id: 'creature', name: '生物', hint: '敌对 / 中立生物' },
  { id: 'item', name: '物品', hint: '工具、装备与材料' },
  { id: 'food', name: '料理', hint: '食物与配方' },
  { id: 'world', name: '世界', hint: '季节、地形与机制' },
]

/** 一条配方：一个产出 + 若干材料 */
export interface DsRecipe {
  /** 产出条目 id */
  output: string
  /** 产出数量，不写 = 1 */
  count?: number
  /** 材料：条目 id + 数量 */
  ingredients: Array<{ id: string; count: number }>
  /** 制作站台 */
  station: DsStation
  /** 补充说明 */
  note?: string
}

/* 判别一律走 category：它是必填字段，kind 只是可选的补充标记 */

export function isCharacter(entry: DsEntry): entry is DsCharacter {
  return entry.category === 'character'
}

export function isItem(entry: DsEntry): entry is DsItem {
  return entry.category === 'item' || entry.category === 'food'
}

export function isCreature(entry: DsEntry): entry is DsCreature {
  return entry.category === 'creature'
}
/** 全部数据打包（入口 index.ts 导出这个，需要一次性拿到全部条目时用） */
export interface DsBundle {
  entries: DsEntry[]
  recipes: DsRecipe[]
}
/** 全部数据打包 */
export interface DsBundle {
  entries: DsEntry[]
  recipes: DsRecipe[]
}