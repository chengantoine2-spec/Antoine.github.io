import { APPS } from '../../lib/apps'
import { DOCK_ORDER } from '../../lib/dock'
import {
  DEFAULT_THEME,
  DEFAULT_WALLPAPER,
  DEFAULT_WALLPAPER_DIM,
  DEFAULT_WALLPAPER_FIT,
  DIM_LEVELS,
  ICON_SIZES,
  THEMES,
  WALLPAPERS,
  WALLPAPER_FITS,
} from '../../lib/theme'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import { useWindows } from '../../hooks/useWindows'
import type { DockPosition } from '../../types/desktop'
import { PositionGlyph } from '../desktop/DockPositionMenu'

const POSITION_LABEL: Record<DockPosition, string> = {
  bottom: '底部',
  top: '顶部',
  left: '左侧',
  right: '右侧',
}

const SHORTCUTS: Array<[string, string]> = [
  ['点任务栏九宫格', '展开「所有项目」，列出全部窗口'],
  ['拖任务栏任意边缘或倒角', '改厚度 / 长度；双击该边缘回到自适应'],
  ['按住任务栏空白处拖动', '横滑查看放不下的按钮（竖排时竖滑），滚轮同样可用'],
  ['点任务栏位置按钮', '展开下 / 上 / 左 / 右四个位置；点开后保持展开'],
  ['Esc 或点别处', '收起已展开的面板'],
  ['拖窗口标题栏', '移动窗口；双击标题栏最大化 / 还原'],
  ['拖窗口右下角', '缩放窗口'],
  ['窗口的 — / □ / ×', '最小化 / 最大化 / 关闭；最小化后点任务栏按钮唤回'],
]

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-dim">{title}</h3>
      {children}
      {hint ? <p className="text-xs text-dim">{hint}</p> : null}
    </section>
  )
}

function OptionButton({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-3 text-left transition-colors ${
        active ? 'border-accent bg-surface-2' : 'border-edge hover:bg-hover'
      }`}
    >
      <span className="block text-sm font-medium text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-dim">{hint}</span>
    </button>
  )
}

/** 设置窗口：主题 / 桌面背景 / 任务栏 / 重置 / 操作说明。全部写 localStorage，刷新后保持 */
export function SettingsWindow() {
  const {
    theme,
    wallpaper,
    wallpaperFit,
    wallpaperDim,
    setTheme,
    setWallpaper,
    setWallpaperFit,
    setWallpaperDim,
    resetAppearance,
  } = useAppearance()
  const {
    position,
    length,
    thickness,
    iconSize,
    dockApps,
    setPosition,
    setLength,
    setThickness,
    setIconSize,
    toggleDockApp,
    resetDock,
  } = useDock()
  const { clearWindowMemory } = useWindows()

  const atDefault =
    theme === DEFAULT_THEME &&
    wallpaper === DEFAULT_WALLPAPER &&
    wallpaperFit === DEFAULT_WALLPAPER_FIT &&
    wallpaperDim === DEFAULT_WALLPAPER_DIM &&
    position === 'bottom' &&
    length === null &&
    thickness === null &&
    iconSize === null &&
    dockApps.length === APPS.length

  function resetAll() {
    resetAppearance()
    resetDock()
  }

  return (
    <div className="space-y-5">
      <Section title="主题">
        <div className="grid gap-2 sm:grid-cols-3">
          {THEMES.map((item) => (
            <OptionButton
              key={item.id}
              active={theme === item.id}
              title={item.name}
              hint={item.hint}
              onClick={() => setTheme(item.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="桌面背景">
        <div className="grid gap-2 sm:grid-cols-3">
          {WALLPAPERS.map((item) => (
            <OptionButton
              key={item.id}
              active={wallpaper === item.id}
              title={item.name}
              hint={item.hint}
              onClick={() => setWallpaper(item.id)}
            />
          ))}
        </div>
      </Section>

      {wallpaper === 'image' ? (
        <Section title="图片填充方式">
          <div className="grid gap-2 sm:grid-cols-3">
            {WALLPAPER_FITS.map((item) => (
              <OptionButton
                key={item.id}
                active={wallpaperFit === item.id}
                title={item.name}
                hint={item.hint}
                onClick={() => setWallpaperFit(item.id)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="背景暗化" hint="浅色壁纸下让图标和窗口边缘更清楚">
        <div className="flex flex-wrap gap-2">
          {DIM_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={wallpaperDim === level}
              onClick={() => setWallpaperDim(level)}
              className={`rounded border px-3 py-1.5 text-xs ${
                wallpaperDim === level
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-edge text-ink hover:bg-hover'
              }`}
            >
              {level === 0 ? '关闭' : `${Math.round(level * 100)}%`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="任务栏位置">
        <div className="flex flex-wrap items-center gap-2">
          {DOCK_ORDER.map((item) => (
            <button
              key={item}
              type="button"
              title={POSITION_LABEL[item]}
              aria-label={`任务栏位置：${POSITION_LABEL[item]}`}
              aria-pressed={position === item}
              onClick={() => setPosition(item)}
              className={`grid h-9 w-9 place-items-center rounded border ${
                position === item
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-edge text-ink hover:bg-hover'
              }`}
            >
              <PositionGlyph position={item} className="h-4 w-4" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setLength(null)
              setThickness(null)
            }}
            className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover"
          >
            尺寸回自适应
          </button>
        </div>

        <p className="text-xs text-dim">
          当前位置：{POSITION_LABEL[position]}｜长度：{length === null ? '自适应' : `${length} px`}
          ｜厚度：{thickness === null ? '默认' : `${thickness} px`}
        </p>
      </Section>

      <Section title="图标大小">
        <div className="flex flex-wrap gap-2">
          {ICON_SIZES.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              aria-pressed={iconSize === item.id}
              onClick={() => setIconSize(item.id)}
              className={`rounded border px-3 py-1.5 text-xs ${
                iconSize === item.id
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-edge text-ink hover:bg-hover'
              }`}
            >
              {item.name}
              {item.id === null ? '' : ` ${item.id}`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="任务栏显示哪些应用" hint="取消勾选的仍可从「所有项目」进入">
        <ul className="grid gap-1 sm:grid-cols-2">
          {APPS.map((app) => (
            <li key={app.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-hover">
                <input
                  type="checkbox"
                  checked={dockApps.includes(app.id)}
                  onChange={() => toggleDockApp(app.id)}
                  className="h-4 w-4 accent-[var(--c-accent)]"
                />
                {app.name}
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="重置">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={atDefault}
            className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            恢复默认（焦糖布丁 · 主题渐变 · 底部任务栏 · 全部应用 · 自适应尺寸）
          </button>

          <button
            type="button"
            onClick={clearWindowMemory}
            className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover"
          >
            清除窗口位置记忆
          </button>
        </div>
      </Section>

      <Section title="操作说明">
        <dl className="space-y-1">
          {SHORTCUTS.map(([what, how]) => (
            <div key={what} className="flex flex-wrap gap-x-2 text-xs">
              <dt className="font-medium text-ink">{what}</dt>
              <dd className="text-dim">{how}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  )
}
