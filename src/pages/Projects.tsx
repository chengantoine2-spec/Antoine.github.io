/**
 * 项目经历列表：/projects
 */
import { Link } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { allStacks, projects } from '../data/projects'

export default function Projects() {
  const stacks = allStacks()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-caramel-200 bg-caramel-100 px-6 py-8 dark:border-caramel-700 dark:bg-caramel-800">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-caramel-600 dark:text-caramel-300">
          Projects
        </p>
        <h1 className="mt-2 text-3xl font-bold text-caramel-800 dark:text-caramel-100">项目经历</h1>
        <p className="mt-3 max-w-2xl text-caramel-700 dark:text-caramel-200">
          每个项目一页：角色、周期、技术栈卡片、亮点时间线与成果指标。数据全部写在{' '}
          <code>src/data/projects.ts</code>，改代码即改内容。
        </p>
        {stacks.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {stacks.map((s) => (
              <li
                key={s}
                className="rounded-full border border-caramel-300 bg-caramel-50 px-2.5 py-1 text-xs text-caramel-700 dark:border-caramel-600 dark:bg-caramel-900 dark:text-caramel-200"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="grid gap-5 md:grid-cols-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              to={`/projects/${project.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-caramel-200 bg-caramel-100 shadow-sm transition hover:-translate-y-0.5 hover:border-caramel-400 hover:shadow-md dark:border-caramel-700 dark:bg-caramel-800"
            >
              <Cover src={project.cover} alt={project.name} label={project.name} variant="card" />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-caramel-600 dark:text-caramel-300">
                  <span className="rounded-full bg-caramel-500 px-2 py-0.5 font-medium text-caramel-50">
                    {project.role}
                  </span>
                  <span>{project.period}</span>
                </div>
                <h2 className="text-lg font-bold text-caramel-800 dark:text-caramel-100">{project.name}</h2>
                <p className="text-sm leading-relaxed text-caramel-700 dark:text-caramel-200">{project.summary}</p>
                <ul className="mt-auto flex flex-wrap gap-1.5">
                  {project.stack.slice(0, 5).map((s) => (
                    <li
                      key={s}
                      className="rounded-md bg-caramel-200 px-2 py-0.5 text-xs text-caramel-800 dark:bg-caramel-700 dark:text-caramel-100"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
