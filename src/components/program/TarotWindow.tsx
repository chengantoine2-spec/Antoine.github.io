import { Suspense, lazy } from 'react'

/**
 * 「塔罗牌」窗口的**外壳**：立刻渲染，内容按需加载。
 *
 * 为什么要有这一层（和 `DstWikiWindow.tsx` 同一个理由）：
 * 78 张牌的牌义数据（`data/tarot/cards.json` 约 73 KB）+ 三个牌阵定义是**打开这个窗口才用得到**的。
 * 如果本组件静态 import 它们，这些重量会折进桌面首屏那个 chunk ——
 * 桌面是首屏，用户不点塔罗就不该为它付钱。
 *
 * 所以这里只 import react；真正的实现在 `TarotContent.tsx`，由 `lazy()` 拉。
 * **路由契约不变**：仍然从本文件导出 `TarotWindow`，`views.tsx` 一行都不用动。
 *
 * ⚠️ 别把数据或 `lib/tarot/*` 静态 import 进本文件 —— 一 import 就白拆了。
 * 改完看一眼构建产物的 chunk 大小（塔罗那份应该单独成一个 chunk）。
 */
const TarotContent = lazy(() => import('./TarotContent'))

export function TarotWindow() {
  return (
    <Suspense
      fallback={
        <div className="tarot">
          <p className="text-sm text-dim">正在洗牌…</p>
        </div>
      }
    >
      <TarotContent />
    </Suspense>
  )
}
