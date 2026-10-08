/* 音乐窗口的服务端契约验证（纯 HTTP，不需要 Playwright、不引依赖）
 *
 * 为什么单独一份、而且先做服务端那半：
 *   服务端是"能不能播/能不能看封面"的真正地基（token / Origin / Range / 穿越 / 清单），
 *   而它**不依赖浏览器**，跑得快、证据硬。窗口那半的断言随后单独一单补进本文件。
 *
 * 用法：node tools/verify-music.mjs
 * 自证要点（每条都在下面 check 里，失败会打出原始 JSON）：
 *   · 无 token → 401；坏 Origin → 403
 *   · /music/list 列出曲目（**且 music.json 的数组清单能覆盖标题**）
 *   · /music/file 取得到音频；`Range: bytes=0-99` → **206 且正好 100 字节**
 *   · 穿越被拒（音频与**图片**都不能 ../ 越界）；白名单外的 .txt 也拒
 *   · 封面图能取到且 Content-Type 正确（2026-10-06 补的图片白名单）
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/* ⚠️ 本文件就在 `tools/` 下，所以 `import.meta.dirname` **已经是 tools 目录**，
   仓库根要再上一层。（第一版这里多拼了一次 `tools/`，结果 spawn 的路径不存在、
   服务永远起不来 —— 现场表现为"12s 内没起来"，而手工起服务是好的。） */
const TOOLS_DIR = import.meta.dirname ?? resolve(new URL('.', import.meta.url).pathname.replace(/^\//, ''))
const ROOT = resolve(TOOLS_DIR, '..')
const PORT = Number(process.env.MUSIC_TEST_PORT ?? 5199)
const TOKEN = 'music-test-token'
const ORIGIN_OK = 'http://localhost:5173'
const ORIGIN_BAD = 'http://evil.example'
const BASE = `http://127.0.0.1:${PORT}`

const results = []
function check(name, ok, detail) {
  results.push(!!ok)
  const mark = ok ? '✓ PASS' : '× FAIL'
  console.log(`${mark}  ${name}${detail === undefined ? '' : `  — ${detail}`}`)
}

/* 一个 256 字节的合法 WAV 头 + 静音数据：够测 Range（0-99 = 100 字节）与 MIME */
function tinyWav() {
  const buf = Buffer.alloc(256)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(248, 4)
  buf.write('WAVEfmt ', 8, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(8000, 24)
  buf.writeUInt32LE(8000, 28)
  buf.writeUInt16LE(1, 32)
  buf.writeUInt16LE(8, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(220, 40)
  return buf
}
/* 一张"看起来像 JPEG"的最小字节：只验 MIME 与可达性，不验图像解码 */
const TINY_JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 0x20), Buffer.from([0xff, 0xd9])])

const parent = mkdtempSync(join(tmpdir(), 'music-verify-'))
const dir = join(parent, 'library')
mkdirSync(dir)
mkdirSync(join(parent, 'outside')) // 用来验证"外面真有文件也不许取"

writeFileSync(join(dir, 'a.wav'), tinyWav())
writeFileSync(join(dir, 'b - 歌手 - 歌名.wav'), tinyWav())
writeFileSync(join(dir, 'cover.jpg'), TINY_JPG)
writeFileSync(join(dir, 'notes.txt'), 'not media') // 白名单外
writeFileSync(join(parent, 'outside', 'secret.wav'), tinyWav())
writeFileSync(join(parent, 'outside', 'secret.jpg'), TINY_JPG)
/* ⚠️ 必须是**数组**形式（上一版测试写成了对象，等于没验到数组这条路径） */
writeFileSync(join(dir, 'music.json'), JSON.stringify([{ file: 'a.wav', title: '清单里的标题', artist: '清单歌手', cover: 'cover.jpg' }]))

let child = null
async function waitReady(ms = 12000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return true
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

const get = (path, { token = TOKEN, origin = ORIGIN_OK, range } = {}) => {
  const headers = {}
  if (origin) headers.Origin = origin
  if (token) headers['x-term-token'] = token
  if (range) headers.Range = range
  return fetch(`${BASE}${path}`, { headers })
}

try {
  /* stdio 全丢掉、只靠轮询 /api/health 判就绪：
     DSH 的沙箱里"捕获子进程管道输出"会被拒（EPERM），所以不碰管道。 */
  child = spawn(process.execPath, [join(ROOT, 'tools', 'term-server.mjs')], {
    cwd: ROOT,
    env: { ...process.env, TERM_PORT: String(PORT), TERM_TOKEN: TOKEN, MUSIC_DIR: dir },
    stdio: 'ignore',
  })

  const ready = await waitReady()
  check('临时起 term-server 并等到 /api/health 就绪（不需要 token）', ready, ready ? BASE : '12s 内没起来')
  if (!ready) throw new Error('服务没起来，后面的检查没法跑')

  /* 1 鉴权与来源 */
  const noToken = await get('/music/list', { token: '' })
  check('无 token → 401（服务不是裸奔的）', noToken.status === 401, `status=${noToken.status}`)
  const badOrigin = await get('/music/list', { origin: ORIGIN_BAD })
  check('坏 Origin → 403（只认本机页面）', badOrigin.status === 403, `status=${badOrigin.status}`)

  /* 2 列表 + 清单覆盖 */
  const listRes = await get('/music/list')
  const listJson = await listRes.json().catch(() => null)
  const tracks = Array.isArray(listJson?.tracks) ? listJson.tracks : []
  check(
    '/music/list 返回 200 且 tracks 是数组、列出了两首 wav',
    listRes.status === 200 && tracks.filter((t) => String(t.file).endsWith('.wav')).length === 2,
    JSON.stringify({ status: listRes.status, n: tracks.length, files: tracks.map((t) => t.file) }),
  )
  const a = tracks.find((t) => String(t.file).endsWith('a.wav'))
  check(
    'music.json 的**数组**清单覆盖元数据（title/artist 来自清单，不是文件名）',
    a?.title === '清单里的标题' && a?.artist === '清单歌手',
    JSON.stringify(a ?? null),
  )
  check(
    '清单里的 cover 会带出来（图片路径进得了列表）',
    a?.cover === 'cover.jpg' || String(a?.cover ?? '').endsWith('cover.jpg'),
    JSON.stringify({ cover: a?.cover }),
  )
  check(
    'cover.jpg 不会被当成一首曲目（图片白名单没有并进"算曲目"的那个数组）',
    !tracks.some((t) => String(t.file).endsWith('.jpg')),
    JSON.stringify(tracks.map((t) => t.file)),
  )

  /* 3 取音频 + Range */
  const full = await get('/music/file?path=a.wav')
  check(
    '/music/file 取得到音频（200、Content-Type audio/wav）',
    full.status === 200 && full.headers.get('content-type') === 'audio/wav',
    JSON.stringify({ status: full.status, type: full.headers.get('content-type'), len: full.headers.get('content-length') }),
  )
  const ranged = await get('/music/file?path=a.wav', { range: 'bytes=0-99' })
  const rangedBytes = ranged.status === 206 ? (await ranged.arrayBuffer()).byteLength : -1
  check(
    'Range: bytes=0-99 → 206 且**正好 100 字节**（进度条拖动能 seek 的地基）',
    ranged.status === 206 &&
      rangedBytes === 100 &&
      /^bytes 0-99\/256$/.test(String(ranged.headers.get('content-range'))),
    JSON.stringify({ status: ranged.status, bytes: rangedBytes, contentRange: ranged.headers.get('content-range') }),
  )

  /* 4 封面图（2026-10-06 补的白名单） */
  const cover = await get('/music/file?path=cover.jpg')
  check(
    '封面图取得到且 MIME 正确（这次补的图片白名单）',
    cover.status === 200 && cover.headers.get('content-type') === 'image/jpeg',
    JSON.stringify({ status: cover.status, type: cover.headers.get('content-type') }),
  )

  /* 5 穿越与白名单（音频、图片都要拒） */
  const travAudio = await get('/music/file?path=' + encodeURIComponent('../outside/secret.wav'))
  const travImage = await get('/music/file?path=' + encodeURIComponent('../outside/secret.jpg'))
  check(
    '穿越被拒：音频 ../ 越界 → 403（外面那个文件**真的存在**也取不到）',
    travAudio.status === 403,
    `status=${travAudio.status}`,
  )
  check('穿越被拒：**图片** ../ 越界 → 403（图片同样不能穿越）', travImage.status === 403, `status=${travImage.status}`)
  /* ⚠️ 这里**不能**再 `encodeURIComponent` 一遍：那会把 `%2F` 编成 `%25 2F`，
     服务端拿到的是字面量 `..%2F…`（不是穿越路径）→ 只会得到 404，断言就成了假红。
     要么发**单次编码**的原始串（让服务端解码成 `../…` 再判），要么发纯 `../`。两种都测。 */
  const encTrav = await get('/music/file?path=..%2Foutside%2Fsecret.wav')
  check('穿越被拒：编码过的 ..%2F 也拒 → 403', encTrav.status === 403, `status=${encTrav.status}`)
  const decoy = await get('/music/file?path=notes.txt')
  check('白名单外的扩展名（.txt）→ 403', decoy.status === 403, `status=${decoy.status}`)
  const missing = await get('/music/file?path=nope.wav')
  check('目录内不存在的文件 → 404（不是 403，语义要分清）', missing.status === 404, `status=${missing.status}`)

  /* 6 无 token 时连文件也拿不到 */
  const fileNoToken = await get('/music/file?path=a.wav', { token: '' })
  check('/music/file 无 token → 401', fileNoToken.status === 401, `status=${fileNoToken.status}`)
} catch (error) {
  check('验证脚本本身没抛错', false, String(error && error.message ? error.message : error).slice(0, 160))
} finally {
  if (child && !child.killed) child.kill()
  try {
    rmSync(parent, { recursive: true, force: true })
  } catch {
    /* Windows 上偶发占用，留个临时目录无所谓 */
  }
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
