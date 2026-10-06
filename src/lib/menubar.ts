/* macOS 顶部菜单栏的几何（2026-10-06「一切以 macOS 为准」P2）。
 *
 * 菜单栏是**常驻**的顶部 chrome：它不像任务栏那样能移动 / 隐藏，
 * 所以"窗口层要让位多少"必须把它算进去 —— macOS 里最大化窗口**不盖菜单栏**
 * （只有真·全屏才盖，那是 `useFullscreen` 那条路）。
 *
 * ⚠️ `MENUBAR_H` 必须与 `tokens.css` 里的 `--menubar-h` 一致（两套主题各一份）。
 * `verify.mjs` 有一条断言同时量**渲染高度**与**令牌值**，两个都对不上才会红 —— 别只改一边。
 */

/** 菜单栏高度（macOS 的 24pt @1x 观感；本站按 28px 落的字，见 MACOS-BRIEF 第 2 节） */
export const MENUBAR_H = 28

/** 菜单栏的宿主契约：`[data-menubar]` 是唯一的菜单栏根节点，验证脚本靠它找 */
export const MENUBAR_SELECTOR = '[data-menubar]'

/**
 * 工作区的上边界（视口坐标）= 菜单栏的下沿。
 *
 * 拖动吸附、平铺、最大化都用它当"最上面能到哪儿"：
 * - 拿**实测**高度而不是常量：令牌被改、或以后菜单栏高度自适应时，这里自动跟上；
 * - 找不到菜单栏（理论上不会，除非组件没挂）就回退 0，宁可按旧行为铺满，也不要卡住不放。
 */
export function workTop(): number {
  const el = document.querySelector(MENUBAR_SELECTOR)
  if (!el) return 0
  return Math.max(0, Math.round(el.getBoundingClientRect().height))
}
