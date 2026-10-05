import type { AppDef } from '../types/desktop'
import { visibleApps } from './apps'

/* 「芹菜耕地」的菜：48 张插画 + 中英对照表。
   画在设计负责人的 `design/veggies/*.svg`（viewBox 64、平涂 + 同色系深色描边），
   这里只做登记与查表 —— **别在这里手写图形**，改画去 design 目录。

   两件事要分清：
   - **应用图标**（`components/icons/`）画的是功能，不画菜
   - **菜图**是身份层：出现在「所有项目」、关于窗口的菜谱里，跟窗口一一对应
     （`AppDef.veggie` 存的就是中文菜名，两边靠这张表对上）

   ⚠️ 用 `import.meta.glob` 一次性收进 48 个地址。
   `vite.config.ts` 里有一条 `assetsInlineLimit` 规则把这批 SVG **排除在内联之外** ——
   内联会把 48 张图变成一大串 data URI 折进主包（实测首屏 gzip 101 → 111 KB），
   而它们是按需出现的（菜单 11 张、关于窗口 49 张），发成独立文件只多 2.6 KB。 */
const FILES = import.meta.glob('../../design/veggies/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type VeggieGroup = 'dish' | 'veg' | 'fruit' | 'plant'

export interface VeggieDef {
  /** 文件名（design/veggies/<id>.svg） */
  id: string
  /** 中文菜名 */
  name: string
  group: VeggieGroup
  /** 图片地址（构建产物里的 hash 名或 data URI） */
  src: string
}

const GROUP_LABEL: Record<VeggieGroup, string> = {
  dish: '站里的菜',
  veg: '蔬菜',
  fruit: '水果',
  plant: '植物',
}

/** 登记表：[文件名, 中文名, 分组]；顺序就是预览页里的顺序 */
const LIST: Array<[string, string, VeggieGroup]> = [
  /* 一、站里的 11 样菜（与窗口一一对应，顺序按 apps.ts 排） */
  ['potato', '土豆', 'dish'],
  ['pumpkin', '南瓜', 'dish'],
  ['corn', '玉米', 'dish'],
  ['tomato', '番茄', 'dish'],
  ['bamboo-shoot', '竹笋', 'dish'],
  ['grape', '葡萄', 'dish'],
  ['chili', '辣椒', 'dish'],
  ['peanut', '花生', 'dish'],
  ['garlic', '大蒜', 'dish'],
  ['onion', '洋葱', 'dish'],
  ['celery', '芹菜', 'dish'],
  /* 二、蔬菜 */
  ['carrot', '胡萝卜', 'veg'],
  ['eggplant', '茄子', 'veg'],
  ['cabbage', '白菜', 'veg'],
  ['cucumber', '黄瓜', 'veg'],
  ['daikon', '白萝卜', 'veg'],
  ['spinach', '菠菜', 'veg'],
  ['peas', '豌豆', 'veg'],
  ['bell-pepper', '青椒', 'veg'],
  ['ginger', '姜', 'veg'],
  ['sweet-potato', '红薯', 'veg'],
  ['mushroom', '蘑菇', 'veg'],
  ['broccoli', '西兰花', 'veg'],
  /* 三、水果 */
  ['apple', '苹果', 'fruit'],
  ['banana', '香蕉', 'fruit'],
  ['orange', '橙子', 'fruit'],
  ['strawberry', '草莓', 'fruit'],
  ['watermelon', '西瓜', 'fruit'],
  ['pear', '梨', 'fruit'],
  ['lemon', '柠檬', 'fruit'],
  ['peach', '桃子', 'fruit'],
  ['cherry', '樱桃', 'fruit'],
  ['pineapple', '菠萝', 'fruit'],
  ['mango', '芒果', 'fruit'],
  ['kiwi', '猕猴桃', 'fruit'],
  ['blueberry', '蓝莓', 'fruit'],
  ['pomegranate', '石榴', 'fruit'],
  ['persimmon', '柿子', 'fruit'],
  ['lychee', '荔枝', 'fruit'],
  ['dragon-fruit', '火龙果', 'fruit'],
  /* 四、植物 */
  ['bamboo', '竹子', 'plant'],
  ['cactus', '仙人掌', 'plant'],
  ['sunflower', '向日葵', 'plant'],
  ['clover', '三叶草', 'plant'],
  ['dandelion', '蒲公英', 'plant'],
  ['fern', '蕨', 'plant'],
  ['aloe', '芦荟', 'plant'],
  ['sapling', '小树苗', 'plant'],
]

export const VEGGIES: VeggieDef[] = LIST.flatMap(([id, name, group]) => {
  const src = FILES[`../../design/veggies/${id}.svg`]
  /* 图缺了就整条丢掉：宁可少一张菜图，也别渲染一个裂图 */
  return src ? [{ id, name, group, src }] : []
})

const BY_NAME = new Map(VEGGIES.map((v) => [v.name, v]))

/** 中文菜名 → 菜图（`AppDef.veggie` 就是中文名） */
export function veggieOfName(name: string): VeggieDef | undefined {
  return BY_NAME.get(name)
}

export function veggieGroupLabel(group: VeggieGroup): string {
  return GROUP_LABEL[group]
}

export interface DishRow {
  app: AppDef
  veggie: VeggieDef | undefined
}

/** 站里那 11 样菜：从窗口登记表反查（顺序就是任务栏顺序），不另存一份对应关系 */
export function dishRows(): DishRow[] {
  return visibleApps().map((app) => ({ app, veggie: veggieOfName(app.veggie) }))
}

/** 其余的菜（备着：以后加窗口、或别处要配图时用） */
export function otherVeggies(): VeggieDef[] {
  const used = new Set(dishRows().map((row) => row.veggie?.id))
  return VEGGIES.filter((v) => !used.has(v.id))
}
