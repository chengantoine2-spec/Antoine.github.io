import { DOCK_ORDER } from '../../lib/dock'
import { THEMES, WALLPAPERS, DEFAULT_THEME, DEFAULT_WALLPAPER } from '../../lib/theme'
import { useAppearance } from '../../hooks/useAppearance'
import { useDock } from '../../hooks/useDock'
import type { DockPosition } from '../../types/desktop'
import { PositionGlyph } from '../desktop/DockPositionMenu'

const POSITION_LABEL: Record<DockPosition, string> = {
  bottom: '底部',
  top: '顶部',
  left: '左侧',
  right: '右侧',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-dim">{title}</h3>
      {children}
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

/** 设置窗口：主题 / 桌面背景 / 任务栏 / 重置。全部写进 localStorage，刷新后保持 */
export function SettingsWindow() {
  const { theme, wallpaper, setTheme, setWallpaper, resetAppearance } = useAppearance()
  const { position, length, thickness, setPosition, setLength, setThickness } = useDock()

  const atDefault =
    theme === DEFAULT_THEME &&
    wallpaper === DEFAULT_WALLPAPER &&
    position === 'bottom' &&
    length === null &&
    thickness === null

  function resetAll() {
    resetAppearance()
    setPosition('bottom')
    setLength(null)
    setThickness(null)
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
        <div className="grid gap-2 sm:grid-cols-2">
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

      <Section title="任务栏">
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

      <Section title="重置">
        <button
          type="button"
          onClick={resetAll}
          disabled={atDefault}
          className="rounded border border-edge px-3 py-1.5 text-xs text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          恢复默认（焦糖布丁 · 主题渐变 · 底部任务栏 · 自适应尺寸）
        </button>
      </Section>
    </div>
  )
}
