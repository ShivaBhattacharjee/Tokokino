/**
 * Offline service worker.
 *
 * Scope is deliberately narrow: it caches the editor's app shell — the `/app`
 * document and its `_next` chunks — and nothing else. The designs themselves
 * are already on the device (the editor autosaves the whole EditorState, with
 * screenshots and videos as native Blobs, into IndexedDB), so the network is
 * only ever needed to load the code.
 *
 * Every route is network-first: a cached copy is a fallback for a request that
 * failed, never a substitute for one that could have succeeded. That keeps dev
 * HMR and normal browsing byte-for-byte unchanged; the cache only surfaces once
 * the network is actually gone.
 */

const SHELL_CACHE = "tokokino-offline-shell-v1"
/** Written by the client once offline mode is on; absent means opted out. */
const MANIFEST_URL = "/__offline__/manifest"

self.addEventListener("install", () => {
  void self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("tokokino-offline-") && name !== SHELL_CACHE
          )
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(networkFirst(event, request, url))
})

async function networkFirst(event, request, url) {
  try {
    const response = await fetch(request)
    // Top up the shell as chunks fly by. A feature the user had not opened when
    // they switched offline mode on is in neither the performance timeline nor
    // the /app markup, so the initial capture cannot know about it; storing
    // every chunk seen since means opening it once online is enough.
    if (response.ok && isShellAsset(url)) {
      event.waitUntil(topUpShell(request, response.clone()))
    }
    return response
  } catch (error) {
    const cached = await matchShell(request, url)
    if (cached) return cached
    throw error
  }
}

function isShellAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") &&
    !url.pathname.includes("hot-update")
  )
}

async function topUpShell(request, response) {
  const shell = await caches.open(SHELL_CACHE)
  // The manifest is the single source of truth for "offline is on". No
  // manifest, no cache writes.
  if (!(await shell.match(MANIFEST_URL))) return
  await shell.put(request, response)
  // Opt-out drops the manifest before the cache, so a top-up that started
  // before it can still land after. Undo the write rather than leave an entry
  // belonging to a shell generation nobody asked for.
  if (!(await shell.match(MANIFEST_URL))) await shell.delete(request)
}

async function matchShell(request, url) {
  const shell = await caches.open(SHELL_CACHE)

  // Same gate as the write path: without the manifest the user has opted out
  // (or a capture never finished), so anything left over is a superseded
  // generation that must not be served.
  if (!(await shell.match(MANIFEST_URL))) return null

  // Documents are matched on the exact path only. Falling back to the editor
  // for any navigation would answer /login, /terms, /share/:id — or /app/shares
  // — with a page the user never asked for, so routes that were never stored
  // get the browser's own offline page instead. The trailing slash is the one
  // rewrite worth doing: offline there is no server left to redirect /app/.
  if (request.mode === "navigate") {
    const path = url.pathname.replace(/(.)\/$/, "$1")
    return (await shell.match(path)) ?? null
  }

  return (await shell.match(request)) ?? null
}
