/* 「塔罗牌」解读文案 —— **组合生成**，不是 78×N 条逐一手写。
 *
 *  站主 2026-10-06 定的三点（A10/A11/A12）：
 *  - **三种粒度都做、做成可切换**：每牌位一句 / 牌 × 牌位组合 / 整体综述；
 *  - **先自己写简易模板**（日后接 AI 生成，不在这单）；
 *  - **每条给 2~3 句「建议与注意」**，语气克制、**不写死宿命论**（不出现"一定会…"），
 *    并在解读区注明「仅供思考参考，不构成决策依据」。
 *
 *  ⚠️ 为什么不逐条手写：牌 78 张 × 牌位（8 个牌阵加起来 38 个位）× 正逆 × 3 种粒度
 *  = 上万条，写不动也维护不了。所以做法是**两组词表相乘**：
 *      ① 牌的核心义：直接用牌表里现成的 `upright` / `reversed` 关键词（正逆各一条）；
 *      ② 牌位的角色：把牌位名（"直接的阻碍""A 方案：结局""周一"…）**归类**成一个角色，
 *         每个角色有自己的"这个位置在问什么"的框架与落点。
 *  两样拼起来成句 —— 所以同一张牌放到**不同牌位**会得到不同的话（角色不参与就退化成"只按牌给话"，
 *  那正是这次要避免的假实现）。
 *
 *  ⚠️ 文案只在这一层。组件只负责把 `interpret()` 的结果排出来。 */

import type { DrawnCard, Reading, Spread, Suit } from '../../lib/tarot/types'

export type InterpModeId = 'brief' | 'combo' | 'overview'

export const INTERP_MODES: ReadonlyArray<{ id: InterpModeId; name: string; hint: string }> = [
  { id: 'brief', name: '每牌位一句', hint: '一句一个牌位，快速过一遍' },
  { id: 'combo', name: '牌 × 牌位', hint: '把这张牌放到这个位置上细看' },
  { id: 'overview', name: '整体综述', hint: '串成一段话：氛围、走向与提醒' },
]

export const DISCLAIMER = '以上是牌面的读法，仅供思考参考，不构成决策依据。'

/* ── 牌位角色：牌位名 → 角色（关键词归类，认不出来就回落到"现状"） ── */

export type Role =
  | 'past'
  | 'present'
  | 'foundation'
  | 'cause'
  | 'block'
  | 'help'
  | 'goal'
  | 'future'
  | 'outcome'
  | 'hope'
  | 'environment'
  | 'self'
  | 'other'
  | 'bond'
  | 'feeling'
  | 'thought'
  | 'matter'
  | 'action'
  | 'choiceA'
  | 'choiceB'
  | 'choiceAEnd'
  | 'choiceBEnd'
  | 'weekday'
  | 'day'
  | 'advice'

/* ⚠️ 顺序有讲究：'结局' 要在 '方案' 之前判，否则「A 方案：结局」会被当成"过程" */
const ROLE_RULES: ReadonlyArray<[RegExp, Role]> = [
  [/结局|结果|落点/, 'outcome'],
  [/阻碍|障碍|挡/, 'block'],
  [/助力|推你/, 'help'],
  [/起因|成因|源头|根/, 'foundation'],
  [/目标/, 'goal'],
  [/希望|恐惧|盼/, 'hope'],
  [/外界|环境/, 'environment'],
  [/对方/, 'other'],
  [/过去|来路/, 'past'],
  [/走向|未来/, 'future'],
  [/之间|关系|相处|现状/, 'bond'],
  [/方案.*走|方案：会/, 'choiceA'],
  [/B 方案/, 'choiceB'],
  [/A 方案/, 'choiceA'],
  [/感受|感性|情绪/, 'feeling'],
  [/想法|理性|思辨/, 'thought'],
  [/物质|现实|条件/, 'matter'],
  [/行动|下一步/, 'action'],
  [/周[一二三四五六日]/, 'weekday'],
  [/指引|今日|今天/, 'day'],
  [/建议/, 'advice'],
  [/你|自己/, 'self'],
]

export function roleOfLabel(label: string): Role {
  for (const [re, role] of ROLE_RULES) if (re.test(label)) return role
  return 'present'
}

/* 这个位置在问什么（框架）／在这个位置上这张牌怎么落地（落点） */
const ROLE_FRAME: Record<Role, string> = {
  past: '已经发生、而且到现在还在起作用的那部分',
  present: '此刻的实际局面',
  foundation: '这件事的底子：深层动机与真正想要的东西',
  cause: '内在的成因 —— 不是时间上的"之前"，而是事情为什么长成这样',
  block: '挡在路上的那股力量',
  help: '推你一把的那股力量',
  goal: '你意识里想达成的样子',
  future: '顺着现在走下去会到的地方',
  outcome: '把这些都算进去之后的落点',
  hope: '你最盼着、往往也最怕的那件事',
  environment: '别人与环境里你控制不了的那部分',
  self: '你自己在这件事里的状态',
  other: '对方此刻的位置与心思',
  bond: '你们凑在一起实际形成的局面',
  feeling: '情绪与直觉那一面',
  thought: '想法与判断那一面',
  matter: '现实条件那一面',
  action: '下一步该做的动作',
  choiceA: 'A 这条路的过程',
  choiceB: 'B 这条路的过程',
  choiceAEnd: 'A 这条路的落点',
  choiceBEnd: 'B 这条路的落点',
  weekday: '这一天的节奏',
  day: '今天最该留意的地方',
  advice: '牌给出的建议',
}

const ROLE_CLAUSE: Record<Role, string> = {
  past: '它不是要你回头看很久，而是提醒你：现在的反应里有一部分是那时候留下的。',
  present: '它讲的是你现在真正站着的位置 —— 不一定是你以为自己站的地方。',
  foundation: '底层的东西不会因为你没看见就不起作用，先看见它就够了。',
  cause: '找到成因的价值在于：能改的那一环，通常就在这里。',
  block: '它更像一条减速带，不是判决 —— 看清形状，才知道力气该往哪使。',
  help: '这股力气已经在手边了，别当它不存在。',
  goal: '想要的样子和真正会走到的样子，有时不是同一个 —— 这张牌就在问你分不分得清。',
  future: '它给的是趋势，不是结局；趋势可以改，前提是你现在知道它在往哪走。',
  outcome: '这是照现在的走法推出来的落点，不是"命里注定"的那一个。',
  hope: '盼和怕常常是同一件事的两面，认出来会松一点。',
  environment: '这部分你改不了，但可以决定自己怎么站进去。',
  self: '这是你的状态，不是你的定性 —— 状态本来就会变。',
  other: '它说的是对方此刻的位置，不是对方"应该"怎样。',
  bond: '两个人凑出来的局面，往往不等于任何一方的单方面感受。',
  feeling: '情绪是信息，不是命令；先承认它在，再决定听不听它的。',
  thought: '想法讲的是你怎么解释这件事，解释换了，路通常也换了。',
  matter: '钱、时间、身体、别人的配合 —— 这些是边界条件，绕不过去。',
  action: '如果只做一件事，这张牌指的就是那件。',
  choiceA: '放到 A 这条路的过程上看：它讲的是这一路会怎么消耗你、又会给你什么。',
  choiceB: '放到 B 这条路的过程上看：它讲的是这一路会怎么消耗你、又会给你什么。',
  choiceAEnd: 'A 走到头会落在什么状态 —— 那个结果你愿不愿意接。',
  choiceBEnd: 'B 走到头会落在什么状态 —— 那个结果你愿不愿意接。',
  weekday: '它说的是这一天的节奏：什么时候可以推、什么时候该让一让。',
  day: '今天只盯这一处就够了，别一次想完一整周。',
  advice: '它给的是一个方向，不是一条命令。',
}

/* ── 牌的核心义与色调：正逆位都从同一条核心义出发，但**说法不同**（不是加个"不"字） ── */

/**
 * 核心义：直接取牌表现成的 `upright` / `reversed` 字段（不另抄一份词表）。
 * ⚠️ 上游那几个字段是**逗号串**（"勇敢的，迷人的，英雄气概的，…"），整串塞进句子里太啰嗦，
 * 所以只取**前两个词**拼成「勇敢的 · 英雄气概」。要完整词条请看牌面详情（ReadingPanel 里有 original）。
 */
export function coreOf(drawn: DrawnCard): string {
  const raw = drawn.reversed ? drawn.card.reversed : drawn.card.upright
  const parts = raw
    .split(/[，,、;；/|。.!！?？]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  /* 有些上游字段的第一段本身就是长句（"抗拒人生的转变 · 抗拒命运的召唤。可能做出错误的决定…"），
     所以偏好短词：够短的前两个；都太长就只用一个（截到 14 字以内）。 */
  const short = parts.filter((x) => x.length <= 14)
  if (short.length >= 2) return short.slice(0, 2).join(' · ')
  const first = short[0] ?? parts[0] ?? raw
  return first.length > 14 ? first.slice(0, 14) : first
}

const SUIT_TONE: Record<Suit, { up: string; rev: string }> = {
  wands: { up: '劲头正旺，适合往前推一步', rev: '劲头被别的事分掉了，或者用力过猛' },
  cups: { up: '情感是这件事的主线', rev: '情绪在暗处起作用，还没被摊开来说' },
  swords: { up: '靠判断与沟通能解开的地方', rev: '想得太多、说不到点上，容易自己绕自己' },
  pents: { up: '落实在具体的资源与节奏上', rev: '现实条件卡着，急也快不起来' },
}

/** 这张牌在"能量状态"上是什么味道 —— 正逆位给的是**同一件事的两种表达** */
export function toneOf(drawn: DrawnCard): string {
  const card = drawn.card
  if (card.arcana === 'major') {
    return drawn.reversed
      ? '大阿卡纳逆位：同一个大主题现在正被压着、或者走到了它的反面 —— 它在等你换个角度'
      : '大阿卡纳正位：这是一个绕不过去的阶段性主题'
  }
  const tone = SUIT_TONE[card.suit ?? 'pents']
  return drawn.reversed ? tone.rev : tone.up
}

/* ── 建议与注意：按"角色 × 正逆"给池子，语气克制、不给宿命论 ── */

const ROLE_REMIND: Record<Role, string> = {
  past: '如果最近又在重复同一种反应，可以先问一句"这是现在的需要，还是那时候留下的习惯"。',
  present: '先把眼下这一件能看清的事做完，再谈更远的。',
  foundation: '找出真正的动机之后，再决定要不要继续用力。',
  cause: '改不动的那部分先放下，改得动的那一环先动。',
  block: '把"挡路的东西"具体写成一句话，它往往就没那么大了。',
  help: '已经帮你的人或事，别客气，用起来。',
  goal: '把想要的东西说成一个能验证的小目标，比"想要"更有用。',
  future: '趋势只是提醒你提前准备，不是提前认命。',
  outcome: '如果这个落点你不想接，现在改动作还来得及。',
  hope: '把最怕的那件事写下来，它经常比想象中小一圈。',
  environment: '改变不了的部分，就别再花力气跟它较劲了。',
  self: '先照顾状态，再谈效率 —— 这条顺序反了事情会更难。',
  other: '对方的想法你猜不到，能问就问，别用猜的当结论。',
  bond: '关系是两个人一起走出来的，一次占卜只说明此刻。',
  feeling: '允许自己有情绪，但别在情绪最高的时候做决定。',
  thought: '把你现在的解释写下来，再写一个相反的解释，看看哪个更禁得住推敲。',
  matter: '先算清时间、钱和精力这三样，再谈要不要做。',
  action: '挑一件今天就能做完的小事起步，手感比计划更早给你答案。',
  choiceA: '想选 A，就先把 A 最坏的情况写出来，看你还接不接。',
  choiceB: '想选 B，就先把 B 最坏的情况写出来，看你还接不接。',
  choiceAEnd: 'A 的结果如果不如意，是因为哪一步？能不能只改那一步。',
  choiceBEnd: 'B 的结果如果不如意，是因为哪一步？能不能只改那一步。',
  weekday: '把这一天最要紧的一件事排在精力最好的那个时段。',
  day: '今天不要一次解决所有事，就盯这一处。',
  advice: '建议是参考，决定还是你自己下。',
}

/** 通用句池：正位 / 逆位各一组（逆位那组偏"先把节奏放慢"） */
const ADVICE_COMMON: Record<'up' | 'rev', readonly string[]> = {
  up: [
    '可以先做一件很小、今天就能完成的事，看看手感再决定下一步。',
    '把想法说给一个信得过的人听，说着说着常会自己清楚起来。',
    '给自己定一个"三天后再看一次"的时间点，别现在就把结论钉死。',
    '已经想清楚的那部分，不妨先动手；剩下的边做边改。',
    '留意那些反复出现的念头 —— 它通常比一次占卜更值得信。',
  ],
  rev: [
    '如果暂时没有答案，把这件事放两天再回来看，它常常会自己变清楚。',
    '先别急着下结论，把能控制的那一小块做扎实就够了。',
    '注意别把"我现在做不到"当成"这件事不行"——这两句不是一回事。',
    '可以先把节奏放慢一点，急的时候做的决定，回头看往往要返工。',
    '找个安静的半小时，只写事实、不写评价，会看清很多。',
  ],
}

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) + b
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

function pick<T>(pool: readonly T[], n: number): T {
  return pool[((n % pool.length) + pool.length) % pool.length]
}

/** 2~3 句「建议与注意」：一句贴角色，两（或一）句来自通用池。语气克制、不写死结局。 */
export function adviceFor(drawn: DrawnCard, role: Role, salt: number): string[] {
  const pol: 'up' | 'rev' = drawn.reversed ? 'rev' : 'up'
  const pool = ADVICE_COMMON[pol]
  const first = pick(pool, hash(salt, 1))
  const second = pick(pool, hash(salt, 2) + 1)
  const lines = [ROLE_REMIND[role], first]
  /* 两句撞了就给第三句，别让一条建议里出现重复话 */
  if (second !== first) lines.push(second)
  else lines.push(pick(pool, hash(salt, 3) + 2))
  return lines
}

/* ── 三种粒度的产出 ── */

export interface InterpEntry {
  /** 牌位名 */
  position: string
  /** `愚人 · The Fool` */
  card: string
  reversed: boolean
  /** 这一段怎么读 */
  text: string
  /** 2~3 句「建议与注意」 */
  advice: string[]
}

export interface InterpOverview {
  /** 整体氛围（元素 / 大阿卡纳 / 正逆位比例） */
  mood: string
  /** 把牌位串成一段话 */
  flow: string
  /** 关键提醒（挑一张最该留意的） */
  remind: string
  advice: string[]
}

export interface InterpView {
  mode: InterpModeId
  entries: InterpEntry[]
  overview: InterpOverview | null
  disclaimer: string
}

const SUIT_NAME: Record<Suit, { name: string; mood: string }> = {
  wands: { name: '权杖（火）', mood: '想动、想推一把' },
  cups: { name: '圣杯（水）', mood: '情感与关系在主导' },
  swords: { name: '宝剑（风）', mood: '要靠想清楚、说明白来解' },
  pents: { name: '星币（土）', mood: '落在现实条件与节奏上' },
}

function overviewOf(pairs: Array<{ drawn: DrawnCard; role: Role; label: string }>): InterpOverview {
  const total = pairs.length
  const reversed = pairs.filter((p) => p.drawn.reversed).length
  const majors = pairs.filter((p) => p.drawn.card.arcana === 'major').length

  /* 元素分布：只看小阿卡纳，取最多的那个花色 */
  const suits: Suit[] = ['wands', 'cups', 'swords', 'pents']
  const tally = suits.map((s) => ({ s, n: pairs.filter((p) => p.drawn.card.suit === s).length }))
  const top = tally.reduce((a, b) => (b.n > a.n ? b : a), tally[0])

  const moodParts = [
    top.n > 0
      ? `这手牌里 ${SUIT_NAME[top.s].name} 最多（${top.n}/${total}），整体偏「${SUIT_NAME[top.s].mood}」`
      : '这手牌里没有小阿卡纳，全是大的 —— 这件事的分量不在日常细节上',
    majors * 2 >= total
      ? `大阿卡纳有 ${majors} 张，说明这一把讲的是阶段性的大主题，不太由日常的小选择决定`
      : `大阿卡纳 ${majors} 张，主要还是日常层面的选择在起作用`,
    reversed === 0
      ? '全是正位 —— 能量比较顺，该动的可以动'
      : reversed === total
        ? '全是逆位 —— 眼下更像"憋着"的阶段，先别硬推'
        : `逆位 ${reversed}/${total} —— 有一部分力气还没使出来，或者使错了地方`,
  ]

  const flow = `从「${pairs[0]?.label ?? '第一张'}」一路到「${pairs[total - 1]?.label ?? '最后一张'}」，串下来是这样：${pairs
    .map((p) => `${p.label}是「${coreOf(p.drawn)}」`)
    .join('；')}。读的时候别把每一句当独立结论 —— 它们是同一件事的不同侧面。`

  /* 关键提醒：优先看"阻碍"，没有就退到"结局"，再没有就取第一张 */
  const focus =
    pairs.find((p) => p.role === 'block') ??
    pairs.find((p) => p.role === 'outcome' || p.role === 'choiceAEnd' || p.role === 'choiceBEnd') ??
    pairs[0]
  const remind = focus
    ? `最该留意的是「${focus.label}」那张 ${focus.drawn.card.name}（${focus.drawn.reversed ? '逆位' : '正位'}）—— ${ROLE_CLAUSE[focus.role]}`
    : '这一把牌还没翻开，谈不上提醒。'

  return {
    mood: moodParts.join('；') + '。',
    flow,
    remind,
    advice: focus ? adviceFor(focus.drawn, focus.role, hash(7, total)) : [],
  }
}

/**
 * 三种粒度都从**同一手牌**生成 —— 切模式只换呈现，不重抽（组件那边也不重新 draw）。
 * `seed` 参与取句，所以同一把牌的文案稳定、不同把之间会变。
 */
export function interpret(
  reading: Reading,
  spread: Spread,
  mode: InterpModeId,
  seed: number,
): InterpView {
  const pairs = reading.cards.map((drawn, index) => {
    const label = spread.positions[drawn.positionIndex]?.label ?? spread.positions[index]?.label ?? `第 ${index + 1} 张`
    return { drawn, role: roleOfLabel(label), label, index }
  })

  const entries: InterpEntry[] = pairs.map(({ drawn, role, label, index }) => {
    const posName = drawn.reversed ? '逆位' : '正位'
    const core = coreOf(drawn)
    const text =
      mode === 'brief'
        ? `${label}：${drawn.card.name}（${posName}）—— 核心义是「${core}」，落在${ROLE_FRAME[role]}上。`
        : `${label}（${ROLE_FRAME[role]}）拿到 ${drawn.card.name}（${posName}）：核心是「${core}」，${toneOf(drawn)}。${ROLE_CLAUSE[role]}`
    return {
      position: label,
      card: drawn.card.name,
      reversed: drawn.reversed,
      text,
      advice: adviceFor(drawn, role, hash(seed, index + 1)),
    }
  })

  return {
    mode,
    entries,
    overview: mode === 'overview' ? overviewOf(pairs) : null,
    disclaimer: DISCLAIMER,
  }
}
