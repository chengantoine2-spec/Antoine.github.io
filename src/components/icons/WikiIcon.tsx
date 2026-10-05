import { iconBase, type IconProps } from './base'

/** 饥荒 Wiki：一本摊开的书（书脊 + 两页） */
export function WikiIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 7.2C10.7 6 8.8 5.4 6.6 5.4H4.2v12.4h2.4c2.2 0 4.1.6 5.4 1.8 1.3-1.2 3.2-1.8 5.4-1.8h2.4V5.4h-2.4c-2.2 0-4.1.6-5.4 1.8z" />
      <path d="M12 7.2v12.4" />
    </svg>
  )
}
