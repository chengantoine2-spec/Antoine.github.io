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

/** 项目经历：全部手写在这里，改内容不用碰组件 */
export const PROJECTS: Project[] = [
  {
    id: 'desktop-blog',
    name: '桌面式个人站',
    role: '设计 + 开发',
    period: '2026 — 现在',
    stack: ['Vite', 'React', 'TypeScript', 'Tailwind', 'GitHub Pages'],
    summary:
      '把个人站做成一个桌面：桌面背景 + 任务栏 + 窗口，博客只是其中一个窗口。纯静态前端、没有后端，设置存在浏览器本地，文章和图片直接写进 GitHub 仓库。',
    highlights: [
      '任务栏可停靠到下 / 上 / 左 / 右，八条边（含四个倒角）都能拖拽改尺寸，厚度富余时自动折成 2~3 行',
      '三套主题 + 四种纯 CSS 纹理壁纸 + 图片壁纸，切换即时生效并持久化；窗口有几何记忆，关掉再打开回到原处',
      '文章即 GitHub Issue：站内就能新建、编辑、下架、删除，图片传到 img 分支并走 jsDelivr 加速',
      '文章排版用容器查询跟随窗口宽度变化 —— 窄窗自动缩小字号，表格自己横向滚动而不撑破窗口',
    ],
    links: [{ label: '仓库', href: 'https://github.com/chengantoine2-spec/Antoine.github.io' }],
  },
]
