import { createContext, useContext, useEffect, type ReactNode } from 'react'

/**
 * 窗口内容用它把标题栏文字换成自己的（项目名、文章标题…）。
 * 不调用就用 apps.ts 里登记的名字。传 null 表示恢复成登记名。
 */
const WindowTitleContext = createContext<((title: string | null) => void) | null>(null)

export function WindowTitleProvider({
  setTitle,
  children,
}: {
  setTitle: (title: string | null) => void
  children: ReactNode
}) {
  return <WindowTitleContext.Provider value={setTitle}>{children}</WindowTitleContext.Provider>
}

export function useWindowTitle(title: string | null | undefined) {
  const setTitle = useContext(WindowTitleContext)
  useEffect(() => {
    if (!setTitle) return
    setTitle(title ?? null)
  }, [setTitle, title])
}
