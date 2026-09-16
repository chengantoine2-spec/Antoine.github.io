/**
 * Giscus 挂载：评论 + 点赞（reactions）全部由 GitHub Discussions 托管。
 * 主题跟随站点亮暗切换：监听 caramel:theme 事件 + html class 变化，调 setConfig。
 */
import { useEffect, useRef, useState } from 'react'
import {
  GISCUS,
  GISCUS_IFRAME_CLASS,
  giscusThemeFor,
  isGiscusConfigured,
  resolveGiscusTerm,
  setGiscusTheme,
} from '../lib/giscus'

export interface GiscusProps {
  /** Issue number，用于 number 映射 */
  blogId: number
  /** 标题，用于 specific 映射 */
  title?: string
  className?: string
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function Giscus({ blogId, title, className = '' }: GiscusProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const configured = isGiscusConfigured()

  // 挂载脚本
  useEffect(() => {
    if (!configured) return
    const host = hostRef.current
    if (!host) return
    host.innerHTML = ''

    const { mapping, term } = resolveGiscusTerm(blogId, title)
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    const data: Record<string, string> = {
      repo: GISCUS.repo,
      repoId: GISCUS.repoId,
      category: GISCUS.category,
      categoryId: GISCUS.categoryId,
      mapping,
      strict: GISCUS.strict,
      reactionsEnabled: GISCUS.reactionsEnabled,
      emitMetadata: GISCUS.emitMetadata,
      inputPosition: GISCUS.inputPosition,
      theme: giscusThemeFor(currentTheme() === 'dark'),
      lang: GISCUS.lang,
      loading: GISCUS.loading,
    }
    if (term) data.term = term
    Object.entries(data).forEach(([key, value]) => script.setAttribute(`data-${key}`, value))
    script.onload = () => setReady(true)
    // giscus iframe 自带 giscus-frame class，这里补一层便于 setConfig 定位
    script.setAttribute('data-iframe-class', GISCUS_IFRAME_CLASS)
    host.appendChild(script)

    return () => {
      host.innerHTML = ''
      setReady(false)
    }
  }, [blogId, title, configured])

  // 主题同步
  useEffect(() => {
    if (!configured) return
    const sync = () => setGiscusTheme(giscusThemeFor(currentTheme() === 'dark'))
    const onSiteTheme = () => sync()
    window.addEventListener('caramel:theme', onSiteTheme)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const timer = window.setTimeout(sync, 1200) // 脚本加载完成后再补一次
    return () => {
      window.removeEventListener('caramel:theme', onSiteTheme)
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [configured, ready])

  if (!configured) {
    return (
      <div
        className={`rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-6 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200 ${className}`}
      >
        <p className="font-medium">评论与点赞需要先配置 Giscus</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-caramel-600 dark:text-caramel-300">
          <li>在仓库 Settings → General → Features 打开 Discussions</li>
          <li>到 giscus.app 安装 app 并选择仓库与 Discussion 分类</li>
          <li>
            把生成的 <code>repo-id</code> / <code>category-id</code> 填进{' '}
            <code>.env</code>（VITE_GISCUS_REPO_ID / VITE_GISCUS_CATEGORY_ID）
          </li>
        </ol>
      </div>
    )
  }

  return <div ref={hostRef} className={`giscus-host ${className}`} data-ready={ready} />
}

export default Giscus
