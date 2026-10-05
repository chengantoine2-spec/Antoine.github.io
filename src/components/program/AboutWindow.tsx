import { useNavigate } from 'react-router-dom'
import { SITE } from '../../data/site'
import { dishRows, otherVeggies } from '../../lib/veggies'

/**
 * 「关于」窗口：也是内容型窗口的排版模板。
 * 约定：正文最大 68ch 行宽、标题 text-lg、正文 text-sm leading-relaxed、
 * 区块间距 space-y-5、出现的颜色一律用主题令牌（text-ink / text-dim / border-edge / bg-surface-2 / text-accent）。
 */
export function AboutWindow() {
  const navigate = useNavigate()
  const dishes = dishRows()
  const others = otherVeggies()

  return (
    <article className="reading">
      <div className="reading__inner space-y-5">
        {/* 站标自带圆角和外圈透明，别再套 rounded——会圆角叠圆角 */}
        <header className="flex items-center gap-3">
          <img src={SITE.logo} alt="" width={48} height={48} className="logo-mark h-12 w-12 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">{SITE.name}</h2>
            <p className="text-sm text-dim">{SITE.tagline}</p>
          </div>
        </header>

        <div className="space-y-3 text-sm leading-relaxed text-ink">
          {SITE.intro.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <dl className="grid gap-2 sm:grid-cols-2">
          {SITE.facts.map((fact) => (
            <div key={fact.label} className="rounded-lg border border-edge bg-surface-2 px-3 py-2">
              <dt className="text-xs text-dim">{fact.label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {/* 菜谱：每个窗口一样菜（菜图是设计负责人画的那 48 张里的 11 张）。
            点一下就打开 / 聚焦那个窗口 —— 桌面能同时开好几个，所以这里是"切过去"而不是"跳过去" */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">这块地里的菜</h3>
          <p className="text-xs text-dim">每个窗口分到一样菜；点一下就把那扇窗开到最上面。</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {dishes.map(({ app, veggie }) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => navigate(app.path)}
                  title={`打开「${app.name}」`}
                  className="flex w-full items-center gap-3 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-left hover:bg-hover"
                >
                  {veggie ? (
                    <img
                      src={veggie.src}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{app.name}</span>
                    <span className="block text-xs text-dim">{app.veggie}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 设计负责人把整套菜都画齐了（48 样），这里给它们一个落点：备着以后加窗口用 */}
        <details className="rounded-lg border border-edge bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-xs text-dim">
            地里还有 {others.length} 样菜（以后加窗口就从这里挑）
          </summary>
          <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {others.map((veggie) => (
              <li key={veggie.id} className="flex flex-col items-center gap-1">
                <img src={veggie.src} alt="" width={32} height={32} className="h-8 w-8" />
                <span className="text-[10px] text-dim">{veggie.name}</span>
              </li>
            ))}
          </ul>
        </details>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SITE.links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
