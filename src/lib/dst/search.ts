/**
 * 饥荒 Wiki 的搜索：索引构建 + 命中打分。
 *
 * 为什么单独一个模块（而不是塞在组件里）：
 * - 打分规则是这个窗口最容易被改坏的部分（假命中很难靠自己看出来），
 *   抽出来就能脱离 React 用真实数据跑单元测试
 * - 博客窗口以后要接拼音检索，也能复用这里的规则
 *
 * ⚠️ 索引与查询必须走同一套归一化（AGENTS.md 里博客搜索踩过的坑）：
 * `normalize` 同时作用于索引和查询，两边规则一旦拆开就会出现「正文搜不到」。
 */

import { entryName } from '../../data/dst'
import type { DstEntry } from '../../data/dst'
/**
 * 拼音函数的**结构类型**：故意不 import `./pinyin`，而是由调用方在运行时传进来。
 *
 * 理由（踩过一次）：`search.ts` 静态 import `pinyin.ts` 之后，首屏链路就变成
 * `DesktopShell → … → DstWikiWindow → search.ts → pinyin.ts → pinyin-pro`，
 * Rollup 会把 300 KB 的拼音库折叠进桌面首屏那个 chunk（实测 305 KB）。
 * 改成参数注入后，这条链在 `pinyin.ts` 处就断成动态 import，库自然独立成 chunk，
 * 只有真的打开 Wiki 窗口才会加载。
 */
export type PinyinFn = (text: string, options: Record<string, unknown>) => string[] | string

/** 把一段文本转成拼音两种形态的函数签名（由 `./pinyin` 提供） */
export type PinyinFormer = (text: string) => { full: string; initials: string }

/** 抹掉空白并小写 —— 索引与查询共用 */
export function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

export interface IndexRow {
  id: string
  /** 正文索引：摘要 / 正文 / facts / 相关条目名（归一化） */
  text: string
  /** 名字侧的「词」：中文名拆成单字，英文名与别名保持整词 */
  tokens: string[]
  /** 各段全拼（zhizhu / spider / xiaozhizhu …） */
  fullTokens: string[]
  /** 各段首字母缩写（zz / spider / xzz …），与全拼分开存，精确/前缀分层用 */
  initialsTokens: string[]
  /** 名字侧整串全拼（去掉标点），用于整名精确与前缀命中 */
  fullWhole: string
}

/** 按空白与标点切词：英文名与别名保持整词 */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s,，、/·|]+/)
    .map((part) => normalize(part))
    .filter(Boolean)
}

/**
 * 把中文名拆成单字 + 整词。
 *
 * 汉字没有词边界，所以逐字当作「词首」：这样「金」能作为「金斧头」的词首命中，
 * 而「斧头」这种内部子串不会反过来命中「金斧头」以外的杂项。
 */
export function charTokens(text: string): string[] {
  const out: string[] = []
  for (const part of tokenize(text)) {
    for (const char of part) out.push(char)
    out.push(part)
  }
  return out
}

/** 名字侧文本：中文名 + 英文名 + 别名 */
function nameTextOf(entry: DstEntry): string {
  return [entry.name, entry.en ?? '', ...(entry.aliases ?? [])].join(' ')
}

export function buildIndex(entries: DstEntry[]): IndexRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    text: normalize(
      [
        entry.summary,
        ...entry.body,
        ...(entry.facts ?? []).map((fact) => `${fact.label} ${fact.value}`),
        ...(entry.related ?? []).map((id) => entryName(id)),
      ].join(' '),
    ),
    tokens: [
      ...charTokens(entry.name),
      ...tokenize([entry.en ?? '', ...(entry.aliases ?? [])].join(' ')),
    ],
    fullTokens: [],
    initialsTokens: [],
    fullWhole: normalize(nameTextOf(entry).replace(/[^\p{L}\p{N}]+/gu, '')),
  }))
}

/** 把拼音形态补进索引（`pinyin-pro` 是动态加载的，所以这一步是异步补的） */
export function attachPinyin(
  rows: IndexRow[],
  entries: DstEntry[],
  pinyinForms: PinyinFormer,
): IndexRow[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  return rows.map((row) => {
    const entry = byId.get(row.id)
    if (!entry) return row
    /* 只对「会被搜的东西」转拼音：中文名、英文名、别名。
       正文转拼音既慢也没有意义（没人会用拼音搜一整段正文）。 */
    const segs = [entry.name, entry.en ?? '', ...(entry.aliases ?? [])].filter(Boolean)
    const forms = segs.map((seg) => pinyinForms(seg))
    return {
      ...row,
      /* 全拼与首字母**分开存**，不要合并成一个数组：
         合并之后就分不清「htb 是首字母精确命中」还是「ht 只是它的前缀」，
         两者会拿到同一个分数（实际发生过），相关性排序就失效了。 */
      fullTokens: forms.map((form) => form.full).filter(Boolean),
      initialsTokens: forms.map((form) => form.initials).filter(Boolean),
    }
  })
}

/** 某个词以关键词开头即算命中（词首匹配） */
export function anyStartsWith(tokens: string[], keyword: string): boolean {
  return tokens.some((token) => token.startsWith(keyword))
}

/** 有没有**完全相等**的词。精确命中必须排在「前缀命中」之前：
    搜 `htb` 时「火腿棒」是精确命中，搜 `ht` 时它只是前缀命中，两者不该同分。 */
export function anyEquals(tokens: string[], keyword: string): boolean {
  return tokens.some((token) => token === keyword)
}

/**
 * 命中打分：分数越高越靠前，0 表示不命中。
 *
 * 两个关键取舍（都是踩过假命中之后定的）：
 *
 * 1. **拉丁（拼音 / 英文）查询按词首匹配，不做无边界子串**。
 *    用 `includes` 匹配拼音串时，`zzzz` 会命中「蜘蛛人」(zhizhuren) 的内部、
 *    `htb` 会命中「黑夜 + 冬天」拼出来的串 —— 看起来就是搜错了。
 *
 * 2. **绝不拿「拼接后的拼音串」做子串匹配**。这是这个模块最容易踩的坑，实际发生过两次：
 *    - `initials` 是各段首字母拼起来的（`蜘蛛` = `zz`、`蜘蛛人` = `zzr`），
 *      拼接处会凭空多出边界：`zz` + `zzz` → `zzzzzz`，于是搜 `zzzz` 会命中蜘蛛；
 *    - `jinfutou` 去掉元音后恰好含 `jft`，于是搜首字母 `jft` 会连带命中「齿轮」(chilun)。
 *    所以拉丁查询只做**整串相等**与**逐段词首**匹配，那两样都是有意义的边界。
 *
 * 3. 全拼子串要求关键词 ≥3 个字符，正文里的拉丁子串要求 ≥4 个字符 ——
 *    否则 `ht`、`spi` 这类碎片会横扫一片。
 *
 * 中文查询仍然允许子串 —— 对中文来说「斧头」搜到「金斧头」正是想要的行为。
 */
export function scoreOf(row: IndexRow, keyword: string): number {
  if (!keyword) return 1

  const latin = /[a-z0-9]/.test(keyword)

  /* ── 第 1 档：精确命中（不区分大小写与形态）── */
  if (anyEquals(row.tokens, keyword)) return 100
  if (row.fullWhole === keyword) return 96
  if (anyEquals(row.initialsTokens, keyword)) return 94
  if (anyEquals(row.fullTokens, keyword)) return 92

  /* ── 第 2 档：前缀命中 ── */
  if (anyStartsWith(row.tokens, keyword)) return 88
  if (anyStartsWith(row.fullTokens, keyword)) return 80
  if (row.fullWhole.startsWith(keyword)) return 74
  /* 首字母前缀排在全拼前缀之后：搜 `ht` 时「火腿棒」是缩写前缀，不如全拼前缀确定 */
  if (anyStartsWith(row.initialsTokens, keyword)) return 60

  if (latin) {
    if (keyword.length >= 3 && row.fullWhole.includes(keyword)) return 40
    if (keyword.length >= 4 && row.text.includes(keyword)) return 24
    return 0
  }

  /* 中文查询走到这里说明没有词首命中，再退一步看任意子串 */

  /* 中文查询：子串是有意义的（「斧头」应该能搜到「金斧头」） */
  if (row.text.includes(keyword)) return 55
  return 0
}

/** 按关键词筛选并排序；无关键词时保留原始顺序（作者编排过的顺序更好读） */
export function searchIndex(rows: IndexRow[], keyword: string): IndexRow[] {
  const scored: Array<{ row: IndexRow; score: number }> = []
  for (const row of rows) {
    const score = scoreOf(row, keyword)
    if (score > 0) scored.push({ row, score })
  }
  if (keyword) scored.sort((a, b) => b.score - a.score)
  return scored.map((item) => item.row)
}