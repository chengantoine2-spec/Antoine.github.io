import { useNavigate } from 'react-router-dom'
import { PROJECTS } from '../../data/projects'
import { useWindowTitle } from '../../hooks/useWindowTitle'

/** 项目详情：路由 /projects/:id，标题栏文字换成项目名。
    ⚠️ 参数从 props 来（不再是 useParams）：桌面能同时开多个窗口，
    路由只表示"当前聚焦的那个窗口"，各窗口的页面由窗口自己带着。 */
export function ProjectDetailWindow({ id }: { id?: string }) {
  const navigate = useNavigate()
  const project = PROJECTS.find((item) => item.id === id)

  useWindowTitle(project?.name ?? '项目详情')

  if (!project) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">没有找到这个项目。</p>
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="text-xs text-dim hover:text-ink"
        >
          ← 回到项目列表
        </button>
      </div>
    )
  }

  return (
    <article className="reading">
      <div className="reading__inner space-y-5">
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="text-xs text-dim hover:text-ink"
      >
        ← 项目列表
      </button>

      {project.cover ? (
        <div
          className="h-40 rounded-lg border border-edge bg-surface-2 bg-cover bg-center"
          style={{ backgroundImage: `url("${project.cover}")` }}
        />
      ) : null}

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
        <p className="text-sm text-dim">
          {project.role} · {project.period}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-ink">{project.summary}</p>

      {project.highlights.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-dim">做了什么</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
            {project.highlights.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.stack.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-dim">技术</h3>
          <ul className="flex flex-wrap gap-1">
            {project.stack.map((item) => (
              <li
                key={item}
                className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {project.links.map((link) => (
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
      ) : null}
      </div>
    </article>
  )
}
