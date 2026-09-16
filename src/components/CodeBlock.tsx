/**
 * 代码块：语法高亮（rehype-highlight 已产出的 hljs 结构）+ 一键复制。
 * 复制按钮用 navigator.clipboard，失败时回落到 textarea + execCommand。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface CodeBlockProps {
  /** ```后面的语言标识 */
  language?: string
  /** 纯文本源码，用于复制 */
  code: string
  /** 已高亮的 code 元素（由 react-markdown 传入） */
  children?: ReactNode
}

const LANG_LABEL: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  html: 'HTML',
  css: 'CSS',
  md: 'Markdown',
  markdown: 'Markdown',
  py: 'Python',
  python: 'Python',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  diff: 'Diff',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  text: 'Text',
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 继续走回落方案 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function CodeBlock({ language, code, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  const label = useMemo(() => {
    if (!language) return 'Code'
    return LANG_LABEL[language.toLowerCase()] || language.toUpperCase()
  }, [language])

  const onCopy = useCallback(async () => {
    const ok = await copyText(code)
    setCopied(ok)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }, [code])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  return (
    <figure className="group relative my-6 overflow-hidden rounded-xl border border-caramel-200 bg-caramel-100 dark:border-caramel-700 dark:bg-caramel-800">
      <figcaption className="flex items-center justify-between gap-2 border-b border-caramel-200 px-3 py-1.5 dark:border-caramel-700">
        <span className="font-mono text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? '已复制' : '复制代码'}
          className="no-print rounded-md border border-caramel-300 bg-caramel-50 px-2 py-0.5 text-xs font-medium text-caramel-700 transition hover:border-caramel-500 hover:bg-caramel-200 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-200 dark:hover:bg-caramel-700"
        >
          {copied ? '已复制 ✓' : '复制'}
        </button>
      </figcaption>
      <pre className="m-0 overflow-x-auto border-0 bg-transparent p-4">{children}</pre>
    </figure>
  )
}
