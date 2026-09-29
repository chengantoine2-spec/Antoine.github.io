/**
 * 把 docs/dst-guides/*.md 发布成博客文章（= GitHub Issue），并打上 `wiki` 标签。
 *
 * 为什么需要它：教程的正文是 3 篇 markdown，逐篇粘进「博客创作」窗口也能发，
 * 但容易漏标签、也容易手滑漏掉一段。这个脚本把「发文章」变成一条命令。
 *
 * 用法（**需要你自己提供 PAT**，脚本不会去读浏览器里的那个）：
 *
 *   # PowerShell
 *   $env:GH_TOKEN = "ghp_xxx"; node docs/dst-guides/publish.mjs
 *   # bash
 *   GH_TOKEN=ghp_xxx node docs/dst-guides/publish.mjs
 *
 * 可选参数：
 *   --dry     只打印将要做什么，不真的写 GitHub
 *   --update  已存在同名文章时改成更新（默认是跳过，避免重复创建）
 *
 * 需要的权限：fine-grained token 的 Issues 读写，或 classic token 的 public_repo。
 * 只依赖 Node 内置能力（node:fs / fetch），不新增依赖。
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'chengantoine2-spec'
const REPO = 'Antoine.github.io'
const API = `https://api.github.com/repos/${OWNER}/${REPO}/issues`
/** 教程必须带的标签：Wiki 窗口的「新手教程」区就是按它筛的 */
const WIKI_LABEL = 'wiki'

const here = dirname(fileURLToPath(import.meta.url))
const args = new Set(process.argv.slice(2))
const dry = args.has('--dry')
const update = args.has('--update')

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? ''

/** 极简 front-matter 解析：只认 --- 之间的 `key: value`，够这个用途 */
function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 0) continue
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { meta, body: text.slice(match[0].length) }
}

function headers(withBody) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function readError(response) {
  if (response.status === 401) return 'Token 无效或已过期（401）'
  if (response.status === 403) return 'Token 权限不足（403）：需要 Issues 读写'
  if (response.status === 404) return '找不到仓库，或 Token 没有该仓库权限（404）'
  try {
    const data = await response.json()
    return data.message ?? `GitHub 返回 ${response.status}`
  } catch {
    return `GitHub 返回 ${response.status}`
  }
}

/** 取回已存在的文章，按标题建索引（用来避免重复发布） */
async function listExisting() {
  const response = await fetch(`${API}?state=all&per_page=100`, { headers: headers(false) })
  if (!response.ok) throw new Error(await readError(response))
  const issues = await response.json()
  const byTitle = new Map()
  for (const issue of issues) {
    if (issue.pull_request) continue
    byTitle.set(issue.title, issue)
  }
  return byTitle
}

async function createIssue(payload) {
  const response = await fetch(API, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

async function updateIssue(number, payload) {
  const response = await fetch(`${API}/${number}`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

async function main() {
  /* 只收真正的稿件：README 也在同一个目录里，别把它当成一篇教程发出去 */
  const files = (await readdir(here))
    .filter((name) => name.endsWith('.md') && !/^readme\.md$/i.test(name))
    .sort()
  if (files.length === 0) {
    console.log('[publish] 没找到 .md 稿件')
    return
  }

  const drafts = []
  for (const name of files) {
    const { meta, body } = parseFrontMatter(await readFile(join(here, name), 'utf8'))
    const title = meta.title ?? name.replace(/\.md$/, '')
    /* front-matter 里的 labels 是逗号分隔；无论如何都补上 wiki，否则教程区看不到 */
    const labels = (meta.labels ?? '')
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!labels.includes(WIKI_LABEL)) labels.unshift(WIKI_LABEL)
    drafts.push({ name, title, labels, body: body.trim() })
  }

  console.log(`[publish] 共 ${drafts.length} 篇：`)
  for (const d of drafts) console.log(`  · ${d.title}  [${d.labels.join(' / ')}]`)

  if (dry) {
    console.log('[publish] --dry：以上是全部动作，未写 GitHub')
    return
  }
  if (!token) {
    console.error('[publish] 缺少 GH_TOKEN。用法见本文件顶部注释。')
    process.exitCode = 1
    return
  }

  const existing = await listExisting()
  let created = 0
  let updated = 0
  let skipped = 0

  for (const draft of drafts) {
    const found = existing.get(draft.title)
    if (found) {
      if (!update) {
        console.log(`  = 跳过（已存在 #${found.number}）：${draft.title}。要覆盖请加 --update`)
        skipped += 1
        continue
      }
      await updateIssue(found.number, {
        title: draft.title,
        body: draft.body,
        labels: draft.labels,
      })
      console.log(`  ↑ 已更新 #${found.number}：${draft.title}`)
      updated += 1
      continue
    }
    const issue = await createIssue({
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
    })
    console.log(`  + 已发布 #${issue.number}：${draft.title}`)
    created += 1
  }

  console.log(`[publish] 完成：新建 ${created}、更新 ${updated}、跳过 ${skipped}`)
  if (created + updated > 0) {
    console.log('[publish] 打开「饥荒 Wiki」窗口 →「新手教程」区即可看到；')
    console.log('          未认证的访客可能要等博客缓存过期（默认 10 分钟）或点一次「刷新」')
  }
}

main().catch((error) => {
  console.error(`[publish] 失败：${error.message}`)
  process.exitCode = 1
})
