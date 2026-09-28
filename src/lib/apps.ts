import type { AppDef, AppId } from '../types/desktop'

/** 窗口名 → 路由 → 数据源：全站唯一登记处，任务栏、所有项目菜单与路由都由它派生 */
export const APPS: AppDef[] = [
  { id: 'about', name: '关于', path: '/about', source: '本地静态配置', icon: 'about' },
  {
    id: 'write',
    name: '写作',
    path: '/write',
    source: 'GitHub Issues 写入（需要本机 PAT，只存 localStorage）',
    icon: 'write',
    defaultSize: { w: 900, h: 660 },
  },
  {
    id: 'projects',
    name: '项目',
    path: '/projects',
    source: '本地静态数据（src/data/projects.ts）',
    icon: 'projects',
    /* 卡片是两列，默认给宽一点 */
    defaultSize: { w: 900, h: 620 },
  },
  {
    id: 'blog',
    name: '博客',
    path: '/blog',
    source: 'GitHub Issues（chengantoine2-spec/Antoine.github.io）',
    icon: 'blog',
    defaultSize: { w: 860, h: 640 },
  },
  { id: 'skills', name: '技能', path: '/skills', source: '本地静态', icon: 'skills' },
  { id: 'contact', name: '联系', path: '/contact', source: '本地静态', icon: 'contact' },
  { id: 'terminal', name: '终端', path: '/terminal', source: '无（前端假命令）', icon: 'terminal' },
  { id: 'assets', name: '资产库', path: '/assets', source: 'Supabase（待接入）', icon: 'assets' },
  {
    id: 'settings',
    name: '设置',
    path: '/settings',
    source: '浏览器本地设置（localStorage）',
    icon: 'settings',
    /* 设置项比一般窗口多，默认给高一点，免得一进来就要滚 */
    defaultSize: { w: 720, h: 620 },
  },
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
