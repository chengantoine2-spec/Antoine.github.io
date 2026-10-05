import type { IconName } from '../../types/desktop'
import { ICON_SET } from '../icons'

/**
 * 应用图标的外壳：把 IconName 翻成真正的图形。
 *
 * 画本身在 `src/components/icons/`（一个图标一个文件 + 一张 ICON_SET 登记表），
 * 这里只做查表 —— 以后换美术不用动外壳、任务栏、窗口。
 */
export function AppIcon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }) {
  const Icon = ICON_SET[name]
  if (!Icon) return null
  return <Icon className={className} />
}
