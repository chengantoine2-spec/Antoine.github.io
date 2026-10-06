/* 「塔罗牌」窗口的数据契约 —— **全窗口唯一一份**。

   数据来源与清洗过程见 `docs/tarot.md`。要点：
   - 牌义原始资料来自 github.com/look-fate/tarot-lab 的 `TarotDB/cards.json`（MIT）；
     上游有 **79 条**，第 22 条是「The World 世界」的坏副本（description 末句重复了两遍），
     清洗时删掉，剩下正是标准的 78 张。
   - 牌面图片是「阿卡西之眼」那套（`AkaxiTarot/`），已转成 webp 放进 `public/tarot/cards/`。
     文件名**沿用上游 `link` 字段的名字**（`Fool.jpg` → `Fool.webp`）——
     这样"哪张牌配哪张图"不需要第二份映射表，`link` 改个后缀就是图片地址。
   - ⚠️ 上游 `AkaxiTarot/` 是按数字编号的裸图堆（`0.png`~`77.png`），**编号顺序和牌序完全不是一回事**
     （源清单里 `_01`…`_32` 之后直接跳到 `_63`）。映射只做一次、只在生成素材的脚本里，
     运行时的数据一个字节都不依赖它。 */

/** 大阿卡纳 / 小阿卡纳 */
export type Arcana = 'major' | 'minor'

/** 小阿卡纳四花色；与上游文件名前缀一一对应（Pents = Pentacles 星币） */
export type Suit = 'wands' | 'cups' | 'swords' | 'pents'

/** 点数：1=Ace(一) … 10=数字牌，11=Page(侍卫) 12=Knight(骑士) 13=Queen(王后) 14=King(国王) */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface TarotCard {
  /** 唯一 id = 上游 `link` 去掉扩展名（`Fool` / `Wands01` / `Pents14`） */
  id: string
  /** 英文名（`The Fool`） */
  nameEn: string
  /** 中文名（`愚人`） */
  nameZh: string
  /** 展示用全名：`愚人 · The Fool` */
  name: string
  arcana: Arcana
  /** 只有小阿卡纳有 */
  suit?: Suit
  /** 只有小阿卡纳有 */
  rank?: Rank
  /** 牌面描述（上游 `description`） */
  description: string
  /** 正位关键词（上游 `normal`） */
  upright: string
  /** 逆位关键词（上游 `reversed`） */
  reversed: string
  /** 原始牌义出处（上游 `detail`，指向 labyrinthos.co） */
  detail: string
}

/** 牌阵里的一个位置：它画在哪儿，以及它在问什么 */
export interface SpreadPosition {
  /** 位置名（`过去` / `现状` / `障碍` …） */
  label: string
  /** 这个位置在问什么 —— 解读时和牌义拼在一起，别写成空话 */
  hint: string
  /**
   * 牌**中心**的横向位置，单位是「牌高」（不是 0~1 的百分比）。
   * 牌宽固定是 0.583 个牌高（`CARD_RATIO`），所以 `u = 1` 就是往右挪一个牌高的距离。
   */
  u: number
  /** 同上，纵向：`v = 1` = 往下挪一张牌的高度 */
  v: number
  /** 顺时针旋转角度；凯尔特十字第 2 张是横放的（90） */
  rotate?: number
}

export interface Spread {
  id: string
  name: string
  /** 牌阵用途（上游 `spreads_db.json` 的 description） */
  purpose: string
  /**
   * ⚠️ 这里**没有**宽高比 / 牌尺寸这类字段 —— 它们由 `lib/tarot/layout.ts`
   * 按"把所有牌塞进可用空间、尽量放大"算出来。手写一个画布比例必然会在某种窗口尺寸下浪费空间
   * （凯尔特十字第一版就是按横的画布定的，牌被压到 51px 宽）。
   */
  positions: SpreadPosition[]
}

/** 抽定的一张牌：牌 + 正逆位 + 落在牌阵的哪个位置 */
export interface DrawnCard {
  card: TarotCard
  /** true = 逆位 */
  reversed: boolean
  /** 对应 `Spread.positions` 的下标 */
  positionIndex: number
}

/** 一次完整的占卜 */
export interface Reading {
  /** 抽牌时刻（ms） */
  at: number
  spreadId: string
  /** 占卜的问题，可空 */
  question: string
  cards: DrawnCard[]
}
