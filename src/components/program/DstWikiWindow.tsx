import { Suspense, lazy } from 'react'

/**
 * 「饥荒 Wiki」窗口的**外壳**：立刻渲染，内容按需加载。
 *
 * 为什么要有这一层：
 * 条目数据（100+ 条）、搜索模块与拼音库加起来是几百 KB，而它们只在**打开这个窗口时**
 * 才用得到。如果 `router.tsx` 静态 import 本组件、本组件再静态 import 数据，
 * 这些重量都会折进桌面首屏那个 chunk（实测让首屏多背约 25 KB gzip + 拼音库 100 KB）。
 *
 * 所以这里只 import react；真正的实现在 `DstWikiContent.tsx`，由 `lazy()` 拉。
 * **路由契约不变**：仍然从本文件导出 `DstWikiWindow`，`router.tsx` 一行都不用动。
 *
 * ⚠️ 归属：`DstWikiWindow.tsx` 与 `DstWikiContent.tsx` 都归 wiki 窗口负责人维护
 * （连同 `src/data/dst/`、`src/lib/dst/`）。窗口外壳、任务栏、主题、路由仍归主管。
 */
const DstWikiContent = lazy(() => import('./DstWikiContent'))

export function DstWikiWindow() {
  return (
    <Suspense
      fallback={
        <div className="wiki">
          <p className="text-sm text-dim">正在整理条目…</p>
        </div>
      }
    >
      <DstWikiContent />
    </Suspense>
  )
}