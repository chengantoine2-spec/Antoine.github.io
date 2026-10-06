import { iconBase, type IconProps } from './base'

/** 塔罗牌：一张牌 + 牌面上的星与月牙（正逆位、星月都是塔罗牌面的常见母题） */
export function TarotIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      {/* 牌 */}
      <rect x="6" y="3" width="12" height="18" rx="2" />
      {/* 四角星 */}
      <path d="M12 6.4l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" />
      {/* 月牙 */}
      <path d="M13.4 12.6a3 3 0 100 5 3.7 3.7 0 010-5z" />
    </svg>
  )
}
