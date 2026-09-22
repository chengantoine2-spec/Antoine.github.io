# 焦糖布丁博客站

以博客为核心的公开个人站：访客可读，**任何人都能用「用户名 + 密码」注册**，
注册后可评论文章、维护自己的物品台账（资产库）；管理员拥有全部权限。

- 线上地址：<https://chengantoine2-spec.github.io/Antoine.github.io/>
- 源码仓库：<https://github.com/chengantoine2-spec/Antoine.github.io>

架构：**纯静态前端**（GitHub Pages）+ **GitHub Issues 当 CMS**（文章正文）+ **Supabase 当后端**
（账号、角色、评论、资产库，权限由 Postgres RLS 强制）。图片存仓库 `img` 分支，走 jsDelivr 加速。

技术栈：Vite + React 18 + TypeScript + Tailwind CSS v3 + react-router-dom v6 +
react-markdown + remark-gfm + rehype-highlight + @supabase/supabase-js。

---

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 产出 dist/
npm run preview
```

---

## 配置（两部分）

### 1. 文章与仓库（已有默认值，通常不用改）

默认值写在 `src/lib/github.ts`，已指向 `chengantoine2-spec/Antoine.github.io`。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_GH_USER` / `VITE_GH_REPO` / `VITE_GH_OWNER` | ⬜ | 默认已是当前仓库 |
| `VITE_IMG_BRANCH` | ⬜ | 默认 `img`（仓库里已建好；不存在则上传报 422） |
| `VITE_SITE_TITLE` | ⬜ | 默认「焦糖布丁」 |

### 2. 账号体系 Supabase（**必填**，否则只能读文章）

1. 到 <https://supabase.com> 新建免费项目（Region 选 Singapore / Tokyo 延迟低）。
2. **SQL Editor** 里整段执行 [`supabase/schema.sql`](supabase/schema.sql)
   （建 `profiles` / `comments` / `assets` 表 + RLS 策略 + 防提权触发器 + 统计函数，可重复执行）。
3. **Authentication → Sign In / Providers → Email：关闭 “Confirm email”**。
   本站用户名会映射成 `<用户名>@<VITE_AUTH_EMAIL_DOMAIN>` 合成邮箱，收不到验证信，必须关掉。
4. **Project Settings → API** 取 `Project URL` 与 `anon public key`，填到：
   - 本地：复制 `.env.example` 为 `.env`；
   - 线上：仓库 **Settings → Secrets and variables → Actions → Variables** 加同名变量。
5. **指定第一个管理员**：用你的用户名在站点注册，然后回到 SQL Editor 执行
   ```sql
   update public.profiles set role = 'admin' where username = '你的用户名';
   ```
   其他注册用户默认都是普通用户。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ✅ | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon public key。**它是设计上公开的**，权限靠 RLS；`service_role` key 绝不能进前端或仓库 |
| `VITE_AUTH_EMAIL_DOMAIN` | ⬜ | 合成邮箱域名，默认 `caramel.local`，不需要真实可收信 |

> 发布文章/上传图片仍需要一个有 `repo` 权限的 **GitHub Token（PAT）**，在 `/me` 保存，
> 只存浏览器 localStorage，不入库、不进仓库。

---

## 角色与权限

| 能力 | 访客 | 普通用户 | 管理员 |
| --- | --- | --- | --- |
| 读文章 / 看评论 | ✅ | ✅ | ✅ |
| 注册 / 登录 | ✅ | — | — |
| 发表、编辑、删除自己的评论 | ❌ | ✅ | ✅ |
| 物品台账（增删改查自己的资产） | ❌ | ✅ | ✅ |
| 查看/代管所有人的资产与评论 | ❌ | ❌ | ✅ |
| 管理用户（改角色、封禁） | ❌ | ❌ | ✅ |
| 写作 / 传图（需 PAT） | ❌ | ❌ | ✅ |

权限的强制点在数据库：`profiles` 有防提权触发器（非管理员改不动 `role`/`banned`），
`comments`/`assets` 的 RLS 策略按 `auth.uid()` 与 `is_admin()` 判定 —— 改前端代码拿不到别人的数据。

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
src/lib/github.ts               GitHub API（Issues / 上传图片 / PAT 读写）
src/lib/supabase.ts             Supabase 客户端、用户名↔合成邮箱、错误翻译
src/lib/markdown.ts             react-markdown 配置（重依赖，按需加载）
src/lib/text.ts                 纯文本工具（日期 / 时长 / TOC 抽取）
src/hooks/useBlogs.ts           Issue 列表 + 评论数合并 + 缓存
src/hooks/useAuth.ts            useAuth()（Supabase 会话）+ usePat()（发布凭据）
src/components/                 BlogCard BlogList BlogDetail Toc ReadingProgress CodeBlock
                                ThemeToggle Cover TagFilter CommentSection ImageUploader
src/pages/                      Home Blog Projects ProjectDetail Login Register Assets Admin Me Write
supabase/schema.sql             建表 + RLS + 触发器 + 统计函数（在 Supabase SQL Editor 执行）
```

---

## 部署（GitHub Pages，同仓库）

1. 仓库 Settings → Pages → **Source 选 “GitHub Actions”**。
2. Push 到 `main`，`.github/workflows/deploy.yml` 自动：推导 base → `npm ci` → `npm run build` → 发布。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。
4. 记得在 Variables 里加 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，否则线上没有账号功能。

**注意事项**

- **私有仓库**：GitHub Free 只能从公开仓库发布 Pages（[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages)）。
- **仓库命名**：叫 `<user>.github.io` 且用户名一致时才是「用户站」（根路径）。当前仓库名 `Antoine.github.io`
  与用户名 `chengantoine2-spec` 不一致，属于项目站，base 由 workflow 自动推导为 `/Antoine.github.io/`。
- **深链回退**：`public/404.html` 把 `/<repo>/blog/1` 重写成 `/<repo>/?/blog/1`，`index.html` 头部脚本再还原。
  因此**不要**把 `index.html` 复制成 `404.html`。

---

## 验收标准自查

| # | 标准 | 状态 |
| --- | --- | --- |
| 1 | 首页卡片列表 + 标签筛选 | ✅ 筛选条件写进 `?category=&tag=`，可分享/回退 |
| 2 | 详情页正文 + TOC + 进度条 + 评论 | ✅ 评论为自建；**点赞本期不做**（表结构已留） |
| 3 | 代码块高亮 + 复制按钮 | ✅ rehype-highlight + CodeBlock |
| 4 | 亮暗主题、主色恒为焦糖布丁 | ✅ 仅 caramel-50…900 |
| 5 | `/projects` 结构化项目经历 | ✅ 技术栈卡片 / 时间线 / 成果指标 |
| 6 | `/write` 仅管理员 + PAT，可传图发布 Issue | ✅ 未满足条件时给出明确的缺项清单 |
| 7 | 任何人可注册（用户名+密码）并评论 | ✅ 待 Supabase 配置完成后线上生效 |
| 8 | 管理员可管理用户（改角色/封禁/统计） | ✅ `/admin`，数据来自 RLS 保护的 RPC |
| 9 | 普通用户物品台账（属主隔离） | ✅ `/assets`，RLS 保证只能动自己的 |
| 10 | 部署在 GitHub Pages 同仓库 | ✅ Actions 自动构建发布 |
| 11 | 反馈不足与待补信息 | ✅ 见下方 |

已验证：`tsc --noEmit` 0 错误；`vite build` 成功；SSR 冒烟测试覆盖 Markdown 渲染、
TOC 锚点一致性、项目页、个人中心、写博客页拦截、时间格式。
**未验证**：Supabase 注册/登录/评论/资产/管理后台的真实链路（需要线上凭据后逐项实测）。

---

## 已知限制

- **点赞未实现**：`supabase/schema.sql` 末尾已留 `likes` 表与策略，启用时在 `CommentSection` 同级加组件即可。
- **删除账号**需要 `service_role`，客户端做不了：请到 Supabase Dashboard → Authentication → Users 删，
  profile / 评论 / 资产会因外键级联清理。
- **Supabase 免费项目 7 天低活动会被自动暂停**（[官方文档](https://supabase.com/docs/guides/platform/free-project-pausing)），
  期间评论/资产不可用（文章仍能读）；可手动 Resume，或加个每日定时任务保活。
- 账号是本站自建，与 GitHub 账号无关；访客评论不需要 GitHub，但写作仍需要 PAT。
- 无草稿箱；列表排序仅按创建时间倒序；阅读时长按中文 350 字/分钟估算。
- 大图原样上传未压缩；未做 SEO / RSS / 站内搜索。

---

## 与 AGENTS.md 的偏差（已在 AGENTS.md「修订记录」登记）

1. **引入 Supabase（后端即服务）**：原「暂不做：后端服务器、云数据库、账号系统」两条被本次需求废止，
   改为「纯静态前端 + Supabase」。这是架构级变更，密码校验与角色强制都在服务端完成。
2. **Giscus 下线**：`src/components/Giscus.tsx`、`src/lib/giscus.ts` 已删除，改为自建评论。
   访客评论不再需要 GitHub 账号。
3. **资产库上线**：原「资产 CRUD（P1 占位）」转为已实现（物品台账）。
4. **新增文件**：`src/lib/supabase.ts`、`src/components/CommentSection.tsx`、
   `src/pages/{Login,Register,Assets,Admin}.tsx`、`supabase/schema.sql`；
   **新增依赖**：`@supabase/supabase-js`。
5. **新增 `src/lib/text.ts`**：纯函数（日期/时长/TOC）与渲染器分离，首屏包从 145 KB 降到 ~78 KB gzip。
6. **未引入 highlight.js 官方主题 CSS**：`globals.css` 手写 `hljs-*` 配色以守住 caramel 色板。

---

## 还需要你补充的信息

1. Supabase 的 `Project URL` 与 `anon public key`（贴给我即可；`anon` 公开无妨，别无 `service_role`）。
2. 打算用哪个用户名注册成第一个管理员。
3. 「进一步优化内容」里你说的「其它」具体指什么（首页信息架构？归档/搜索？移动端导航？）。
