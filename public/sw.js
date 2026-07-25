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
const EDITOR_PATH = "/app"

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

  event.respondWith(networkFirst(request, url))
})

async function networkFirst(request, url) {
  try {
    return await fetch(request)
  } catch (error) {
    const cached = await matchShell(request, url)
    if (cached) return cached
    throw error
  }
}

async function matchShell(request, url) {
  const shell = await caches.open(SHELL_CACHE)

  // A document request is the offline entry point: whatever page was asked for,
  // the editor shell is the only thing we can meaningfully serve.
  if (request.mode === "navigate") {
    return (await shell.match(url.pathname)) ?? (await shell.match(EDITOR_PATH))
  }

  return (await shell.match(request)) ?? null
}
