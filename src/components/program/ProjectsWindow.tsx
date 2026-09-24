import { useNavigate } from 'react-router-dom'
import { PROJECTS } from '../../data/projects'

/** 「项目」窗口：卡片列表，点卡片走 /projects/:id 打开详情窗口 */
export function ProjectsWindow() {
  const navigate = useNavigate()

  if (PROJECTS.length === 0) {
    return <p className="text-sm text-dim">还没有项目。</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-dim">共 {PROJECTS.length} 个项目，点开看详情</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {PROJECTS.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex h-full w-full flex-col gap-2 rounded-lg border border-edge bg-surface-2 p-4 text-left transition-colors hover:bg-hover"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{project.name}</span>
                <span className="shrink-0 text-xs text-dim">{project.period}</span>
              </span>

              <span className="text-xs text-dim">{project.role}</span>

              <span className="text-sm leading-relaxed text-ink">{project.summary}</span>

              <span className="mt-auto flex flex-wrap gap-1 pt-1">
                {project.stack.map((item) => (
                  <span
                    key={item}
                    className="rounded border border-edge px-1.5 py-0.5 text-[11px] text-dim"
                  >
                    {item}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
