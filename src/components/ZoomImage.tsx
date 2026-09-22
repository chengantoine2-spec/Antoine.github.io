/**
 * 正文图片：点击放大查看原图（灯箱），Esc 或点背景关闭。
 * 无第三方依赖，图片仍走 jsDelivr。图文混排（展示八项 #2）的阅读体验补充。
 */
import { useEffect, useState } from 'react'

export interface ZoomImageProps {
  src?: string
  alt?: string
}

export function ZoomImage({ src, alt = '' }: ZoomImageProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!src) return null

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        title="点击放大"
        onClick={() => setOpen(true)}
        className="cursor-zoom-in"
      />
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-caramel-900/92 p-4"
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="!m-0 max-h-[88vh] max-w-full rounded-lg object-contain"
          />
          {alt && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 max-w-[90vw] -translate-x-1/2 truncate text-sm text-caramel-100">
              {alt}
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭预览"
            className="absolute right-4 top-4 rounded-full border border-caramel-100/40 px-3 py-1 text-sm text-caramel-100 transition hover:bg-caramel-100/10"
          >
            关闭 ✕
          </button>
        </div>
      )}
    </>
  )
}

export default ZoomImage
