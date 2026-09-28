# 桌面式个人站（焦糖布丁）

把个人站做成一个**桌面**：桌面背景 + 任务栏 + 窗口，博客只是其中一个窗口。

纯静态前端（GitHub Pages），**没有后端**：设置存在浏览器 localStorage，文章与图片直接写进本仓库。

- 线上地址：<https://chengantoine2-spec.github.io/Antoine.github.io/>
- 源码仓库：<https://github.com/chengantoine2-spec/Antoine.github.io>

技术栈：Vite 5 + React 18 + TypeScript + Tailwind CSS 3 + react-router-dom 6 +
react-markdown + remark-gfm + rehype-highlight。

---

## 有哪些窗口

| 窗口 | 说明 |
|---|---|
| **博客** | 文章列表（分类 / 标签筛选）+ 详情，正文按 markdown 渲染；排版随窗口宽度自适应 |
| **博客创作** | 用本机 PAT 直接新建 / 编辑 / 下架 / 删除文章，上传图片到 `img` 分支，可浏览图库并插入正文 |
| **项目** | 项目卡片 + 详情（静态数据 `src/data/projects.ts`） |
| **关于** | 站点信息（静态数据 `src/data/site.ts`） |
| **设置** | 三套主题、四种纯 CSS 纹理壁纸 + 图片壁纸、任务栏位置与尺寸、任务栏显示哪些应用、图标大小 |
| 技能 / 联系 / 终端 / 资产库 | 占位，后续补 |

## 数据从哪来

- **文章 = GitHub Issues**：`daily` / `project` 标签当分类，其余标签当 tag；`state=open` 的才在博客里显示。
  站内创作走 GitHub API（新建 `POST /issues`、修改 `PATCH /issues/{n}`、下架 `state=closed`、删除走 GraphQL `deleteIssue`）。
- **图片 = 仓库 `img` 分支**：路径 `YYYY/MM/<随机>.png`，对外用 jsDelivr 加速；浏览图库不需要凭据。
- **设置 = 浏览器 localStorage**：主题、壁纸、任务栏、窗口几何、草稿等（键名见 `AGENTS.md`）。

> 写作凭据（PAT）只存在你自己浏览器的 localStorage 里，**不会进仓库、不会进代码**。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 类型检查 + 产出 dist/
npm run build:pages  # 追加生成 dist/404.html（GitHub Pages 深链兜底）
npm run verify       # 冒烟验证（需要 dev 已在跑）
```

## 部署

推到 `main` 触发 GitHub Actions 自动发布（`.github/workflows/deploy.yml`）。
构建时由 workflow 推导 `VITE_BASE`（本仓库是项目站，路径 `/Antoine.github.io/`），
路由 `basename` 取自 `import.meta.env.BASE_URL`，深链靠 `build:pages` 生成的 `404.html` 兜底。

> 首次在新仓库启用时：Settings → Pages，把 Source 设为 **GitHub Actions**。

## 目录

```
src/components/desktop/   桌面外壳：DesktopShell / Window / Dock / StartMenu / AppIcon
src/components/program/   窗口内容（新窗口一律放这里）
src/hooks/                useAppearance / useDock / useWindows / useBlogFeed / useWindowTitle
src/lib/                  apps（窗口登记表）/ dock / theme / windowManager / windowStore / github
src/styles/               tokens.css（三套主题变量）、globals.css
src/data/                 site.ts、projects.ts
tools/                    verify.mjs（冒烟验证）、pages-postbuild.mjs（404 兜底）
AGENTS.md                 开发约定：窗口契约、主题令牌硬规则、localStorage 键、踩过的坑
```

---

## 版权说明

- 代码部分：MIT License
- 博客文章、笔记、图片、个人内容：Copyright © 2026 chengantoine2-spec, All Rights Reserved.
- 未经许可，不得转载、复制或用于商业用途。
