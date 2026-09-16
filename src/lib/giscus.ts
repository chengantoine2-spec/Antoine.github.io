/**
 * Giscus 配置与挂载工具。
 *
 * 需要补齐：仓库开启 Discussions → 安装 giscus app → 在 https://giscus.app 取
 * data-repo-id / data-category-id，填到下面（或用 .env 的 VITE_GISCUS_* 注入）。
 * 主题跟随站点亮暗色切换走 setConfig()（见 setGiscusTheme）。
 */

export const GISCUS = {
  repo: (import.meta.env.VITE_GISCUS_REPO as string) || 'chengantoine2-spec/Antoine.github.io',
  repoId: (import.meta.env.VITE_GISCUS_REPO_ID as string) || 'TODO_REPO_ID',
  category: (import.meta.env.VITE_GISCUS_CATEGORY as string) || 'Announcements',
  categoryId: (import.meta.env.VITE_GISCUS_CATEGORY_ID as string) || 'TODO_CATEGORY_ID',
  mapping: (import.meta.env.VITE_GISCUS_MAPPING as string) || 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  lang: (import.meta.env.VITE_GISCUS_LANG as string) || 'zh-CN',
  loading: 'lazy',
} as const

export const GISCUS_IFRAME_CLASS = 'giscus-frame'

export type GiscusTheme = 'light' | 'dark' | 'preferred_color_scheme'

/** 是否已配置好 repoId / categoryId */
export const isGiscusConfigured = (): boolean =>
  !GISCUS.repoId.startsWith('TODO') && !GISCUS.categoryId.startsWith('TODO')

export const giscusThemeFor = (isDark: boolean): GiscusTheme => (isDark ? 'dark' : 'light')

/** 站点主题切换时调用：向 giscus iframe 广播 setConfig */
export function setGiscusTheme(theme: GiscusTheme): void {
  const iframe = document.querySelector<HTMLIFrameElement>(`iframe.${GISCUS_IFRAME_CLASS}`)
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app')
}

/**
 * Giscus 的 Discussions 映射。
 * AGENTS 要求「Issue 与 Discussion 通过标题或 number 映射」：
 * - 默认 mapping=pathname，即 /blog/123 → Discussion 标题为 /blog/123
 * - 想按标题映射可把 mapping 换成 specific + term（见 resolveGiscusTerm）
 */
export function resolveGiscusTerm(blogId: number, blogTitle?: string): { mapping: string; term?: string } {
  if (GISCUS.mapping === 'specific' && blogTitle) return { mapping: 'specific', term: blogTitle }
  if (GISCUS.mapping === 'number') return { mapping: 'number', term: String(blogId) }
  return { mapping: GISCUS.mapping }
}
