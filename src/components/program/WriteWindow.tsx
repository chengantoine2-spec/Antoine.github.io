import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import {
  clearBlogCache,
  clearImageCache,
  createIssue,
  deleteIssue,
  listImages,
  readToken,
  saveToken,
  setIssueState,
  updateIssue,
  uploadImage,
  verifyToken,
  type BlogPost,
  type StoredImage,
} from '../../lib/github'

/* markdown 是懒加载的；提前预热 + startTransition 切换，避免"同步更新里挂起"那个 React 报错 */
const Markdown = lazy(() => import('./Markdown').then((mod) => ({ default: mod.Markdown })))

type Category = 'daily' | 'project' | 'none'
type ViewMode = 'edit' | 'split' | 'preview'

type Draft = {
  /** null = 新建 */
  number: number | null
  title: string
  body: string
  category: Category
  tags: string
}

const EMPTY_DRAFT: Draft = { number: null, title: '', body: '', category: 'daily', tags: '' }
const DRAFT_KEY = 'desktop.draft'

function draftFromPost(post: BlogPost): Draft {
  return {
    number: post.id,
    title: post.title,
    body: post.body,
    category: post.category === 'other' ? 'none' : post.category,
    tags: post.labels.filter((label) => label !== 'daily' && label !== 'project').join(', '),
  }
}

const inputCls =
  'w-full rounded border border-edge bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-dim'

const smallBtnCls =
  'rounded border border-edge px-2.5 py-1 text-xs text-ink hover:bg-hover disabled:opacity-50'

const toolBtnCls =
  'grid h-7 min-w-7 place-items-center rounded border border-edge px-1.5 text-[11px] text-ink hover:bg-hover'

/** markdown 工具栏：作用于选区 */
const TOOLS: Array<{ label: string; title: string; kind: 'wrap' | 'block'; before: string; after?: string; placeholder?: string }> = [
  { label: 'H2', title: '二级标题', kind: 'block', before: '## ' },
  { label: 'H3', title: '三级标题', kind: 'block', before: '### ' },
  { label: 'B', title: '加粗 (Ctrl+B)', kind: 'wrap', before: '**', placeholder: '粗体' },
  { label: 'I', title: '斜体 (Ctrl+I)', kind: 'wrap', before: '*', placeholder: '斜体' },
  { label: 'S', title: '删除线', kind: 'wrap', before: '~~', placeholder: '删除线' },
  { label: '` `', title: '行内代码', kind: 'wrap', before: '`', placeholder: 'code' },
  { label: '```', title: '代码块', kind: 'wrap', before: '```\n', after: '\n```', placeholder: 'code' },
  { label: '❝', title: '引用', kind: 'block', before: '> ' },
  { label: '•', title: '无序列表', kind: 'block', before: '- ' },
  { label: '1.', title: '有序列表', kind: 'block', before: '1. ' },
  { label: '表', title: '插入表格', kind: 'block', before: '| 列1 | 列2 |\n| --- | --- |\n|  |  |' },
  { label: '🔗', title: '链接 (Ctrl+K)', kind: 'wrap', before: '[', after: '](https://)', placeholder: '链接文字' },
]

/** 「博客创作」窗口：用本机 PAT 增改 GitHub Issues（= 文章），并管理 img 分支里的图片 */
export function WriteWindow() {
  const { feed, loading, refresh } = useBlogFeed()
  const [token, setToken] = useState(readToken)
  const [tokenInput, setTokenInput] = useState(readToken)
  const [who, setWho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [view, setView] = useState<ViewMode>('split')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [pendingDraft, setPendingDraft] = useState<{ draft: Draft; savedAt: number } | null>(null)
  const [images, setImages] = useState<StoredImage[]>([])
  const [imgLoading, setImgLoading] = useState(true)
  const [imgError, setImgError] = useState<string | null>(null)

  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void import('./Markdown')
  }, [])

  /* 打开时看看有没有上次没发出去的草稿 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { draft?: Draft; savedAt?: number }
      if (parsed.draft && (parsed.draft.title.trim() || parsed.draft.body.trim())) {
        setPendingDraft({ draft: parsed.draft, savedAt: parsed.savedAt ?? 0 })
      }
    } catch {
      /* 草稿坏了就忽略 */
    }
  }, [])

  /* 编辑中自动存草稿（防误关窗口丢内容）；发布/取消后清掉 */
  useEffect(() => {
    if (!draft) return
    if (!draft.title.trim() && !draft.body.trim()) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, savedAt: Date.now() }))
        setSavedAt(Date.now())
      } catch {
        /* 写不进去就算了 */
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [draft])

  function clearStoredDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* 同上 */
    }
    setSavedAt(null)
    setPendingDraft(null)
  }

  const loadImages = useCallback(async (force = false) => {
    setImgLoading(true)
    setImgError(null)
    try {
      setImages(await listImages({ force }))
    } catch (error) {
      setImgError(error instanceof Error ? error.message : '读取图片失败')
    } finally {
      setImgLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadImages()
  }, [loadImages])

  const posts = feed?.posts ?? []

  function applyToken(next: string) {
    const trimmed = next.trim()
    saveToken(trimmed)
    setToken(trimmed)
    setWho(null)
    setNotice(null)
    setDraft(null)
  }

  async function checkToken() {
    setBusy(true)
    setNotice(null)
    try {
      const login = await verifyToken(token)
      setWho(login)
      setNotice({ kind: 'ok', text: `Token 有效，登录名：${login}` })
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '验证失败' })
    } finally {
      setBusy(false)
    }
  }

  /** 用前缀/后缀包住选区（工具栏与快捷键共用） */
  function wrapSelection(before: string, after = before, placeholder = '') {
    if (!draft) return
    const el = bodyRef.current
    const value = draft.body
    const at = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    const selected = value.slice(at, end) || placeholder
    const next = value.slice(0, at) + before + selected + after + value.slice(end)
    setDraft({ ...draft, body: next })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(at + before.length, at + before.length + selected.length)
    })
  }

  /** 在光标处整行插入（标题、列表、表格…） */
  function insertBlock(text: string) {
    if (!draft) return
    const el = bodyRef.current
    const value = draft.body
    const at = el ? el.selectionStart : value.length
    const prefix = at > 0 && !value.slice(0, at).endsWith('\n') ? '\n' : ''
    const snippet = `${prefix}${text}\n`
    const next = value.slice(0, at) + snippet + value.slice(at)
    setDraft({ ...draft, body: next })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      /* 光标停在末尾换行之前：插完标题/列表/引用能接着打字，而不是跳到下一行 */
      const pos = at + prefix.length + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  function runTool(tool: (typeof TOOLS)[number]) {
    if (tool.kind === 'wrap') wrapSelection(tool.before, tool.after ?? tool.before, tool.placeholder)
    else insertBlock(tool.before)
  }

  /** 把图片 markdown 插到正文光标处；返回是否真的插进去了 */
  function insertIntoBody(markdown: string): boolean {
    if (!draft) return false
    const el = bodyRef.current
    const at = el ? el.selectionStart : draft.body.length
    const end = el ? el.selectionEnd : draft.body.length
    const next = draft.body.slice(0, at) + markdown + draft.body.slice(end)
    setDraft({ ...draft, body: next })
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(at + markdown.length, at + markdown.length)
    })
    return true
  }

  function onBodyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.ctrlKey || event.metaKey
    if (!mod) return
    const key = event.key.toLowerCase()
    if (key === 'b') {
      event.preventDefault()
      wrapSelection('**', '**', '粗体')
    } else if (key === 'i') {
      event.preventDefault()
      wrapSelection('*', '*', '斜体')
    } else if (key === 'k') {
      event.preventDefault()
      wrapSelection('[', '](https://)', '链接文字')
    } else if (key === 's') {
      event.preventDefault()
      void submit()
    }
  }

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!token) {
      setNotice({ kind: 'err', text: '先填 Token 才能上传图片' })
      return
    }
    setUploading(true)
    setNotice(null)
    try {
      const image = await uploadImage(token, file)
      /* 先插入再报结果：没开编辑器时不要让提示把"已上传"顶掉 */
      const inserted = insertIntoBody(`\n![${image.name}](${image.url})\n`)
      setNotice({
        kind: 'ok',
        text: inserted
          ? `已上传 ${image.name}，并插入到正文光标处`
          : `已上传 ${image.name}；点「新建文章」或「编辑」后就能插进正文`,
      })
      await loadImages(true)
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '上传失败' })
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!draft) return
    if (!draft.title.trim()) {
      setNotice({ kind: 'err', text: '标题不能为空' })
      return
    }
    const labels = [
      ...(draft.category === 'none' ? [] : [draft.category]),
      ...draft.tags
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ]

    setBusy(true)
    setNotice(null)
    try {
      if (draft.number === null) {
        const number = await createIssue(token, {
          title: draft.title.trim(),
          body: draft.body,
          labels,
        })
        setNotice({ kind: 'ok', text: `已发布为一篇新文章（issue #${number}）` })
      } else {
        await updateIssue(token, draft.number, {
          title: draft.title.trim(),
          body: draft.body,
          labels,
        })
        setNotice({ kind: 'ok', text: `已保存 issue #${draft.number}` })
      }
      clearStoredDraft()
      clearBlogCache()
      refresh()
      setDraft(null)
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '写入失败' })
    } finally {
      setBusy(false)
    }
  }

  function cancelDraft() {
    if (!draft) return
    const hasContent = draft.title.trim() || draft.body.trim()
    if (hasContent && !window.confirm('放弃当前这篇草稿？')) return
    clearStoredDraft()
    setDraft(null)
  }

  async function changeState(post: BlogPost, state: 'open' | 'closed') {
    setBusy(true)
    setNotice(null)
    try {
      await setIssueState(token, post.id, state)
      setNotice({
        kind: 'ok',
        text: state === 'closed' ? `已把 #${post.id} 下架` : `已把 #${post.id} 重新显示`,
      })
      clearBlogCache()
      refresh()
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '操作失败' })
    } finally {
      setBusy(false)
    }
  }

  /** 彻底删除（GraphQL）；GitHub 上不可撤销，所以先 confirm */
  async function removePost(post: BlogPost) {
    if (!window.confirm(`彻底删除 #${post.id}「${post.title}」？GitHub 上无法撤销。`)) return
    setBusy(true)
    setNotice(null)
    try {
      await deleteIssue(token, post.nodeId)
      setNotice({ kind: 'ok', text: `已彻底删除 #${post.id}` })
      clearBlogCache()
      refresh()
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '删除失败' })
    } finally {
      setBusy(false)
    }
  }

  const previewPane = (extra: string) => (
    <div className={`overflow-auto rounded border border-edge bg-surface p-3 ${extra}`}>
      <Suspense fallback={<p className="text-sm text-dim">正在排版…</p>}>
        <Markdown>{draft?.body ?? ''}</Markdown>
      </Suspense>
    </div>
  )

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-edge bg-surface-2 p-3">
        <h3 className="text-xs font-semibold tracking-wide text-dim">GitHub 凭据</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="粘贴 PAT（Issues 读写 + Contents 写入）"
            aria-label="GitHub Token"
            className={`${inputCls} max-w-md flex-1`}
          />
          <button
            type="button"
            aria-label="保存 Token"
            onClick={() => applyToken(tokenInput)}
            className={smallBtnCls}
          >
            保存
          </button>
          <button type="button" onClick={checkToken} disabled={!token || busy} className={smallBtnCls}>
            验证
          </button>
          <button
            type="button"
            onClick={() => {
              setTokenInput('')
              applyToken('')
            }}
            className={`${smallBtnCls} text-dim`}
          >
            清除
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-dim">
          Token 只存在这台浏览器的 localStorage，不会进仓库、不会进代码；但同源脚本能读到它，
          所以别在公共电脑上填。需要 fine-grained token 的「Issues: Read and write」+「Contents: Read and
          write」权限，或 classic token 的 <code>public_repo</code> / <code>repo</code> 范围。
          {who ? ` 当前登录：${who}` : ''}
        </p>
      </section>

      {notice ? (
        <p
          className={`rounded border px-3 py-2 text-xs ${
            notice.kind === 'ok' ? 'border-edge text-ink' : 'border-accent text-accent'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {!token ? (
        <p className="text-sm text-dim">填入 Token 之后才能新建或修改文章（图片可以浏览，不能上传）。</p>
      ) : draft ? (
        <section className="space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-dim">
              {draft.number === null ? '新建文章' : `编辑 issue #${draft.number}`}
              {savedAt ? <span className="ml-2 font-normal">草稿已自动保存</span> : null}
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex overflow-hidden rounded border border-edge">
                {(['edit', 'split', 'preview'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    onClick={() => startTransition(() => setView(mode))}
                    className={`px-2.5 py-1 text-xs ${
                      view === mode ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                    }`}
                  >
                    {mode === 'edit' ? '编辑' : mode === 'split' ? '分屏' : '预览'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={cancelDraft} className={`${smallBtnCls} text-dim`}>
                取消
              </button>
              <button
                type="button"
                aria-label={draft.number === null ? '发布文章' : '保存文章'}
                onClick={submit}
                disabled={busy}
                className="rounded border border-accent bg-accent px-2.5 py-1 text-xs text-accent-ink hover:opacity-90 disabled:opacity-50"
              >
                {busy ? '提交中…' : draft.number === null ? '发布' : '保存'}
              </button>
            </div>
          </header>

          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="标题"
            aria-label="标题"
            className={inputCls}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
            <span>分类</span>
            {(['daily', 'project', 'none'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={draft.category === item}
                onClick={() => setDraft({ ...draft, category: item })}
                className={`rounded border px-2 py-1 ${
                  draft.category === item
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-edge text-ink hover:bg-hover'
                }`}
              >
                {item === 'daily' ? '日常' : item === 'project' ? '项目' : '不分类'}
              </button>
            ))}
            <input
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              placeholder="其他标签，逗号分隔"
              aria-label="其他标签"
              className={`${inputCls} max-w-xs flex-1`}
            />
            <span className="ml-auto">{draft.body.length} 字</span>
          </div>

          {view === 'edit' || view === 'split' ? (
            <div className="flex flex-wrap gap-1">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  title={tool.title}
                  aria-label={tool.title}
                  onClick={() => runTool(tool)}
                  className={toolBtnCls}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ) : null}

          {view === 'split' ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <textarea
                ref={bodyRef}
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                onKeyDown={onBodyKeyDown}
                placeholder="正文（支持 markdown；Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 链接、Ctrl+S 保存）"
                aria-label="正文"
                className={`${inputCls} h-[380px] resize-y font-mono text-[13px] leading-relaxed`}
              />
              {previewPane('h-[380px]')}
            </div>
          ) : view === 'edit' ? (
            <textarea
              ref={bodyRef}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              onKeyDown={onBodyKeyDown}
              placeholder="正文（支持 markdown；Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 链接、Ctrl+S 保存）"
              aria-label="正文"
              className={`${inputCls} h-[380px] resize-y font-mono text-[13px] leading-relaxed`}
            />
          ) : (
            previewPane('min-h-[380px]')
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {pendingDraft ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-accent px-3 py-2 text-xs">
              <span>发现上次没发出去的草稿（{pendingDraft.draft.title.trim() || '无标题'}）</span>
              <button
                type="button"
                onClick={() => {
                  setDraft(pendingDraft.draft)
                  setPendingDraft(null)
                }}
                className={smallBtnCls}
              >
                恢复
              </button>
              <button type="button" onClick={clearStoredDraft} className={`${smallBtnCls} text-dim`}>
                丢弃
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
              className="rounded border border-accent bg-accent px-3 py-1.5 text-xs text-accent-ink hover:opacity-90"
            >
              新建文章
            </button>
            <button
              type="button"
              onClick={() => {
                clearBlogCache()
                refresh()
              }}
              disabled={loading}
              className={`${smallBtnCls} text-dim`}
            >
              {loading ? '读取中…' : '刷新列表'}
            </button>
          </div>

          <ul className="space-y-1">
            {posts.map((post) => (
              <li
                key={post.id}
                className={`flex flex-wrap items-center gap-2 rounded border border-edge px-3 py-2 ${
                  post.state === 'closed' ? 'bg-surface opacity-70' : 'bg-surface-2'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  #{post.id} {post.title}
                </span>
                {post.state === 'closed' ? (
                  <span className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim">
                    已下架
                  </span>
                ) : null}
                <span className="text-[11px] text-dim">{post.labels.join(' · ') || '无标签'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setView('split')
                    setDraft(draftFromPost(post))
                  }}
                  className="rounded border border-edge px-2 py-0.5 text-[11px] text-ink hover:bg-hover"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => changeState(post, post.state === 'open' ? 'closed' : 'open')}
                  disabled={busy}
                  className="rounded border border-edge px-2 py-0.5 text-[11px] text-dim hover:bg-hover disabled:opacity-50"
                >
                  {post.state === 'open' ? '下架' : '重新显示'}
                </button>
                <button
                  type="button"
                  onClick={() => removePost(post)}
                  disabled={busy}
                  className="rounded border border-edge px-2 py-0.5 text-[11px] text-accent hover:bg-hover disabled:opacity-50"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>

          {posts.length === 0 && !loading ? (
            <p className="text-sm text-dim">还没有文章，点「新建文章」写第一篇。</p>
          ) : null}
        </section>
      )}

      {/* 图片：上传到 img 分支（需要 Token），浏览已存图片不需要 Token */}
      <section className="space-y-2 rounded-lg border border-edge bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-dim">图片（img 分支）</h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
            aria-label="选择图片文件"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={smallBtnCls}
          >
            {uploading ? '上传中…' : '上传图片'}
          </button>
          <button
            type="button"
            onClick={() => {
              clearImageCache()
              void loadImages(true)
            }}
            disabled={imgLoading}
            className={`${smallBtnCls} text-dim`}
          >
            {imgLoading ? '读取中…' : '刷新图库'}
          </button>
          <span className="text-[11px] text-dim">点一张图 → 插到正文光标处（自动带 jsDelivr 地址）</span>
        </div>

        {imgError ? <p className="text-xs text-accent">{imgError}</p> : null}

        {images.length === 0 && !imgLoading && !imgError ? (
          <p className="text-xs text-dim">img 分支里还没有图片。</p>
        ) : null}

        <ul className="flex flex-wrap gap-2">
          {images.map((image) => (
            <li key={image.path}>
              <button
                type="button"
                title={`${image.name}\n${image.url}`}
                onClick={() => {
                  if (!insertIntoBody(`![${image.name}](${image.url})`)) {
                    setNotice({
                      kind: 'err',
                      text: '先点「新建文章」或「编辑」，图片会插到正文光标处',
                    })
                  }
                }}
                className="block h-20 w-28 overflow-hidden rounded border border-edge bg-cover bg-center hover:border-accent"
                style={{ backgroundImage: `url("${image.url}")` }}
              >
                <span className="sr-only">{image.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
