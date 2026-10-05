import type { AppDef, AppId } from '../types/desktop'

/* 「芹菜耕地」：站名叫芹菜耕地，每个窗口对应一样菜（`veggie`）。
   图标仍是自绘线稿（AppIcon），`veggie` 只出现在任务栏提示与「所有项目」里。 */

/**
 * 是不是跑在本机（开发服务器、本地预览）。
 * ⚠️ 判断的是**页面的主机名**，不是 build 模式：本地 `npm run preview` 出来的产物也该算本地。
 * 线上（chengantoine2-spec.github.io）为 false —— `localOnly` 的窗口在那儿一律不出现。
 */
export const IS_LOCAL_HOST =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)

/** 窗口名 → 路由 → 数据源：全站唯一登记处，任务栏、所有项目菜单与路由都由它派生 */
export const APPS: AppDef[] = [
  {
    id: 'about',
    name: '关于',
    path: '/about',
    source: '本地静态配置',
    icon: 'about',
    veggie: '土豆',
  },
  {
    id: 'write',
    name: '博客创作',
    path: '/write',
    source: 'GitHub Issues 写入 + 图片上传（需要本机 PAT，只存 localStorage）',
    icon: 'write',
    veggie: '番茄',
    defaultSize: { w: 960, h: 700 },
  },
  {
    id: 'projects',
    name: '项目',
    path: '/projects',
    source: '本地静态数据（src/data/projects.ts）',
    icon: 'projects',
    veggie: '南瓜',
    /* 卡片是两列，默认给宽一点 */
    defaultSize: { w: 900, h: 620 },
  },
  {
    id: 'blog',
    name: '博客',
    path: '/blog',
    source: 'GitHub Issues（chengantoine2-spec/Antoine.github.io）',
    icon: 'blog',
    veggie: '玉米',
    /* 贴吧式三栏排版：给到 1000 宽才放得下左栏 + 卡片流 + 右栏（窄窗会自动收成一列） */
    defaultSize: { w: 1000, h: 680 },
  },
  {
    id: 'wiki',
    name: '饥荒 Wiki',
    path: '/wiki',
    source: '饥荒联机版资料（本地数据 src/data/dst/，窗口内容由 wiki 负责人维护）',
    icon: 'wiki',
    veggie: '洋葱',
    /* 三栏版式，和博客窗口一样给宽一点 */
    defaultSize: { w: 1000, h: 680 },
  },
  {
    id: 'skills',
    name: '技能',
    path: '/skills',
    source: '本地静态',
    icon: 'skills',
    veggie: '竹笋',
  },
  {
    id: 'contact',
    name: '联系',
    path: '/contact',
    source: '本地静态',
    icon: 'contact',
    veggie: '葡萄',
  },
  {
    id: 'terminal',
    name: '终端',
    path: '/terminal',
    source: '本机终端服务（tools/term-server.mjs，只监听 127.0.0.1）：浏览器只当屏幕，命令真在本机跑',
    icon: 'terminal',
    veggie: '辣椒',
    /* 输出行偏宽，默认给大一点 */
    defaultSize: { w: 900, h: 620 },
  },
  {
    id: 'dsh',
    name: 'DSH',
    path: '/dsh',
    source: '本机 DeepSeek Harness（默认 http://127.0.0.1:3080，地址可在窗口里改）',
    icon: 'dsh',
    /* 田地的本体：站叫芹菜耕地，DSH 就是那块地的入口 */
    veggie: '芹菜',
    /* 只是个启动器，不用大窗口 */
    defaultSize: { w: 620, h: 480 },
    /* 只有本机才有意义：线上站点是 HTTPS，够不到 127.0.0.1，也嵌不了 http 的页面 */
    localOnly: true,
  },
  {
    id: 'assets',
    name: '资产库',
    path: '/assets',
    source: 'Supabase（待接入）',
    icon: 'assets',
    veggie: '花生',
  },
  {
    id: 'settings',
    name: '设置',
    path: '/settings',
    source: '浏览器本地设置（localStorage）',
    icon: 'settings',
    veggie: '大蒜',
    /* 设置项比一般窗口多，默认给高一点，免得一进来就要滚 */
    defaultSize: { w: 720, h: 620 },
  },
]

/** 当前环境真正能用的窗口（任务栏、「所有项目」、路由都用它，别直接用 APPS） */
export function visibleApps(): AppDef[] {
  return APPS.filter((app) => !app.localOnly || IS_LOCAL_HOST)
}

export function getApp(id: AppId): AppDef {
  const app = APPS.find((a) => a.id === id)
  if (!app) throw new Error(`未登记的应用：${id}`)
  return app
}

/** 当前路径对应哪个窗口；'/' 返回 undefined（桌面本身没有窗口）。
    本机专属的窗口在线上不是"未登记"，而是**不该出现** —— 一并返回 undefined。 */
export function matchApp(pathname: string): AppDef | undefined {
  if (pathname === '/') return undefined
  const app = APPS.find((a) => pathname === a.path || pathname.startsWith(`${a.path}/`))
  if (!app) return undefined
  if (app.localOnly && !IS_LOCAL_HOST) return undefined
  return app
}
