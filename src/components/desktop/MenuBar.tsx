import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApp, matchWindowRoute, pathOf } from '../../lib/apps'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useFullscreen } from '../../hooks/useFullscreen'
import { useWindows } from '../../hooks/useWindows'
import { SITE } from '../../data/site'
import type { SnapZone } from '../../types/desktop'
import { MenuGlyph, PositionGlyph } from '../icons'
import { CelestialClock } from './CelestialClock'
import { DockPositionMenu } from './DockPositionMenu'
import { FullscreenButton } from './FullscreenButton'
import { StartMenu } from './StartMenu'

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
  /* 「所有项目」（≈ 启动台）—— 2026-10-06 站主：「最左边的全部应用图标也改到顶部栏里面去吧」。
     整块从 `Dock.tsx` 搬来：**同一颗按钮、同一个 `StartMenu`、同一个 `aria-label="所有项目"`**
     （两个验证脚本都按它找入口，名字不许改）。放在菜单栏**最左**（macOS 的启动台也在最左）。 */
  const [allOpen, setAllOpen] = useState(false)

  /* 启动台菜单的收起规则（照 Dock 原来那套）：按 Esc、点别处、或换了页面就收。
     ⚠️ `StartMenu` 是渲染在**菜单栏这个 div 内部**的，所以 `bar.contains(target)` 能同时覆盖
     "点在按钮上"和"点在下拉里"两种情况 —— 别把它挪到 `bar` 外面去。 */
  useEffect(() => {
    if (!allOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!bar.current?.contains(e.target as Node)) setAllOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAllOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [allOpen])

  /* 打开任何窗口（换页）就收起启动台 */
  useEffect(() => {
    setAllOpen(false)
  }, [pathname])

  /* ── 全屏里的菜单栏自动隐藏（macOS：鼠标碰顶部那条热区才浮现）──────────────────
     站主 2026-10-06：「想要"鼠标碰顶部就浮现菜单栏"那种细节」。
     **只在浏览器级全屏里生效**（macOS 也只在全屏时自动隐藏菜单栏）；非全屏时菜单栏常驻，
     下面这些分支一律不参与。
     收起要"晚一点点"：指针在「热区 ↔ 菜单栏」之间来回时，两个元素的 enter/leave 会在
     同一次移动里先后触发，立刻收会闪一下 —— 和 DSH 工具条同一套解法（那边也是 180ms）。 */
  const HIDE_MS = 180
  const { fullscreen } = useFullscreen()
  const [revealed, setRevealed] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])
  const wake = useCallback(() => {
    cancelHide()
    setRevealed(true)
  }, [cancelHide])
  const sleep = useCallback(() => {
    /* 菜单开着的时候不收：macOS 里下拉打开着，菜单栏一定在（也免得和"点别处才收"打架） */
    if (open || posOpen) return
    cancelHide()
    hideTimer.current = window.setTimeout(() => setRevealed(false), HIDE_MS)
  }, [cancelHide, open, posOpen])
  useEffect(() => cancelHide, [cancelHide])
  /* 进 / 出全屏都复位：进全屏从「收起」开始，退全屏自然回到常驻 */
  useEffect(() => {
    cancelHide()
    setRevealed(false)
  }, [fullscreen, cancelHide])
  /** 收起态 = 全屏里 + 还没被热区唤起来。CSS 只认这两个标记（`[data-fs='on'][data-hidden='true']`） */
  const menuHidden = fullscreen && !revealed

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
          setAllOpen(false)
        }}
      >
        {/* ⚠️ 2026-10-06：品牌（系统）菜单**不再用九宫格字形** —— 最左那颗字形按钮现在是「所有项目」，
            两颗一样的九宫格挨着会分不清。这里跟其它菜单一样走文字。`aria-label` 保持 `menus.brand.title`。 */}
        <span className="menubar__app">{menus[id].title}</span>
      </button>
      {open === id ? dropdown(id) : null}
    </div>
  )

  return (
    <>
      {/* 顶部唤出热区：**只在浏览器级全屏里出场**（平时菜单栏常驻那一条，不需要它）。
          z 比菜单栏低 1（见 globals.css），所以栏滑下来之后指针落在栏上，两边不打架。 */}
      {fullscreen ? <div className="menubar__hot" data-menubar-hot="" onPointerEnter={wake} /> : null}

      <div
        className="menubar"
        data-menubar=""
        /* 收起 = 滑上去（`[data-fs='on'][data-hidden='true']`），**不是 `display: none`** ——
           这样鼠标碰到顶部热区才滑得回来。两个标记同时成立才隐藏，非全屏永远常驻。 */
        data-fs={fullscreen ? 'on' : 'off'}
        data-hidden={menuHidden ? 'true' : 'false'}
        role="menubar"
        aria-label="菜单栏"
        ref={bar}
        onPointerEnter={wake}
        onPointerLeave={sleep}
        /* 键盘 Tab 进到菜单栏也保持显示；焦点跑到外面才收（同 DSH 工具条那条） */
        onFocusCapture={wake}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) sleep()
        }}
      >
      {/* ⚠️ 2026-10-06：**「所有项目」在最左**（`aria-label` 保持「所有项目」，两个验证脚本靠它找入口）。
          它是**菜单栏里唯一的字形按钮**：原来的系统菜单（品牌菜单）改成文字菜单，免得两颗九宫格挨着分不清。 */}
      <button
        type="button"
        className="menubar__btn"
        data-menubar-launcher=""
        title="所有项目"
        aria-label="所有项目"
        aria-haspopup="dialog"
        aria-expanded={allOpen}
        onClick={() => {
          setAllOpen((v) => !v)
          setOpen(null)
          setPosOpen(false)
        }}
      >
        <MenuGlyph className="h-3.5 w-3.5" />
      </button>
      <StartMenu
        open={allOpen}
        position={position}
        /* ⚠️ 从菜单栏弹，**不能**再按任务栏位置摆（那样面板会跑到视口外，实测点击超时）——
           贴着菜单栏左端往下挂。 */
        placementClass="top-full left-0 mt-1"
        onClose={() => setAllOpen(false)}
      />

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
        {/* 站主 2026-10-06：「从右上角日期进入」黄历 —— 整枚时钟就是按钮。
            ⚠️ 别给它套 `.menubar__btn`：那条规则会把里面的 svg 压成 14px（当初修菜单栏那个
            300×150 的 bug 时加的），时钟的日月圆盘会被压扁。所以只用 Tailwind 工具类 + 令牌底色。 */}
        <button
          type="button"
          aria-label="黄历"
          title="打开黄历"
          onClick={() => navigate(pathOf('almanac'))}
          className="flex items-center rounded px-2 py-0.5 hover:bg-[var(--c-control-hover)]"
        >
          <CelestialClock variant="compact" />
        </button>
      </div>
      </div>
    </>
  )
}
