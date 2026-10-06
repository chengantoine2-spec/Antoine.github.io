import { PositionGlyph } from '../icons'
import { DOCK_ORDER, isVertical } from '../../lib/dock'
import type { DockPosition } from '../../types/desktop'

const PLACEMENT: Record<DockPosition, string> = {
  bottom: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  top: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'left-full top-1/2 ml-2 -translate-y-1/2',
  right: 'right-full top-1/2 mr-2 -translate-y-1/2',
}

const LABEL: Record<DockPosition, string> = {
  bottom: '底部',
  top: '顶部',
  left: '左侧',
  right: '右侧',
}

interface DockPositionMenuProps {
  open: boolean
  position: DockPosition
  onPick: (position: DockPosition) => void
  /**
   * 覆盖默认的展开方向（默认按任务栏停在哪边往哪儿弹）。
   * 2026-10-06（macOS P2）：这个菜单现在挂在**顶部菜单栏**里，需要从栏的下沿往下展开，
   * 所以那边传 `'top-full right-0 mt-1'`。
   */
  placementClass?: string
}

/** 位置按钮点开后展开的四个位置选项（保持展开，直到选位置 / 点别处 / Esc） */
export function DockPositionMenu({ open, position, onPick, placementClass }: DockPositionMenuProps) {
  if (!open) return null

  return (
    <div
      role="menu"
      aria-label="任务栏位置"
      className={`absolute z-50 flex gap-1 rounded-dock border border-edge bg-surface p-1.5 shadow-2xl ${
        placementClass ?? PLACEMENT[position]
      } ${isVertical(position) ? 'flex-col' : ''}`}
    >
      {DOCK_ORDER.map((p) => (
        <button
          key={p}
          type="button"
          role="menuitemradio"
          aria-checked={p === position}
          aria-label={LABEL[p]}
          title={LABEL[p]}
          onClick={() => onPick(p)}
          className={`grid h-8 w-8 place-items-center rounded ${
            p === position ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
          }`}
        >
          <PositionGlyph position={p} className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
