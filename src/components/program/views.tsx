import type { ReactElement } from 'react'
import { getApp } from '../../lib/apps'
import type { AppId } from '../../types/desktop'
import { AppPlaceholder } from './AppPlaceholder'
import { AboutWindow } from './AboutWindow'
import { BlogDetailWindow } from './BlogDetailWindow'
import { BlogWindow } from './BlogWindow'
import { DstWikiWindow } from './DstWikiWindow'
import { DshWindow } from './DshWindow'
import { ProjectDetailWindow } from './ProjectDetailWindow'
import { ProjectsWindow } from './ProjectsWindow'
import { SettingsWindow } from './SettingsWindow'
import { TarotWindow } from './TarotWindow'
import { AlmanacWindow } from './AlmanacWindow'

import { TerminalWindow } from './TerminalWindow'
import { WriteWindow } from './WriteWindow'

/* 「窗口 id → 里面装什么」的唯一登记处。

   以前这张表在 `router.tsx` 里，靠路由的 <Outlet /> 塞进窗口；现在桌面能同时开好几个窗口，
   窗口内容就不能再挂在"当前路由"上了 —— 外壳按窗口列表挨个问这里要。

   ⚠️ 加新窗口时除了 `lib/apps.ts` 登记一行，还要在这里挂上（不挂就走 AppPlaceholder 占位）。
   ⚠️ 详情页（blog/:id、projects/:id）通过 `param` 传参，不再用 useParams ——
      因为一个窗口可以停在任何一页，而路由只表示"当前聚焦的那个窗口"。 */

type ViewFactory = (param?: string) => ReactElement

const VIEWS: Partial<Record<AppId, ViewFactory>> = {
  about: () => <AboutWindow />,
  blog: (param) => (param ? <BlogDetailWindow id={Number(param)} /> : <BlogWindow />),
  dsh: () => <DshWindow />,
  projects: (param) => (param ? <ProjectDetailWindow id={param} /> : <ProjectsWindow />),
  settings: () => <SettingsWindow />,
  tarot: () => <TarotWindow />,
  almanac: () => <AlmanacWindow />,

  terminal: () => <TerminalWindow />,
  wiki: () => <DstWikiWindow />,
  write: () => <WriteWindow />,
}

/** 某个窗口当前该渲染什么：有 param 就是那一页，没有就是应用的根 */
export function WindowView({ id, param }: { id: AppId; param?: string }) {
  const make = VIEWS[id]
  if (!make) return <AppPlaceholder id={id} route={param ? `${getApp(id).path}/${param}` : undefined} />
  return make(param)
}
