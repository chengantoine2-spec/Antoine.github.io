/**
 * 封面图：无图时给一块焦糖色渐变占位，加载失败也回落到占位，避免破图。
 */
import { useEffect, useState } from 'react'

export interface CoverProps {
  src?: string
  alt?: string
  /** 卡片缩略图 / 详情大图 */
  variant?: 'card' | 'hero' | 'thumb'
  /** 占位图上的小字（通常取标题首字或分类） */
  label?: string
  className?: string
}

const RATIO: Record<NonNullable<CoverProps['variant']>, string> = {
  card: 'aspect-[16/9]',
  hero: 'aspect-[21/9]',
  thumb: 'aspect-square',
}

export function Cover({ src, alt = '', variant = 'card', label, className = '' }: CoverProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const showImage = !!src && !failed
  const initial = (label || alt || '焦').trim().slice(0, 1).toUpperCase()

  return (
    <div
      className={`relative overflow-hidden ${RATIO[variant]} ${
        showImage ? 'bg-caramel-200 dark:bg-caramel-800' : 'bg-caramel-200 dark:bg-caramel-800'
      } ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-caramel-200 via-caramel-300 to-caramel-500 dark:from-caramel-800 dark:via-caramel-700 dark:to-caramel-600">
          <span className="select-none text-3xl font-bold text-caramel-100 drop-shadow-sm dark:text-caramel-900">
            {initial}
          </span>
        </div>
      )}
    </div>
  )
}
