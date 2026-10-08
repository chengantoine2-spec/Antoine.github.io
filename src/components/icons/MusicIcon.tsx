import { iconBase, type IconProps } from './base'

/** 音乐：一个八分音符（符头 + 符干 + 符尾）。和「终端」那种纯几何剪影区分得开 */
export function MusicIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      {/* 符干 + 符尾（一条斜杠把一个音符连起来） */}
      <path d="M9.4 17V6.6l8.4-1.7V15.2" />
      {/* 两个符头 */}
      <circle cx="7" cy="17" r="2.4" />
      <circle cx="15.4" cy="15.2" r="2.4" />
    </svg>
  )
}
