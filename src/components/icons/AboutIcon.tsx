import { iconBase, type IconProps } from './base'

/** 关于：胸像 —— 头 + 整半圆肩线，重心落在 12 上（别改成两段折线，16px 会散） */
export function AboutIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <circle cx="12" cy="7.8" r="3.3" />
      <path d="M5.4 19.8A6.6 6.6 0 0 1 18.6 19.8" />
    </svg>
  )
}
