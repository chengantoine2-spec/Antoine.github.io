/* 最小 Service Worker —— 只缓存「应用外壳」，别的一律不碰。
 *
 * 刻意不做的事（都是会咬人的）：
 *   ⚠️ **不缓存 `api.github.com`**：博客正文是 Issues，缓存下来就会「明明改了却看不到」。
 *   ⚠️ **不缓存跨域资源（含 jsDelivr 上的 img 分支图片）**：`url.origin !== self.location.origin` 直接放行，
 *      免得图片被长期钉在旧版本上。
 *   ⚠️ **不缓存本机服务（终端 5180 / DSH 3080 / 音乐库）**：那些是实时数据。
 *      音乐库的音频与封面走的是**同一个服务、同一个端口**，只是路径在 `/music/` 下 ——
 *      见下面 `shouldBypass()` 的三条规则（跨域 / 本机服务路径 / 本机服务端口）。
 *
 * 路径一律用**相对**的（`./`、`./index.html`…）：本项目部署在子路径 `/Antoine.github.io/` 下，
 * SW 的 `self.location` 就在那个子路径里，相对路径天然带对前缀 —— 写死 `/` 会 404（项目老坑）。
 * manifest 里的 `start_url` / `scope` 同理用 `"."`。
 */

const VERSION = 'v1'
const CACHE = `celery-shell-${VERSION}`
/* 外壳：入口 + manifest + 站标。构建产物（/assets/*.js、*.css）不在这里预列 ——
   它们的文件名带哈希，改用下面的"抓到就存"策略。 */
const SHELL = ['./', './index.html', './manifest.webmanifest', './logo.svg', './logo.png']

/* 本机服务的端口：终端 5180、DSH 3080。音乐库走的是**同一个服务**、同一个端口。 */
const LOCAL_SERVICE_PORTS = new Set(['5180', '3080'])

/* 该不该**放行**（= 一律不进缓存）。
   特意写成**具名纯函数**：`tools/verify-music.mjs` 会把这段源码抽出来、**真跑**几个 URL
   —— 弱断言"文件里有 /music/ 字样"证明不了规则真的命中。
   三条规则：① 跨域一律放行（GitHub API / jsDelivr 图片 / 本机服务都算跨域）；
   ② 本机服务的路径一律放行（`/api/` 与 `/music/`）；③ 本机服务端口一律放行。 */
function shouldBypass(url, origin) {
  if (url.origin !== origin) return true
  if (url.pathname.includes('/api/') || url.pathname.includes('/music/')) return true
  if (LOCAL_SERVICE_PORTS.has(url.port)) return true
  return false
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  /* 跨域（GitHub API、jsDelivr 图片、DSH…）与本机服务的实时数据（终端 / **音乐库**）一律放行 */
  if (shouldBypass(url, self.location.origin)) return

  /* 导航请求：网络优先；断网时回退到缓存的外壳（首页） */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((hit) => hit ?? Response.error())),
    )
    return
  }

  /* 静态资源（构建产物 / 站标 / 图标）：缓存优先，抓到就存一份 */
  const isStatic =
    /\/assets\//.test(url.pathname) || /\.(?:js|css|svg|png|webp|jpg|jpeg|ico|woff2?)$/.test(url.pathname)
  if (!isStatic) return
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
