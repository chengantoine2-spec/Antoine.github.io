/** 浏览器全屏 / 退出全屏：四角朝外 = 进全屏，四角朝内 = 退出（一眼能看出当前状态） */
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
          <path d="M5 1.5V5H1.5" />
          <path d="M7 1.5V5h3.5" />
          <path d="M5 10.5V7H1.5" />
          <path d="M7 10.5V7h3.5" />
        </>
      ) : (
        <>
          <path d="M1.5 5V1.5H5" />
          <path d="M10.5 5V1.5H7" />
          <path d="M1.5 7v3.5H5" />
          <path d="M10.5 7v3.5H7" />
        </>
      )}
    </svg>
  )
}
