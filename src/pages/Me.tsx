/**
 * 个人中心：/me
 * - 账号：注册/登录（Supabase，用户名 + 密码）、角色、退出
 * - 发布凭据：管理员的 GitHub Token（文章仍是 GitHub Issues，写入需要它）
 * - 外观：亮/暗主题
 * - P1 占位：音乐播放器、换背景、像素图头像（资产库已实现，见 /assets）
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { SITE, hasToken, isConfigured as repoConfigured } from '../lib/github'
import { diagnoseSupabase, type SupabaseReport } from '../lib/supabase'
import { formatFull } from '../lib/text'
import { useAuth, usePat } from '../hooks/useAuth'

const P1_ITEMS = ['音乐播放器', '站点换背景', '像素图头像']

export default function Me() {
  const { isLoggedIn, isAdmin, isActive, username, profile, configured, ready, logout } = useAuth()
  const pat = usePat()
  const [patInput, setPatInput] = useState('')
  const [patMessage, setPatMessage] = useState('')
  const [patOk, setPatOk] = useState(false)
  const [report, setReport] = useState<SupabaseReport | null>(null)
  const [reportBusy, setReportBusy] = useState(false)

  const onSavePat = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await pat.save(patInput)
    setPatMessage(result.message)
    setPatOk(result.ok)
    if (result.ok) setPatInput('')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-caramel-200 bg-caramel-100 px-6 py-8 dark:border-caramel-700 dark:bg-caramel-800">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel-600 dark:text-caramel-300">
          Me
        </p>
        <h1 className="mt-2 text-3xl font-bold text-caramel-800 dark:text-caramel-100">个人中心</h1>
        <p className="mt-3 text-caramel-700 dark:text-caramel-200">
          账号用<strong>用户名 + 密码</strong>注册即可，不需要 GitHub。登录后可以评论文章、管理自己的物品台账；
          管理员额外拥有写作与用户管理权限。
        </p>
      </section>

      {/* ---------- 账号 ---------- */}
      <section className="space-y-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800">
        <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">我的账号</h2>

        {!configured && (
          <p className="rounded-lg border border-dashed border-caramel-300 bg-caramel-50 px-3 py-2 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-200">
            账号服务未配置：请在部署环境里设置 <code>VITE_SUPABASE_URL</code> 与{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>（本地写 <code>.env</code>），并在 Supabase SQL Editor 执行{' '}
            <code>supabase/schema.sql</code>。详见 README。
          </p>
        )}

        {configured && ready && !isLoggedIn && (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600"
            >
              登录
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-caramel-400 px-4 py-2 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
            >
              注册新账号
            </Link>
            <span className="text-sm text-caramel-600 dark:text-caramel-300">用户名 + 密码，30 秒搞定</span>
          </div>
        )}

        {configured && ready && isLoggedIn && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-caramel-500 text-lg font-medium text-caramel-50">
                {username.slice(0, 1).toUpperCase()}
              </span>
              <div className="text-sm">
                <p className="font-medium text-caramel-800 dark:text-caramel-100">
                  {username}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      isAdmin
                        ? 'bg-caramel-500 text-caramel-50'
                        : 'bg-caramel-200 text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100'
                    }`}
                  >
                    {isAdmin ? '管理员' : '普通用户'}
                  </span>
                  {!isActive && (
                    <span className="ml-2 rounded-full bg-caramel-700 px-2 py-0.5 text-xs text-caramel-100">
                      已封禁
                    </span>
                  )}
                </p>
                {profile && (
                  <p className="text-caramel-600 dark:text-caramel-300" title={formatFull(profile.created_at)}>
                    注册于 {profile.created_at.slice(0, 10)}
                  </p>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <Link
                  to="/assets"
                  className="rounded-lg border border-caramel-400 px-3 py-1.5 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
                >
                  我的资产库
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="rounded-lg border border-caramel-400 px-3 py-1.5 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
                  >
                    管理后台
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-caramel-400 px-3 py-1.5 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
                >
                  退出登录
                </button>
              </div>
            </div>
            <p className="text-xs text-caramel-600 dark:text-caramel-300">
              权限由数据库策略强制：普通用户只能评论和读写自己的资产，改前端代码也拿不到别人的数据。
            </p>
          </div>
        )}
      </section>

      {/* ---------- 账号服务自检 ---------- */}
      <section className="space-y-3 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">账号服务自检</h2>
          <button
            type="button"
            disabled={reportBusy}
            onClick={async () => {
              setReportBusy(true)
              setReport(await diagnoseSupabase())
              setReportBusy(false)
            }}
            className="rounded-lg border border-caramel-400 px-3 py-1 text-sm transition hover:bg-caramel-200 disabled:opacity-60 dark:hover:bg-caramel-700"
          >
            {reportBusy ? '检查中…' : '运行自检'}
          </button>
        </div>

        {report && (
          <ul className="space-y-1 text-sm text-caramel-700 dark:text-caramel-200">
            <li>
              {report.ok ? '✓' : '✗'} {report.message}
            </li>
            <li>· Supabase 可达：{report.reachable ? '是' : '否'}</li>
            <li>· 建表脚本 supabase/schema.sql：{report.schemaReady ? '已执行' : '未执行'}</li>
            <li>· 评论计数函数 comment_counts()：{report.countsReady ? '可用' : '缺失'}</li>
          </ul>
        )}

        <p className="text-xs text-caramel-600 dark:text-caramel-300">
          还没配 Supabase？见 README「配置 → 2. 账号体系」：新建免费项目 → SQL Editor 执行{' '}
          <code>supabase/schema.sql</code> → 关闭 Confirm email → 把 Project URL 与 anon key 填进环境变量。
        </p>
      </section>

      {/* ---------- 发布凭据（PAT） ---------- */}
      <section className="space-y-4 rounded-2xl border border-caramel-200 bg-caramel-100 p-5 dark:border-caramel-700 dark:bg-caramel-800">
        <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">发布凭据（GitHub Token）</h2>
        <p className="text-sm text-caramel-700 dark:text-caramel-200">
          文章仍存放在 GitHub Issues 里，所以<strong>写作与传图</strong>需要一个有 <code>repo</code> 权限的
          GitHub Token。它只保存在本机 localStorage，不入库、不进仓库。
        </p>

        <p className="text-sm text-caramel-600 dark:text-caramel-300">
          当前状态：
          {pat.hasPat ? (
            <span className="font-medium text-caramel-700 dark:text-caramel-100">
              已保存{pat.login ? `（${pat.login}）` : ''}
              {repoConfigured() ? '' : '，但仓库未配置'}
            </span>
          ) : (
            <span className="font-medium text-caramel-700 dark:text-caramel-100">未保存（不能发布文章/上传图片）</span>
          )}
        </p>

        <form onSubmit={onSavePat} className="space-y-2">
          <label className="block text-sm text-caramel-700 dark:text-caramel-200" htmlFor="pat">
            粘贴 Token（经典 PAT 勾 <code>repo</code> 即可）
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="pat"
              type="password"
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="ghp_..."
              autoComplete="off"
              className="min-w-[16rem] flex-1 rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
            />
            <button
              type="submit"
              disabled={pat.checking}
              className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:opacity-60"
            >
              {pat.checking ? '校验中…' : '保存'}
            </button>
            {hasToken() && (
              <button
                type="button"
                onClick={pat.clear}
                className="rounded-lg border border-caramel-400 px-4 py-2 text-sm transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
              >
                清除
              </button>
            )}
          </div>
          {patMessage && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                patOk
                  ? 'border border-caramel-300 bg-caramel-50 text-caramel-700 dark:bg-caramel-900 dark:text-caramel-200'
                  : 'border border-caramel-500 bg-caramel-200 font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100'
              }`}
            >
              {patOk ? '✓ ' : '⚠ '}
              {patMessage}
            </p>
          )}
        </form>

        <p className="text-xs text-caramel-600 dark:text-caramel-300">
          目标仓库：<code>{SITE.user}/{SITE.repo}</code>
          {configured && !isAdmin && '（非管理员账号无法进入 /write）'}
        </p>
      </section>

      {/* ---------- 外观 ---------- */}
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
          <li className="rounded-full border border-caramel-300 bg-caramel-200 px-3 py-1 text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100">
            资产库已上线 → <Link to="/assets" className="underline">去看看</Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
