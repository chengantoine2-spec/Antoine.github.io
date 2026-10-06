/* 塔罗牌「想问什么」的示例文案：**日常小事**，按一天里的**时段分桶** + 随时间**轮换**。
 *
 *  站主 2026-10-06：「塔罗牌里面想问什么的例子修改一下，改成日常生活中的小事，
 *  然后多做几个，会随时间轮换」。
 *
 *  ⚠️ 这一层只回答一个问题：**给定时刻该显示哪一句**。
 *  牌表（`cards.json` / `spreads.ts`）、抽牌与随机种子（`lib/tarot/draw.ts`）、
 *  历史记录结构（`lib/tarot/history.ts`）都不在这层、也别顺手改。
 *
 *  为什么按时段分桶：深夜问「要不要现在点外卖」很对，早上问就怪。
 *  桶内再按时间步进：同一时段里也会一句一句换，让人看得出它会变。
 */

export type QuestionBucketId = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'

export interface QuestionBucket {
  id: QuestionBucketId
  /** 给界面显示的中文名（提示行里会写「现在是『深夜』的写法」） */
  name: string
  /** 命中这个桶的小时（0~23，闭区间）。跨零点的那一桶是 from > to（如 21 → 4） */
  from: number
  to: number
  questions: readonly string[]
}

/** 每条例子停留多久（毫秒）。站主要 20~40s，取 20s —— 也是验证脚本等待一期的时间。 */
export const QUESTION_ROTATE_MS = 20_000

/** 五个时段 × 7 条 = 35 条 */
export const QUESTION_BUCKETS: readonly QuestionBucket[] = [
  {
    id: 'dawn',
    name: '清晨',
    from: 5,
    to: 8,
    questions: [
      '现在起，还是再赖十分钟？',
      '早饭是煮面，还是路上随手买？',
      '今天要不要带伞出门？',
      '先洗头还是先吃早饭？',
      '昨晚那条消息，现在回合适吗？',
      '今天穿薄外套会不会冷？',
      '早起这半小时，拿来收拾屋子还是发会儿呆？',
    ],
  },
  {
    id: 'morning',
    name: '上午',
    from: 9,
    to: 11,
    questions: [
      '今天要不要点那杯奶茶？',
      '那盆快蔫的花，要不要现在浇水？',
      '上午先擦桌子，还是先把衣服洗了？',
      '快递现在下楼取，还是等中午顺路？',
      '要不要给家里打个电话问问近况？',
      '中午吃什么 —— 食堂还是随便对付一口？',
      '碗现在洗了，还是留到晚上一起？',
    ],
  },
  {
    id: 'afternoon',
    name: '午后',
    from: 12,
    to: 16,
    questions: [
      '午睡二十分钟，还是硬撑到晚上？',
      '下午要不要出门走一圈晒晒太阳？',
      '阳台那几件衣服，今天收不收？',
      '下午茶吃点什么，还是忍住？',
      '现在开始收拾房间，还是再拖一会儿？',
      '给朋友回个电话，还是发条消息算了？',
      '明天穿那件外套会不会太热？',
    ],
  },
  {
    id: 'evening',
    name: '傍晚',
    from: 17,
    to: 20,
    questions: [
      '今晚吃什么 —— 自己做还是点？',
      '现在去买菜，还是翻翻冰箱凑一顿？',
      '今晚出门散步，还是窝在沙发里？',
      '先做饭还是先洗澡？',
      '今晚把那部电影看完，还是早点睡？',
      '要不要约人明天一起吃个饭？',
      '垃圾现在拿下去，还是明早顺手？',
    ],
  },
  {
    id: 'night',
    name: '深夜',
    from: 21,
    to: 4,
    questions: [
      '要不要现在点个外卖？',
      '该睡了，还是再刷十分钟手机？',
      '现在去洗澡，还是再拖一会儿？',
      '明天的闹钟要不要提前半小时？',
      '碗留到明天早上洗，行不行？',
      '现在关掉手机，还是再看一集？',
      '睡前喝口热水，还是直接躺下？',
    ],
  },
]

/** 某一小时属于哪个时段（0~23；越界会先折回 0~23） */
export function questionBucketForHour(hour: number): QuestionBucket {
  const h = ((Math.trunc(hour) % 24) + 24) % 24
  return (
    QUESTION_BUCKETS.find((b) => (b.from <= b.to ? h >= b.from && h <= b.to : h >= b.from || h <= b.to)) ??
    QUESTION_BUCKETS[0]
  )
}

/** 例子总数（验证脚本与以后加条目时用） */
export function questionTotal(): number {
  return QUESTION_BUCKETS.reduce((n, b) => n + b.questions.length, 0)
}

/**
 * 给定时刻该显示哪一句。
 *
 * 取法：**先按时段选桶**，再在桶内按 `floor(时间 / 20s)` 步进 ——
 * 所以同一个时段里每 20 秒换一条，跨到下一个时段自动换组，
 * 跨天也不会总是从第一条开始（步进是连续时间算出来的，不是每次打开重置的随机数）。
 */
export function pickQuestion(now: Date): { bucket: QuestionBucket; text: string; index: number } {
  const bucket = questionBucketForHour(now.getHours())
  const list = bucket.questions
  const step = Math.floor(now.getTime() / QUESTION_ROTATE_MS)
  const index = ((step % list.length) + list.length) % list.length
  return { bucket, text: list[index], index }
}
