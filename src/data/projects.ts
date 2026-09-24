export interface ProjectLink {
  label: string
  href: string
}

export interface Project {
  id: string
  name: string
  role: string
  period: string
  stack: string[]
  summary: string
  highlights: string[]
  /** 可选封面图 URL；没有就只显示文字卡片 */
  cover?: string
  links: ProjectLink[]
}

/** 项目经历：全部手写在这里，改内容不用碰组件。带「待填」的都是占位。 */
export const PROJECTS: Project[] = [
  {
    id: 'desktop-blog',
    name: '桌面式个人站',
    role: '设计 + 开发',
    period: '2026 — 现在',
    stack: ['Vite', 'React', 'TypeScript', 'Tailwind'],
    summary:
      '（待填）把个人站做成一个桌面：桌面背景 + 任务栏 + 窗口，博客只是其中一个窗口。所有设置存浏览器本地，没有后端。',
    highlights: [
      '（待填）任务栏可停靠到下/上/左/右，八条边（含倒角）都能拖拽改尺寸，厚度富余时自动折成 2~3 行',
      '（待填）三套主题 + 四种纯 CSS 纹理壁纸 + 图片壁纸，切换即时生效并持久化',
      '（待填）窗口有几何记忆：关闭再打开回到原处，换小屏时自动夹回可视区',
    ],
    links: [{ label: '仓库', href: 'https://github.com/chengantoine2-spec/Antoine.github.io' }],
  },
  {
    id: 'second',
    name: '（待填）第二个项目',
    role: '（待填）角色',
    period: '（待填）时间',
    stack: ['（待填）技术'],
    summary: '（待填）一句话说明它解决什么问题、结果如何。',
    highlights: ['（待填）值得写的一条'],
    links: [],
  },
]
