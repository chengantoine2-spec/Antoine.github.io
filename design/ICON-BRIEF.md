# 图标设计任务书 · 「芹菜耕地」桌面站全套图标

> 这份文档是**唯一**的任务描述。看完它 + `AGENTS.md`，你就能开工，不需要问前面发生过什么。
> 写文档的人是这个仓库的**主管**（负责桌面外壳 / 任务栏 / 窗口框架 / 主题令牌 / 路由 / 验证脚本）。
> 站主是中文用户，**所有回复用中文**；代码注释也一律中文。

---

## 1. 一句话任务

给「芹菜耕地」这套桌面模拟器**画一套全新的图标**，覆盖全部应用与桌面外壳的字形，
替换掉现有的自绘线稿 —— 交付能在项目里直接跑起来的那一份（React 组件），外加设计稿 SVG 与预览页。

## 2. 你是谁 · 你的地盘

| 你负责（可自由改） | 说明 |
|---|---|
| `src/components/icons/**` | **全部图标美术**：11 个应用图标 + 4 个外壳字形 |
| `design/**` | 设计稿：`design/icons/*.svg`、`design/preview.html`（都是你新建的） |

| 归主管，**不要动** | 为什么 |
|---|---|
| `src/components/desktop/AppIcon.tsx` | 外壳只做"查表"，已经接好线了；你换画它一行都不用改 |
| `src/types/desktop.ts`（`IconName`）、`src/lib/apps.ts` | 键名是路由 / 任务栏 / 验证脚本的抓手 |
| `src/components/desktop/**` 其余（`Dock` / `Window` / `StartMenu` / `FullscreenButton` / `DockPositionMenu`） | 它们已经改成 import 你的组件了 |
| `tools/verify.mjs`、`tools/verify-dst.mjs` | 验证脚本，**不许改测试去迁就实现** |
| `src/data/dst/**`、`src/components/program/DstWiki*.tsx`、`docs/**` | 饥荒 Wiki 窗口归另一个 agent |
| `public/logo.svg`、`public/logo.png` | **站标是焦糖布丁，站主明确要求不动**（它是这个站原来的记忆点） |
| `src/styles/tokens.css` | 主题色值，加色要跟主管说 |

## 3. 这个站是什么（画之前要知道的几件事）

- 它是一个**桌面模拟器**：壁纸 + 任务栏（左下那种 Dock）+ 一个个独立窗口。一个窗口 = 一个功能。
- **每个窗口分到一样菜**（站主的趣味设定）：站名就叫「芹菜耕地」。
  菜名只出现在**文字**里（任务栏 `title` / 悬浮提示 / 「所有项目」列表），
  **图标不必画菜** —— 菜是彩蛋，不是图标主题。唯一的例外：DSH 窗口现在画的是芹菜
  （因为 DSH 是"这块地"本身），你可以保留或提出更好的方案。
- 三套主题：`caramel`（焦糖，暖棕）/ `linen`（亚麻，浅米）/ `night`（夜，深灰蓝）。
  图标**不写死颜色**，一律 `currentColor`，外面套的类换颜色：
  - 任务栏图标：未选中 `text-chrome-ink`（深色任务栏上的奶油白），选中 `text-accent-ink`（强调色底上的字色）
  - 窗口标题栏 / 「所有项目」列表：`text-accent`
  - 所以：**同一张图必须同时在"深底浅线"和"浅底深线"下都清楚**，也要在 night 主题下亮得起来。
- 尺寸跨度大：标题栏与菜单 **16px**、默认 24px、任务栏可调到 **64px**。小尺寸要能认出来。

## 4. 交付物（三份**必须同源**，改一份就一起改）

1. **`src/components/icons/<名字>Icon.tsx`** —— 真正上线的那份：一个图标一个文件，
   React 函数组件（**这是唯一会被构建的东西**）。
2. **`design/icons/<kebab-name>.svg`** —— 独立 SVG 设计稿（同几何、`stroke="currentColor"`、`viewBox="0 0 24 24"`），
   放仓库里方便以后复用 / 在设计对话里直接展示。
3. **`design/preview.html`** —— 单文件静态预览页（**不参与 Vite 构建**，双击就能看）：
   一页铺开全部图标 × 尺寸 [16, 24, 32, 48, 64] × 三套主题底色，带名字与网格。
   三套主题的底色直接写死在预览页里就行（**只有预览页允许写死颜色**，见下表）。

| 主题 | 卡片底 surface | 次面 surface-2 | 描边 | 正文 text | 次要 dim | 强调 accent | 任务栏 chrome | 任务栏前景 |
|---|---|---|---|---|---|---|---|---|
| caramel | `#fff8f0` | `#f7e6d0` | `#efd3b0` | `#3d2b1f` | `#855434` | `#a96f44` | `rgba(61,43,31,.82)` | `#fff8f0` |
| linen | `#fbf7ee` | `#f1e8d8` | `#dccdb4` | `#3a3226` | `#7a6a52` | `#8a6a45` | `rgba(74,63,50,.78)` | `#fbf7ee` |
| night | `#22252b` | `#2a2e35` | `#3a3f48` | `#e8e6e1` | `#9aa1ac` | `#c68a5b` | `rgba(32,34,40,.86)` | `#e8e6e1` |

## 5. 文件契约（照抄，别自己发明）

`src/components/icons/base.ts` 已经定好了统一几何，**每个图标都从它开始**：

```tsx
import { iconBase, type IconProps } from './base'

/** 博客：一页带文字的纸 */
export function BlogIcon({ className }: IconProps) {
  return (
    <svg {...iconBase(className)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  )
}
```

- `iconBase(className)` 提供：`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、
  `strokeWidth={1.6}`、圆头圆角、`aria-hidden`。
  **要改这几个全局值（比如 1.6 → 1.5）请一次改 `base.ts`**，别在每个图标里覆盖 ——
  全套看起来才是一家人。字号感只有一条：线宽与图幅的比例要稳。
- 需要**实心**小面时，只在该元素上写 `fill="currentColor"`（例：`MenuGlyph` 的九宫格、
  `PositionGlyph` 的位置条）。整张图都实心的图标请先用线稿方案，真需要再跟主管说。
- 组件签名固定 `{ className }: IconProps`，`className` 带默认值，**不要**加别的 props
  （要加先问主管）。自绘图形**不要超过 24×24 的 3~21 范围**（留 1.5px 视觉边距）。
- 登记表 `src/components/icons/index.ts` 的 `ICON_SET` 把 `IconName` 映射到组件：

  ```ts
  export const ICON_SET: Record<IconName, ComponentType<IconProps>> = {
    about: AboutIcon, projects: ProjectsIcon, blog: BlogIcon, write: WriteIcon,
    skills: SkillsIcon, contact: ContactIcon, terminal: TerminalIcon, assets: AssetsIcon,
    settings: SettingsIcon, wiki: WikiIcon, dsh: DshIcon,
  }
  ```
  **这 11 个键一个都不能改名**（改了要动 `types/desktop.ts` / 路由 / 两个验证脚本）。
  新增图标位：**先跟主管说**，由他加 `IconName` 与登记表。

## 6. 硬约束（违反就上线不了）

1. **不许引入任何依赖**（图标库、SVG 优化器、构建插件都不行）。
   站主的规矩是"新增依赖必须先批准并登记"，这里的答案是：不需要。
2. **组件里不许出现写死颜色**：`#fff`、`rgb(…)`、`bg-white`、`stroke="#333"` 一律不行。
   唯一的颜色来源是 `currentColor`（+ 允许 `fill="currentColor"`）。
   写死 = 换主题时那个图标不变色，直接算不合格。
3. **不许改 `aria-label`**：验证脚本靠 `button[aria-label="博客"]` 这类选择器点任务栏，
   无障碍名一旦被动，`verify.mjs`（63 项）与 `verify-dst.mjs`（21 项）会一起炸。
   图标自己是 `aria-hidden`（`iconBase` 已经给了），**不要**在 SVG 里加 `<title>`。
4. **文本字符→矢量图标**也要保持可读：如果想把某处的 `–` / `×` 换掉，
   那些按钮的 `aria-label` 必须原样保留（`最小化` / `关闭`）。
5. 单元格尺寸靠 `className`（`h-4 w-4` / `h-6 w-6` / `h-1/2 w-1/2` …），
   所以 SVG 必须**跟着容器缩放**，别写死 `width`/`height` 属性。

## 7. 美术要求（判断标准，不是替你设计）

- **风格统一**：同一套线稿语言 —— 一致的线宽、一致的圆角倾向、一致的"填充 vs 留白"密度。
  11 个摆在一起要像一支队伍，不像 11 个人画的。
- **辨识度优先于细节**：16px 下要能分清"博客"和"博客创作"、"项目"和"资产库"。
  细节在 16px 会糊成灰点，宁可少画两笔。
- **视觉重量均衡**：每个图标的墨量大致相当（避免一个特别满、一个特别空），拖到任务栏一排看着才齐。
- **光学居中**：不是数学居中 —— 圆形的要略放大，尖角的要略收。整套走下来再统一微调一次。
- **要能看出"功能"**：图标是入口，不是插画。用户扫一眼任务栏得知道点哪个。
- **风格参考**：现在的画法是"细线 + 圆头 + 少量实心点"，气质是安静的桌面小工具（不卖萌、不 3D、不带渐变）。
  你可以提出新方向，但**请先在回复里给一两句方案说明再动手**，别直接推翻全部 11 个。

## 8. 现有图标清单（对照表：这些就是你要覆盖的全套）

| `IconName` | 窗口 | 菜 | 现在的画法 | 出现在哪 | 尺寸 |
|---|---|---|---|---|---|
| `about` | 关于 | 土豆 | 一个人像（圆头 + 肩线） | 任务栏 / 标题栏 / 所有项目 | 16 / 24 / 32~64 |
| `write` | 博客创作 | 番茄 | 一支笔 + 笔锋线 | 同上 | 同上 |
| `projects` | 项目 | 南瓜 | 文件夹（带标签页） | 同上 | 同上 |
| `blog` | 博客 | 玉米 | 一张纸 + 三行字 | 同上 | 同上 |
| `wiki` | 饥荒 Wiki | 洋葱 | 一本摊开的书 | 同上 | 同上 |
| `skills` | 技能 | 竹笋 | 五角星 | 同上 | 同上 |
| `contact` | 联系 | 葡萄 | 信封 | 同上 | 同上 |
| `terminal` | 终端 | 辣椒 | 屏幕 + 提示符 `>_` | 同上 | 同上 |
| `dsh` | DSH | 芹菜 | 三根茎 + 顶端两片叶（**唯一画了菜的**） | 同上（**只在本机出现**） | 同上 |
| `assets` | 资产库 | 花生 | 一个箱子/立方体 | 同上 | 同上 |
| `settings` | 设置 | 大蒜 | 圆 + 八根辐条（简写齿轮） | 同上 | 同上 |

> 技能 / 联系 / 资产库三个窗口目前是占位页（`AppPlaceholder`），但**图标要一起画**。

## 9. 外壳字形清单（同样归你）

| 组件 | 用在哪 | 尺寸 | 现在 |
|---|---|---|---|
| `glyphs/MenuGlyph.tsx` | 任务栏最左的「所有项目」 | 按钮的 1/2 | 3×3 实心点（`fill="currentColor"`） |
| `glyphs/FullscreenGlyph.tsx` | 任务栏右侧 ⛶ + 设置窗口 | 按钮的 1/2 | 12×12 网格、四角短线；`on` 时四角朝内 |
| `glyphs/MaximizeGlyph.tsx` | 窗口标题栏「最大化 / 还原」 | `h-3 w-3` | 12×12 网格；`maximized` 时两个叠起来的方块 |
| `glyphs/PositionGlyph.tsx` | 任务栏「位置」按钮 / 位置菜单 / 设置窗口 | 16~20px | 外框 + 停在对应边上的粗条（`position` 四态） |

⚠️ `FullscreenGlyph` / `MaximizeGlyph` 现在用的是 **12×12** 网格（线宽 1.2），
因为它们画在很小的按钮里 —— 你要统一到 24 网格可以，但**先把视觉重量对齐再换**，
并且注意验证脚本会数最大化按钮里的图形元素个数（`shapes === 2`），
还原态请保持"两个图形"（两个方块或一个方块 + 一条线都行，别变成三个）。

## 10. 明确不在范围内

- `public/logo.svg`（焦糖布丁站标）—— 不动。
- `CelestialClock` 的日月圆盘与月相 —— 那是**按时间算出来的图形**，不是图标，别碰。
- 编辑器 markdown 工具栏（`H2` / `B` / `I` / `S` / `` ` ` `` / `❝` / `•` / `1.` / `表` / `🔗`）：
  现在是文字按钮。想换矢量图标**先问主管**（会动到交互与无障碍名）。
- 窗口内的 `← 回到文章列表` 这类文字箭头：可以做，但属于二期，先问主管。
- 饥荒 Wiki 窗口内部的图形与色彩 —— 归另一个 agent。
- 任何依赖、构建配置、验证脚本。

## 11. 验收（你**必须**自己跑过再交）

先起开发服务器（后台跑着）：

```bash
npm run dev            # http://127.0.0.1:5173
```

然后：

```bash
npm run typecheck                                  # 类型
npm run build                                      # tsc --noEmit + vite build
npm run verify -- http://127.0.0.1:5173            # 全站冒烟：当前基线 63/63
npm run verify:dst -- http://127.0.0.1:5173        # 饥荒 Wiki：基线 21/21
```

- **基线只能保持或更好**：63/63 与 21/21。红了先看是不是自己改的，别去改测试。
- ⚠️ 地址要显式写成 `http://127.0.0.1:5173`（裸 `localhost` 在有些机器上解析到 `::1` 会连不上）。
- 自查写死颜色：`git diff --stat` 后搜一遍 `#`、`rgb(`、`fill="#`、`bg-white`。
- 肉眼验收：`design/preview.html` 看三套主题 × 五档尺寸；
  再在 `npm run dev` 的页面里把三套主题都切一遍（设置窗口 → 主题）。
- 改动后请顺手看一眼首屏 chunk 大小有没有明显变化（构建输出里看得到）：
  图标都是几个字节的 SVG，正常不会有波动。

## 12. 提交纪律（这个仓库**同时有多个 agent** 在改）

- **只 `git add <你自己改的路径>`，绝对不要 `git add -A`** —— 会把别人进行中的改动一起卷进来。
- 提交前先 `git status`：扫到别人的文件被改/被删，那不是你的活，**不要"顺手修"**，也不要提交。
- 提交信息写中文，说清"用户要什么 + 你怎么做的 + 验证结果"。
- **不要 push**：站主规定推送要等他明确指令（`main` 已开 push 部署，一推就上线）。

## 13. 建议的开工顺序

1. 先只做 `design/preview.html` + 3~4 个图标的 SVG 草稿（`about` / `blog` / `write` / `terminal`），
   给站主看方向 → 拿到"就是这个味道"再铺开全套（这一步能省掉一整轮返工）。
2. 方向定了：补齐 11 个应用图标 + 4 个字形，SVG 与 React 组件同步。
3. 全部换成新版 → 跑第 11 节四条命令 → 截图（三套主题各一张）再交给主管。

## 14. 什么时候来找主管

- 想新增 `IconName`（新窗口/新图标位）→ 找主管改 `types/desktop.ts` 与 `ICON_SET`。
- 想动 `AppIcon.tsx`、`Dock.tsx`、`Window.tsx` 等外壳文件 → 说明理由，由主管改。
- 想改 `base.ts` 的全局几何（线宽/网格）→ 可以，但要在回复里说明影响面（全套一起改）。
- 想动站标、想加依赖、想改验证脚本 → 基本会被拒，除非站主点头。
