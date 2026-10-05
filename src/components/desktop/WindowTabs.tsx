import { getApp } from '../../lib/apps'
import type { AppId, TabPosition, WindowState } from '../../types/desktop'
import { AppIcon } from './AppIcon'

interface WindowTabsProps {
  /** 开着的窗口，顺序 = 打开顺序（标签栏顺序，和浏览器一样稳定） */
  windows: WindowState[]
  /** 当前聚焦的那个（高亮） */
  activeId?: AppId
  position: TabPosition
  /** 窗口标题（详情页会换成文章名 / 项目名），拿不到就退回应用名 */
  titles: Partial<Record<AppId, string>>
  onSelect: (id: AppId) => void
  onClose: (id: AppId) => void
}

/**
 * 窗口标签栏（像浏览器的标签页）：顶部一条 / 左侧一条 / 不显示。
 *
 * 用户 2026-10-05：「窗口要可以叠加，可以同时打开多个窗口，显示方式像浏览器一样」。
 * - 一条标签 = 一个开着的窗口；点它 = 抬到最上面并聚焦、× = 关掉
 * - 最小化的窗口标签会淡一点，点一下就回来（不销毁窗口，内容与滚动位置都还在）
 * - 它自己占掉的那一条写进 CSS 变量 `--tabs-top` / `--tabs-left`，
 *   窗口层与「最大化」都按这个变量让位（见 globals.css 的 .desktop__layer / .window--max）
 */
export function WindowTabs({
  windows,
  activeId,
  position,
  titles,
  onSelect,
  onClose,
}: WindowTabsProps) {
  if (position === 'off' || windows.length === 0) return null

  const vertical = position === 'left'

  return (
    <div
      role="tablist"
      aria-label="窗口标签栏"
      data-tabs={position}
      className={
        vertical
          ? 'absolute bottom-[var(--inset-bottom)] left-[var(--inset-left)] top-[var(--inset-top)] z-[70] flex w-[190px] flex-col gap-1 overflow-y-auto rounded-dock border border-edge bg-chrome p-1.5 shadow-xl'
          : 'absolute left-[var(--inset-left)] right-[var(--inset-right)] top-[var(--inset-top)] z-[70] flex h-9 items-center gap-1 overflow-x-auto rounded-dock border border-edge bg-chrome px-1.5 shadow-xl'
      }
      /* 面板本身别抢窗口的拖动：只有标签按钮可点 */
      onPointerDown={(e) => e.stopPropagation()}
    >
      {windows.map((win) => {
        const app = getApp(win.id)
        const label = titles[win.id] ?? app.name
        const active = win.id === activeId && !win.minimized
        return (
          <span
            key={win.id}
            data-tab={win.id}
            data-active={active ? 'true' : 'false'}
            data-minimized={win.minimized ? 'true' : 'false'}
            className={`group flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs ${
              active
                ? 'border-edge bg-surface text-ink'
                : 'border-transparent text-chrome-ink hover:bg-hover'
            } ${win.minimized ? 'opacity-55' : ''} ${vertical ? 'w-full' : 'max-w-[13rem]'}`}
          >
            <button
              type="button"
              onClick={() => onSelect(win.id)}
              title={`${app.name} · ${label}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <AppIcon name={app.icon} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
            <button
              type="button"
              onClick={() => onClose(win.id)}
              aria-label={`关闭 ${app.name} 标签`}
              title="关闭这个窗口"
              className="grid h-4 w-4 shrink-0 place-items-center rounded text-[11px] text-chrome-ink opacity-60 hover:bg-hover hover:opacity-100"
            >
              &#215;
            </button>
          </span>
        )
      })}
    </div>
  )
}
