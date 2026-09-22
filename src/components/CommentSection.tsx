/**
 * 文章评论：注册用户（Supabase 账号）发表，替代原来的 Giscus。
 * 权限由数据库 RLS 强制：登录且未被封禁才能发；只能改/删自己的；管理员可管理全部。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase, type CommentRow } from '../lib/supabase'
import { formatDateTime, formatFull, formatRelative } from '../lib/text'
import { useAuth } from '../hooks/useAuth'
import { useNow } from '../hooks/useBlogs'

const MAX_LEN = 2000

export interface CommentSectionProps {
  blogId: number
}

export function CommentSection({ blogId }: CommentSectionProps) {
  const { isLoggedIn, userId, username, isAdmin, isActive, ready } = useAuth()
  const location = useLocation()
  const now = useNow(15_000)

  const [rows, setRows] = useState<CommentRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase()
      .from('comments')
      .select('id, blog_id, user_id, body, created_at, updated_at, profiles(username)')
      .eq('blog_id', blogId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    if (err) setError(`读取评论失败：${err.message}`)
    else {
      setError('')
      setRows((data as unknown as CommentRow[]) || [])
      setCount(((data as unknown as CommentRow[]) || []).length)
    }
    setLoading(false)
  }, [blogId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    const text = body.trim()
    if (!text || !userId) return
    setPosting(true)
    setError('')
    const { error: err } = await supabase()
      .from('comments')
      .insert({ blog_id: blogId, user_id: userId, body: text })
    if (err) setError(`发表失败：${err.message}`)
    else {
      setBody('')
      await load()
    }
    setPosting(false)
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除这条评论吗？')) return
    const { error: err } = await supabase().from('comments').update({ is_deleted: true }).eq('id', id)
    if (err) setError(`删除失败：${err.message}`)
    else await load()
  }

  const saveEdit = async (id: string) => {
    const text = editBody.trim()
    if (!text) return
    const { error: err } = await supabase().from('comments').update({ body: text }).eq('id', id)
    if (err) setError(`保存失败：${err.message}`)
    else {
      setEditingId(null)
      setEditBody('')
      await load()
    }
  }

  const canPost = isLoggedIn && isActive

  return (
    <section id="comments" className="space-y-4">
      <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">
        评论{count > 0 && <span className="ml-2 text-sm font-normal">（{count}）</span>}
      </h2>

      {!isSupabaseConfigured() && (
        <p className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          评论区还没接上数据库：运行 <code>supabase/schema.sql</code> 并配置{' '}
          <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> 后即可使用。
        </p>
      )}

      {isSupabaseConfigured() && (
        <>
          {canPost ? (
            <div className="space-y-2 rounded-xl border border-caramel-200 bg-caramel-100 p-3 dark:border-caramel-700 dark:bg-caramel-800">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
                rows={3}
                placeholder={`以 ${username} 的身份说点什么…`}
                className="w-full resize-y rounded-lg border border-caramel-300 bg-caramel-50 p-3 text-sm text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
              <div className="flex items-center justify-between text-xs text-caramel-600 dark:text-caramel-300">
                <span>
                  {body.length}/{MAX_LEN} · 支持纯文本，换行会保留
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={posting || body.trim().length === 0}
                  className="rounded-lg bg-caramel-500 px-4 py-1.5 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {posting ? '发表中…' : '发表评论'}
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-caramel-200 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-200">
              {ready && isLoggedIn && !isActive ? (
                '你的账号已被管理员封禁，暂时不能评论。'
              ) : (
                <>
                  <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-medium underline">
                    登录
                  </Link>{' '}
                  或{' '}
                  <Link to="/register" className="font-medium underline">
                    注册
                  </Link>{' '}
                  后即可评论（用户名 + 密码，无需 GitHub）。
                </>
              )}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-caramel-400 bg-caramel-100 px-3 py-2 text-sm text-caramel-700 dark:bg-caramel-800 dark:text-caramel-200">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-caramel-600 dark:text-caramel-300">评论加载中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-caramel-600 dark:text-caramel-300">还没有评论，来做第一个。</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const mine = row.user_id === userId
                const name = row.profiles?.username || '已注销用户'
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-caramel-200 bg-caramel-100 p-3 dark:border-caramel-700 dark:bg-caramel-800"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-caramel-600 dark:text-caramel-300">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-caramel-500 text-[11px] font-medium text-caramel-50">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-caramel-700 dark:text-caramel-100">{name}</span>
                      <time dateTime={row.created_at} title={formatFull(row.created_at)}>
                        {formatDateTime(row.created_at)}
                      </time>
                      <span className="rounded bg-caramel-200 px-1.5 py-0.5 dark:bg-caramel-700">
                        {formatRelative(row.created_at, now)}
                      </span>
                      {row.updated_at !== row.created_at && <span>· 已编辑</span>}
                      {(mine || isAdmin) && (
                        <span className="ml-auto flex gap-2">
                          {mine && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id)
                                setEditBody(row.body)
                              }}
                              className="rounded border border-caramel-300 px-1.5 py-0.5 transition hover:bg-caramel-200 dark:border-caramel-600 dark:hover:bg-caramel-700"
                            >
                              编辑
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(row.id)}
                            className="rounded border border-caramel-300 px-1.5 py-0.5 transition hover:bg-caramel-200 dark:border-caramel-600 dark:hover:bg-caramel-700"
                          >
                            删除
                          </button>
                        </span>
                      )}
                    </div>

                    {editingId === row.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value.slice(0, MAX_LEN))}
                          rows={3}
                          className="w-full resize-y rounded-lg border border-caramel-300 bg-caramel-50 p-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(row.id)}
                            className="rounded-lg bg-caramel-500 px-3 py-1 text-xs font-medium text-caramel-50 hover:bg-caramel-600"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-caramel-300 px-3 py-1 text-xs dark:border-caramel-600"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-caramel-800 dark:text-caramel-100">
                        {row.body}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* TODO(点赞)：schema.sql 末尾已留 likes 表结构，本期先不做 */}
    </section>
  )
}

export default CommentSection
