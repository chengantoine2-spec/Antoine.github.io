/** 标题栏的「最大化 / 还原」。
    用矢量而不是 □ 字形：字形里没有可靠的"两个叠起来的方块"，而且矢量能跟着
    text-dim / hover:text-ink 走，不写死颜色。 */
export function MaximizeGlyph({
  maximized,
  className = 'h-3 w-3',
}: {
  /** true = 当前已最大化，画"两个叠起来的方块" */
  maximized: boolean
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
    >
      {maximized ? (
        <>
          <rect x="1.5" y="3.5" width="7" height="7" rx="1.2" />
          <path d="M4.2 3.4V2.9A1.1 1.1 0 0 1 5.3 1.8H9.6A1.1 1.1 0 0 1 10.7 2.9V7.2A1.1 1.1 0 0 1 9.6 8.3H8.4" />
        </>
      ) : (
        <rect x="1.5" y="1.5" width="9" height="9" rx="1.3" />
      )}
    </svg>
  )
}
