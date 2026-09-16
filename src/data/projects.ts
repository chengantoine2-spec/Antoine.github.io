/**
 * 项目经历静态数据（改代码即改内容）。
 * 展示：封面、角色、周期、技术栈卡片、亮点时间线、成果指标。
 */

export interface ProjectMetric {
  label: string
  value: string
  /** 补充说明，例如口径、对比基线 */
  note?: string
}

export interface ProjectHighlight {
  /** 时间点或阶段，如 2024 Q2 */
  period: string
  title: string
  detail: string
}

export interface ProjectLink {
  label: string
  url: string
}

export interface Project {
  id: string
  name: string
  role: string
  period: string
  stack: string[]
  summary: string
  highlights: ProjectHighlight[]
  cover: string
  links: ProjectLink[]
  /** 成果指标 */
  metrics?: ProjectMetric[]
  /** 参与人数 / 规模等一句话背景 */
  scale?: string
}

export const projects: Project[] = [
  {
    id: 'caramel-blog',
    name: '焦糖布丁博客站',
    role: '独立开发（设计 + 前端 + 部署）',
    period: '2025.01 - 至今',
    stack: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'GitHub Issues', 'Giscus', 'GitHub Pages'],
    summary:
      '以 GitHub Issues 作为内容源、Discussions 作为评论区的静态博客站。零后端、零数据库，用 Issue 当 CMS，用仓库分支当图床。',
    cover: '',
    scale: '个人项目 · 纯静态部署',
    metrics: [
      { label: '首屏 JS', value: '≈ 77 KB', note: 'gzip 后入口包；Markdown 渲染器另按需加载' },
      { label: '后端成本', value: '0', note: '全部跑在 GitHub 免费额度内' },
      { label: '内容发布链路', value: '1 步', note: '开一个 Issue 即发布' },
    ],
    highlights: [
      {
        period: '2025.01',
        title: '确定零后端架构',
        detail:
          '用 GitHub Issues 承载正文与标签，图片存 img 分支走 jsDelivr 加速，评论点赞交给 Giscus，彻底去掉服务端。',
      },
      {
        period: '2025.01',
        title: '内容渲染链路',
        detail:
          'react-markdown + remark-gfm + rehype-highlight，支持表格、引用、任务列表与代码高亮，代码块带复制按钮；正文任意位置图文混排且图片自适应宽度。',
      },
      {
        period: '2025.02',
        title: '阅读体验',
        detail:
          '标题锚点与 TOC 双向联动（滚动高亮）、顶部阅读进度条、中文阅读时长估算，移动端目录折叠。',
      },
      {
        period: '2025.02',
        title: '站点外观与部署',
        detail:
          '一套 caramel 色板贯穿亮/暗两套主题，跟随系统与手动切换；GitHub Actions 自动构建发布到 Pages，SPA 深链用 404 回退。',
      },
    ],
    links: [
      { label: '源码仓库', url: 'https://github.com/YOUR_GITHUB_USER/caramel-blog' },
      { label: '线上站点', url: 'https://YOUR_GITHUB_USER.github.io/caramel-blog/' },
    ],
  },
  {
    id: 'issue-cms',
    name: 'Issue CMS 写作台',
    role: '设计与实现',
    period: '2025.02',
    stack: ['React', 'GitHub REST API', 'PAT 鉴权', 'Contents API'],
    summary:
      '博客站内的站长写作台：本地 Markdown 编辑 + 实时预览，图片上传到仓库分支并直接插入 jsDelivr 链接，一键创建或更新 Issue。',
    cover: '',
    scale: '站长专用 · 仅本地持有 PAT',
    metrics: [
      { label: '上传路径', value: 'yyyy/mm/hash.ext', note: '内容哈希命名，天然去重' },
      { label: '预览延迟', value: '即时', note: '同一套 markdown 组件渲染' },
    ],
    highlights: [
      {
        period: '阶段一',
        title: 'PAT 登录态',
        detail: 'token 存 localStorage 且不入库，登录即校验 /user 接口，非站长账号自动隐藏 /write 入口。',
      },
      {
        period: '阶段二',
        title: '插图闭环',
        detail:
          '支持选择文件、拖拽、粘贴剪贴板三种方式，上传后按光标位置插入 Markdown，正文禁止 base64。',
      },
      {
        period: '阶段三',
        title: '发布与改稿',
        detail: '同一表单既可新建 Issue 也可编辑已有 Issue；下架用关闭 + deleted 标签（GitHub 不提供删除 Issue 的 API）。',
      },
    ],
    links: [{ label: '使用说明', url: 'https://github.com/YOUR_GITHUB_USER/caramel-blog#readme' }],
  },
]

export const projectById = (id: string | undefined): Project | undefined =>
  projects.find((p) => p.id === id)

/** 全站技术栈去重汇总，用于项目页顶部 */
export function allStacks(): string[] {
  const set = new Set<string>()
  projects.forEach((p) => p.stack.forEach((s) => set.add(s)))
  return [...set].sort((a, b) => a.localeCompare(b))
}
