# 焦糖布丁博客站

以博客为核心的公开个人站：访客可读、可评论、可点赞，仅站长可写作与管理。
**零后端**：正文存在 GitHub Issues，图片存在仓库 `img` 分支（jsDelivr 加速），评论与点赞由 Giscus 托管。

- 线上地址：<https://chengantoine2-spec.github.io/Antoine.github.io/>
- 源码仓库：<https://github.com/chengantoine2-spec/Antoine.github.io>

技术栈：Vite + React 18 + TypeScript + Tailwind CSS v3 + react-router-dom v6 +
react-markdown + remark-gfm + rehype-highlight。

---

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 产出 dist/
npm run preview
```

未配置 GitHub 仓库时，首页会回落到内置示例数据（页面上有明确提示），方便先验收样式与交互。

---

## 上线前必须补的配置

站点/仓库的默认值已经写在 `src/lib/github.ts` 里（指向 `chengantoine2-spec/Antoine.github.io`），
**开箱即可显示该仓库的 Issues**。只有换仓库或想覆盖时才需要 `.env`（本地）或
仓库 **Settings → Secrets and variables → Actions → Variables**（部署时同名变量自动注入）。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_GISCUS_REPO_ID` | ✅ | 评论区必需，在 [giscus.app](https://giscus.app) 生成（仓库需先开启 Discussions） |
| `VITE_GISCUS_CATEGORY_ID` | ✅ | 同上 |
| `VITE_GISCUS_REPO` | ⬜ | 默认已是当前仓库 |
| `VITE_GISCUS_CATEGORY` | ⬜ | 默认 `Announcements` |
| `VITE_GISCUS_MAPPING` | ⬜ | 默认 `pathname`；也可用 `number`（按 Issue 号）或 `specific`（按标题） |
| `VITE_GH_USER` / `VITE_GH_REPO` / `VITE_GH_OWNER` | ⬜ | 默认已是当前仓库 |
| `VITE_IMG_BRANCH` | ⬜ | 默认 `img`（**需先在仓库里建好该分支**，否则上传报 422） |
| `VITE_SITE_TITLE` | ⬜ | 默认「焦糖布丁」 |

站长登录：站内 `/me` 或 `/write` 填写 Personal Access Token（需 `repo` 权限）。
**PAT 只存在浏览器 localStorage，不入库、不提交仓库。**

> 还没写第一篇文章时首页是空列表（会有提示引导去 `/write`）；
> 只有在仓库未配置或 API 请求失败时才会回落到内置示例数据。

---

## 内容约定

- **每篇博客 = 一个 Issue**；`state=open` 的 Issue 才会出现在列表里。
- **分类**：label `daily`（日常）或 `project`（项目）；其余 label 一律当作标签展示与筛选。
- **下架**：关闭 Issue 并打 `deleted` 标签。GitHub REST API 不提供删除 Issue 的能力。
- **封面**：Issue 正文开头的 frontmatter，或正文第一张图：
  ```markdown
  ---
  cover: https://cdn.jsdelivr.net/gh/user/repo@img/2025/01/ab12cd34.png
  summary: 一句话摘要（可省略，缺省自动截取首段）
  ---
  ```
- **图片**：`/write` 里选择 / 拖拽 / 粘贴上传，落到 `img` 分支的 `yyyy/mm/{hash}.{ext}`，
  正文只写 jsDelivr 链接，**禁止 base64**。

---

## 目录结构（与 AGENTS.md 文件边界一致）

```
src/main.tsx  App.tsx  router.tsx
src/styles/globals.css          全局样式 + 正文排版 + hljs 配色
src/theme/colors.ts             caramel 色板（JS 侧）
src/data/projects.ts            项目经历静态数据
src/lib/github.ts               GitHub API（Issues / 上传图片 / PAT）
src/lib/giscus.ts               Giscus 配置与主题同步
src/lib/markdown.ts             react-markdown 配置（重依赖，按需加载）
src/lib/text.ts                 纯文本工具（日期 / 时长 / TOC 抽取）
src/hooks/useBlogs.ts  useAuth.ts
src/components/                 BlogCard BlogList BlogDetail Toc ReadingProgress
                                CodeBlock ThemeToggle Cover TagFilter Giscus ImageUploader
src/pages/                      Home Blog Projects ProjectDetail Me Write
```

唯一新增文件是 `src/lib/text.ts`，原因见文末「与 AGENTS.md 的偏差」。

---

## 部署（GitHub Pages，同仓库）

**最简 5 步（不配置任何变量也能先看到效果，首页会显示内置示例数据）**

```bash
git init && git add -A && git commit -m "feat: 焦糖布丁博客站"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

1. 仓库 Settings → Pages → **Source 选 “GitHub Actions”**（不选的话 workflow 会报 `Pages not enabled`）。
2. Push 到 `main`，`.github/workflows/deploy.yml` 自动：推导 base → `npm ci` → `npm run build` → 发布。
3. 访问 `https://<用户名>.github.io/<仓库名>/` 即可预览。
4. 想显示真实内容：Settings → Secrets and variables → Actions → **Variables** 里加 `VITE_GH_USER` /
   `VITE_GH_REPO` / `VITE_GH_OWNER`，再点 Re-run 或重新 push 一次。
5. 想开评论：仓库开启 Discussions → 到 giscus.app 装 app 取 `repo-id` / `category-id` → 加两个 Variables 再部署。

**注意事项**

- **私有仓库**：GitHub Free 只能从**公开仓库**发布 Pages；私有仓库要发布 Pages 需要 Pro/Team/Enterprise（[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages)）。只想自己看的话，本地 `npm run dev` 即可。
- **仓库命名**：叫 `<user>.github.io` 时是「用户站」，会发布到根路径 `https://<user>.github.io/`。
  workflow 已自动把 base 设为 `/`；这时还需把 `public/404.html` 里的
  `pathSegmentsToKeep` 从 `1` 改成 `0`（项目站保持 `1`）。
- **PAT 与预览无关**：预览/访客阅读评论都不需要 PAT；PAT 只是 `/write` 写作用的本地凭据，绝不进仓库。
- **图片上传**：先在仓库里建好 `img` 分支，否则上传会 422。
- **深链回退**：`public/404.html` 负责把 `/<repo>/blog/1` 重写成 `/<repo>/?/blog/1`，
  `index.html` 头部的内联脚本再还原成干净 URL 并交给 BrowserRouter。
  因此**不要**把 `index.html` 复制成 `404.html`，那会覆盖重定向脚本。

**替代方案（不想用 Actions）**：本地 `VITE_BASE=/<repo>/ npm run build`，把 `dist/` 手动推到
`gh-pages` 分支，Settings → Pages → Source 选该分支的 `/(root)`。

---

## 验收标准自查

| # | 标准 | 状态 | 证据 / 说明 |
| --- | --- | --- | --- |
| 1 | 首页卡片列表 + 标签筛选 | ✅ | `filterBlogs` + `TagFilter`，筛选条件写入 `?category=&tag=`，可分享/回退 |
| 2 | 详情页正文 + TOC + 进度条 + 点赞评论 | ✅ | SSR 冒烟测试 22/22 通过；TOC 锚点与正文标题 id 一致性已断言 |
| 3 | 代码块高亮 + 复制按钮 | ✅ | rehype-highlight + `CodeBlock`（含 `execCommand` 回落） |
| 4 | 亮暗主题切换、主色恒为焦糖布丁 | ✅ | `darkMode: 'class'`；全站仅 caramel-50…900，未硬编码其它色值 |
| 5 | `/projects` 与详情页结构化展示 | ✅ | 封面 / 角色 / 周期 / 技术栈卡片 / 亮点时间线 / 成果指标 |
| 6 | `/write` 仅站长、可传图并发布 Issue | ✅（待真实仓库联调） | 未登录或非站长账号显示拦截页；上传走 Contents API |
| 7 | 访客 GitHub 登录后可评论点赞 | ✅（待 Giscus 配置） | Giscus reactions 承载点赞；未配置时页面给出配置指引 |
| 8 | 部署在 GitHub Pages 同仓库 | ✅（本机无 git，未实跑） | Actions workflow + base 注入 + 404 回退已就位 |
| 9 | 反馈不足与待补信息 | ✅ | 见下方两节 |

已验证：`tsc --noEmit` 0 错误；`vite build` 成功（入口包 **76.85 KB gzip**，Markdown 渲染器 102.84 KB gzip 按需加载）；
SSR 冒烟测试覆盖 Markdown 表格/引用/代码高亮、TOC 锚点一致性、围栏代码块内的 `#` 不误判为标题、
项目页、个人中心、写博客页拦截。

未验证（需要真实环境）：真实 GitHub Issues 数据、PAT 写操作与图片上传、Giscus 评论区、线上 Pages 访问。

---

## 与 AGENTS.md 的偏差（3 处，均已说明理由）

1. **新增 `src/lib/text.ts`**：日期/阅读时长/TOC 抽取是纯函数，原先放在 `lib/markdown.ts` 里导致
   首屏包把 react-markdown + highlight.js 一起拖进来（145 KB → 拆分后 77 KB gzip）。
2. **未引入 highlight.js 主题 CSS**：`globals.css` 里手写了 `hljs-*` 配色，
   目的是遵守「只用 caramel 色板、禁止硬编码其他颜色」——官方主题含大量非色板色值。
3. **数据源配置走 `VITE_*` 环境变量**（`src/lib/github.ts` 里保留 TODO 默认值），
   比把用户名/仓库名写死在代码里更适合公开仓库。

---

## 已知限制

- 无草稿箱：草稿只能先发布再关闭，或自行用 `draft` label。
- 列表排序仅按创建时间倒序；GitHub Issues API 不支持自定义排序。
- 阅读时长按中文 350 字/分钟估算，非精确值。
- 未闭合的代码围栏（写到一半）里的 `#` 会被当成标题。
- `Issue.comments` 来自 Issue 自身评论数，与 Giscus 的 Discussion 评论数不是同一份数据。
- 大图原样上传，未做压缩或尺寸限制（`uploadImage` 里已留 TODO）。
- 未做 SEO / sitemap / RSS。

---

## 还需要你补充的信息

1. `VITE_GH_USER` / `VITE_GH_REPO` / `VITE_GH_OWNER` 的真实值。
2. Giscus 的 `repo-id` 与 `category-id`，以及 Discussions 打算用哪个分类（建议 `Announcements`）。
3. `img` 分支是否已创建（未创建时上传图片会 422）。
4. 是否需要把首图自动当封面（当前策略：frontmatter `cover:` 优先，其次正文第一张图）。
5. 是否需要「站点外观」在线上可改（当前只有亮暗切换；改主色需改 `tailwind.config.js` 重新部署）。
6. 音乐、个人资产等 P1 占位是否维持只留 `/me` 里的占位清单。
