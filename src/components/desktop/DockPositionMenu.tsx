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

/** 位置示意图标：外框 + 停在对应边上的粗条 */
export function PositionGlyph({
  position,
  className = 'h-5 w-5',
}: {
  position: DockPosition
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {position === 'bottom' ? (
        <rect x="6" y="16.5" width="12" height="2.5" rx="1.2" fill="currentColor" />
      ) : null}
      {position === 'top' ? (
        <rect x="6" y="5" width="12" height="2.5" rx="1.2" fill="currentColor" />
      ) : null}
      {position === 'left' ? (
        <rect x="5" y="6" width="2.5" height="12" rx="1.2" fill="currentColor" />
      ) : null}
      {position === 'right' ? (
        <rect x="16.5" y="6" width="2.5" height="12" rx="1.2" fill="currentColor" />
      ) : null}
    </svg>
  )
}

interface DockPositionMenuProps {
  open: boolean
  position: DockPosition
  onPick: (position: DockPosition) => void
}

/** 位置按钮点开后展开的四个位置选项（保持展开，直到选位置 / 点别处 / Esc） */
export function DockPositionMenu({ open, position, onPick }: DockPositionMenuProps) {
  if (!open) return null

  return (
    <div
      role="menu"
      aria-label="任务栏位置"
      className={`absolute z-50 flex gap-1 rounded-dock border border-edge bg-surface p-1.5 shadow-2xl ${
        PLACEMENT[position]
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
