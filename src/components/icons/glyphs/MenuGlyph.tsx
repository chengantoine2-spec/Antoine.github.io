/** 任务栏最左的「所有项目」：九宫格实心点（唯一的 fill 用法，其余图标都是线稿） */
export function MenuGlyph({ className = 'h-1/2 w-1/2' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {[7, 12, 17].map((y) =>
        [7, 12, 17].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />),
      )}
    </svg>
  )
}
