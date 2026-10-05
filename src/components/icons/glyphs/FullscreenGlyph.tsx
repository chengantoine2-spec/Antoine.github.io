/** 浏览器全屏 / 退出全屏：四角朝外 = 进全屏，四角朝内 = 退出（一眼能看出当前状态）。
    和 MaximizeGlyph、PositionGlyph 一套：**12 网格 / 线宽 1.2 / 圆头圆角**。

    ⚠️ 四个角之间的空隙是 2.4 格，别收到 2 格以内：16px 下线宽折合 1.6px，
       空隙小于线宽时四个角会糊成一个十字（"已全屏"就认不出来了）。 */
export function FullscreenGlyph({
  on,
  className = 'h-1/2 w-1/2',
}: {
  /** true = 当前已全屏，画"四角朝内" */
  on: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {on ? (
        <>
          <path d="M4.8 1.5V4.8H1.5" />
          <path d="M7.2 1.5V4.8H10.5" />
          <path d="M4.8 10.5V7.2H1.5" />
          <path d="M7.2 10.5V7.2H10.5" />
        </>
      ) : (
        <>
          <path d="M1.5 4.8V1.5H4.8" />
          <path d="M10.5 4.8V1.5H7.2" />
          <path d="M1.5 7.2v3.3H4.8" />
          <path d="M10.5 7.2v3.3H7.2" />
        </>
      )}
    </svg>
  )
}
