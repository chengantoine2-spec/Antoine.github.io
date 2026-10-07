/* 最小 Service Worker —— 只缓存「应用外壳」，别的一律不碰。
 *
 * 刻意不做的事（都是会咬人的）：
 *   ⚠️ **不缓存 `api.github.com`**：博客正文是 Issues，缓存下来就会「明明改了却看不到」。
 *   ⚠️ **不缓存跨域资源（含 jsDelivr 上的 img 分支图片）**：`url.origin !== self.location.origin` 直接放行，
 *      免得图片被长期钉在旧版本上。
 *   ⚠️ **不缓存本机服务（终端 5180 / DSH 3080）**：那些是实时数据。
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
  /* 跨域（GitHub API、jsDelivr 图片、DSH…）一律放行，不缓存 */
  if (url.origin !== self.location.origin) return
  /* 本机服务的实时数据不缓存 */
  if (url.pathname.includes('/api/') || url.port === '5180' || url.port === '3080') return

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
