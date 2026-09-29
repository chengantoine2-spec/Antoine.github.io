import type { AppDef, AppId } from '../types/desktop'

/** 窗口名 → 路由 → 数据源：全站唯一登记处，任务栏、所有项目菜单与路由都由它派生 */
export const APPS: AppDef[] = [
  { id: 'about', name: '关于', path: '/about', source: '本地静态配置', icon: 'about' },
  {
    id: 'write',
    name: '博客创作',
    path: '/write',
    source: 'GitHub Issues 写入 + 图片上传（需要本机 PAT，只存 localStorage）',
    icon: 'write',
    defaultSize: { w: 960, h: 700 },
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
    /* 贴吧式三栏排版：给到 1000 宽才放得下左栏 + 卡片流 + 右栏（窄窗会自动收成一列） */
    defaultSize: { w: 1000, h: 680 },
  },
  {
    id: 'wiki',
    name: '饥荒 Wiki',
    path: '/wiki',
    source: '饥荒联机版资料（本地数据 src/data/dst/，窗口内容由 wiki 负责人维护）',
    icon: 'wiki',
    /* 三栏版式，和博客窗口一样给宽一点 */
    defaultSize: { w: 1000, h: 680 },
  },
  { id: 'skills', name: '技能', path: '/skills', source: '本地静态', icon: 'skills' },
  { id: 'contact', name: '联系', path: '/contact', source: '本地静态', icon: 'contact' },
  {
    id: 'terminal',
    name: '终端',
    path: '/terminal',
    source: '本机终端服务（tools/term-server.mjs，只监听 127.0.0.1）：浏览器只当屏幕，命令真在本机跑',
    icon: 'terminal',
    /* 输出行偏宽，默认给大一点 */
    defaultSize: { w: 900, h: 620 },
  },
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
