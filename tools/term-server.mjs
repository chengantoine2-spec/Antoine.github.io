/**
 * 本机终端服务：给站点里的「终端」窗口提供**真实 shell**。
 *
 * 为什么必须有它：浏览器不能起进程，纯静态页面做不到真终端。
 * 这个进程只监听 127.0.0.1，命令接口一律要求启动时打印的 token；
 * 跨域只放行来自 localhost / 127.0.0.1 的页面（Origin 白名单，防的是你浏览器里
 * 别的网页偷偷往这个端口发命令）。
 *
 *   npm run term                                  # 端口 5180，每次随机一个 token
 *   TERM_PORT=5181 TERM_TOKEN=xxx npm run term    # 也可以自己指定
 *
 * 协议：全部 NDJSON（一行一个 JSON）
 *   GET  /api/health            → {ok, service, cwd}    不需要 token，用来判断服务在不在
 *   POST /api/exec  {cmd}       → {type:start,cwd} → 若干 {type:out,data} → {type:exit,code}
 *                               cmd 是 cd 时改回 {type:cd,cwd}（子进程改目录留不下来，只能自己处理）
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { statSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

const PORT = Number(process.env.TERM_PORT ?? 5180)
const HOST = '127.0.0.1'
const TOKEN = process.env.TERM_TOKEN ?? randomBytes(16).toString('hex')
const IS_WIN = process.platform === 'win32'
const HOME = homedir()
const ORIGIN_OK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
/* 颜色/光标控制码：网页里显示不了，直接抹掉 */
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
const MAX_BODY = 1 << 20

let cwd = process.cwd()

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function applyCors(req, res) {
  const origin = req.headers.origin
  if (typeof origin === 'string' && ORIGIN_OK.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-term-token')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        fail(new Error('请求体太大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        done(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        fail(error)
      }
    })
    req.on('error', fail)
  })
}

/** 解析 cd 目标（支持 ~、相对、绝对，带引号也认），是目录就返回绝对路径，否则 null */
function resolveDir(to) {
  let target = String(to ?? '').trim()
  /* cd "D:\带 空格的目录" —— 引号是命令行语法，不是路径的一部分 */
  if (target.length >= 2) {
    const first = target[0]
    const last = target[target.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      target = target.slice(1, -1).trim()
    }
  }
  if (target === '' || target === '~') target = HOME
  else if (target.startsWith('~/') || target.startsWith('~\\')) target = join(HOME, target.slice(2))
  const abs = isAbsolute(target) ? target : resolve(cwd, target)
  try {
    return statSync(abs).isDirectory() ? abs : null
  } catch {
    return null
  }
}

function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  })
  return (event) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`)
  }
}

async function handleExec(req, res) {
  const body = await readBody(req)
  const cmd = String(body.cmd ?? '').trim()
  if (!cmd) {
    sendJson(res, 400, { error: '空命令' })
    return
  }

  const cd = /^cd(?:\s+(.+))?$/i.exec(cmd)
  if (cd) {
    /* 光敲 cd 不换目录，把当前目录打出来（和 Windows 的 cmd 一致）；换目录写 cd ~ 或 cd 路径 */
    if (cd[1] === undefined) {
      const write = openStream(res)
      write({ type: 'out', data: `${cwd}\n` })
      write({ type: 'exit', code: 0 })
      res.end()
      return
    }
    const next = resolveDir(cd[1])
    if (next) cwd = next
    const write = openStream(res)
    write({ type: 'cd', cwd, ok: Boolean(next), target: cd[1] })
    write({ type: 'exit', code: next ? 0 : 1 })
    res.end()
    return
  }

  const write = openStream(res)
  write({ type: 'start', cwd, cmd })

  /* Windows 的 cmd 默认不是 UTF-8，中文会乱码，先切码页 */
  const line = IS_WIN ? `chcp 65001>nul && ${cmd}` : cmd
  const child = spawn(line, {
    cwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' },
  })

  const push = (chunk) => {
    /* Windows 上编码是混的：cmd 内置命令按 OEM 码页（中文系统是 GBK）输出，
       git / node 之类多为 UTF-8。先按 UTF-8 解，出现替换字符就说明不是，再用 GBK 解一遍。 */
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    let text = buffer.toString('utf8')
    if (text.includes('\uFFFD')) {
      try {
        text = new TextDecoder('gbk').decode(buffer)
      } catch {
        /* 这台 Node 没带 gbk 解码器，就保持 UTF-8 的结果 */
      }
    }
    write({ type: 'out', data: text.replace(ANSI, '') })
  }
  child.stdout?.on('data', push)
  child.stderr?.on('data', push)
  child.on('error', (error) => {
    push(`无法启动命令：${error.message}\n`)
    write({ type: 'exit', code: 1 })
    res.end()
  })
  child.on('close', (code, signal) => {
    if (signal) push(`\n[已终止：${signal}]\n`)
    write({ type: 'exit', code: code ?? (signal ? 130 : 0) })
    res.end()
  })

  /* 前端点「停止」= 断开连接，这里把子进程一起收掉 */
  res.on('close', () => {
    if (!res.writableEnded && child.exitCode === null) child.kill()
  })
}

/* ── 音乐（站主 2026-10-06「先做一个本机音乐」）──────────────────────────
   ⚠️ 三条底线照旧：**要 token**、**只接受本机页面**（Origin 白名单，上面已判）、**只听 127.0.0.1**。
   ⚠️ 安全重点：**只放行音乐根目录之下的音频文件**；`..` 穿越、非音频扩展名一律拒。
   音乐根目录：默认 %USERPROFILE%\Music，可用环境变量 MUSIC_DIR 覆盖。 */

const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus']
const AUDIO_MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
}
/* 封面图（2026-10-06 补）：清单 music.json 里的 `cover` 指向它们，要能通过 /music/file 取到，
   否则音乐窗口只有歌没有封面。
   ⚠️ **绝不能把它们并进 AUDIO_EXT**：那个数组同时被列表扫描器（musicList）当作"这一项是不是一首曲目"，
   并进去会让 `cover.jpg` 出现在曲目列表里、点开还想播它。所以"能不能取"与"算不算曲目"分成两份：
     · 算曲目：AUDIO_EXT（列表用）
     · 能取文件：MEDIA_EXT = 音频 + 图片（/music/file 用）
   穿越校验对两者是同一条代码路径（都在 musicFileOf 里），所以图片同样不许 ../ 越界。 */
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const IMAGE_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const MEDIA_EXT = [...AUDIO_EXT, ...IMAGE_EXT]
const MEDIA_MIME = { ...AUDIO_MIME, ...IMAGE_MIME }

function extOf(name) {
  const m = /(\.[A-Za-z0-9]+)$/.exec(name)
  return m ? m[1].toLowerCase() : ''
}

async function musicDirPath() {
  const { resolve, join } = await import('node:path')
  return resolve(process.env.MUSIC_DIR ?? join(HOME, 'Music'))
}

/** 相对路径 → 音乐根目录下的绝对路径；越界 / 扩展名不对 / 含 NUL 一律 null */
async function musicFileOf(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.includes('\0')) return null
  const { resolve } = await import('node:path')
  const root = await musicDirPath()
  const abs = resolve(root, rel)
  /* ⚠️ 前缀校验要带分隔符，否则同前缀的兄弟目录（MusicEvil）能溜过去 */
  const inside = abs === root || abs.startsWith(root + '/') || abs.startsWith(root + '\\')
  if (!inside) return null
  if (!MEDIA_EXT.includes(extOf(abs))) return null
  return abs
}

/** 文件名 → { title, artist }：默认按「歌手 - 歌名」拆，没有就整串当歌名 */
function parseName(base) {
  const stem = base.replace(/\.[A-Za-z0-9]+$/, '')
  const i = stem.indexOf(' - ')
  if (i > 0) return { artist: stem.slice(0, i).trim(), title: stem.slice(i + 3).trim() }
  return { artist: '', title: stem }
}

/** 可选清单 music.json：[{file,title,artist,album,cover}] —— 有就以它为准 */
async function readMusicManifest(root) {
  const { join } = await import('node:path')
  try {
    const { readFileSync } = await import('node:fs')
    const list = JSON.parse(readFileSync(join(root, 'music.json'), 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function handleMusicList(res) {
  const { join } = await import('node:path')
  const { readdirSync, statSync } = await import('node:fs')
  const root = await musicDirPath()
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    /* 目录不存在 / 没权限：**友好 JSON**，绝不抛（线上或还没放音乐时走这里） */
    sendJson(res, 200, {
      ok: false,
      dir: root,
      error: String(error?.code ?? error),
      hint: '把音乐放进这个目录，或设 MUSIC_DIR 指向别处，然后重启本机服务',
      tracks: [],
    })
    return
  }
  const files = []
  for (const e of entries) {
    const q = join(root, e.name)
    if (e.isFile() && AUDIO_EXT.includes(extOf(e.name))) files.push(q)
    else if (e.isDirectory()) {
      /* 只扫一层子目录（够用即可） */
      try {
        for (const f of readdirSync(q, { withFileTypes: true })) {
          if (f.isFile() && AUDIO_EXT.includes(extOf(f.name))) files.push(join(q, f.name))
        }
      } catch {
        /* 子目录读不到就跳过 */
      }
    }
  }
  const manifest = await readMusicManifest(root)
  const over = new Map(manifest.filter((m) => m && m.file).map((m) => [String(m.file), m]))
  const tracks = files.map((abs) => {
    const rel = abs.slice(root.length + 1).split(/[\\/]/).join('/')
    const base = rel.split('/').pop() ?? rel
    const meta = over.get(rel) ?? over.get(base) ?? {}
    const parsed = parseName(base)
    let size = 0
    let mtime = 0
    try {
      const st = statSync(abs)
      size = st.size
      mtime = Math.round(st.mtimeMs)
    } catch {
      /* 读不到 stat 就给 0 */
    }
    return {
      id: rel,
      file: rel,
      title: meta.title ?? parsed.title,
      artist: meta.artist ?? parsed.artist,
      album: meta.album ?? '',
      cover: meta.cover ?? null,
      size,
      mtime,
    }
  })
  tracks.sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title, 'zh'))
  sendJson(res, 200, { ok: true, dir: root, tracks })
}

async function handleMusicFile(req, res, url) {
  const abs = await musicFileOf(url.searchParams.get('path'))
  if (!abs) {
    sendJson(res, 403, { error: '只能取音乐目录里的音频与封面图（不许 ../ 穿越、不许白名单外的扩展名）' })
    return
  }
  const { createReadStream, statSync } = await import('node:fs')
  let st
  try {
    st = statSync(abs)
    if (!st.isFile()) throw new Error('not a file')
  } catch {
    sendJson(res, 404, { error: '这个文件不在音乐目录里' })
    return
  }
  const type = MEDIA_MIME[extOf(abs)] ?? 'application/octet-stream'
  const range = req.headers.range
  /* ⚠️ 必须支持 Range：否则浏览器拖进度条只能重头下 */
  const m = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
  if (m) {
    const start = m[1] === '' ? Math.max(0, st.size - Number(m[2] || 0)) : Number(m[1])
    const end = m[1] === '' || m[2] === '' ? st.size - 1 : Math.min(Number(m[2]), st.size - 1)
    if (!Number.isFinite(start) || start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + st.size })
      res.end()
      return
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    })
    createReadStream(abs, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  })
  createReadStream(abs).pipe(res)
}
const server = createServer((req, res) => {
  applyCors(req, res)
  const url = new URL(req.url ?? '/', `http://${HOST}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  /* Origin 白名单：非本机页面一律拒掉；没有 Origin（curl 之类）放行，反正只听 127.0.0.1 */
  const origin = req.headers.origin
  if (typeof origin === 'string' && !ORIGIN_OK.test(origin)) {
    sendJson(res, 403, { error: '只接受本机页面的请求' })
    return
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'dsh-term', cwd })
    return
  }

  if (req.headers['x-term-token'] !== TOKEN) {
    sendJson(res, 401, { error: 'token 不对（看启动时打印的那串）' })
    return
  }

  if (url.pathname === '/music/list' && req.method === 'GET') {
    handleMusicList(res).catch((error) => {
      if (!res.headersSent) sendJson(res, 500, { error: String(error?.message ?? error) })
      else res.end()
    })
    return
  }

  if (url.pathname === '/music/file' && req.method === 'GET') {
    handleMusicFile(req, res, url).catch((error) => {
      if (!res.headersSent) sendJson(res, 500, { error: String(error?.message ?? error) })
      else res.end()
    })
    return
  }
  if (url.pathname === '/api/exec' && req.method === 'POST') {
    handleExec(req, res).catch((error) => {
      if (!res.headersSent) sendJson(res, 400, { error: String(error?.message ?? error) })
      else res.end()
    })
    return
  }

  sendJson(res, 404, { error: '没有这个接口' })
})

server.listen(PORT, HOST, () => {
  const line = '─'.repeat(58)
  console.log(line)
  console.log('  本机终端服务已启动（站点「终端」窗口用）')
  console.log(`  地址   http://${HOST}:${PORT}`)
  console.log(`  token  ${TOKEN}`)
  console.log(`  起始目录 ${cwd}`)
  console.log('  把地址和 token 填进「终端」窗口的连接栏，token 只存在浏览器本地')
  console.log('  Ctrl+C 停止')
  console.log(line)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[term] 端口 ${PORT} 被占用，改用 TERM_PORT=别的端口 再启动`)
  } else {
    console.error('[term] 启动失败：' + error.message)
  }
  process.exit(1)
})
