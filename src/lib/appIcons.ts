/* 应用图标的**彩色版**（2026-10-06 站主："图标能更生动，而不是黑白图"）。

   画在 `design/icons-app/*.svg`：**本站自绘、原创、无任何第三方素材**
   （Apple 的 App 图标是版权物，参考项目夹带的素材也不能拿 —— 见 `MACOS-BRIEF.md` 第 5 节）。
   规格：512 画布 / squircle 44..468 圆角 96 / 135° 双色渐变 / 白色符号 / 顶部一层淡内高光；
   12 个图标同外形同手法，只换色相与符号，所以排在任务栏里是齐的。
   对照页：`design/icons-app/preview.html`（浅/深两色 × 64/40/28/20px 各看一遍）。

   ⚠️ **不要内联**：`vite.config.ts` 的 `assetsInlineLimit` 把这批 SVG 排除在 data URI 之外
   （理由同菜图：12 个文件加起来才 23 KB，内联反而把主包撑大）。
   ⚠️ 颜色**写在这些 SVG 里**是允许的（它们是美术资源，等价于 `design/veggies/*.svg`）；
   但**组件里仍然不许写死颜色**。
   ⚠️ 旧的单色线形图标（`components/icons/**`）**没有删**：查不到彩色图时用它兜底，
   而且窗口标题行、菜单栏那几处字形仍归图标设计负责人那套。 */
import type { AppId } from '../types/desktop'

const FILES = import.meta.glob('../../design/icons-app/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** 应用 id → 彩色图标地址；没有这张图就返回 null（调用方回退到功能图标） */
export function appColorIcon(id: AppId): string | null {
  return FILES[`../../design/icons-app/${id}.svg`] ?? null
}

/** 有哪些 App 有彩色图标（验证脚本用得上；也是"这批图覆盖了几个应用"的答案） */
export const COLORED_APP_IDS: AppId[] = (
  Object.keys(FILES).map((k) => k.replace('../../design/icons-app/', '').replace('.svg', '')) as AppId[]
).sort()
