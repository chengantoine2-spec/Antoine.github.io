import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'
import { headingId } from '../../lib/toc'

/** 把标题里的富文本（加粗、行内代码、链接）压成纯文字，用来算目录 id */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => textOf(child as ReactNode)).join('')
  const props = (node as { props?: { children?: ReactNode } }).props
  return props ? textOf(props.children) : ''
}

/* 表格外面套一层可横向滚动的容器：窗口再窄也不会把正文撑破 */
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
  /* h2 / h3 挂上 id，文章详情页的目录靠它跳转（id 由标题文字推导，见 lib/toc.ts） */
  h2: ({ node: _node, children, ...props }) => (
    <h2 id={headingId(textOf(children))} {...props}>
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 id={headingId(textOf(children))} {...props}>
      {children}
    </h3>
  ),
}

/**
 * 全站唯一的 markdown 渲染入口：样式集中在 globals.css 的 .md 规则里，
 * 颜色全部取自主题令牌，所以三套主题下都是对的。
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
