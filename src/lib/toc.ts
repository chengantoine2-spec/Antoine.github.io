/**
 * 文章目录：从 markdown 正文里抽出 ## / ###，并给标题算一个稳定 id。
 *
 * id 由**标题文字本身**推导，不是序号 —— 这样 Markdown 组件（挂 id）和详情页（生成目录）
 * 各自算一遍就能对上，不需要共享计数器；StrictMode 下渲染两次也不会错位。
 * 两边的清洗规则必须保持一致：先把链接压成文字，再抹掉非字母数字汉字。
 */

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

/** 标题文字 → DOM id（Markdown.tsx 与这里必须得出同样结果） */
export function headingId(text: string): string {
  return `h-${text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase().slice(0, 60)}`
}

/** 从正文抽目录；围栏代码块里的 # 不算标题 */
export function extractToc(body: string): TocItem[] {
  const items: TocItem[] = []
  let inFence = false

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    /* 与渲染结果对齐：链接只留文字，强调/行内代码的记号去掉 */
    const text = match[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim()
    if (!text) continue

    items.push({ id: headingId(text), text, level: match[1].length as 2 | 3 })
  }

  return items
}
