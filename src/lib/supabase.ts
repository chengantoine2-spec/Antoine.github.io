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

export const usernameToEmail = (username: string): string =>
  `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`

export const emailToUsername = (email?: string | null): string => {
  if (!email) return ''
  const suffix = `@${AUTH_EMAIL_DOMAIN}`
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email
}

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
