/**
 * 项目详情：/projects/:id —— 封面 + 角色/周期 + 技术栈卡片 + 亮点时间线 + 成果指标 + 链接。
 */
import { Link, useParams } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { projectById } from '../data/projects'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const project = projectById(id)

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-caramel-800 dark:text-caramel-100">找不到这个项目</h1>
        <p className="mt-3 text-caramel-600 dark:text-caramel-300">
          <code>src/data/projects.ts</code> 里没有 id 为 <code>{id}</code> 的项目。
        </p>
        <Link
          to="/projects"
          className="mt-6 inline-block rounded-full bg-caramel-500 px-4 py-2 text-sm font-medium text-caramel-50 transition hover:bg-caramel-600"
        >
          返回项目列表
        </Link>
      </div>
    )
  }

  return (
    <article className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      <nav className="text-sm text-caramel-600 dark:text-caramel-300">
        <Link to="/projects" className="hover:text-caramel-700 dark:hover:text-caramel-100">
          项目经历
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-caramel-700 dark:text-caramel-100">{project.name}</span>
      </nav>

      <header className="space-y-5">
        <Cover
          src={project.cover}
          alt={project.name}
          label={project.name}
          variant="hero"
          className="rounded-2xl"
        />
        <h1 className="text-3xl font-bold text-caramel-800 sm:text-4xl dark:text-caramel-100">
          {project.name}
        </h1>
        <p className="max-w-3xl text-caramel-700 dark:text-caramel-200">{project.summary}</p>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800">
            <dt className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">角色</dt>
            <dd className="mt-1 font-medium text-caramel-800 dark:text-caramel-100">{project.role}</dd>
          </div>
          <div className="rounded-xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800">
            <dt className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">周期</dt>
            <dd className="mt-1 font-medium text-caramel-800 dark:text-caramel-100">{project.period}</dd>
          </div>
          <div className="rounded-xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800">
            <dt className="text-xs uppercase tracking-wider text-caramel-600 dark:text-caramel-300">规模</dt>
            <dd className="mt-1 font-medium text-caramel-800 dark:text-caramel-100">
              {project.scale || '—'}
            </dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="stack-heading" className="space-y-3">
        <h2 id="stack-heading" className="text-xl font-bold text-caramel-700 dark:text-caramel-100">
          技术栈
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.stack.map((tech) => (
            <li
              key={tech}
              className="rounded-xl border border-caramel-200 bg-caramel-100 px-4 py-3 text-sm font-medium text-caramel-800 transition hover:border-caramel-400 dark:border-caramel-700 dark:bg-caramel-800 dark:text-caramel-100"
            >
              {tech}
            </li>
          ))}
        </ul>
      </section>

      {project.metrics && project.metrics.length > 0 && (
        <section aria-labelledby="metrics-heading" className="space-y-3">
          <h2 id="metrics-heading" className="text-xl font-bold text-caramel-700 dark:text-caramel-100">
            成果指标
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {project.metrics.map((m) => (
              <li
                key={m.label}
                className="rounded-2xl border border-caramel-200 bg-caramel-100 p-4 dark:border-caramel-700 dark:bg-caramel-800"
              >
                <p className="text-2xl font-bold text-caramel-600 dark:text-caramel-300">{m.value}</p>
                <p className="mt-1 text-sm font-medium text-caramel-800 dark:text-caramel-100">{m.label}</p>
                {m.note && <p className="mt-1 text-xs text-caramel-600 dark:text-caramel-300">{m.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="highlights-heading" className="space-y-4">
        <h2 id="highlights-heading" className="text-xl font-bold text-caramel-700 dark:text-caramel-100">
          亮点时间线
        </h2>
        <ol className="relative space-y-6 border-l-2 border-caramel-200 pl-6 dark:border-caramel-700">
          {project.highlights.map((h) => (
            <li key={`${h.period}-${h.title}`} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[1.9rem] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-caramel-50 bg-caramel-500 dark:border-caramel-900"
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-caramel-600 dark:text-caramel-300">
                {h.period}
              </p>
              <h3 className="mt-1 font-bold text-caramel-800 dark:text-caramel-100">{h.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-caramel-700 dark:text-caramel-200">{h.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {project.links.length > 0 && (
        <section className="flex flex-wrap gap-3">
          {project.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-caramel-400 px-4 py-2 text-sm font-medium text-caramel-700 transition hover:bg-caramel-200 dark:text-caramel-100 dark:hover:bg-caramel-700"
            >
              {link.label} ↗
            </a>
          ))}
        </section>
      )}
    </article>
  )
}
