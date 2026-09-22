/**
 * 我的资产库（物品台账）：/assets
 * 普通用户只能管理自己的条目（RLS 强制）；管理员可以切换查看/管理所有人的条目。
 * 字段：名称、分类、数量、单位、单价、币种、购入时间、存放位置、封面图、备注、标签。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isConfigured as repoConfigured, uploadImage } from '../lib/github'
import { isSupabaseConfigured, supabase, type AssetRow } from '../lib/supabase'
import { formatDate } from '../lib/text'
import { useAuth, usePat } from '../hooks/useAuth'

const CURRENCIES = ['CNY', 'USD', 'JPY', 'EUR', 'HKD']
const CATEGORIES = ['数码', '家居', '书籍', '厨房', '服饰', '工具', '收藏', '其他']
const UNITS = ['件', '个', '台', '本', '套', 'kg', 'g', '盒']

interface FormState {
  id?: string
  name: string
  category: string
  quantity: string
  unit: string
  unit_value: string
  currency: string
  purchased_at: string
  location: string
  cover: string
  notes: string
  tags: string
}

const emptyForm = (): FormState => ({
  name: '',
  category: '数码',
  quantity: '1',
  unit: '件',
  unit_value: '',
  currency: 'CNY',
  purchased_at: '',
  location: '',
  cover: '',
  notes: '',
  tags: '',
})

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Assets() {
  const { isLoggedIn, isAdmin, isActive, userId, ready } = useAuth()
  const { hasPat } = usePat()
  const location = useLocation()

  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [rows, setRows] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !isLoggedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase()
      .from('assets')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
    if (!(isAdmin && scope === 'all')) query = query.eq('owner_id', userId)
    const { data, error: err } = await query
    if (err) setError(`读取失败：${err.message}`)
    else {
      setError('')
      setRows((data as unknown as AssetRow[]) || [])
    }
    setLoading(false)
  }, [isAdmin, isLoggedIn, scope, userId])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>()
    let quantity = 0
    let value = 0
    for (const r of rows) {
      quantity += Number(r.quantity) || 0
      const line = (Number(r.quantity) || 0) * (Number(r.unit_value) || 0)
      value += line
      byCurrency.set(r.currency, (byCurrency.get(r.currency) || 0) + line)
    }
    return { byCurrency: [...byCurrency.entries()], quantity, value }
  }, [rows])

  const save = async () => {
    if (!form || !userId) return
    const name = form.name.trim()
    if (!name) {
      setError('名称不能为空')
      return
    }
    setSaving(true)
    const payload = {
      owner_id: userId,
      name,
      category: form.category,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      unit_value: form.unit_value === '' ? null : Number(form.unit_value),
      currency: form.currency,
      purchased_at: form.purchased_at || null,
      location: form.location.trim() || null,
      cover: form.cover.trim() || null,
      notes: form.notes.trim() || null,
      tags: form.tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    }
    const { error: err } = form.id
      ? await supabase().from('assets').update(payload).eq('id', form.id)
      : await supabase().from('assets').insert(payload)
    setSaving(false)
    if (err) setError(`保存失败：${err.message}`)
    else {
      setError('')
      setForm(null)
      await load()
    }
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除这条资产记录吗？')) return
    const { error: err } = await supabase().from('assets').delete().eq('id', id)
    if (err) setError(`删除失败：${err.message}`)
    else await load()
  }

  const uploadCover = async (file: File) => {
    if (!form) return
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      setForm({ ...form, cover: url })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    }
    setUploading(false)
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">资产库</h1>
        <p className="rounded-xl border border-dashed border-caramel-300 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:border-caramel-600 dark:bg-caramel-800 dark:text-caramel-200">
          资产库依赖账号服务：请配置 <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>，
          并在 Supabase 执行 <code>supabase/schema.sql</code>。
        </p>
      </div>
    )
  }

  if (ready && !isLoggedIn) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">我的资产库</h1>
        <p className="text-caramel-700 dark:text-caramel-200">
          登录后即可建自己的物品台账（数量、单价、购入时间、存放位置）。
        </p>
        <div className="flex gap-3">
          <Link
            to={`/login?next=${encodeURIComponent(location.pathname)}`}
            className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 hover:bg-caramel-600"
          >
            登录
          </Link>
          <Link
            to="/register"
            className="rounded-lg border border-caramel-400 px-4 py-2 text-sm hover:bg-caramel-200 dark:hover:bg-caramel-700"
          >
            注册
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">
            {isAdmin && scope === 'all' ? '全部用户的资产库' : '我的资产库'}
          </h1>
          <p className="mt-1 text-sm text-caramel-600 dark:text-caramel-300">
            物品台账：名称 / 分类 / 数量 / 单价 / 购入时间 / 存放位置 / 封面 / 备注 / 标签。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="inline-flex rounded-full border border-caramel-200 bg-caramel-100 p-0.5 dark:border-caramel-700 dark:bg-caramel-800">
              {(['mine', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    scope === s
                      ? 'bg-caramel-500 font-medium text-caramel-50'
                      : 'text-caramel-700 dark:text-caramel-200'
                  }`}
                >
                  {s === 'mine' ? '我的' : '全部用户'}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={!isActive}
            onClick={() => setForm(emptyForm())}
            className="rounded-lg bg-caramel-500 px-4 py-1.5 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600 disabled:opacity-60"
          >
            + 新增资产
          </button>
        </div>
      </header>

      {!isActive && (
        <p className="rounded-xl border border-caramel-400 bg-caramel-100 px-4 py-3 text-sm text-caramel-700 dark:bg-caramel-800 dark:text-caramel-200">
          你的账号已被管理员封禁，只能查看，不能新增或修改。
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800">
          <p className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">条目 / 总数量</p>
          <p className="mt-1 text-2xl font-bold text-caramel-700 dark:text-caramel-100">
            {rows.length} / {totals.quantity}
          </p>
        </div>
        <div className="rounded-2xl border border-caramel-200 bg-caramel-100 p-4 sm:col-span-2 dark:border-caramel-700 dark:bg-caramel-800">
          <p className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">按币种合计价值</p>
          <p className="mt-1 text-lg font-bold text-caramel-700 dark:text-caramel-100">
            {totals.byCurrency.length === 0
              ? '—'
              : totals.byCurrency.map(([cur, v]) => money(v, cur)).join(' · ')}
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-caramel-500 bg-caramel-200 px-3 py-2 text-sm font-medium text-caramel-900 dark:bg-caramel-700 dark:text-caramel-100">
          ⚠ {error}
        </p>
      )}

      {form && (
        <section className="space-y-4 rounded-2xl border border-caramel-300 bg-caramel-100 p-5 dark:border-caramel-600 dark:bg-caramel-800">
          <h2 className="text-lg font-bold text-caramel-700 dark:text-caramel-100">
            {form.id ? '编辑资产' : '新增资产'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">名称 *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">分类</span>
              <input
                list="asset-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
              <datalist id="asset-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">数量</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">单位</span>
              <input
                list="asset-units"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
              <datalist id="asset-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">单价</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_value}
                onChange={(e) => setForm({ ...form, unit_value: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">币种</span>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">购入时间</span>
              <input
                type="date"
                value={form.purchased_at}
                onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">存放位置</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="书房 / 2 号抽屉"
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">
                封面图 URL（可留空）
              </span>
              <div className="flex gap-2">
                <input
                  value={form.cover}
                  onChange={(e) => setForm({ ...form, cover: e.target.value })}
                  placeholder="https://cdn.jsdelivr.net/gh/...@img/..."
                  className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
                />
                <button
                  type="button"
                  disabled={uploading || !hasPat || !repoConfigured()}
                  onClick={() => fileRef.current?.click()}
                  title={hasPat ? '上传到 img 分支' : '需要先在个人中心保存 GitHub Token'}
                  className="shrink-0 rounded-lg border border-caramel-400 px-3 py-2 text-sm transition hover:bg-caramel-200 disabled:opacity-60 dark:hover:bg-caramel-700"
                >
                  {uploading ? '上传中…' : '上传'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadCover(f)
                    e.target.value = ''
                  }}
                />
              </div>
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">标签（逗号分隔）</span>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="电子产品, 常用"
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>

            <label className="space-y-1 sm:col-span-2 lg:col-span-3">
              <span className="text-sm font-medium text-caramel-700 dark:text-caramel-200">备注</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-caramel-300 bg-caramel-50 px-3 py-2 text-sm dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-100"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 hover:bg-caramel-600 disabled:opacity-60"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg border border-caramel-400 px-4 py-2 text-sm hover:bg-caramel-200 dark:hover:bg-caramel-700"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-caramel-600 dark:text-caramel-300">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-caramel-300 px-6 py-12 text-center text-caramel-700 dark:border-caramel-600 dark:text-caramel-200">
          还没有资产记录，点右上角「+ 新增资产」开始记一笔。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const line = (Number(row.quantity) || 0) * (Number(row.unit_value) || 0)
            return (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-caramel-200 bg-caramel-100 dark:border-caramel-700 dark:bg-caramel-800"
              >
                {row.cover && (
                  <img src={row.cover} alt={row.name} loading="lazy" className="h-36 w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-caramel-800 dark:text-caramel-100">{row.name}</h3>
                    <span className="shrink-0 rounded-full bg-caramel-200 px-2 py-0.5 text-xs text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100">
                      {row.category}
                    </span>
                  </div>

                  <dl className="space-y-1 text-sm text-caramel-700 dark:text-caramel-200">
                    <div className="flex gap-2">
                      <dt className="text-caramel-600 dark:text-caramel-300">数量</dt>
                      <dd>
                        {row.quantity} {row.unit}
                      </dd>
                    </div>
                    {row.unit_value !== null && (
                      <div className="flex gap-2">
                        <dt className="text-caramel-600 dark:text-caramel-300">单价 / 小计</dt>
                        <dd>
                          {money(Number(row.unit_value), row.currency)} / {money(line, row.currency)}
                        </dd>
                      </div>
                    )}
                    {row.purchased_at && (
                      <div className="flex gap-2">
                        <dt className="text-caramel-600 dark:text-caramel-300">购入</dt>
                        <dd>{formatDate(row.purchased_at)}</dd>
                      </div>
                    )}
                    {row.location && (
                      <div className="flex gap-2">
                        <dt className="text-caramel-600 dark:text-caramel-300">位置</dt>
                        <dd>{row.location}</dd>
                      </div>
                    )}
                    {isAdmin && scope === 'all' && row.profiles?.username && (
                      <div className="flex gap-2">
                        <dt className="text-caramel-600 dark:text-caramel-300">归属</dt>
                        <dd>{row.profiles.username}</dd>
                      </div>
                    )}
                  </dl>

                  {row.notes && (
                    <p className="text-xs text-caramel-600 dark:text-caramel-300">{row.notes}</p>
                  )}

                  {row.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1">
                      {row.tags.map((t) => (
                        <li
                          key={t}
                          className="rounded bg-caramel-200 px-1.5 py-0.5 text-xs text-caramel-700 dark:bg-caramel-700 dark:text-caramel-100"
                        >
                          #{t}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          name: row.name,
                          category: row.category,
                          quantity: String(row.quantity),
                          unit: row.unit,
                          unit_value: row.unit_value === null ? '' : String(row.unit_value),
                          currency: row.currency,
                          purchased_at: row.purchased_at || '',
                          location: row.location || '',
                          cover: row.cover || '',
                          notes: row.notes || '',
                          tags: row.tags.join(', '),
                        })
                      }
                      className="rounded-lg border border-caramel-400 px-3 py-1 text-xs transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="rounded-lg border border-caramel-400 px-3 py-1 text-xs transition hover:bg-caramel-200 dark:hover:bg-caramel-700"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!hasPat && (
        <p className="text-xs text-caramel-600 dark:text-caramel-300">
          提示：想在资产条目里传图，需要先在{' '}
          <Link to="/me" className="underline">
            个人中心
          </Link>{' '}
          保存 GitHub Token（图片存到 img 分支）。
        </p>
      )}
    </div>
  )
}
