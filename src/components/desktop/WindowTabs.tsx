import { useState } from 'react'
import { getApp } from '../../lib/apps'
import { TAB_LEFT_WIDTH, TAB_TOP_HEIGHT } from '../../lib/tabs'
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
 *
 * ⚠️ **它是浮层 + 自动隐藏，不占任何布局空间**：
 * 早先的做法是让窗口层给它让出一条（顶部 36 / 左侧 190），结果窗口永远贴不到那条边上 ——
 * 实测「标签栏在顶部时窗口最上面只能到 y=36、在左侧时最左边只能到 x=190」，
 * 用户报的就是这个「窗口不能拖到最左边和最上面」。
 * 现在窗口层铺满（只躲任务栏），标签栏浮在上面、平时收起，鼠标蹭到那条边界才滑出来。
 *
 * - 一条标签 = 一个开着的窗口；点=抬到最上面并聚焦、× = 关掉
 * - 最小化的窗口标签淡一点，点一下就回来（窗口本身不销毁，滚动位置都在）
 * - 收起时容器 `pointer-events-none`、只有标签自己 `pointer-events-auto`：
 *   所以鼠标蹭到上边界能把它唤出来，而**窗口标题栏在被它盖住时依然能拖**
 */
export function WindowTabs({
  windows,
  activeId,
  position,
  titles,
  onSelect,
  onClose,
}: WindowTabsProps) {
  /* 鼠标是否在那条边界上（唤出标签栏）。默认收起 —— 和 DSH 工具条一个套路 */
  const [reveal, setReveal] = useState(false)

  if (position === 'off' || windows.length === 0) return null

  const vertical = position === 'left'
  const hidden = reveal ? '' : vertical ? '-translate-x-full' : '-translate-y-full'

  const hotZone = (
    <div
      data-tabs-hot=""
      aria-hidden="true"
      onPointerEnter={() => setReveal(true)}
      className={
        vertical
          ? 'absolute bottom-[var(--inset-bottom)] left-[var(--inset-left)] top-[var(--inset-top)] z-[65] w-3'
          : 'absolute left-[var(--inset-left)] right-[var(--inset-right)] top-[var(--inset-top)] z-[65] h-3'
      }
    >
      {/* 一条细拉手：告诉人"这儿有东西"。标签栏露出来时自己隐掉 */}
      <span
        className={`absolute bg-[var(--c-scroll-thumb)] transition-opacity duration-150 ${
          reveal ? 'opacity-0' : 'opacity-100'
        } ${vertical ? 'inset-y-8 left-1 w-[3px] rounded-full' : 'inset-x-8 top-1 h-[3px] rounded-full'}`}
      />
    </div>
  )

  return (
    <>
      {hotZone}
      <div
        role="tablist"
        aria-label="窗口标签栏"
        data-tabs={position}
        style={vertical ? { width: TAB_LEFT_WIDTH } : { height: TAB_TOP_HEIGHT }}
        onPointerEnter={() => setReveal(true)}
        onPointerLeave={() => setReveal(false)}
        className={`absolute z-[70] flex gap-1 overflow-auto rounded-dock border border-edge bg-chrome p-1.5 shadow-xl transition-transform duration-150 ease-out ${hidden} ${
          vertical
            ? 'bottom-[var(--inset-bottom)] left-[var(--inset-left)] top-[var(--inset-top)] flex-col'
            : 'left-[var(--inset-left)] right-[var(--inset-right)] top-[var(--inset-top)] items-center'
        }`}
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
              className={`group pointer-events-auto flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs ${
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
    </>
  )
}
