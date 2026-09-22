/**
 * 编辑时插图：选文件 / 拖拽 / 粘贴 → 上传到仓库 img 分支 → 回调插入 ![](jsDelivr URL)。
 * 需要站长 PAT；未登录时不给上传入口。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { SITE, isConfigured, jsdelivrUrl, uploadImage } from '../lib/github'
import { usePat } from '../hooks/useAuth'

export interface ImageUploaderProps {
  /** 上传成功后把 Markdown 片段插到正文光标处 */
  onInsert: (markdown: string) => void
  disabled?: boolean
}

interface Uploaded {
  url: string
  path: string
  name: string
}

export function ImageUploader({ onInsert, disabled = false }: ImageUploaderProps) {
  const { hasPat } = usePat()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Uploaded[]>([])
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (list.length === 0) {
        setError('只支持图片文件（png / jpg / webp / gif / svg / avif）')
        return
      }
      if (!isConfigured()) {
        setError('尚未配置 GitHub 仓库，无法上传')
        return
      }
      if (!hasPat) {
        setError('请先登录站长 PAT，再上传图片')
        return
      }
      setBusy(true)
      setError('')
      for (const file of list) {
        try {
          const { path, url } = await uploadImage(file)
          const alt = file.name.replace(/\.[^.]+$/, '')
          onInsert(`![${alt}](${url})`)
          setDone((prev) => [{ url, path, name: file.name }, ...prev].slice(0, 6))
        } catch (err) {
          setError(err instanceof Error ? err.message : '上传失败')
        }
      }
      setBusy(false)
    },
    [onInsert, hasPat],
  )

  // 支持直接粘贴剪贴板图片
  useEffect(() => {
    if (disabled) return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || [])
      if (files.some((f) => f.type.startsWith('image/'))) {
        void handleFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFiles, disabled])

  return (
    <section className="space-y-2" aria-label="插入图片">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) void handleFiles(e.dataTransfer.files)
        }}
        className={`rounded-xl border border-dashed px-4 py-4 text-sm transition ${
          dragging
            ? 'border-caramel-500 bg-caramel-200 dark:bg-caramel-700'
            : 'border-caramel-300 bg-caramel-100 dark:border-caramel-600 dark:bg-caramel-800'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-caramel-500 px-3 py-1.5 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? '上传中…' : '选择图片'}
          </button>
          <span className="text-caramel-600 dark:text-caramel-300">
            或拖拽到这里 / 直接粘贴剪贴板图片
          </span>
        </div>
        <p className="mt-2 text-xs text-caramel-600 dark:text-caramel-300">
          上传到 <code>{SITE.user}/{SITE.repo}@{SITE.imgBranch}</code> 的{' '}
          <code>yyyy/mm/hash.ext</code>，正文只存 jsDelivr 链接（禁止 base64）。
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {!hasPat && !disabled && (
        <p className="text-xs text-caramel-600 dark:text-caramel-300">
          未登录：上传走站长 PAT，登录后再来插图。
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-caramel-400 bg-caramel-100 px-3 py-2 text-xs text-caramel-700 dark:bg-caramel-800 dark:text-caramel-200">
          {error}
        </p>
      )}

      {done.length > 0 && (
        <ul className="space-y-1 text-xs">
          {done.map((item) => (
            <li key={item.path} className="flex items-center gap-2 text-caramel-700 dark:text-caramel-200">
              <span className="truncate">✓ {item.name}</span>
              <code className="truncate text-caramel-600 dark:text-caramel-300">{item.path}</code>
              <button
                type="button"
                onClick={() => onInsert(`![](${jsdelivrUrl(item.path)})`)}
                className="shrink-0 rounded border border-caramel-300 px-1.5 py-0.5 transition hover:bg-caramel-200 dark:border-caramel-600 dark:hover:bg-caramel-700"
              >
                再插入
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ImageUploader
