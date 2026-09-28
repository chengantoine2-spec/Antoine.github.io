import { Suspense, lazy, startTransition, useEffect, useState } from 'react'
import { useBlogFeed } from '../../hooks/useBlogFeed'
import {
  clearBlogCache,
  createIssue,
  readToken,
  saveToken,
  setIssueState,
  updateIssue,
  verifyToken,
  type BlogPost,
} from '../../lib/github'

/* markdown 是懒加载的；提前预热 + startTransition 切换，避免"同步更新里挂起"那个 React 报错 */
const Markdown = lazy(() => import('./Markdown').then((mod) => ({ default: mod.Markdown })))

type Draft = {
  /** null = 新建 */
  number: number | null
  title: string
  body: string
  category: 'daily' | 'project' | 'none'
  tags: string
}

const EMPTY_DRAFT: Draft = { number: null, title: '', body: '', category: 'daily', tags: '' }

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

/** 「写作」窗口：用本机 PAT 直接增改 GitHub Issues（= 博客文章） */
export function WriteWindow() {
  const { feed, loading, refresh } = useBlogFeed()
  const [token, setToken] = useState(readToken)
  const [tokenInput, setTokenInput] = useState(readToken)
  const [who, setWho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void import('./Markdown')
  }, [])

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
      clearBlogCache()
      refresh()
      setDraft(null)
      setPreview(false)
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '写入失败' })
    } finally {
      setBusy(false)
    }
  }

  async function changeState(post: BlogPost, state: 'open' | 'closed') {
    setBusy(true)
    setNotice(null)
    try {
      await setIssueState(token, post.id, state)
      setNotice({ kind: 'ok', text: state === 'closed' ? `已把 #${post.id} 下架` : `已把 #${post.id} 重新显示` })
      clearBlogCache()
      refresh()
    } catch (error) {
      setNotice({ kind: 'err', text: error instanceof Error ? error.message : '操作失败' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-edge bg-surface-2 p-3">
        <h3 className="text-xs font-semibold tracking-wide text-dim">GitHub 凭据</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="粘贴 PAT（需要 Issues 读写权限）"
            aria-label="GitHub Token"
            className={`${inputCls} max-w-md flex-1`}
          />
          <button
            type="button"
            onClick={() => applyToken(tokenInput)}
            className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover"
          >
            保存
          </button>
          <button
            type="button"
            onClick={checkToken}
            disabled={!token || busy}
            className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover disabled:opacity-50"
          >
            验证
          </button>
          <button
            type="button"
            onClick={() => {
              setTokenInput('')
              applyToken('')
            }}
            className="rounded border border-edge px-3 py-1.5 text-xs text-dim hover:bg-hover"
          >
            清除
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-dim">
          Token 只存在这台浏览器的 localStorage，不会进仓库、不会进代码；但同源脚本能读到它，
          所以别在公共电脑上填。需要 fine-grained token 的「Issues: Read and write」权限，
          或 classic token 的 <code>public_repo</code> / <code>repo</code> 范围。
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
        <p className="text-sm text-dim">填入 Token 之后才能新建或修改文章。</p>
      ) : draft ? (
        <section className="space-y-3">
          <header className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-dim">
              {draft.number === null ? '新建文章' : `编辑 issue #${draft.number}`}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startTransition(() => setPreview((value) => !value))}
                className="rounded border border-edge px-2.5 py-1 text-xs text-ink hover:bg-hover"
              >
                {preview ? '继续编辑' : '预览'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setPreview(false)
                }}
                className="rounded border border-edge px-2.5 py-1 text-xs text-dim hover:bg-hover"
              >
                取消
              </button>
              <button
                type="button"
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
          </div>

          {preview ? (
            <div className="rounded border border-edge bg-surface p-3">
              <Suspense fallback={<p className="text-sm text-dim">正在排版…</p>}>
                <Markdown>{draft.body}</Markdown>
              </Suspense>
            </div>
          ) : (
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              placeholder="正文（支持 markdown：标题、列表、代码块、表格、图片）"
              aria-label="正文"
              rows={14}
              className={`${inputCls} resize-y font-mono text-[13px] leading-relaxed`}
            />
          )}
        </section>
      ) : (
        <section className="space-y-2">
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
              className="rounded border border-edge px-3 py-1.5 text-xs text-dim hover:bg-hover disabled:opacity-50"
            >
              {loading ? '读取中…' : '刷新列表'}
            </button>
          </div>

          <ul className="space-y-1">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex flex-wrap items-center gap-2 rounded border border-edge bg-surface-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  #{post.id} {post.title}
                </span>
                <span className="text-[11px] text-dim">{post.labels.join(' · ') || '无标签'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(false)
                    setDraft(draftFromPost(post))
                  }}
                  className="rounded border border-edge px-2 py-0.5 text-[11px] text-ink hover:bg-hover"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => changeState(post, 'closed')}
                  disabled={busy}
                  className="rounded border border-edge px-2 py-0.5 text-[11px] text-dim hover:bg-hover disabled:opacity-50"
                >
                  下架
                </button>
              </li>
            ))}
          </ul>

          {posts.length === 0 && !loading ? (
            <p className="text-sm text-dim">还没有文章，点「新建文章」写第一篇。</p>
          ) : null}
        </section>
      )}
    </div>
  )
}
