/**
 * PAT 登录态：token 存 localStorage（不入库），校验后缓存 GitHub 用户信息。
 * 多个组件通过 useSyncExternalStore 共享同一份状态。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { PAT_STORAGE_KEY, SITE, fetchUser, type GitHubUser } from '../lib/github'

interface AuthState {
  pat: string
  user: GitHubUser | null
  checking: boolean
  error: string
}

let state: AuthState = { pat: '', user: null, checking: false, error: '' }
const listeners = new Set<() => void>()

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function readStoredPat(): string {
  try {
    return localStorage.getItem(PAT_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/** 应用启动时校验一次已保存的 PAT */
export async function initAuth(): Promise<void> {
  const pat = readStoredPat()
  if (!pat) {
    setState({ pat: '', user: null, checking: false, error: '' })
    return
  }
  setState({ pat, checking: true, error: '' })
  try {
    const user = await fetchUser(pat)
    setState({ user, checking: false, error: '' })
  } catch (err) {
    setState({
      user: null,
      checking: false,
      error: err instanceof Error ? err.message : 'PAT 校验失败',
    })
  }
}

/** 站长判定：owner 未配置时，任何通过校验的 PAT 都视为站长 */
export function isOwner(user: GitHubUser | null): boolean {
  if (!user) return false
  const owner = SITE.owner
  if (!owner || owner === 'YOUR_GITHUB_USER') return true
  return owner.toLowerCase() === user.login.toLowerCase()
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // 首次挂载时若还没校验过，补齐一次
    if (!snapshot.pat && !snapshot.user) void initAuth()
  }, [snapshot.pat, snapshot.user])

  const login = useCallback(async (pat: string): Promise<boolean> => {
    const trimmed = pat.trim()
    if (!trimmed) {
      setState({ error: '请输入 Personal Access Token' })
      return false
    }
    setBusy(true)
    setState({ checking: true, error: '' })
    try {
      const user = await fetchUser(trimmed)
      try {
        localStorage.setItem(PAT_STORAGE_KEY, trimmed)
      } catch {
        /* 隐私模式可能写入失败，本次会话内存态仍可用 */
      }
      setState({ pat: trimmed, user, checking: false, error: '' })
      return true
    } catch (err) {
      setState({
        pat: '',
        user: null,
        checking: false,
        error: err instanceof Error ? err.message : '登录失败',
      })
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(PAT_STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
    setState({ pat: '', user: null, checking: false, error: '' })
  }, [])

  return {
    ...snapshot,
    busy,
    isOwner: isOwner(snapshot.user),
    login,
    logout,
  }
}
