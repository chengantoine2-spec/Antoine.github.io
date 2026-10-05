import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SITE } from '../../data/site'
import { visibleApps } from '../../lib/apps'
import { veggieOfName } from '../../lib/veggies'
import type { DockPosition } from '../../types/desktop'
import { AppIcon } from './AppIcon'

const PLACEMENT: Record<DockPosition, string> = {
  bottom: 'bottom-full left-1/2 mb-3 -translate-x-1/2',
  top: 'top-full left-1/2 mt-3 -translate-x-1/2',
  left: 'left-full top-1/2 ml-3 -translate-y-1/2',
  right: 'right-full top-1/2 mr-3 -translate-y-1/2',
}

interface StartMenuProps {
  open: boolean
  /** 面板从任务栏的反方向弹出 */
  position: DockPosition
  onClose: () => void
}

/** 所有项目总览：桌面图标取消后，这里是查看全部入口的地方。
    每行左边是**功能图标**、右边是**这扇窗分到的那棵菜**（菜图来自 design/veggies）。 */
export function StartMenu({ open, position, onClose }: StartMenuProps) {
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
      <div
        role="dialog"
        aria-label="所有项目"
        className={`absolute z-50 w-72 rounded-dock border border-edge bg-surface p-3 shadow-2xl ${
          PLACEMENT[position]
        }`}
      >
        <p className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-dim">
          <img src={SITE.logo} alt="" width={20} height={20} className="logo-mark h-5 w-5 shrink-0" />
          所有项目
        </p>
        <ul className="grid gap-1">
          {visibleApps().map((app) => {
            const veggie = veggieOfName(app.veggie)
            return (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(app.path)
                    onClose()
                  }}
                  title={`${app.name} · ${app.veggie}`}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-hover"
                >
                  <AppIcon name={app.icon} className="h-4 w-4 shrink-0 text-accent" />
                  <span className="truncate">{app.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {veggie ? (
                      <img src={veggie.src} alt="" width={20} height={20} className="h-5 w-5" />
                    ) : null}
                    <span className="text-[10px] text-dim">{app.veggie}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
