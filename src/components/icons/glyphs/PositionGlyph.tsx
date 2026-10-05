import type { DockPosition } from '../../../types/desktop'

/** 任务栏位置示意图标：外框 + 停在对应边上的粗条。
    任务栏的「位置」按钮、位置菜单、设置窗口三处共用。 */
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
