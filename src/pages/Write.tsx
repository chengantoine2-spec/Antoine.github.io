/**
 * 写博客（仅站长）：/write
 * - 支持 ?edit=<issueNumber> 进入改稿模式
 * - 正文 Markdown + 实时预览（与详情页同一套渲染组件）
 * - ImageUploader 上传后按光标位置插入 jsDelivr 链接
 * - 发布 = 创建 Issue；改稿 = 更新 Issue
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ImageUploader } from '../components/ImageUploader'
import {
  CATEGORY_DAILY,
  CATEGORY_PROJECT,
  SITE,
  createIssue,
  diagnoseAccess,
  explainGitHubError,
  updateIssue,
  type Category,
} from '../lib/github'
import { readingMinutes } from '../lib/text'
import { markdownComponents, rehypePlugins, remarkPlugins } from '../lib/markdown'
import { useAuth, usePat } from '../hooks/useAuth'
import { invalidateBlogs, useBlog } from '../hooks/useBlogs'

const SNIPPETS: Array<{ label: string; text: string }> = [
  { label: '小标题', text: '\n## 小标题\n' },
  { label: '引用', text: '\n> 引用内容\n' },
  { label: '代码块', text: '\n```ts\nconst a = 1\n```\n' },
  { label: '表格', text: '\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n' },
  { label: '列表', text: '\n- 第一项\n- 第二项\n' },
  { label: '分割线', text: '\n---\n' },
]

export default function Write() {
  const [params] = useSearchParams()
  const editId = Number(params.get('edit') || '')
  const isEditing = Number.isFinite(editId) && editId > 0

  const { isLoggedIn, isAdmin, username, configured } = useAuth()
  const pat = usePat()
  /** 发布 = 管理员（或尚未接入账号体系时的过渡态）+ 已保存 GitHub Token */
  const canWrite = pat.hasPat && (!configured || isAdmin)

  const { blog: editing } = useBlog(isEditing ? editId : undefined)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>(CATEGORY_DAILY)
  const [tags, setTags] = useState('')
  const [summary, setSummary] = useState('')
  const [cover, setCover] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preflight, setPreflight] = useState<{
    state: 'idle' | 'checking' | 'ok' | 'bad'
    message: string
  }>({ state: 'idle', message: '' })
  const [loadedEdit, setLoadedEdit] = useState(false)
  const [patInput, setPatInput] = useState('')
  const [patMessage, setPatMessage] = useState('')
  const [patOk, setPatOk] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  /** 进页面先自检：PAT 是否有效、有没有写权限、Issues 是否开着 */
  useEffect(() => {
    if (!canWrite) return
    let alive = true
    setPreflight({ state: 'checking', message: '正在检查发布权限…' })
    diagnoseAccess()
      .then((report) => {
        if (!alive) return
        setPreflight({ state: report.ok ? 'ok' : 'bad', message: report.message })
      })
      .catch((err: unknown) => {
        if (!alive) return
        setPreflight({ state: 'bad', message: explainGitHubError(err, 'write') })
      })
    return () => {
      alive = false
    }
  }, [canWrite])

  // 改稿模式：把 Issue 内容灌进表单（只灌一次，避免覆盖用户输入）
  useEffect(() => {
    if (!isEditing || !editing || loadedEdit) return
    setTitle(editing.title)
    setCategory(editing.category)
    setTags(editing.tags.join(', '))
    setSummary(editing.summary)
    setCover(editing.cover)
    setBody(editing.body)
    setLoadedEdit(true)
  }, [isEditing, editing, loadedEdit])

  /** 在光标处插入文本（用于图片与片段） */
  const insertAtCursor = useCallback((text: string) => {
    const el = bodyRef.current
    if (!el) {
      setBody((prev) => `${prev}\n${text}`)
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + text.length
      el.setSelectionRange(caret, caret)
    })
  }, [])

  const tagList = useMemo(
    () => tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean),
    [tags],
  )

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        body,
        tags: tagList,
        category,
        cover: cover.trim() || undefined,
        summary: summary.trim() || undefined,
      }
      const saved = isEditing ? await updateIssue(editId, payload) : await createIssue(payload)
      invalidateBlogs() // 让首页/列表下次进入时重新拉取，立刻出现新文章
      navigate(`/blog/${saved.id}`)
    } catch (err) {
      setError(explainGitHubError(err, 'write'))
    } finally {
      setSaving(false)
    }
  }

  if (!canWrite) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">写博客</h1>
        <p className="text-caramel-700 dark:text-caramel-200">
          发布需要两个条件：<strong>管理员账号</strong> + 已保存的 <strong>GitHub Token</strong>。
        </p>
        <ul className="space-y-2 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 text-sm dark:border-caramel-700 dark:bg-caramel-800">
          <li>
            1. 账号：
            {isLoggedIn ? (
              <>
                <strong>{username}</strong>
                {isAdmin ? (
                  <span className="ml-2 text-caramel-600 dark:text-caramel-300">管理员 ✓</span>
                ) : (
                  <span className="ml-2 text-caramel-700 dark:text-caramel-200">
                    普通用户，无权写作（需要管理员在后台授权）
                  </span>
                )}
              </>
            ) : (
              <>
                未登录 →{' '}
                <Link to="/login?next=%2Fwrite" className="font-medium underline">
                  去登录
                </Link>{' '}
                或{' '}
                <Link to="/register" className="font-medium underline">
                  注册
                </Link>
              </>
            )}
          </li>
          <li>
            2. 发布凭据：
            {pat.hasPat ? (
              <span className="text-caramel-600 dark:text-caramel-300">已保存 ✓</span>
            ) : (
              <>
                未保存 → 到{' '}
                <Link to="/me" className="font-medium underline">
                  个人中心
                </Link>{' '}
                粘贴一个有 <code>repo</code> 权限的 GitHub Token
              </>
            )}
          </li>
        </ul>

        {isAdmin && !pat.hasPat && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const result = await pat.save(patInput)
              setPatMessage(result.message)
              setPatOk(result.ok)
              if (result.ok) setPatInput('')
            }}
            className="space-y-3 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800"
          >
            <label className="block text-sm text-caramel-700 dark:text-caramel-200" htmlFor="write-pat">
              GitHub Token（勾了 <code>repo</code> 的经典 PAT）
            </label>
            <input
              id="write-pat"
              type="password"
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="ghp_..."
              autoComplete="off"
              className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
            />
            <button
              type="submit"
              disabled={pat.checking}
              className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:opacity-60"
            >
              {pat.checking ? '校验中…' : '保存并继续'}
            </button>
            {patMessage && (
              <p className="text-sm text-caramel-700 dark:text-caramel-200">
                {patOk ? '✓ ' : '⚠ '}
                {patMessage}
              </p>
            )}
          </form>
        )}

        <Link to="/" className="inline-block text-sm text-caramel-600 hover:text-caramel-700 dark:text-caramel-300">
          ← 返回首页
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">
            {isEditing ? `改稿：#${editId}` : '写博客'}
          </h1>
          <p className="mt-1 text-sm text-caramel-600 dark:text-caramel-300">
            发布即创建 GitHub Issue；正文约 {readingMinutes(body)} 分钟阅读时长。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-lg border border-caramel-400 px-3 py-1.5 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
          >
            {showPreview ? '继续编辑' : '预览'}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-caramel-500 px-4 py-1.5 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '提交中…' : isEditing ? '保存修改' : '发布'}
          </button>
        </div>
      </header>

      {/* 发布前自检 + 失败原因：吸顶显示，滚到哪都看得见 */}
      <div className="sticky top-16 z-30 space-y-2">
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            preflight.state === 'bad'
              ? 'border-caramel-500 bg-caramel-200 font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100'
              : 'border-caramel-200 bg-caramel-100 text-caramel-600 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-300'
          }`}
        >
          {preflight.state === 'checking' && '⏳ '}
          {preflight.state === 'ok' && '✓ '}
          {preflight.state === 'bad' && '✗ '}
          目标仓库 <code>{SITE.user}/{SITE.repo}</code>
          {preflight.message ? ` · ${preflight.message}` : ''}
        </p>

        {error && (
          <p className="rounded-lg border border-caramel-500 bg-caramel-200 px-3 py-2 text-sm font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100">
            ⚠ 发布失败：{error}
          </p>
        )}
      </div>

      <section className="grid gap-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 sm:grid-cols-2 dark:border-caramel-700 dark:bg-caramel-800">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">标题 *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="今天想写点什么"
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">分类</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          >
            <option value={CATEGORY_DAILY}>日常（daily）</option>
            <option value={CATEGORY_PROJECT}>项目（project）</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">标签（逗号分隔）</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="前端, 烘焙"
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">
            封面图 URL（jsDelivr，可留空）
          </span>
          <input
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="https://cdn.jsdelivr.net/gh/user/repo@img/2025/01/xxxx.png"
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">摘要（可留空，自动截取首段）</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>
      </section>

      <ImageUploader onInsert={insertAtCursor} />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">正文（Markdown）*</span>
          <div className="flex flex-wrap gap-1">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insertAtCursor(s.text)}
                className="rounded-md border border-caramel-300 px-2 py-0.5 text-xs text-caramel-700 transition hover:bg-caramel-200 dark:border-caramel-600 dark:text-caramel-200 dark:hover:bg-caramel-700"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {showPreview ? (
          <div className="prose-caramel min-h-[24rem] rounded-xl border border-caramel-200 bg-caramel-50 p-5 dark:border-caramel-700 dark:bg-caramel-900">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {body || '_还没有内容_'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={22}
            placeholder={'## 起因\n\n写点什么… 支持表格、代码块、引用与图片'}
            className="w-full rounded-xl border border-caramel-300 bg-caramel-50 p-4 font-mono text-sm leading-relaxed text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-caramel-200 pt-4 text-sm dark:border-caramel-700">
        <span className="text-caramel-600 dark:text-caramel-300">
          {tagList.length > 0 ? `将写入标签：${tagList.map((t) => `#${t}`).join(' ')}` : '未设置标签'}
        </span>
        <div className="flex items-center gap-3">
          {error && (
            <span className="max-w-md text-caramel-700 dark:text-caramel-200">⚠ {error}</span>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-caramel-500 px-5 py-2 font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '提交中…' : isEditing ? '保存修改' : '发布'}
          </button>
        </div>
      </footer>
    </form>
  )
}
