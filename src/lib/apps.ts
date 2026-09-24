import type { AppDef, AppId } from '../types/desktop'

/** 窗口名 → 路由 → 数据源：全站唯一登记处，任务栏、所有项目菜单与路由都由它派生 */
export const APPS: AppDef[] = [
  { id: 'about', name: '关于', path: '/about', source: '本地静态配置', icon: 'about' },
  { id: 'projects', name: '项目', path: '/projects', source: '静态数据（待接入）', icon: 'projects' },
  { id: 'blog', name: '博客', path: '/blog', source: 'GitHub Issues（待接入）', icon: 'blog' },
  { id: 'skills', name: '技能', path: '/skills', source: '本地静态', icon: 'skills' },
  { id: 'contact', name: '联系', path: '/contact', source: '本地静态', icon: 'contact' },
  { id: 'terminal', name: '终端', path: '/terminal', source: '无（前端假命令）', icon: 'terminal' },
  { id: 'assets', name: '资产库', path: '/assets', source: 'Supabase（待接入）', icon: 'assets' },
  { id: 'settings', name: '设置', path: '/settings', source: 'localStorage', icon: 'settings' },
]

export function getApp(id: AppId): AppDef {
  const app = APPS.find((a) => a.id === id)
  if (!app) throw new Error(`未登记的应用：${id}`)
  return app
}

/** 当前路径对应哪个窗口；'/' 返回 undefined（桌面本身没有窗口） */
export function matchApp(pathname: string): AppDef | undefined {
  if (pathname === '/') return undefined
  return APPS.find((a) => pathname === a.path || pathname.startsWith(`${a.path}/`))
}
