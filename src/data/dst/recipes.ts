import type { DsRecipe } from '../../lib/dst/types'

/**
 * 配方表。
 *
 * 这是「这个物品怎么做出来」与「这个材料用在哪」两个反查的**唯一数据源** ——
 * 条目里不再重复写材料，展示时用 index.ts 的 recipesFor / recipesUsing 去算。
 *
 * 同名材料在不同版本里数量会调整（例如木甲早期是 8 木 2 绳），
 * 这里按当前联机版的常规值记录；改动时优先改这里，条目里的 facts 不要跟着抄一遍。
 */
export const RECIPES: DsRecipe[] = [
  /* ── 工具 ── */
  { output: 'axe', station: 'none', ingredients: [{ id: 'twigs', count: 1 }, { id: 'flint', count: 1 }] },
  {
    output: 'golden-axe',
    station: 'science',
    ingredients: [{ id: 'gold-nugget', count: 2 }, { id: 'twigs', count: 4 }],
  },
  {
    output: 'golden-pickaxe',
    station: 'science',
    ingredients: [{ id: 'gold-nugget', count: 2 }, { id: 'twigs', count: 4 }],
  },
  {
    output: 'boards',
    station: 'science',
    ingredients: [{ id: 'logs', count: 4 }],
  },
  { output: 'pickaxe', station: 'none', ingredients: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }] },
  {
    output: 'shovel',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 2 }, { id: 'flint', count: 2 }],
  },
  {
    output: 'hammer',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 3 }, { id: 'rocks', count: 3 }, { id: 'cut-grass', count: 3 }],
  },
  {
    output: 'rope',
    station: 'science',
    ingredients: [{ id: 'cut-grass', count: 3 }],
  },
  {
    output: 'bug-net',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 4 }, { id: 'silk', count: 2 }, { id: 'rope', count: 1 }],
  },
  {
    output: 'fishing-rod',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 2 }, { id: 'rope', count: 2 }],
  },
  {
    output: 'tooth-trap',
    station: 'science',
    ingredients: [{ id: 'houndstooth', count: 1 }, { id: 'logs', count: 1 }, { id: 'rope', count: 1 }],
  },

  /* ── 照明 ── */
  { output: 'torch', station: 'none', ingredients: [{ id: 'cut-grass', count: 2 }, { id: 'twigs', count: 2 }] },
  { output: 'campfire', station: 'none', ingredients: [{ id: 'cut-grass', count: 3 }, { id: 'logs', count: 2 }] },
  {
    output: 'fire-pit',
    station: 'science',
    ingredients: [{ id: 'rocks', count: 12 }, { id: 'logs', count: 2 }],
  },
  {
    output: 'miner-hat',
    station: 'alchemy',
    ingredients: [{ id: 'straw-hat', count: 1 }, { id: 'gold-nugget', count: 1 }, { id: 'fireflies', count: 1 }],
  },
  {
    output: 'lantern',
    station: 'alchemy',
    ingredients: [{ id: 'twigs', count: 2 }, { id: 'rope', count: 3 }, { id: 'fireflies', count: 2 }],
  },
  {
    output: 'night-light',
    station: 'shadow',
    ingredients: [{ id: 'nightmare-fuel', count: 8 }, { id: 'living-log', count: 1 }],
  },

  /* ── 武器 ── */
  {
    output: 'spear',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 2 }, { id: 'rope', count: 1 }, { id: 'flint', count: 1 }],
  },
  {
    output: 'ham-bat',
    station: 'alchemy',
    ingredients: [{ id: 'pigskin', count: 2 }, { id: 'rope', count: 1 }, { id: 'monster-meat', count: 2 }],
    note: '会随时间腐烂，新鲜时伤害最高',
  },
  {
    output: 'night-sword',
    station: 'shadow',
    ingredients: [{ id: 'nightmare-fuel', count: 5 }, { id: 'living-log', count: 1 }],
    note: '持有时持续掉理智',
  },
  {
    output: 'shadow-sword',
    station: 'shadow',
    ingredients: [{ id: 'nightmare-fuel', count: 5 }, { id: 'living-log', count: 1 }],
    note: '与暗夜之剑同档，持有时持续掉理智',
  },
  {
    output: 'morning-star',
    station: 'alchemy',
    ingredients: [{ id: 'gold-nugget', count: 1 }, { id: 'gears', count: 2 }, { id: 'nitre', count: 2 }],
    note: '对潮湿目标伤害翻倍',
  },

  /* ── 护甲与衣物 ── */
  {
    output: 'grass-armor',
    station: 'none',
    ingredients: [{ id: 'cut-grass', count: 10 }, { id: 'twigs', count: 2 }],
  },
  {
    output: 'wood-armor',
    station: 'science',
    ingredients: [{ id: 'logs', count: 8 }, { id: 'rope', count: 2 }],
  },
  {
    output: 'football-helmet',
    station: 'alchemy',
    ingredients: [{ id: 'pigskin', count: 1 }, { id: 'rope', count: 1 }],
  },
  {
    output: 'straw-hat',
    station: 'science',
    ingredients: [{ id: 'cut-grass', count: 12 }],
  },
  {
    output: 'umbrella',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 6 }, { id: 'silk', count: 2 }, { id: 'pigskin', count: 1 }],
  },
  {
    output: 'thermal-stone',
    station: 'alchemy',
    ingredients: [{ id: 'rocks', count: 10 }, { id: 'pickaxe', count: 1 }, { id: 'flint', count: 3 }],
  },
  {
    output: 'eyebrella',
    station: 'alchemy',
    ingredients: [{ id: 'deerclops-eye', count: 1 }, { id: 'twigs', count: 15 }],
    note: '防雨效果全游戏最强',
  },
  {
    output: 'ice-box',
    station: 'alchemy',
    ingredients: [{ id: 'gears', count: 2 }, { id: 'gold-nugget', count: 1 }, { id: 'rocks', count: 1 }],
  },
  {
    output: 'shadow-armor',
    station: 'shadow',
    ingredients: [{ id: 'nightmare-fuel', count: 5 }, { id: 'living-log', count: 3 }],
    note: '穿着时持续掉理智',
  },

  /* ── 科技 ── */
  {
    output: 'science-machine',
    station: 'none',
    ingredients: [{ id: 'logs', count: 4 }, { id: 'rocks', count: 4 }, { id: 'gold-nugget', count: 1 }],
  },
  {
    output: 'alchemy-engine',
    station: 'science',
    ingredients: [{ id: 'logs', count: 6 }, { id: 'rocks', count: 4 }, { id: 'gold-nugget', count: 2 }],
  },
  {
    output: 'healing-salve',
    station: 'science',
    ingredients: [{ id: 'honey', count: 1 }, { id: 'rocks', count: 2 }],
    note: '另有一条用蜘蛛腺体的路线，效果相近',
  },

  /* ── 烹饪 ── */
  {
    output: 'crockpot',
    station: 'science',
    ingredients: [{ id: 'twigs', count: 6 }, { id: 'charcoal', count: 6 }, { id: 'cut-grass', count: 6 }],
  },
  {
    output: 'meatballs',
    station: 'cooking',
    ingredients: [{ id: 'monster-meat', count: 1 }, { id: 'berries', count: 3 }],
    note: '通用公式：任意肉 ×1 + 任意填充 ×3；这里给的是最省的做法',
  },
  {
    output: 'meaty-stew',
    station: 'cooking',
    ingredients: [{ id: 'monster-meat', count: 3 }, { id: 'berries', count: 1 }],
    note: '要求肉度 ≥ 3，肉不够会变成肉丸',
  },
  {
    output: 'honey-ham',
    station: 'cooking',
    ingredients: [{ id: 'monster-meat', count: 2 }, { id: 'honey', count: 1 }, { id: 'berries', count: 1 }],
    note: '要求肉度 ≥ 2 且含蜂蜜',
  },
  {
    output: 'taffy',
    station: 'cooking',
    ingredients: [{ id: 'honey', count: 3 }, { id: 'berries', count: 1 }],
  },
  {
    output: 'dragonpie',
    station: 'cooking',
    ingredients: [{ id: 'dragonfruit', count: 1 }, { id: 'berries', count: 3 }],
    note: '填充物不能是肉',
  },
]