/**
 * 登录页：/login?next=<路径>
 * 用户名 + 密码（用户名会映射成合成邮箱交给 Supabase Auth）。
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, configured, isLoggedIn, username } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = params.get('next') || '/'

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(false)

  if (isLoggedIn) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">已经登录了</h1>
        <p className="text-caramel-700 dark:text-caramel-200">
          当前账号：<strong>{username}</strong>
        </p>
        <div className="flex gap-3">
          <Link
            to={next}
            className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 hover:bg-caramel-600"
          >
            继续浏览
          </Link>
          <Link
            to="/assets"
            className="rounded-lg border border-caramel-400 px-4 py-2 text-sm hover:bg-caramel-200 dark:hover:bg-caramel-700"
          >
            我的资产库
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const result = await login(name, password)
    setBusy(false)
    setOk(result.ok)
    setMessage(result.message)
    if (result.ok) navigate(next, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">登录</h1>
        <p className="text-sm text-caramel-600 dark:text-caramel-300">
          用注册时的<strong>用户名 + 密码</strong>登录，登录后即可评论、管理自己的资产库。
        </p>
      </header>

      {!configured && (
        <p className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          账号服务还没接上：需要配置 <code>VITE_SUPABASE_URL</code> 与{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>，并在 Supabase 执行 <code>supabase/schema.sql</code>。
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800"
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">用户名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-caramel-500 px-4 py-2 font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:opacity-60"
        >
          {busy ? '登录中…' : '登录'}
        </button>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              ok
                ? 'border border-caramel-300 bg-caramel-50 text-caramel-700 dark:bg-caramel-900 dark:text-caramel-200'
                : 'border border-caramel-500 bg-caramel-200 font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100'
            }`}
          >
            {ok ? '✓ ' : '⚠ '}
            {message}
          </p>
        )}

        <p className="text-sm text-caramel-600 dark:text-caramel-300">
          还没有账号？{' '}
          <Link to="/register" className="font-medium underline">
            立即注册
          </Link>
        </p>
      </form>
    </div>
  )
}
