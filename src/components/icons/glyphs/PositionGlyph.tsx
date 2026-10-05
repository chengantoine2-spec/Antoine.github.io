import type { DockPosition } from '../../../types/desktop'

/** 任务栏位置示意图标：外框 + 停在对应边上的粗条。
    任务栏的「位置」按钮、位置菜单、设置窗口三处共用。

    ⚠️ 走 **12 网格 / 线宽 1.2**，和 FullscreenGlyph、MaximizeGlyph 同一套 ——
    这三张都画在很小的按钮里，相对线宽必须比 24 网格的图标粗，视觉重量才齐。
    曾经这里是 24 网格 / 1.4：同一个 22px 盒子里，全屏是 2.2px、位置只有 1.3px，
    并排站在任务栏上粗细差一倍（几何数值就是老版本按 1/2 折过来的，别随手改）。 */
export function PositionGlyph({
  position,
  className = 'h-5 w-5',
}: {
  position: DockPosition
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" />
      {position === 'bottom' ? (
        <rect x="3" y="8.25" width="6" height="1.25" rx="0.6" fill="currentColor" />
      ) : null}
      {position === 'top' ? (
        <rect x="3" y="2.5" width="6" height="1.25" rx="0.6" fill="currentColor" />
      ) : null}
      {position === 'left' ? (
        <rect x="2.5" y="3" width="1.25" height="6" rx="0.6" fill="currentColor" />
      ) : null}
      {position === 'right' ? (
        <rect x="8.25" y="3" width="1.25" height="6" rx="0.6" fill="currentColor" />
      ) : null}
    </svg>
  )
}
