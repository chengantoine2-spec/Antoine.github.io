import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { APPS } from '../../lib/apps'
import { AppIcon } from './AppIcon'

interface StartMenuProps {
  open: boolean
  /** Ubuntu 的 Dock 在左侧，菜单要往右弹；Win11 任务栏在底部，菜单往上弹 */
  vertical: boolean
  onClose: () => void
}

/** 所有项目总览：桌面图标取消后，这里是查看全部入口的地方 */
export function StartMenu({ open, vertical, onClose }: StartMenuProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* 面板外任意处点击即收起 */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-label="所有项目"
        className={`absolute z-50 w-72 rounded-dock border border-edge bg-surface p-3 shadow-2xl ${
          vertical
            ? 'left-full top-1/2 ml-3 -translate-y-1/2'
            : 'bottom-full left-1/2 mb-3 -translate-x-1/2'
        }`}
      >
        <p className="mb-2 px-1 text-xs font-medium text-dim">所有项目</p>
        <ul className="grid grid-cols-2 gap-1">
          {APPS.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => {
                  navigate(app.path)
                  onClose()
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-ink hover:bg-hover"
              >
                <AppIcon name={app.icon} className="h-4 w-4 text-accent" />
                <span className="truncate">{app.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
