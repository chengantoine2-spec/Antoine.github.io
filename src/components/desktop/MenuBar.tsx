import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, matchWindowRoute, pathOf } from '../../lib/apps'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import { SITE } from '../../data/site'
import type { SnapZone } from '../../types/desktop'
import { MenuGlyph, PositionGlyph } from '../icons'
import { CelestialClock } from './CelestialClock'
import { DockPositionMenu } from './DockPositionMenu'
import { FullscreenButton } from './FullscreenButton'

/**
 * macOS 顶部菜单栏（2026-10-06「一切以 macOS 为准」P2）。
 *
 * 结构照 macOS 那一套：
 * - **左**：系统菜单（≈ 苹果标，本站用九宫格字形）→ 当前聚焦窗口的**应用名（粗体）** → 应用菜单；
 * - **右**：状态区 —— 全屏 ⛶、任务栏位置、以及**并进来的日月时钟**（原来是浮在桌面右上角的挂件）。
 *
 * 两条硬约束：
 * 1. **菜单项必须有真实动作**（项目红线：不许摆点了没反应的按钮）。所以这里只有四个菜单，
 *    每个动作都落到窗口 / 主题 / 路由上；宁可少一个「编辑」菜单，也不放空壳。
 * 2. **高度 `.menubar` = `--menubar-h`**，而且窗口层已经把这条让出来了
 *    （`dockInsets(position, thickness, MENUBAR_H)` + `lib/menubar.ts`）——
 *    所以最大化 / 铺满都**不会盖住菜单栏**，这是 macOS 的行为（只有浏览器级全屏才盖，
 *    `:fullscreen .menubar { display: none }` 把这条也照 macOS 收起来了）。
 */
interface MenuBarProps {
  /** 平铺 / 吸附：几何在 DesktopShell（窗口层的 ref 在那边），这里只报"往哪儿铺" */
  onTile: (zone: SnapZone) => void
}

type MenuId = 'brand' | 'file' | 'view' | 'window' | 'help'

/** 一个菜单项：动作 + 可选的"当前项"打勾与右侧提示 */
interface Item {
  label: string
  hint?: string
  checked?: boolean
  run: () => void
}

export function MenuBar({ onTile }: MenuBarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { windows, dispatch } = useWindows()
  const { theme, setTheme } = useAppearance()
  const { position, setPosition } = useDock()

  const bar = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState<MenuId | null>(null)
  const [posOpen, setPosOpen] = useState(false)

  const routeId = matchWindowRoute(pathname)?.app.id
  /* 聚焦的框 = 活动标签就是当前路由那个应用。没有就回落到站点名（macOS 里 Finder 也总有名字） */
  const focused = windows.find((w) => !w.minimized && w.tabs[w.active]?.id === routeId)
  const focusedKey = focused?.key
  const appName = routeId ? getApp(routeId).name : SITE.name

  const close = useCallback(() => {
    setOpen(null)
    setPosOpen(false)
  }, [])

  /* 点别处 / Esc 收起（和任务栏那两个菜单同一套做法）。
     ⚠️ 别用"全屏透明遮罩"：`.menubar` 带 `backdrop-filter`，会给 fixed 后代当包含块，
     遮罩会被压成 28px 高的一条 —— 踩过这个坑，所以走 document 监听。 */
  useEffect(() => {
    if (!open && !posOpen) return
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, posOpen, close])

  const run = (fn: () => void) => () => {
    fn()
    setOpen(null)
  }

  const menus: Record<MenuId, { title: string; items: Array<Item | 'sep'> }> = {
    brand: {
      title: '本站菜单',
      items: [
        { label: '关于本站', run: run(() => navigate('/about')) },
        { label: '打开设置', run: run(() => navigate('/settings')) },
        'sep',
        { label: '全部最小化', run: run(() => windows.forEach((w) => dispatch({ type: 'minimize', key: w.key }))) },
        { label: '关闭全部窗口', run: run(() => dispatch({ type: 'closeAll' })) },
      ],
    },
    file: {
      title: '文件',
      items: [
        {
          label: '关闭当前窗口',
          hint: '⌘W',
          run: run(() => focusedKey && dispatch({ type: 'closeFrame', key: focusedKey })),
        },
        { label: '关闭全部窗口', run: run(() => dispatch({ type: 'closeAll' })) },
        'sep',
        { label: '返回桌面', run: run(() => navigate('/')) },
      ],
    },
    view: {
      title: '显示',
      items: [
        { label: '平铺：左半', run: run(() => onTile('left')) },
        { label: '平铺：右半', run: run(() => onTile('right')) },
        { label: '铺满工作区', hint: '⌃⌘F', run: run(() => onTile('top')) },
        'sep',
        {
          label: focused?.maximized ? '还原窗口' : '最大化窗口',
          run: run(() => focusedKey && dispatch({ type: 'toggle-maximize', key: focusedKey })),
        },
        'sep',
        { label: '浅色外观', checked: theme === 'light', run: run(() => setTheme('light')) },
        { label: '深色外观', checked: theme === 'dark', run: run(() => setTheme('dark')) },
      ],
    },
    window: {
      title: '窗口',
      items: [
        {
          label: '最小化当前窗口',
          hint: '⌘M',
          run: run(() => focusedKey && dispatch({ type: 'minimize', key: focusedKey })),
        },
        { label: '全部最小化', run: run(() => windows.forEach((w) => dispatch({ type: 'minimize', key: w.key }))) },
        ...(windows.length ? (['sep'] as const) : []),
        ...windows.map((w) => {
          const tab = w.tabs[w.active]
          const name = getApp(tab.id).name
          const suffix = w.tabs.length > 1 ? ` +${w.tabs.length - 1}` : ''
          return {
            label: `${name}${suffix}${w.minimized ? '（已最小化）' : ''}`,
            checked: w.key === focusedKey,
            run: run(() => navigate(pathOf(tab.id, tab.param))),
          }
        }),
      ],
    },
    help: {
      title: '帮助',
      items: [
        { label: '关于本站', run: run(() => navigate('/about')) },
        { label: '饥荒 Wiki 教程', run: run(() => navigate('/wiki')) },
        'sep',
        { label: '打开设置', run: run(() => navigate('/settings')) },
      ],
    },
  }

  const dropdown = (id: MenuId, alignRight = false) => (
    <div
      role="menu"
      aria-label={menus[id].title}
      className={`menubar__dropdown${alignRight ? ' menubar__dropdown--right' : ''}`}
    >
      {menus[id].items.map((item, i) =>
        item === 'sep' ? (
          <div key={`sep${i}`} className="menubar__sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            aria-checked={item.checked}
            onClick={item.run}
            className="menubar__item"
          >
            <span>{item.label}</span>
            {item.hint ? <span className="menubar__hint">{item.hint}</span> : null}
          </button>
        ),
      )}
    </div>
  )

  const menuButton = (id: MenuId) => (
    <div key={id} className="menubar__wrap">
      <button
        type="button"
        className="menubar__btn"
        data-open={open === id}
        aria-haspopup="menu"
        aria-expanded={open === id}
        aria-label={id === 'brand' ? menus.brand.title : menus[id].title}
        onClick={() => {
          setOpen((cur) => (cur === id ? null : id))
          setPosOpen(false)
        }}
      >
        {id === 'brand' ? (
          <MenuGlyph className="h-3.5 w-3.5" />
        ) : (
          <span className="menubar__app">{menus[id].title}</span>
        )}
      </button>
      {open === id ? dropdown(id) : null}
    </div>
  )

  return (
    <div className="menubar" data-menubar="" role="menubar" aria-label="菜单栏" ref={bar}>
      {menuButton('brand')}

      {/* 聚焦窗口的应用名：macOS 里这一段是加粗的，且随聚焦窗口实时变 */}
      <span className="menubar__app px-2" data-menubar-app="">
        {appName}
      </span>

      {menuButton('file')}
      {menuButton('view')}
      {menuButton('window')}
      {menuButton('help')}

      <div className="menubar__right">
        {/* 全屏 ⛶ 与「任务栏位置」：2026-10-06 从任务栏挪进来（macOS 的 Dock 两端只有启动台与废纸篓）。
            两者的 aria-label 保持不变 —— verify.mjs 按它们找入口，挪位置但别改名。 */}
        <FullscreenButton variant="icon" className="menubar__btn" />

        <div className="menubar__wrap">
          <button
            type="button"
            className="menubar__btn"
            data-open={posOpen}
            title="任务栏位置"
            aria-label="任务栏位置"
            aria-haspopup="menu"
            aria-expanded={posOpen}
            onClick={() => {
              setPosOpen((v) => !v)
              setOpen(null)
            }}
          >
            <PositionGlyph position={position} className="h-3.5 w-3.5" />
          </button>
          <DockPositionMenu
            open={posOpen}
            position={position}
            placementClass="top-full right-0 mt-1"
            onPick={(next) => {
              setPosition(next)
              setPosOpen(false)
            }}
          />
        </div>

        {/* 日月时钟并进菜单栏（同一个组件，紧凑形态；元素与类名一个都不少） */}
        <CelestialClock variant="compact" />
      </div>
    </div>
  )
}
