# 主题令牌 / 两套配色 / 字体 / 菜图 / 挂件（施工沿革）

> 从 `AGENTS.md` **搬出来**的长篇明细（2026-10-06：AGENTS.md 已超过工作区指令预算 64 KB，
> 尾部会被截断，下一个 agent 根本读不到）。**规则本身仍以 `AGENTS.md` 为准**，
> 这里放的是逐条沿革、实测数字与踩过的坑 —— 动手前读一遍能少踩雷。**信息一条没删。**

- **48 张菜图已经用起来了**（2026-10-05，用户："UI平面设计把图画好了，你来应用"）：
  - 画在 `design/veggies/*.svg`（设计负责人的），登记表在 **`lib/veggies.ts`**：
    `VEGGIES`（48 条：文件名 / 中文名 / 分组）、`veggieOfName()`、`dishRows()`、`otherVeggies()`
  - **对应关系只有一份**：`AppDef.veggie` 存中文菜名 → `veggieOfName()` 查图。
    `dishRows()` 直接按 `visibleApps()` 生成（顺序 = 任务栏顺序），别再手写第二份表
  - 用在哪：**「所有项目」菜单**（每行右侧：菜图 + 菜名）、**关于窗口的「这块地里的菜」**
    （11 张卡片，点一下就把那扇窗开到最上面）+ 折叠区里的另外 37 张（备着以后加窗口）
  - ⚠️ **图片不内联**：`vite.config.ts` 里 `build.assetsInlineLimit` 把 `/design/veggies/` 排除了 ——
    默认会把 48 张折成 data URI 塞进主包（实测首屏 gzip 101 → 111 KB），
    排除后只多 2.6 KB（= 48 个地址字符串），图按需加载
  - ⚠️ 菜图是**身份层**（哪个窗口是哪样菜），功能图标仍然在 `components/icons/` 里 —— 两套别混

- **桌面挂件：日月时钟**（右上角，`components/desktop/CelestialClock.tsx`）。天空条里的圆盘
  按正弦弧走（6:00 出、18:00 落；入夜换成同一条弧的月亮），**颜色随时刻变** ——
  组件只算「哪两档 + 前者的权重」，混色交给 CSS 的 `color-mix`，色值在
  `tokens.css` 的 `--c-celestial-{night,dawn,noon,dusk}`；入夜按**日期**显示月相
  （`lib/celestial.ts` 的 `moonPhase`：八相名 + 照亮百分比，形状用「外缘半圆 + 明暗界线椭圆弧」画）。
  ⚠️ 圆盘位置那两个百分比区间（17%~83% / 29%~71%）是照着「44px 圆盘 + 84px 天空条」留的边距，
  改尺寸要一起改，否则日出日落时圆盘会被天空条裁掉一块（`verify.mjs` 有一条专门量这个余量）。
  ⚠️ 挂件 z-5、窗口层 z-10、最大化 z-60：窗口盖住它是**预期**的，和真桌面挂件一样。
  ⚠️ **走时用「对齐整秒的自调度 `setTimeout`」，别改回 `setInterval`**：后台标签页节流、
  Edge 的"睡眠标签页"、电脑睡一觉回来，`setInterval` 会长时间不触发甚至停掉，
  表现就是"时间停在那一刻，点刷新才对"（用户报过一次）。另外挂了
  `visibilitychange` / `focus` / `pageshow` 三个兜底，任何一次唤醒都立刻重新对表。
  HH:MM 是大字、秒是小一号的次要色 —— 让"表在走"一眼可见

- **站名「芹菜耕地」+ 每个窗口一样菜**（2026-10-05 改名）：`SITE.name` 一处改，
  窗口标题栏 / 关于窗口 / 博客右栏都跟着变；每样菜写在 `AppDef.veggie`（`lib/apps.ts`），
  只出现在**任务栏的 title 与悬浮提示**、以及「所有项目」里。
  ⚠️ **菜名千万别塞进 `aria-label`**：`verify.mjs` 与 `verify-dst.mjs` 都按
  `button[aria-label="博客"]` 这类选择器点任务栏按钮，label 一旦变成"博客 · 玉米"，
  两个脚本立刻一起炸（改的时候踩过，当场回滚成"无障碍名 = 窗口名"）

## 彩色 App 图标（design/icons-app） · 2026-10-06 辨识度优化

- 12 枚自绘原创 SVG 进 Dock（`src/lib/appIcons.ts` 按**文件名**查表 → 文件名 / 键名不许改）。
  Dock 里实际渲染约 **28.8px**（按钮 40px × 72%），所以判据统一按 28px 看。
- **核心判据**：把颜色去掉（灰度）后每个图标的**剪影**要能分得出来 —— 颜色是最先丢的信息。
- 这一批做了三件事：① 色相在**真实相邻顺序**上拉开（`write` 由 `#A5B4FC` 改紫罗兰，
  原来与 `about` 的 `#8F9BFB` 几乎同色；`assets` 由 `#67E8F9` 改青绿 `#2DD4BF`，原来与 `skills` 同为青）；
  ② 底部色标统一压深一档提对比；③ 符号整体放大 **1.16×**。
- 同日第二轮（站主点名「图标可以加强」）只重画两枚：
  - **contact**：原来封口线是 `stroke="#fff"` 画在**白**信封上 → 等于隐形，28px 像一块白圆角方块；
    改成深色封口折角（`#9F1239`、宽 26、opacity .7），现在一眼是信封。
  - **tarot**：原来只有**一张**牌 + 暗色星，与 `blog`（白文稿 + 横线）在 28px 撞脸；
    改成**两张交叠斜置的牌 + 牌面四角星**（后牌 opacity .5 / rotate 11°，前牌 rotate −14°，星随前牌一起转）。
- ⚠️ **squircle 一律不加外围 stroke**（站主明确不要那圈半透明框）；逐枚检查结果：12 枚本来就没有。
  符号自身的白描边（信封口 / `>_` / 立方体棱）**保留**。
- 证据截图（`preview/` 已被 .gitignore 忽略，不进提交）：`icons-new.png` / `icons-new-gray.png`（全 12 枚四档）、
  `pair-28.png` / `pair-28-gray.png`（blog vs contact vs tarot 的 28px 专项对照）。

## 四套 macOS 味道的渐变壁纸（站主 2026-10-06）

`极光 aurora` / `晚霞 sunset` / `海雾 mist` / `紫夜 violet` —— **纯 CSS 多层渐变、零素材**（不碰 Apple 原版壁纸，版权红线）。

**加一套壁纸要三处一起改**（少一处就会出现"设置了没反应"）：
1. `src/styles/tokens.css`：**两套主题各补一个** `--wall-<id>`（浅色版 + 深色版，深色别死黑、浅色别糊成一片白）；
2. `src/styles/globals.css`：加一条 `.desktop__wall--<id> { background-image: var(--wall-<id>) }`（**必须在 `@layer` 之外**，见坑 1）；
3. `src/lib/theme.ts`：`WALLPAPERS` 清单加一行（`name` 是设置里按钮的可访问名，验证脚本按它点）。

⚠️ **类型上的临时口径**：`WallpaperId` 这个联合定义在 `src/types/desktop.ts`（登记表三件之一，本轮未授权改动），
所以 `lib/theme.ts` 用 `extraWallpaper()` 把新 id 断言成 `WallpaperId` —— **运行时完全等价**（壁纸就是拼 `desktop__wall--<id>` 类名）。
**等那张登记表解冻**要把这四个值并进联合并删掉 helper。

⚠️ **断言还欠一条**：本轮 `tools/verify.mjs` 上有**别的执行者的未提交改动**，按纪律没往上叠 ——
"四套能选中且背景两两不同"这条暂时只有一次性探针取证（`hitAll / gradientAll / distinct` 全 true，探针已删），
**待 verify.mjs 空出来后补成常驻断言**。

### 补记 2026-10-06：临时口径已收口
上面那条"类型临时口径"**已经完成**：`aurora` / `sunset` / `mist` / `violet` **已并入**
`src/types/desktop.ts` 的 `WallpaperId` 联合类型，`lib/theme.ts` 里的 `extraWallpaper()` helper
与 `ExtraWallpaperId` **已删** —— 现在壁纸清单靠联合类型这一条真源，`isWallpaperId` 也回归查清单。
⚠️ 以后再加壁纸，**先改联合类型**（那不再需要特别授权，它已经是常规入口）。
