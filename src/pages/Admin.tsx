/**
 * 管理后台：/admin（仅管理员）
 * - 用户列表：用户名、角色、状态、注册时间、评论数、资产数与资产总值
 * - 操作：设为管理员 / 降为普通用户 / 封禁 / 解封
 * - 权限由数据库 RLS + admin_user_stats() 强制，非管理员拿不到数据也改不动
 * - 注意：删除账号需要 service_role key，客户端做不了，请到 Supabase Dashboard → Authentication 里删
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase, type Profile, type Role } from '../lib/supabase'
import { formatDateTime, formatRelative, formatFull } from '../lib/text'
import { useAuth } from '../hooks/useAuth'
import { useNow } from '../hooks/useBlogs'

interface StatRow {
  user_id: string
  comments: number
  assets: number
  assets_value: number
}

export default function Admin() {
  const { isAdmin, isLoggedIn, ready, username } = useAuth()
  const now = useNow(30_000)
  const [users, setUsers] = useState<Profile[]>([])
  const [stats, setStats] = useState<StatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [profilesRes, statsRes] = await Promise.all([
      supabase().from('profiles').select('*').order('created_at', { ascending: true }),
      supabase().rpc('admin_user_stats'),
    ])
    if (profilesRes.error) setError(`读取用户失败：${profilesRes.error.message}`)
    else setUsers((profilesRes.data as Profile[]) || [])
    if (!statsRes.error) setStats((statsRes.data as StatRow[]) || [])
    setLoading(false)
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const statOf = useMemo(() => {
    const map = new Map(stats.map((s) => [s.user_id, s]))
    return (id: string) => map.get(id)
  }, [stats])

  const totals = useMemo(
    () => ({
      users: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      banned: users.filter((u) => u.banned).length,
      comments: stats.reduce((sum, s) => sum + Number(s.comments || 0), 0),
      assets: stats.reduce((sum, s) => sum + Number(s.assets || 0), 0),
      value: stats.reduce((sum, s) => sum + Number(s.assets_value || 0), 0),
    }),
    [users, stats],
  )

  const patchUser = async (id: string, patch: Partial<Pick<Profile, 'role' | 'banned'>>) => {
    setBusyId(id)
    setError('')
    const { error: err } = await supabase().from('profiles').update(patch).eq('id', id)
    setBusyId('')
    if (err) setError(`操作失败：${err.message}`)
    else await load()
  }

  const visible = users.filter((u) =>
    keyword.trim() ? u.username.toLowerCase().includes(keyword.trim().toLowerCase()) : true,
  )

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">管理后台</h1>
        <p className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          需要先配置 Supabase（<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>）并执行{' '}
          <code>supabase/schema.sql</code>。
        </p>
      </div>
    )
  }

  if (ready && (!isLoggedIn || !isAdmin)) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">管理后台</h1>
        <p className="text-caramel-700 dark:text-caramel-200">
          {isLoggedIn
            ? `当前账号 ${username} 不是管理员，无权访问。`
            : '请先用管理员账号登录。'}
        </p>
        <div className="flex gap-3">
          <Link
            to="/login?next=%2Fadmin"
            className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 hover:bg-caramel-600"
          >
            去登录
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-caramel-400 px-4 py-2 text-sm hover:bg-caramel-200 dark:hover:bg-caramel-700"
          >
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">管理后台</h1>
          <p className="mt-1 text-sm text-caramel-600 dark:text-caramel-300">
            用户与角色管理。管理员拥有全部权限；普通用户只能评论与维护自己的资产库。
          </p>
        </div>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索用户名"
          className="rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-1.5 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
        />
      </header>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['注册用户', totals.users],
          ['管理员', totals.admins],
          ['已封禁', totals.banned],
          ['评论总数', totals.comments],
          ['资产条目', totals.assets],
          ['资产总值', `¥${Number(totals.value).toLocaleString('zh-CN')}`],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800"
          >
            <p className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">{label}</p>
            <p className="mt-1 text-xl font-bold text-caramel-700 dark:text-caramel-100">{value}</p>
          </div>
        ))}
      </section>

      {error && (
        <p className="rounded-lg border border-caramel-500 bg-caramel-200 px-3 py-2 text-sm font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100">
          ⚠ {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-caramel-600 dark:text-caramel-300">加载中…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-caramel-200 dark:border-caramel-700">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead className="bg-caramel-200 text-left text-caramel-800 dark:bg-caramel-800 dark:text-caramel-100">
              <tr>
                <th className="px-3 py-2">用户名</th>
                <th className="px-3 py-2">角色</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">注册时间</th>
                <th className="px-3 py-2">评论</th>
                <th className="px-3 py-2">资产</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const s = statOf(u.id)
                const isSelf = u.username === username
                return (
                  <tr key={u.id} className="border-t border-caramel-200 dark:border-caramel-700">
                    <td className="px-3 py-2 font-medium text-caramel-800 dark:text-caramel-100">
                      {u.username}
                      {isSelf && <span className="ml-2 text-xs text-caramel-600 dark:text-caramel-300">（我）</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          u.role === 'admin'
                            ? 'bg-caramel-500 text-caramel-50'
                            : 'bg-caramel-200 text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100'
                        }`}
                      >
                        {u.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {u.banned ? (
                        <span className="text-caramel-700 dark:text-caramel-200">已封禁</span>
                      ) : (
                        <span className="text-caramel-600 dark:text-caramel-300">正常</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-caramel-600 dark:text-caramel-300">
                      <time dateTime={u.created_at} title={formatFull(u.created_at)}>
                        {formatDateTime(u.created_at)}
                      </time>
                      <span className="ml-2 rounded bg-caramel-200 px-1.5 py-0.5 text-xs dark:bg-caramel-700">
                        {formatRelative(u.created_at, now)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-caramel-700 dark:text-caramel-200">{s?.comments ?? '—'}</td>
                    <td className="px-3 py-2 text-caramel-700 dark:text-caramel-200">
                      {s?.assets ?? '—'}
                      {s && Number(s.assets_value) > 0 && (
                        <span className="ml-1 text-xs text-caramel-600 dark:text-caramel-300">
                          ¥{Number(s.assets_value).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === u.id || isSelf}
                          onClick={() => patchUser(u.id, { role: (u.role === 'admin' ? 'user' : 'admin') as Role })}
                          className="rounded border border-caramel-400 px-2 py-0.5 text-xs transition hover:bg-caramel-200 disabled:opacity-50 dark:hover:bg-caramel-700"
                        >
                          {u.role === 'admin' ? '降为普通' : '设为管理员'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === u.id || isSelf}
                          onClick={() => patchUser(u.id, { banned: !u.banned })}
                          className="rounded border border-caramel-400 px-2 py-0.5 text-xs transition hover:bg-caramel-200 disabled:opacity-50 dark:hover:bg-caramel-700"
                        >
                          {u.banned ? '解封' : '封禁'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-caramel-600 dark:text-caramel-300">
        说明：出于安全，前端无法删除账号（需要 service_role key）。要彻底删除用户，请到 Supabase Dashboard →
        Authentication → Users 删除，其 profile / 评论 / 资产会因外键级联一并清理。
      </p>
    </div>
  )
}
