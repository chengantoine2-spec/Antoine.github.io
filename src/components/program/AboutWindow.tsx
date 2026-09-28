import { SITE } from '../../data/site'

/**
 * 「关于」窗口：也是内容型窗口的排版模板。
 * 约定：正文最大 68ch 行宽、标题 text-lg、正文 text-sm leading-relaxed、
 * 区块间距 space-y-5、出现的颜色一律用主题令牌（text-ink / text-dim / border-edge / bg-surface-2 / text-accent）。
 */
export function AboutWindow() {
  return (
    <article className="reading">
      <div className="reading__inner space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">{SITE.name}</h2>
        <p className="text-sm text-dim">{SITE.tagline}</p>
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
