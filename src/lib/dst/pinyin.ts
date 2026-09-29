/**
 * 饥荒 Wiki 的拼音检索支持（全拼 + 首字母）。
 *
 * 为什么单独一个模块：
 * - `pinyin-pro` 是**动态 import** 的 —— 它不该出现在桌面首屏的 chunk 里
 * - 多音字覆盖表必须有地方放，而且要和「搜索」这件事写在一起才不会被漏掉
 *
 * 两个函数的分工（都很重要）：
 * - `foldPinyin`：把一段文本压成纯音节串（`威尔逊` → `weierxun`），用于**查询侧**
 * - `pinyinForms`：给出「全拼」与「首字母」两种形态，用于**索引侧**
 *
 * ⚠️ 索引与查询必须走同一套规则（AGENTS.md 里博客搜索踩过的坑）：
 * 查询 "wex" 能命中索引里的首字母形态，靠的就是两边都过 foldPinyin + 同一个归一化。
 */

/**
 * 多音字覆盖表。
 *
 * pinyin-pro 对多音字取的是「最常用读音」，但游戏译名里有些字读的是另一个音，
 * 不覆盖的话用拼音就打不出来。只放**确实会用到**的，别把整个多音字表抄进来。
 */
const POLYPHONE: Record<string, string> = {
  行: 'xing',
  长: 'chang',
  重: 'zhong',
  卡: 'ka',
  角: 'jiao',
  恶: 'e',
  适: 'shi',
}

/**
 * pinyin-pro 的调用签名。
 *
 * **故意不 import `./search`**：那样会变成循环依赖，而且会把搜索模块拉进这条链。
 * 这个类型与 `search.ts` 里的 `PinyinFn` 结构一致，两边各写一份、互不 import。
 */
export type PinyinFn = (text: string, options: Record<string, unknown>) => string[] | string

let cached: PinyinFn | null = null

async function loadPinyin(): Promise<PinyinFn | null> {
  if (cached) return cached
  try {
    const mod = (await import('pinyin-pro')) as unknown as { pinyin: PinyinFn }
    cached = mod.pinyin
    return cached
  } catch {
    /* 拿不到就退回纯文本搜索：拼音检索失效，但中文/英文/别名照常能搜 */
    return null
  }
}

/** 一个字一个字地取拼音，多音字按 POLYPHONE 修正 */
function charPinyin(fn: PinyinFn, text: string): string {
  return [...text]
    .map((char) => {
      const fixed = POLYPHONE[char]
      if (fixed) return fixed
      const got = fn(char, { toneType: 'none', type: 'array' }) as string[]
      return got[0] ?? char
    })
    .join('')
}

/**
 * 把文本压成纯音节串：汉字转拼音、保留字母数字、其余（标点空白）一律丢掉。
 * 返回空字符串表示这段文本没有可拼音化的内容。
 */
export function foldPinyin(fn: PinyinFn, text: string): string {
  const syllables = charPinyin(fn, text)
  return syllables.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export interface PinyinForms {
  /** 全拼：威尔逊 → weierxun */
  full: string
  /** 首字母：威尔逊 → wex。中文输入法环境下这是最常用的检索方式 */
  initials: string
}

/**
 * 把一段文本转成全拼与首字母两种形态。
 *
 * 做法是**逐字取音节再拼**，而不是整串交给 pinyin-pro 猜词：
 * 猜词会把「火腿棒」拆成词，首字母就不是单纯的 huotuibang 了；
 * 逐字虽然朴素，但结果可预测、和用户敲键盘的方式一致。
 */
export function formsWith(fn: PinyinFn, text: string): PinyinForms {
  const chars = [...text]
  let full = ''
  let initials = ''
  for (const char of chars) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const syllable = POLYPHONE[char] ?? ((fn(char, { toneType: 'none', type: 'array' }) as string[])[0] ?? '')
      if (!syllable) continue
      full += syllable
      initials += syllable[0] ?? ''
      continue
    }
    /* 字母数字（含 WX-78 这类英文名）原样保留并转小写 */
    const ascii = char.toLowerCase().replace(/[^a-z0-9]/g, '')
    full += ascii
    initials += ascii
  }
  return { full, initials }
}

/** 懒加载拼音库；拿不到返回 null（调用方据此退回纯文本检索） */
export async function getPinyin(): Promise<PinyinFn | null> {
  return loadPinyin()
}

/** 预热拼音库：加载成功返回 true。组件用它决定提示文案（就绪 / 准备中） */
export async function warmupPinyin(): Promise<boolean> {
  return (await loadPinyin()) !== null
}

/**
 * 把文本转成全拼与首字母 —— **索引侧调用的就是这一个**。
 *
 * 它自己负责懒加载拼音库，所以调用方不需要先拿到 `PinyinFn`，
 * 也不用关心「库有没有加载好」这件事。拿不到库时返回空串，
 * 索引里的拼音形态为空，中文 / 英文 / 别名检索照常工作。
 */
export async function pinyinForms(text: string): Promise<PinyinForms> {
  const fn = await loadPinyin()
  if (!fn) return { full: '', initials: '' }
  return formsWith(fn, text)
}

/**
 * 同步批量转换：给已经预热过的场景用（一次加载、多次调用，避免每个词都 await 一遍）。
 * `fn` 由 `getPinyin()` 提供。
 */
export function makePinyinFormer(fn: PinyinFn) {
  return (text: string): PinyinForms => formsWith(fn, text)
}

/** 拼音函数的类型（与 search.ts 的 PinyinFn 结构一致，两边都不 import 对方） */
export type PinyinLike = PinyinFn