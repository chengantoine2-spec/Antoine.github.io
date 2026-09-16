/**
 * 个人中心：/me
 * P1 占位页：先把「站长登录（PAT）」与账号状态、主题偏好放这里；
 * 资产 / 音乐 / 换背景等 P1 功能按 AGENTS.md 暂不实现。
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { SITE, diagnoseAccess, explainGitHubError, hasToken, type AccessReport } from '../lib/github'
import { useAuth } from '../hooks/useAuth'

const P1_ITEMS = ['个人资产清单', '音乐播放器', '站点换背景', '像素图头像']

export default function Me() {
  const { user, pat, error, checking, busy, isOwner, login, logout } = useAuth()
  const [input, setInput] = useState('')
  const [report, setReport] = useState<AccessReport | null>(null)
  const [diagError, setDiagError] = useState('')
  const [diagBusy, setDiagBusy] = useState(false)

  const runDiagnose = async () => {
    setDiagBusy(true)
    setDiagError('')
    setReport(null)
    try {
      setReport(await diagnoseAccess())
    } catch (err) {
      setDiagError(explainGitHubError(err, 'write'))
    } finally {
      setDiagBusy(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await login(input)
    if (ok) setInput('')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-caramel-200 bg-caramel-100 px-6 py-8 dark:border-caramel-700 dark:bg-caramel-800">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel-600 dark:text-caramel-300">
          Me
        </p>
        <h1 className="mt-2 text-3xl font-bold text-caramel-800 dark:text-caramel-100">个人中心</h1>
        <p className="mt-3 text-caramel-700 dark:text-caramel-200">
          访客只需要 GitHub 账号（评论点赞走 Giscus）；站长在同一浏览器里保存 PAT 后即可写作与管理。
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800">
        <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">站长登录</h2>

        {user ? (
          <div className="flex flex-wrap items-center gap-4">
            <img src={user.avatar_url} alt={user.login} className="h-12 w-12 rounded-full border border-caramel-300" />
            <div className="text-sm">
              <p className="font-medium text-caramel-800 dark:text-caramel-100">
                {user.name || user.login}
                {isOwner ? '（站长）' : '（非站长）'}
              </p>
              <a
                href={user.html_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-caramel-600 hover:text-caramel-700 dark:text-caramel-300"
              >
                github.com/{user.login}
              </a>
            </div>
            <button
              type="button"
              onClick={logout}
              className="ml-auto rounded-lg border border-caramel-400 px-3 py-1.5 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
            >
              退出登录
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-sm text-caramel-700 dark:text-caramel-200" htmlFor="pat">
              Personal Access Token（需要 <code>repo</code> 权限；只存在本机 localStorage，不入库）
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="pat"
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ghp_..."
                autoComplete="off"
                className="min-w-[16rem] flex-1 rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm text-caramel-900 outline-none focus:border-caramel-500 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
              <button
                type="submit"
                disabled={busy || checking}
                className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:opacity-60"
              >
                {busy || checking ? '校验中…' : '登录'}
              </button>
            </div>
            {!hasToken() && (
              <p className="text-xs text-caramel-600 dark:text-caramel-300">
                还没有 PAT？GitHub → Settings → Developer settings → Personal access tokens（勾选 repo）。
              </p>
            )}
          </form>
        )}

        {error && (
          <p className="rounded-lg border border-caramel-400 bg-caramel-50 px-3 py-2 text-sm text-caramel-700 dark:bg-caramel-900 dark:text-caramel-200">
            {error}
          </p>
        )}

        {user && isOwner && (
          <Link
            to="/write"
            className="inline-block rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600"
          >
            去写博客
          </Link>
        )}

        <p className="text-xs text-caramel-600 dark:text-caramel-300">
          当前数据源：<code>{SITE.user}/{SITE.repo}</code>，图片分支 <code>{SITE.imgBranch}</code>
          {pat ? '（已带 PAT 请求，速率上限 5000/h）' : '（匿名请求，速率上限 60/h）'}
        </p>

        {user && (
          <div className="space-y-3 rounded-xl border border-caramel-200 bg-caramel-50 p-4 dark:border-caramel-700 dark:bg-caramel-900">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">
                发布权限自检
              </span>
              <button
                type="button"
                onClick={runDiagnose}
                disabled={diagBusy}
                className="rounded-lg border border-caramel-400 px-3 py-1 text-sm transition hover:bg-caramel-200 disabled:opacity-60 dark:hover:bg-caramel-700"
              >
                {diagBusy ? '检查中…' : '运行自检'}
              </button>
            </div>

            {report && (
              <ul className="space-y-1 text-sm text-caramel-700 dark:text-caramel-200">
                <li>
                  {report.ok ? '✓' : '✗'} {report.message}
                </li>
                <li>· 登录账号：{report.login}</li>
                <li>· 仓库写权限 push：{report.canPush ? '有' : '无'}</li>
                <li>· 仓库 Issues 功能：{report.hasIssues ? '已开启' : '已关闭'}</li>
                <li>· 当前已发布文章：{report.openIssues} 篇</li>
              </ul>
            )}

            {diagError && (
              <p className="text-sm text-caramel-700 dark:text-caramel-200">✗ {diagError}</p>
            )}

            <p className="text-xs text-caramel-600 dark:text-caramel-300">
              发不出文章通常是 PAT 类型问题：<strong>经典 PAT</strong> 勾选 <code>repo</code>；
              <strong>细粒度 PAT</strong> 要在 Repository access 里选中{' '}
              <code>{SITE.repo}</code>，并把 <strong>Issues 设为 Read and write</strong>。
              自检里 push 为「无」就属于这种情况。
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800">
        <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">外观</h2>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-caramel-700 dark:text-caramel-200">
            默认亮色，可切到暗色（caramel-900 底 / caramel-100 字），选择会记住。
          </span>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-dashed border-caramel-300 p-5 dark:border-caramel-600">
        <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">P1 占位（暂不实现）</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {P1_ITEMS.map((item) => (
            <li
              key={item}
              className="rounded-full border border-caramel-200 bg-caramel-50 px-3 py-1 text-caramel-600 dark:border-caramel-700 dark:bg-caramel-900 dark:text-caramel-300"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
