import type { Arcana, Rank, Suit, TarotCard } from '../../lib/tarot/types'
import raw from './cards.json'

/* 塔罗牌数据的**唯一入口**：把上游 `cards.json` 归一化成 `TarotCard[]`，
   并给出花色 / 点数的中文标签与查表函数。

   ⚠️ 这里刻意**不手写第二份牌表**：78 条的中英文名、正逆位关键词、牌面描述全部从
   `cards.json` 来（那份是上游原文，只删掉了重复的「世界」）。
   花色与点数从 `link` 的前缀/数字推出来 —— 上游文件名本身就编码了这两件事
   （`Wands01.jpg` = 权杖一），所以不需要额外字段，也不会两处对不上。 */

/** 上游 `cards.json` 一条的形状 */
interface RawCard {
  name: string
  description: string
  normal: string
  reversed: string
  detail: string
  link: string
}

/** 花色前缀 → 内部花色键。`Pents` 是 Pentacles（星币）的缩写 */
const SUIT_PREFIX: Array<[string, Suit]> = [
  ['Wands', 'wands'],
  ['Cups', 'cups'],
  ['Swords', 'swords'],
  ['Pents', 'pents'],
]

export const SUIT_LABEL: Record<Suit, string> = {
  wands: '权杖',
  cups: '圣杯',
  swords: '宝剑',
  pents: '星币',
}

/** 1~14 → 点数名；11~14 是宫廷牌 */
export const RANK_LABEL: Record<Rank, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
  10: '十',
  11: '侍卫',
  12: '骑士',
  13: '王后',
  14: '国王',
}

/** 「权杖 · 国王」这种副标题；大阿卡纳回「大阿卡纳」 */
export function cardSubtitle(card: TarotCard): string {
  if (card.arcana === 'major' || !card.suit || !card.rank) return '大阿卡纳'
  return `${SUIT_LABEL[card.suit]} · ${RANK_LABEL[card.rank]}`
}

export const CARDS: TarotCard[] = (raw as RawCard[]).map((entry) => {
  const id = entry.link.replace(/\.[^.]+$/, '')
  /* 大阿卡纳的名字是「The Fool 愚人」这种「英文 中文」，从**最后一个空格**切开 ——
     牌名里本身有空格（`Ace of Wands`、`King of Pentacles`），从第一个切会切错 */
  const cut = entry.name.lastIndexOf(' ')
  const nameEn = cut > 0 ? entry.name.slice(0, cut) : entry.name
  const nameZh = cut > 0 ? entry.name.slice(cut + 1) : ''

  const hit = SUIT_PREFIX.find(([prefix]) => id.startsWith(prefix))
  const arcana: Arcana = hit ? 'minor' : 'major'
  const suit = hit?.[1]
  /* 小阿卡纳的点数就是文件名尾部的数字（`Wands01` → 1） */
  const rank = suit ? (Number(id.slice(id.search(/\d/))) as Rank) : undefined

  return {
    id,
    nameEn,
    nameZh,
    name: nameZh ? `${nameZh} · ${nameEn}` : nameEn,
    arcana,
    suit,
    rank,
    description: entry.description,
    upright: entry.normal,
    reversed: entry.reversed,
    detail: entry.detail,
  }
})

const BY_ID = new Map(CARDS.map((card) => [card.id, card]))

export function cardOfId(id: string): TarotCard | undefined {
  return BY_ID.get(id)
}

/** 按全库固定顺序分组：大阿卡纳 22 张，然后权杖 / 圣杯 / 宝剑 / 星币各 14 张 */
export const MAJOR_CARDS: TarotCard[] = CARDS.filter((c) => c.arcana === 'major')

export function cardsOfSuit(suit: Suit): TarotCard[] {
  return CARDS.filter((c) => c.suit === suit)
}

/** 图片地址：文件名沿用上游 `link` 的名字，只把扩展名换成 webp。
    ⚠️ 前缀必须拼 `import.meta.env.BASE_URL` —— 站点部署在子路径下（`/Antoine.github.io/`），
    写死 `/tarot/...` 会 404（站标 `/logo.svg` 踩过同一个坑）。 */
export function cardImageSrc(card: TarotCard): string {
  return `${import.meta.env.BASE_URL}tarot/cards/${card.id}.webp`
}

/** 牌背（自绘 SVG，见 `components/program/tarot/CardBack.tsx`）不走图片，这里没有它的地址 */
