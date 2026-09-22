/**
 * 账号体系（Supabase）与站长发布凭据（GitHub PAT）两套状态。
 *
 * - useAuth()：注册/登录/退出、当前 profile（用户名、角色、是否被封禁）。
 *   角色与权限由数据库 RLS 强制，前端只是展示与引导。
 * - usePat()：写文章/传图要用 GitHub Token（文章仍以 Issues 为源），
 *   仅存在本机 localStorage，不入库、不进仓库。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { SITE, clearToken, fetchUser, hasToken, setToken } from '../lib/github'
import {
  type Profile,
  USERNAME_RE,
  emailToUsername,
  isSupabaseConfigured,
  supabase,
  translateAuthError,
  usernameToEmail,
} from '../lib/supabase'

export interface AuthResult {
  ok: boolean
  message: string
}

// ============================================================
// Supabase 会话状态（模块级 store，多组件共享）
// ============================================================
interface AuthState {
  /** 初次会话恢复是否完成 */
  ready: boolean
  userId: string | null
  email: string | null
  username: string
  profile: Profile | null
  error: string
}

let state: AuthState = {
  ready: !isSupabaseConfigured(),
  userId: null,
  email: null,
  username: '',
  profile: null,
  error: '',
}
const listeners = new Set<() => void>()

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

async function loadProfile(userId: string, email: string | null | undefined) {
  const { data, error } = await supabase()
    .from('profiles')
    .select('id, username, role, banned, created_at')
    .eq('id', userId)
    .maybeSingle()
  setState({
    ready: true,
    userId,
    email: email ?? null,
    username: (data as Profile | null)?.username || emailToUsername(email),
    profile: (data as Profile | null) ?? null,
    error: error ? `读取账号资料失败：${error.message}` : '',
  })
}

async function syncSession() {
  const { data } = await supabase().auth.getSession()
  const user = data.session?.user
  if (!user) {
    setState({ ready: true, userId: null, email: null, username: '', profile: null })
    return
  }
  await loadProfile(user.id, user.email)
}

let started = false
export function startAuth(): void {
  if (started) return
  started = true
  if (!isSupabaseConfigured()) {
    setState({ ready: true })
    return
  }
  void syncSession()
  supabase().auth.onAuthStateChange((_event, session) => {
    const user = session?.user
    if (!user) {
      setState({ ready: true, userId: null, email: null, username: '', profile: null })
      return
    }
    void loadProfile(user.id, user.email)
  })
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state)
  useEffect(() => {
    startAuth()
  }, [])

  const register = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    const name = username.trim()
    if (!USERNAME_RE.test(name)) {
      return { ok: false, message: '用户名 2–24 位，可用中英文、数字、下划线、连字符' }
    }
    if (password.length < 8) return { ok: false, message: '密码至少 8 位' }
    if (!isSupabaseConfigured()) return { ok: false, message: 'Supabase 还没配置，暂时无法注册' }
    try {
      const { data, error } = await supabase().auth.signUp({
        email: usernameToEmail(name),
        password,
        options: { data: { username: name } },
      })
      if (error) return { ok: false, message: translateAuthError(error.message) }
      if (!data.session) {
        return {
          ok: false,
          message:
            '注册成功但需要邮箱验证：请到 Supabase → Authentication → Sign In / Providers → Email 关闭 Confirm email，然后重新注册',
        }
      }
      await loadProfile(data.session.user.id, data.session.user.email)
      return { ok: true, message: `注册成功，欢迎 ${name}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '注册失败' }
    }
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    const name = username.trim()
    if (!name || !password) return { ok: false, message: '请填写用户名和密码' }
    if (!isSupabaseConfigured()) return { ok: false, message: 'Supabase 还没配置，暂时无法登录' }
    try {
      const { data, error } = await supabase().auth.signInWithPassword({
        email: usernameToEmail(name),
        password,
      })
      if (error) return { ok: false, message: translateAuthError(error.message) }
      await loadProfile(data.user.id, data.user.email)
      if (state.profile?.banned) {
        await supabase().auth.signOut()
        setState({ userId: null, username: '', profile: null })
        return { ok: false, message: '该账号已被管理员封禁，无法登录' }
      }
      return { ok: true, message: `欢迎回来，${state.profile?.username || name}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '登录失败' }
    }
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) await supabase().auth.signOut()
    setState({ userId: null, email: null, username: '', profile: null })
  }, [])

  return {
    ...snapshot,
    configured: isSupabaseConfigured(),
    isLoggedIn: !!snapshot.userId,
    isAdmin: snapshot.profile?.role === 'admin' && !snapshot.profile.banned,
    isActive: !!snapshot.profile && !snapshot.profile.banned,
    register,
    login,
    logout,
  }
}

// ============================================================
// 站长发布凭据（GitHub PAT）
// ============================================================
interface PatState {
  pat: string
  login: string
  checking: boolean
  error: string
}

let patState: PatState = { pat: '', login: '', checking: false, error: '' }
const patListeners = new Set<() => void>()

function setPatState(patch: Partial<PatState>) {
  patState = { ...patState, ...patch }
  patListeners.forEach((fn) => fn())
}

function subscribePat(fn: () => void) {
  patListeners.add(fn)
  return () => {
    patListeners.delete(fn)
  }
}

export function usePat() {
  const snapshot = useSyncExternalStore(subscribePat, () => patState, () => patState)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return
    setInitialized(true)
    // 本机已存过 token 时给出提示（不回读明文，只在请求时由 lib/github 读取）
    if (hasToken()) setPatState({ pat: 'saved' })
  }, [initialized])

  const save = useCallback(async (pat: string): Promise<AuthResult> => {
    const token = pat.trim()
    if (!token) return { ok: false, message: '请填写 GitHub Token' }
    setPatState({ checking: true, error: '' })
    try {
      const user = await fetchUser(token)
      setToken(token)
      const isOwnerAccount = user.login.toLowerCase() === SITE.owner.toLowerCase()
      setPatState({ pat: token, login: user.login, checking: false, error: '' })
      return {
        ok: true,
        message: isOwnerAccount
          ? `已保存：${user.login}（仓库 owner）`
          : `已保存：${user.login}。注意它不是仓库 owner（${SITE.owner}），除非被加为协作者，否则无法发布`,
      }
    } catch (err) {
      setPatState({ checking: false, pat: '', login: '', error: '' })
      return { ok: false, message: err instanceof Error ? err.message : 'Token 校验失败' }
    }
  }, [])

  const clear = useCallback(() => {
    clearToken()
    setPatState({ pat: '', login: '', checking: false, error: '' })
  }, [])

  return { ...snapshot, initialized, hasPat: hasToken(), save, clear }
}
