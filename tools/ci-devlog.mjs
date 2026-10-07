#!/usr/bin/env node
/*
 * CI 开发日志草稿（tools/ci-devlog.mjs）
 * ---------------------------------------------------------------------------
 * 由 .github/workflows/devlog.yml 在**推到 main 之后**调用：读本次推送的提交区间 →
 * 让 DeepSeek 写一篇中文第一人称的开发日志 → 用 GitHub REST **建成一个"已关闭"的 issue**。
 *
 * ⚠️ 为什么建成即 closed：本站公开博客只显示 `state=open` 的 issue（见 AGENTS「数据约定」），
 *    所以草稿**不会立刻出现在线上**；站主在「博客创作」窗口里能看到它、审完点「重新显示」即可。
 *
 * ⚠️ 安全硬要求（改这个脚本前先读这三条）：
 *  1. **绝不打印、绝不拼进 issue 正文/提交信息的任何 secret**：出错时只打 HTTP status 与
 *     响应里 GitHub / DeepSeek 给出的 `message`（它们不会回显 key），**不许**打请求头或整个 body。
 *  2. **没有 DEEPSEEK_API_KEY 就打印一句提示并 `exit 0`** —— fork 的 PR 拿不到 secret，
 *     那种环境不许把构建弄红。
 *  3. 所有网络调用都有**超时（60s）+ 最多 1 次重试**，任何失败都**优雅退出（exit 0）**，
 *     绝不把部署链路带崩。
 *
 * 本机自证：`BEFORE=<旧提交> AFTER=HEAD node tools/ci-devlog.mjs --dry-run`
 *   → 只打印"提交条数 + prompt 摘要"，**不调 API、不建 issue**（所以不带 key 也能跑）。
 */
import { execFileSync } from 'node:child_process'

const DRY_RUN = process.argv.includes('--dry-run')

const KEY = process.env.DEEPSEEK_API_KEY ?? ''
const GH_TOKEN = process.env.GH_TOKEN ?? ''
const REPO = process.env.REPO ?? ''
const BEFORE = process.env.BEFORE ?? ''
const AFTER = process.env.AFTER ?? ''
const RUN_URL = process.env.RUN_URL ?? ''
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'

const NET_TIMEOUT_MS = 60_000
const MAX_COMMITS = 40

const ZERO_SHA = /^0{7,40}$/

function info(message) {
  console.log(`[ci-devlog] ${message}`)
}

/** 今天的日期（按站主所在时区），用于 issue 标题 */
function today() {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * 取本次推送的提交。BEFORE 可能是全 0（新分支）或不可达（force push）——
 * 那种情况退回最近 20 条，**绝不让脚本崩**。
 */
function collectCommits() {
  const pretty = '%h|%ad|%an|%s'
  const range = `${BEFORE}..${AFTER}`
  const run = (args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

  let raw = ''
  let source = `区间 ${range}`
  if (BEFORE && AFTER && !ZERO_SHA.test(BEFORE)) {
    try {
      raw = run(['log', `--pretty=${pretty}`, '--date=short', range])
    } catch {
      raw = '' // force push / 浅克隆都可能让区间取不到
    }
  }
  if (!raw) {
    source = `退回最近 ${MAX_COMMITS} 条（BEFORE 不可用或区间为空）`
    try {
      raw = run(['log', `-n${MAX_COMMITS}`, `--pretty=${pretty}`, '--date=short'])
    } catch {
      raw = ''
    }
  }

  const commits = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author, ...rest] = line.split('|')
      return { hash, date, author, subject: rest.join('|') }
    })
  return { commits, source }
}

function buildPrompt(commits, source) {
  const list = commits.map((c) => `- ${c.date} ${c.hash} ${c.subject}`).join('\n')
  return [
    {
      role: 'system',
      content: [
        '你在给一个个人网站的站长写**开发日志**，会作为博客草稿交给他审。',
        '写作要求（务必遵守）：',
        '1. 中文、**第一人称**（"我把…改成…"），语气平实，像自己写的工作记录。',
        '2. **具体到数字与现象**：写清改了哪个文件/哪个数值/什么表现变好了（提交信息里有的才写）。',
        '3. **少用形容词**，不要营销腔、不要"极大地提升了用户体验"这种空话。',
        '4. **绝对不许编造**：提交信息里没有的数字、没测过的结论、没做过的验证都不许写。',
        '5. **不许出现**：PAT / API key / token / 内部会话 id / 任何 agent 的名字（要写就写"一个执行者"）。',
        '6. 长度 **600~1000 字**，用 markdown 小标题分 2~4 段（例如「这一轮做了什么」「踩到的坑」「下一步」）。',
        '7. 结尾不要写"发布说明"之类的客套话。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `这次推送的提交（来源：${source}，共 ${commits.length} 条）：`,
        list || '（这次没有取到提交信息）',
        '',
        '请据此写开发日志草稿。只输出日志正文本身，不要额外解释。',
      ].join('\n'),
    },
  ]
}

/** 带超时的 fetch（AbortController 是 Node 内置，不引依赖） */
async function fetchWithTimeout(url, options, timeoutMs = NET_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 网络调用：最多 1 次重试；失败只回中立信息（绝不回显 key/请求头） */
async function withRetry(label, fn) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      info(`${label} 第 ${attempt + 1} 次失败：${error && error.name === 'AbortError' ? '超时' : String(error && error.message)}`)
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  throw lastError ?? new Error(`${label} 失败`)
}

/** 从响应体里只取 message 字段（GitHub / DeepSeek 都不会在这里回显 key） */
async function safeMessage(response) {
  try {
    const text = await response.text()
    const parsed = JSON.parse(text)
    const message = parsed && (parsed.message || (parsed.error && parsed.error.message))
    return message ? String(message).slice(0, 200) : text.slice(0, 200)
  } catch {
    return '(响应无法解析)'
  }
}

async function writeDevlog(commits, source) {
  const response = await withRetry('DeepSeek', () =>
    fetchWithTimeout('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: buildPrompt(commits, source),
        temperature: 0.7,
        max_tokens: 2000,
      }),
    }),
  )
  if (!response.ok) {
    info(`DeepSeek 返回 ${response.status}：${await safeMessage(response)}`)
    return null
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.trim() ? content.trim() : null
}

/** 建 issue：⚠️ 建成后**立刻 PATCH 成 closed**（create 接口不保证接受 state） */
async function createClosedIssue(title, body) {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${GH_TOKEN}`,
    'content-type': 'application/json',
    'user-agent': 'ci-devlog',
    'x-github-api-version': '2022-11-28',
  }
  const created = await withRetry('建 issue', () =>
    fetchWithTimeout(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, body, labels: ['project'] }),
    }),
  )
  if (!created.ok) {
    info(`建 issue 失败：HTTP ${created.status} — ${await safeMessage(created)}`)
    return null
  }
  const issue = await created.json()
  const closed = await withRetry('关 issue', () =>
    fetchWithTimeout(`https://api.github.com/repos/${REPO}/issues/${issue.number}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'closed' }),
    }),
  )
  if (!closed.ok) {
    info(`草稿已建（#${issue.number}）但**关闭失败**：HTTP ${closed.status} — ${await safeMessage(closed)}`)
    return { number: issue.number, closed: false }
  }
  return { number: issue.number, closed: true }
}

async function main() {
  const { commits, source } = collectCommits()
  const promptMessages = buildPrompt(commits, source)
  const promptChars = promptMessages.reduce((sum, m) => sum + m.content.length, 0)

  if (DRY_RUN) {
    info('--dry-run：不调 API、不建 issue')
    info(`提交条数：${commits.length}（来源：${source}）`)
    info(`模型：${MODEL}；prompt 约 ${promptChars} 字`)
    info('提交摘要：')
    for (const c of commits.slice(0, 8)) info(`  ${c.date} ${c.hash} ${c.subject}`)
    if (commits.length > 8) info(`  …另有 ${commits.length - 8} 条`)
    info('prompt 前 200 字：')
    info('  ' + promptMessages[1].content.slice(0, 200).replace(/\n/g, ' / '))
    info(`有 key：${KEY ? '是' : '否'}；有 GH_TOKEN：${GH_TOKEN ? '是' : '否'}；REPO：${REPO || '(未设置)'}`)
    return 0
  }

  if (!KEY) {
    info('没有 DEEPSEEK_API_KEY，跳过（fork 的 PR 拿不到 secret，属正常）。')
    return 0
  }
  if (!GH_TOKEN || !REPO) {
    info('缺少 GH_TOKEN 或 REPO，跳过（不建 issue）。')
    return 0
  }
  if (commits.length === 0) {
    info('这次没有取到提交，跳过。')
    return 0
  }

  const body = await writeDevlog(commits, source)
  if (!body) {
    info('没能生成日志正文，跳过建 issue（不影响部署）。')
    return 0
  }

  const footer = [
    '',
    '---',
    '',
    '> ⚠️ 这是 **CI 自动生成的草稿**，请审后再发布（看完点「重新显示」才会出现在公开博客里）。',
    `> 提交区间：\`${BEFORE || '(无)'}..${AFTER || '(无)'}\`（${source}，共 ${commits.length} 条）`,
    RUN_URL ? `> 构建记录：${RUN_URL}` : '> 构建记录：未提供',
  ].join('\n')

  const result = await createClosedIssue(`[草稿] 开发日志 ${today()}`, body + footer)
  if (result) {
    info(`草稿 issue #${result.number} 已建（${result.closed ? '并已关闭' : '但关闭失败，请手动关'}）`)
  }
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    // 任何意外都只报中立信息并**优雅退出**：绝不把部署带崩，也绝不打 secret。
    info('意外失败（不影响部署）：' + String(error && error.message ? error.message : error))
    process.exit(0)
  })
