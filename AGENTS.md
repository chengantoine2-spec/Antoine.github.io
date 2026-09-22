# 项目：焦糖布丁博客站

## 定位

以博客为核心的公开个人站，展示日常与项目经历。
访客可读、可注册、注册后可评论；仅管理员可管理内容、用户与外观。
个人资产已实现为「物品台账」资产库；音乐等仍为 P1 占位，暂不实现。

## 技术栈

- Vite + React + TypeScript + Tailwind CSS
- 路由：react-router-dom
- Markdown 渲染：react-markdown + remark-gfm + rehype-highlight
- 部署：GitHub Pages（同仓库）
- 数据源：GitHub Issues（博客正文）+ 图片存仓库分支（jsDelivr 加速）
- 账号 / 评论 / 资产库：Supabase（Postgres + Auth + RLS），前端仍为纯静态
- 管理操作：GitHub REST API + Personal Access Token（仅本地管理时使用，不入库）



## 主色调：焦糖布丁

在 tailwind.config 扩展：

- caramel-50  #FFF8F0  页面背景
- caramel-100 #F7E6D0  卡片浅底
- caramel-200 #EFD3B0  边框/分隔
- caramel-300 #E0B98A  次级元素
- caramel-400 #D4A574  主色浅
- caramel-500 #C68A5B  主色（焦糖）
- caramel-600 #A96F44  主色深 / 链接
- caramel-700 #855434  标题
- caramel-800 #5C3A22  正文深
- caramel-900 #3D2B1F  主文字
  规则：默认亮色主题；暗色主题用 caramel-900 作底、caramel-100 作字。
  所有组件只用这套色板，禁止硬编码其他颜色。



## 信息架构

/            首页 —— 日常博客列表（卡片，带封面）
/blog/:id    博客详情 —— 正文 + TOC + 阅读进度 + 评论
/projects    项目经历 —— 独立页面集合
/assets      我的资产库（物品台账，登录用户）
/login       登录（用户名 + 密码）
/register    注册（用户名 + 密码，开放注册）
/admin       管理后台（仅管理员：用户与角色管理）
/me          个人中心（账号、发布凭据、外观）
/write       写博客（管理员 + PAT）

## 权限模型

- 访客（匿名）：读文章与评论，可注册
- 普通用户（user）：评论、管理自己的物品台账；不能改角色、不能动别人的数据
- 管理员（admin）：所有权限 —— 写作、上传图片、管理全部用户/评论/资产
- 权限强制点在数据库（Supabase RLS + 触发器），前端只做展示与引导
- 写作/传图仍走 GitHub PAT，仅存本机 localStorage，不提交仓库



## 数据模型

Blog（对应一个 GitHub Issue）

- id: number（Issue number）
- title: string
- body: string（Markdown）
- labels: string[]（含分类：daily | project，其余为标签）
- cover: string（jsDelivr 图片 URL）
- createdAt / updatedAt: string



Project（静态配置，非数据库）

- 位于 src/data/projects.ts，手写结构化数据
- 字段：id, name, role, period, stack[], summary, highlights[], cover, links[]



Comment（注册用户评论，Supabase 表 public.comments）

- id: uuid, blog_id: number（Issue number）, user_id: uuid（→ profiles）
- body: string, is_deleted: boolean, created_at / updated_at（见 supabase/schema.sql）

Like（本期不做，表结构已在 schema.sql 末尾留好）

- likes(blog_id, user_id) 主键去重

Profile / Role（Supabase 表 public.profiles）

- id: uuid（= auth.users.id）, username: string（唯一）, role: 'admin' | 'user', banned: boolean

Asset（物品台账，Supabase 表 public.assets）

- id, owner_id, name, category, quantity, unit, unit_value, currency,
  purchased_at, location, cover, notes, tags[]



## 文件边界

src/main.tsx
src/App.tsx
src/router.tsx
src/styles/globals.css
src/theme/colors.ts

src/data/projects.ts

src/lib/github.ts          // GitHub API 封装（Issues、上传图片）与 PAT 读写
src/lib/supabase.ts        // Supabase 客户端、用户名↔合成邮箱、类型与错误翻译
src/lib/markdown.ts        // react-markdown 配置
src/lib/text.ts            // 纯文本工具（日期 / 时长 / TOC 抽取）

supabase/schema.sql        // 建表 + RLS + 防提权触发器 + 统计函数

src/hooks/useBlogs.ts
src/hooks/useAuth.ts       // Supabase 会话（useAuth）+ PAT（usePat）

src/components/BlogCard.tsx
src/components/BlogList.tsx
src/components/BlogDetail.tsx
src/components/Toc.tsx
src/components/ReadingProgress.tsx
src/components/CodeBlock.tsx      // 高亮 + 复制按钮
src/components/ThemeToggle.tsx
src/components/Cover.tsx
src/components/TagFilter.tsx
src/components/CommentSection.tsx // 自建评论（替代 Giscus）
src/components/ImageUploader.tsx  // 编辑时插图

src/pages/Home.tsx
src/pages/Blog.tsx
src/pages/Projects.tsx
src/pages/ProjectDetail.tsx
src/pages/Login.tsx               // 登录
src/pages/Register.tsx            // 注册
src/pages/Assets.tsx              // 物品台账资产库
src/pages/Admin.tsx               // 管理后台（仅管理员）
src/pages/Me.tsx                  // 账号 / 发布凭据 / 外观
src/pages/Write.tsx               // 管理员 + PAT

## 展示八项（全量实现）

1. Markdown 渲染：标题、代码块、引用、表格
2. 图文混排：正文任意位置插图，图片自适应宽度
3. 封面图 + 卡片布局：列表页缩略图
4. 标签系统：多标签，点击筛选
5. 阅读进度条 + 目录 TOC
6. 代码高亮 + 复制按钮
7. 暗色/亮色主题切换
8. 项目经历结构化模板：技术栈卡片、时间线、成果指标



## 图片方案

- 上传到仓库 img/ 分支，按 yyyy/mm/{hash}.{ext} 存放
- 前端引用 https://cdn.jsdelivr.net/gh/{user}/{repo}@img/{path}
- 编辑器插图：ImageUploader 上传后插入 ![](cdnUrl)
- 禁止 base64 进正文



## 账号与评论（Supabase）配置要点

- 新建免费项目 → SQL Editor 执行 supabase/schema.sql（建表 + RLS + 触发器，可重复执行）
- Authentication → Sign In / Providers → Email：关闭 “Confirm email”（用户名映射成合成邮箱，收不到验证信）
- 前端只需 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY（anon key 公开无妨，权限靠 RLS）
- 首个管理员：用目标用户名注册后，执行
  `update public.profiles set role = 'admin' where username = '你的用户名';`
- service_role key 绝不能进前端或仓库；删除账号需到 Dashboard → Authentication

## 资产库（物品台账）

- 每个登录用户一个自己的库；管理员可切到「全部用户」查看与代管
- 字段：名称、分类、数量、单位、单价、币种、购入时间、存放位置、封面、备注、标签
- 封面图片复用 img 分支上传（需要 PAT），入口在 /me 保存 Token



## Projects 页面

- 每个项目一个独立路由 /projects/:id
- 展示：封面、角色、周期、技术栈卡片、亮点时间线、成果指标
- 数据全部来自 src/data/projects.ts，改代码即改内容



## Token 纪律

- 只输出被要求文件的完整代码；不解释、不总结、不加 markdown 围栏
- 修改已有文件只输出 diff 或完整替换指定文件，不重复其他文件
- 读取文件用 head/tail 截断；大输出加 | head -c 4000
- 每完成一个模块，输出 ≤5 行状态摘要
- 不确定的接口先写 TODO，不展开实现
- 不主动引入未列出的依赖
- 新组件先查文件边界是否已存在，避免重复创建



## 暂不做（防范围膨胀）

- 点赞（表结构已在 schema.sql 留好，下一期启用）
- 音乐播放、换背景、像素图头像（P1 占位）
- 富文本编辑器（用 Markdown）
- 第三方统计、SEO 高级优化
- 评论审核后台的独立页面（当前用管理员内联删除）
- 账号自删（需 service_role，走 Supabase Dashboard）



## 验收标准

1. 首页展示日常博客卡片，可点标签筛选
2. 详情页正文渲染 + TOC + 进度条 + 评论（点赞本期不做）
3. 代码块有高亮和复制按钮
4. 亮暗主题可切换，主色始终为焦糖布丁
5. /projects 及详情页展示结构化项目经历
6. /write 仅管理员可见（且需 PAT），能上传图片并发布 Issue
7. 任何人可用「用户名 + 密码」注册，注册后即可评论
8. 管理员可在 /admin 管理用户：改角色、封禁解封、查看统计
9. 普通用户可在 /assets 建自己的物品台账（属主隔离由 RLS 保证）
10. 部署在 GitHub Pages，同仓库
11. 反馈存在的不足以及需要补充的信息。



## 修订记录

- 2026-09-16 初版：静态站 + GitHub Issues + Giscus + PAT 站长写作。
- 2026-09-16 第二版（本次）：引入 Supabase 账号体系取代「仅 GitHub 身份」——
  开放注册（用户名 + 密码）、管理员/普通用户角色、管理后台、注册用户评论（Giscus 下线）、
  普通用户物品台账资产库；相应废止旧「暂不做」中的「后端/云数据库/账号系统」与「资产 CRUD」两条，
  并新增依赖 @supabase/supabase-js 与文件 src/lib/supabase.ts、src/components/CommentSection.tsx、
  src/pages/{Login,Register,Assets,Admin}.tsx、supabase/schema.sql。
