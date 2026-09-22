/**
 * react-markdown 配置（重依赖，只被详情页 / 写博客页按需加载）。
 *
 * 关键点：
 * - 标题 id 由「slug + 源码行号」生成，与 lib/text.ts 的 extractHeadings 用同一算法，
 *   渲染器读 hast node.position.start.line，两侧天然对齐，不需要 rehype-slug。
 * - 代码块交给 CodeBlock 组件（高亮结构 + 复制按钮）。
 *
 * 注意：纯文本工具（日期、阅读时长、TOC 抽取）在 lib/text.ts，
 * 别从这里导入，否则会把 react-markdown / highlight 带进首屏包。
 */
import { createElement, type ReactNode } from 'react'
import type { Components, Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { CodeBlock } from '../components/CodeBlock'
import { ZoomImage } from '../components/ZoomImage'
import { headingId } from './text'

export const remarkPlugins: Options['remarkPlugins'] = [remarkGfm]

/** detect:false 只处理显式 ```lang 代码块；ignoreMissing 避免未知语言报错 */
export const rehypePlugins: Options['rehypePlugins'] = [
  [rehypeHighlight, { detect: false, ignoreMissing: true }],
]

/** 从 React children 里取纯文本（标题里可能含行内代码/加粗） */
function textOf(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOf).join('')
  const el = children as { props?: { children?: ReactNode } }
  return el.props ? textOf(el.props.children) : ''
}

type NodeWithPosition = { position?: { start?: { line?: number } } }

function heading(level: number) {
  const tag = `h${level}` as 'h1'
  return function Heading({ children, node }: { children?: ReactNode; node?: NodeWithPosition }) {
    const line = node?.position?.start?.line
    const id = headingId(textOf(children), line)
    // 标题末尾挂一个可复制的锚点链接（hover 才显形），方便分享到具体小节
    return createElement(tag, { id, className: 'heading' }, [
      createElement('span', { key: 'text' }, children),
      createElement(
        'a',
        {
          key: 'anchor',
          href: `#${id}`,
          className: 'heading-anchor',
          'aria-label': '此小节的链接',
          title: '复制到地址栏即可分享这一节',
        },
        '#',
      ),
    ])
  }
}

export const markdownComponents: Components = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  // 块级代码：react-markdown 生成 <pre><code class="language-x hljs">…</code></pre>
  // 这里把「已高亮的 code 元素」原样交给 CodeBlock 渲染，另外把纯文本传给它做复制。
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children
    const props = (child as { props?: { className?: string; children?: ReactNode } })?.props
    const className = props?.className || ''
    const language = /language-([\w-]+)/.exec(className)?.[1]
    const raw = textOf(props?.children).replace(/\n$/, '')
    return createElement(CodeBlock, { language, code: raw }, child)
  },
  // 行内代码（块级已被 pre 拦截）
  code({ children }) {
    return createElement('code', null, children)
  },
  a({ href, children }) {
    const external = !!href && /^https?:\/\//.test(href)
    return createElement(
      'a',
      external ? { href, target: '_blank', rel: 'noreferrer noopener' } : { href },
      children,
    )
  },
  img({ src, alt }) {
    return createElement(ZoomImage, { src, alt: alt || '' })
  },
  table({ children }) {
    return createElement('div', { className: 'overflow-x-auto' }, createElement('table', null, children))
  },
}
