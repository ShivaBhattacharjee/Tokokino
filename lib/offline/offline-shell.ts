"use client"

/**
 * Client half of the offline feature: it fills the cache that `public/sw.js`
 * reads back. Only the editor's code is stored — the designs are already local
 * (see `lib/editor/store/draft-persistence.ts`, which autosaves the whole
 * EditorState with its screenshots and videos as native Blobs), so nothing here
 * touches the network beyond fetching the app shell.
 */

/** Kept in sync with the cache name in `public/sw.js`. */
const SHELL_CACHE = "tokokino-offline-shell-v1"
const MANIFEST_URL = "/__offline__/manifest"
const SERVICE_WORKER_URL = "/sw.js"
const EDITOR_PATH = "/app"
/** Enough parallelism to saturate a connection without stalling the UI thread. */
const SHELL_CONCURRENCY = 6
/** Decorative — the editor still boots without them, so they may 404. */
const OPTIONAL_SHELL_URLS = ["/favicon.ico", "/logo.png"]

export type OfflineShellRecord = {
  savedAt: string
  /** How many shell files were stored. */
  files: number
  /** Total bytes they occupy. */
  bytes: number
}

export type OfflineProgress = {
  label: string
  /** Files stored so far. */
  current: number
  /** Files to store, or 0 while the list is still being worked out. */
  total: number
}

export function isOfflineSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "caches" in window
  )
}

export async function registerOfflineServiceWorker() {
  if (!isOfflineSupported()) {
    throw new Error("This browser cannot keep the editor offline")
  }
  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" })
  await navigator.serviceWorker.ready
}

export async function getOfflineShell(): Promise<OfflineShellRecord | null> {
  if (!isOfflineSupported()) return null
  try {
    const cache = await caches.open(SHELL_CACHE)
    const stored = await cache.match(MANIFEST_URL)
    if (!stored) return null
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- json() is unknown under strict DOM typings
    const record = (await stored.json()) as OfflineShellRecord | null
    return record?.savedAt ? record : null
  } catch {
    return null
  }
}

/** Drops the cache and the worker, so nothing is left serving stale code. */
export async function clearOfflineShell() {
  if (!isOfflineSupported()) return
  // Delete the manifest before the cache. The worker gates both reads and
  // top-up writes on it, so this one statement is what actually ends offline
  // mode — a top-up already in flight cannot outlive it.
  const shell = await caches.open(SHELL_CACHE)
  await shell.delete(MANIFEST_URL)
  await caches.delete(SHELL_CACHE)
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations
      .filter((registration) =>
        registration.active?.scriptURL.endsWith(SERVICE_WORKER_URL)
      )
      .map((registration) => registration.unregister())
  )
}

/**
 * Store the editor's code so `/app` boots with no network. Designs need no
 * work here — they are restored from IndexedDB by the store as usual.
 */
export async function cacheEditorShell(
  onProgress: (progress: OfflineProgress) => void
): Promise<OfflineShellRecord> {
  await registerOfflineServiceWorker()
  // Start clean so a stale chunk from a previous build can never be served.
  await caches.delete(SHELL_CACHE)
  const shell = await caches.open(SHELL_CACHE)

  onProgress({ label: "Preparing…", current: 0, total: 0 })
  const urls = await collectShellUrls(shell)

  let stored = 0
  let bytes = 0
  // A chunk that never landed means the next offline boot fails on it, so the
  // manifest must not claim success — the caller drops the whole cache instead
  // of leaving a shell that only looks ready.
  const missing: string[] = []
  onProgress({ label: "Saving the editor…", current: 0, total: urls.length })
  await mapWithConcurrency(urls, SHELL_CONCURRENCY, async (url) => {
    const size = await cacheUrl(shell, url)
    if (size === null) {
      if (!OPTIONAL_SHELL_URLS.includes(url)) missing.push(url)
    } else {
      bytes += size
      stored += 1
    }
    onProgress({
      label: "Saving the editor…",
      current: stored,
      total: urls.length,
    })
  })

  if (missing.length > 0) {
    console.error("[offline] Could not store shell files", missing)
    throw new Error(
      `Could not store ${missing.length} of ${urls.length} editor files`
    )
  }

  const record: OfflineShellRecord = {
    savedAt: new Date().toISOString(),
    files: stored,
    bytes,
  }
  await shell.put(
    MANIFEST_URL,
    new Response(JSON.stringify(record), {
      headers: { "Content-Type": "application/json" },
    })
  )
  return record
}

/**
 * The URLs an offline boot of the editor needs. Three sources, because none is
 * complete on its own: the performance timeline knows every chunk this session
 * actually executed, the document markup lists the chunks the next boot will
 * request before any of that code runs, and the lazy AV1 fallback appears in
 * neither until it is deliberately warmed below.
 */
async function collectShellUrls(shell: Cache) {
  const urls = new Set<string>(OPTIONAL_SHELL_URLS)

  // The editor's one lazily loaded feature — the AV1 export fallback — is in
  // neither source below until something has triggered it, so a capture taken
  // before it was ever used would omit it. Pull its chunk in (without building
  // a decoder) and name its WASM payload outright.
  const { dav1dWasmUrl, preloadDav1dChunk } =
    await import("@/lib/editor/animation-export/video-media/dav1d-preload")
  await preloadDav1dChunk()
  urls.add(dav1dWasmUrl)

  for (const entry of performance.getEntriesByType("resource")) {
    if (!entry.name.startsWith(`${location.origin}/`)) continue
    const path = new URL(entry.name).pathname
    if (!path.startsWith("/_next/")) continue
    // Dev-only traffic that is meaningless (and stale) offline.
    if (path.includes("hot-update") || path.includes("webpack-hmr")) continue
    urls.add(entry.name)
  }

  const response = await fetch(EDITOR_PATH, { credentials: "include" })
  if (!response.ok) {
    throw new Error("Could not download the editor")
  }
  const html = await response.text()
  await shell.put(
    EDITOR_PATH,
    new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  )
  for (const match of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) {
    urls.add(new URL(match[0], location.origin).toString())
  }

  return [...urls]
}

/** Caches one URL. Returns the bytes stored, or null if it did not land. */
async function cacheUrl(cache: Cache, url: string) {
  try {
    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) return null
    const body = await response.blob()
    const contentType = response.headers.get("Content-Type")
    await cache.put(
      url,
      new Response(body, {
        headers: contentType ? { "Content-Type": contentType } : undefined,
      })
    )
    return body.size
  } catch {
    return null
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
) {
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++]
        await run(item)
      }
    }
  )
  await Promise.all(workers)
}
