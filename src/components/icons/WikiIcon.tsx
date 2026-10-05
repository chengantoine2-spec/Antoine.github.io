import { iconBase, type IconProps } from './base'

/** 饥荒 Wiki：一本摊开的书 */
export function WikiIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <path d="M12 7.4C10.6 6.1 8.7 5.4 6.5 5.4H4v12.2h2.5c2.2 0 4.1.7 5.5 2 1.4-1.3 3.3-2 5.5-2H20V5.4h-2.5c-2.2 0-4.1.7-5.5 2z" />
      <path d="M12 7.4v12.2" />
    </svg>
  )
}
