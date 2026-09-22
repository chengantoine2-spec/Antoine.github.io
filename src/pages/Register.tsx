/**
 * 注册页：/register
 * 只要用户名 + 密码（不需要邮箱、不需要 GitHub）。
 * 用户名会映射成 username@<AUTH_EMAIL_DOMAIN> 交给 Supabase Auth，
 * 因此需要在 Supabase 后台关闭 “Confirm email”。
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { USERNAME_RE } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const { register, configured, isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(false)

  const nameOk = USERNAME_RE.test(name.trim())
  const lengthOk = password.length >= 8
  const matchOk = password.length > 0 && password === confirm
  const canSubmit = nameOk && lengthOk && matchOk && !busy

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setMessage('')
    const result = await register(name, password)
    setBusy(false)
    setOk(result.ok)
    setMessage(result.message)
    if (result.ok) navigate('/assets', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">注册</h1>
        <p className="text-sm text-caramel-600 dark:text-caramel-300">
          注册后即可评论文章、创建自己的物品台账（资产库）。注册即普通用户，管理员可另行授权。
        </p>
      </header>

      {!configured && (
        <p className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          账号服务还没接上：需要配置 <code>VITE_SUPABASE_URL</code> 与{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>，并在 Supabase 执行 <code>supabase/schema.sql</code>。
        </p>
      )}

      {isLoggedIn ? (
        <p className="rounded-xl border border-caramel-200 bg-caramel-100 px-4 py-3 text-sm dark:border-caramel-700 dark:bg-caramel-800">
          你已登录，无需重复注册。
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800"
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">用户名</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2–24 位，中英文 / 数字 / _ / -"
              autoComplete="username"
              className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
            />
            {name.length > 0 && !nameOk && (
              <span className="text-xs text-caramel-700 dark:text-caramel-200">
                用户名不合规：2–24 位，中英文、数字、下划线、连字符
              </span>
            )}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete="new-password"
              className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
            />
            {password.length > 0 && !lengthOk && (
              <span className="text-xs text-caramel-700 dark:text-caramel-200">密码至少 8 位</span>
            )}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">确认密码</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
            />
            {confirm.length > 0 && !matchOk && (
              <span className="text-xs text-caramel-700 dark:text-caramel-200">两次输入的密码不一致</span>
            )}
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-caramel-500 px-4 py-2 font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? '注册中…' : '注册'}
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
            已有账号？{' '}
            <Link to="/login" className="font-medium underline">
              去登录
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
