import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

/* 表格外面套一层可横向滚动的容器：窗口再窄也不会把正文撑破 */
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
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
