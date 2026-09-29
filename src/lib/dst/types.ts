/**
 * 饥荒 Wiki 的数据契约。
 *
 * 设计原则（改数据前先读这段）：
 * 1. **id 用稳定 slug，永远不用中文名**。中文名放 name，常见叫法 / 错别字 / 英文缩写放 aliases。
 *    中文译名会变（「薇克伯顿 / 薇克巴顿」都有人写），改了名不该断掉别人收藏的链接。
 * 2. **引用只存 id**（配方材料、掉落物…），展示时反查。于是「这个物品被哪些配方用到」
 *    可以自动算出来，不需要手写 —— 手写的那份一定会腐坏。
 * 3. 数值一律按「游戏内原始单位」。攻击力写成玩家伤害而不是「多少下打死」，换算交给 UI。
 * 4. 拿不准的数值宁可留空（字段可选），也不要填一个看起来像真的错数。
 */

/** 条目大类：决定进哪个分栏、用哪种详情模板 */
export type DsKind = 'character' | 'item' | 'creature'

/** 分类导航用的小节（比 kind 细一层，直接决定左栏怎么分组） */
export type DsSection =
  | 'survivor'
  | 'material'
  | 'tool'
  | 'light'
  | 'weapon'
  | 'armor'
  | 'food'
  | 'cook'
  | 'magic'

/** 制作站台：决定配方归属哪一档（对应游戏里的制作栏解锁顺序） */
export type DsStation =
  | 'none'
  | 'science'
  | 'alchemy'
  | 'shadow'
  | 'lunar'
  | 'ancient'
  | 'seafaring'
  | 'cartography'
  | 'cooking'

/** 一条数值展示（详情页的「属性」表就是这些的数组） */
export interface DsStat {
  label: string
  /** 展示用文本，已带单位（如 "43"、"10 天"、"0.5"） */
  value: string
  /** 可选补充说明，鼠标悬停或小字显示 */
  hint?: string
}

/** 所有条目共有的字段 */
export interface DsEntryBase {
  id: string
  kind: DsKind
  section: DsSection
  /** 中文名（主名） */
  name: string
  /** 英文名，搜索结果与别名都用得上 */
  enName?: string
  /** 其它常见叫法：俗称、旧译名、错别字、英文缩写 —— 直接喂给搜索 */
  aliases?: string[]
  /** 非结构化补充说明；表格与短句，不要写成攻略长文 */
  description?: string
  /** 可展示的要点（角色是「特性」，物品是「用途」） */
  notes?: string[]
  /** 数据出处说明，如「游戏脚本 tuning.lua」 */
  source?: string
  /** 数据对应的游戏版本或核对日期 */
  updatedAt?: string
  /** 详情页属性表 */
  stats?: DsStat[]
}

/** 角色 */
export interface DsCharacter extends DsEntryBase {
  kind: 'character'
  section: 'survivor'
  /** 生命上限 */
  health: number
  /** 饥饿上限 */
  hunger: number
  /** 理智上限 */
  sanity: number
  /** 一句话定位，列表卡片与详情页头部用 */
  role: string
  /** 上手难度 1~3 */
  difficulty: 1 | 2 | 3
  /** 特殊机制（生命 / 饥饿 / 理智之外的：变身、理智换算、专属道具…） */
  perks: string[]
  /** 解锁方式（DST 里多为「经验解锁」或「织影者购买」） */
  unlock?: string
  /** 开局自带物品的物品 id（引用 DsItem.id，展示时反查名字） */
  startItems?: string[]
}

/** 可堆叠 / 可使用物品 */
export interface DsItem extends DsEntryBase {
  kind: 'item'
  /** 堆叠上限；不写 = 不可堆叠 */
  stack?: number
  /** 耐久（使用次数或点数） */
  durability?: number
  /** 武器伤害（玩家攻击力） */
  damage?: number
  /** 护甲吸收率 0~1 */
  absorption?: number
  /** 食用后回复 */
  food?: { hunger?: number; sanity?: number; health?: number }
  /** 腐烂时间（游戏内秒）；负数表示「腐烂后变成 id」 */
  perish?: number
  /** 作为燃料的燃料值 */
  fuel?: number
  /** 保暖 / 降温 */
  insulation?: number
  /** 能否再生（可种植 / 可合成） */
  renewable?: boolean
  /** 获取方式（掉落、采集、合成…）的非配方说明 */
  obtain?: string
}

export type DsEntry = DsCharacter | DsItem

/** 一条配方：一个产出 + 若干材料 */
export interface DsRecipe {
  id: string
  /** 产出物品 id */
  output: string
  /** 产出数量，默认 1 */
  count?: number
  /** 材料：物品 id + 数量 */
  ingredients: Array<{ id: string; count: number }>
  /** 制作站台 */
  station: DsStation
  /** 分类（游戏里制作栏的那一列，如「工具」「照明」） */
  tab: string
  /** 补充说明，如「需要先在科学机器旁解锁」 */
  note?: string
}

/** 分类导航里的一项（左栏） */
export interface DsSectionDef {
  id: DsSection
  name: string
  /** 归到这一类下的条目 kind，用于筛数据 */
  kinds: DsKind[]
  hint: string
}

/** 站台的中文名与说明 */
export const STATIONS: Record<DsStation, { name: string; hint: string }> = {
  none: { name: '随时制作', hint: '不需要站台，背包里就能做' },
  science: { name: '科学机器', hint: '第二档解锁；原型机一次即可' },
  alchemy: { name: '炼金引擎', hint: '第三档解锁，需要金块' },
  shadow: { name: '暗影操纵者', hint: '魔法一档，需要活木与紫宝石' },
  lunar: { name: '月球祭坛', hint: '月亮阵营路线' },
  ancient: { name: '远古伪科学站', hint: '遗迹产物，需要铥矿' },
  seafaring: { name: '航海', hint: '船上一档' },
  cartography: { name: '制图', hint: '地图与罗盘' },
  cooking: { name: '烹饪锅 / 晾肉架', hint: '食物加工' },
}

/** 分类导航的登记表：顺序即左栏展示顺序 */
export const SECTIONS: DsSectionDef[] = [
  { id: 'survivor', name: '幸存者', kinds: ['character'], hint: '可选角色与属性' },
  { id: 'material', name: '基础材料', kinds: ['item'], hint: '草、木、石、金…' },
  { id: 'tool', name: '工具', kinds: ['item'], hint: '斧、镐、锤、铲' },
  { id: 'light', name: '照明', kinds: ['item'], hint: '火把、灯笼、营火' },
  { id: 'weapon', name: '武器', kinds: ['item'], hint: '长矛、火腿棒、晨星' },
  { id: 'armor', name: '护甲', kinds: ['item'], hint: '木甲、猪皮帽、蜂后帽' },
  { id: 'food', name: '食物', kinds: ['item'], hint: '采集与掉落物' },
  { id: 'cook', name: '料理', kinds: ['item'], hint: '烹饪锅产物' },
  { id: 'magic', name: '魔法与特殊', kinds: ['item'], hint: '需要特殊站台' },
]

export function isCharacter(entry: DsEntry): entry is DsCharacter {
  return entry.kind === 'character'
}

export function isItem(entry: DsEntry): entry is DsItem {
  return entry.kind === 'item'
}

/** 数据里出现的所有条目（各数据文件合并后由 lib/dst/index.ts 校验） */
export interface DsBundle {
  entries: DsEntry[]
  recipes: DsRecipe[]
}
