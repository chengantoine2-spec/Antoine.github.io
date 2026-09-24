import { getApp } from '../../lib/apps'
import type { AppId } from '../../types/desktop'

interface AppPlaceholderProps {
  id: AppId
  /** 实际命中的路由，用于 /blog/:id 这类带参路径 */
  route?: string
}

/** 未实现的窗口内容占位：只显示窗口名、路由、数据源 */
export function AppPlaceholder({ id, route }: AppPlaceholderProps) {
  const app = getApp(id)

  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold text-ink">{app.name}</h2>
      <p className="text-dim">
        路由：<code className="font-mono text-ink">{route ?? app.path}</code>
      </p>
      <p className="text-dim">
        数据源：<code className="font-mono text-ink">{app.source}</code>
      </p>
      <p className="text-xs text-dim">内容待接入。</p>
    </div>
  )
}
