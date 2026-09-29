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
 */

export interface DstEntry {
  /** 稳定 id，用作 React key；改了等于换条目 */
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
 * 条目。现在只有几条**基础事实**用来把版式撑起来，
 * 细节与扩充由 wiki 窗口负责人来做（有疑问的数值宁可不写）。
 */
export const DST_ENTRIES: DstEntry[] = [
  {
    id: 'wilson',
    name: '威尔逊',
    en: 'Wilson',
    category: 'character',
    summary: '科学家，公认最好上手的角色：会长胡子，胡子能保暖、也能做复活肉像。',
    body: [
      '威尔逊是默认角色，三维均衡，没有明显短板，适合第一次玩联机版的人。',
      '他的专属能力是胡子：随着天数增长会越长越长，冬天能当保暖用，剃下来的胡子可以做复活肉像。',
    ],
    facts: [
      { label: '生命', value: '150' },
      { label: '理智', value: '200' },
      { label: '饥饿', value: '150' },
      { label: '专属', value: '胡子 / 复活肉像' },
    ],
    related: ['beefalo'],
  },
  {
    id: 'beefalo',
    name: '牛',
    en: 'Beefalo',
    category: 'creature',
    summary: '草原上的中立生物。剃毛得牛毛，喂够食物后可驯服成坐骑。',
    body: [
      '平时中立，被攻击或发情期会成群反击，前期不建议硬碰。',
      '可以剃毛拿牛毛（做保暖衣物），也可以持续喂食驯服成坐骑。',
    ],
    facts: [
      { label: '态度', value: '中立' },
      { label: '产出', value: '牛毛 / 粪便' },
      { label: '注意', value: '发情期主动攻击' },
    ],
    related: ['wilson'],
  },
  {
    id: 'chester',
    name: '切斯特',
    en: 'Chester',
    category: 'creature',
    summary: '会跟着玩家走的移动储物箱，用眼骨召唤。',
    body: [
      '把眼骨带在身上，切斯特就会一直跟着你，相当于一个随身箱子。',
      '联机版里它同样可以被升级形态替换，放东西进去比来回跑基地省事。',
    ],
    facts: [
      { label: '召唤', value: '眼骨' },
      { label: '作用', value: '移动储物' },
    ],
    related: [],
  },
]
