/**
 * Supabase 客户端与账号约定。
 *
 * 设计要点：
 * - 用户名 + 密码注册/登录：Supabase Auth 原生是 email+password，
 *   所以用「用户名 → 合成邮箱 username@<AUTH_EMAIL_DOMAIN>」做映射，
 *   需要在 Supabase 后台把 Confirm email 关掉（合成邮箱收不到验证信）。
 * - 角色与封禁状态存在 profiles 表，权限由数据库 RLS 强制（见 supabase/schema.sql），
 *   前端只负责展示，改前端代码绕不过去。
 * - anon key 是设计上公开的；service_role key 绝不能进前端或仓库。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''
/** 合成邮箱域名，仅内部使用，不需要真实可收信 */
export const AUTH_EMAIL_DOMAIN = (import.meta.env.VITE_AUTH_EMAIL_DOMAIN as string) || 'caramel.local'

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase 未配置：请设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY（本地写 .env，线上填仓库 Variables）',
    )
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }
  return client
}

/** 用户名规则：2–24 位，中英文 / 数字 / 下划线 / 连字符 */
export const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5-]{2,24}$/

/**
 * 用户名 → 合成邮箱的本地部分。
 *
 * 为什么不用用户名直接拼：中文（或任何非 ASCII）用户名会得到
 * `布丁@caramel.local` 这种非 ASCII 本地部分，Supabase Auth 可能直接判为
 * 非法邮箱而拒绝注册。这里用 UTF-8 字节的 djb2 哈希 + 字节长度拼成纯 ASCII
 * 别名（`u` + 8 位十六进制 + 长度），确定性可复算，登录时无需查表。
 * 真实用户名始终存在 profiles.username 里。
 */
export function usernameAlias(username: string): string {
  const bytes = new TextEncoder().encode(username.trim().toLowerCase())
  let h = 5381
  for (const b of bytes) h = ((h << 5) + h + b) >>> 0
  return `u${h.toString(16).padStart(8, '0')}${bytes.length.toString(16)}`
}

export const usernameToEmail = (username: string): string =>
  `${usernameAlias(username)}@${AUTH_EMAIL_DOMAIN}`

export type Role = 'admin' | 'user'

export interface Profile {
  id: string
  username: string
  role: Role
  banned: boolean
  created_at: string
}

export interface CommentRow {
  id: string
  blog_id: number
  user_id: string
  body: string
  created_at: string
  updated_at: string
  /** 通过外键连带查出的作者用户名 */
  profiles?: { username: string } | null
}

export interface AssetRow {
  id: string
  owner_id: string
  name: string
  category: string
  quantity: number
  unit: string
  unit_value: number | null
  currency: string
  purchased_at: string | null
  location: string | null
  cover: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  profiles?: { username: string } | null
}

/** 把 Supabase 的英文报错翻成人话 */
export function translateAuthError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return '用户名或密码不正确'
  if (m.includes('already registered') || m.includes('already been registered'))
    return '这个用户名已经被注册了，换一个或直接登录'
  if (m.includes('email not confirmed')) return '需要邮箱验证：请到 Supabase 关闭 Confirm email 后重试'
  if (m.includes('password should be at least')) return '密码太短，至少 8 位'
  if (m.includes('rate limit') || m.includes('too many')) return '操作太频繁，请稍后再试'
  if (m.includes('user not found')) return '账号不存在，先注册'
  if (m.includes('profiles_username_key') || m.includes('duplicate key'))
    return '这个用户名已经被占用了'
  return message || '操作失败'
}

export interface SupabaseReport {
  reachable: boolean
  /** profiles 表存在（说明 schema.sql 跑过了） */
  schemaReady: boolean
  /** comment_counts() 函数存在（列表页评论数用） */
  countsReady: boolean
  /** 已注册用户数（读不到时为 null） */
  users: number | null
  ok: boolean
  message: string
}

/** 账号服务自检：URL 通不通、建表脚本跑了没、函数在不在 */
export async function diagnoseSupabase(): Promise<SupabaseReport> {
  if (!isSupabaseConfigured()) {
    return {
      reachable: false,
      schemaReady: false,
      countsReady: false,
      users: null,
      ok: false,
      message: '未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY',
    }
  }

  let reachable = false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store',
    })
    reachable = res.status > 0 && res.status < 500
  } catch {
    reachable = false
  }

  let schemaReady = false
  let countsReady = false
  let users: number | null = null
  let detail = ''

  if (reachable) {
    const p = await supabase().from('profiles').select('id', { count: 'exact', head: true })
    if (p.error) detail = p.error.message
    else {
      schemaReady = true
      users = p.count ?? null
    }
    if (schemaReady) {
      const r = await supabase().rpc('comment_counts')
      countsReady = !r.error
    }
  }

  const ok = reachable && schemaReady
  const message = !reachable
    ? 'Supabase 不可达：检查 VITE_SUPABASE_URL，或免费项目已被暂停（Dashboard → Resume project）'
    : !schemaReady
      ? `还没执行 supabase/schema.sql（${detail || 'profiles 表不存在'}）`
      : `账号服务正常 · 已注册 ${users ?? '?'} 人 · 评论计数函数${countsReady ? '可用' : '缺失（重新执行 schema.sql）'}`

  return { reachable, schemaReady, countsReady, users, ok, message }
}
