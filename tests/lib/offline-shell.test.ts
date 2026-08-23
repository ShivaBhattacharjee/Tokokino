import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cacheEditorShell,
  type OfflineProgress,
} from "@/lib/offline/offline-shell"

vi.mock("@/lib/editor/animation-export/video-media/dav1d-preload", () => ({
  dav1dWasmUrl: "https://editor.test/_next/static/media/decoder.wasm",
  preloadDav1dChunk: () => Promise.resolve(),
}))

const ORIGIN = "https://editor.test"
const CHUNK_A = "/_next/static/chunks/first_0abcdef._.js"
const CHUNK_B = "/_next/static/chunks/second_0fedcba._.js"
const STALE_CHUNK = `${ORIGIN}/_next/static/chunks/rebuilt_0000000._.js`

/**
 * The flight payload is emitted as a run of `self.__next_f.push` calls whose
 * string fragments are cut at arbitrary offsets — here mid-way through
 * {@link CHUNK_B}, which is what used to strand a truncated URL in the capture.
 */
function editorHtml() {
  const head = `<script src="${CHUNK_A}"></script>`
  const split = CHUNK_B.length - 8
  const first = JSON.stringify(`["${CHUNK_A}","${CHUNK_B.slice(0, split)}`)
  const second = JSON.stringify(`${CHUNK_B.slice(split)}"]`)
  return `<html><head>${head}</head><body>
    <script>self.__next_f.push([1,${first}])</script>
    <script>self.__next_f.push([1,${second}])</script>
  </body></html>`
}

class FakeCache {
  entries = new Map<string, Response>()
  match(request: string) {
    return Promise.resolve(this.entries.get(String(request)))
  }
  put(request: string, response: Response) {
    this.entries.set(String(request), response)
    return Promise.resolve()
  }
  delete(request: string) {
    return Promise.resolve(this.entries.delete(String(request)))
  }
}

let cache: FakeCache
let requested: string[]

beforeEach(() => {
  cache = new FakeCache()
  requested = []

  vi.stubGlobal("caches", {
    open: () => Promise.resolve(cache),
    delete: () => Promise.resolve(true),
  })
  vi.stubGlobal("location", { origin: ORIGIN })
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: () => Promise.resolve(),
      ready: Promise.resolve(),
      getRegistrations: () => Promise.resolve([]),
    },
  })
  vi.stubGlobal("performance", {
    getEntriesByType: () => [
      { name: `${ORIGIN}${CHUNK_A}` },
      // A chunk this session loaded that the dev server has since rebuilt.
      { name: STALE_CHUNK },
      { name: `${ORIGIN}/_next/static/chunks/x.hot-update.js` },
    ],
  })
  vi.stubGlobal("fetch", (input: string) => {
    const url = String(input)
    requested.push(url)
    if (url === "/app") {
      return Promise.resolve(new Response(editorHtml(), { status: 200 }))
    }
    if (url === STALE_CHUNK || !url.startsWith(ORIGIN)) {
      return Promise.resolve(new Response("", { status: 404 }))
    }
    return Promise.resolve(new Response("chunk", { status: 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("cacheEditorShell", () => {
  it("stores a chunk URL that was split across two flight fragments", async () => {
    await cacheEditorShell(() => {})

    expect(requested).toContain(`${ORIGIN}${CHUNK_B}`)
    expect(cache.entries.has(`${ORIGIN}${CHUNK_B}`)).toBe(true)
  })

  it("never requests a truncated fragment boundary", async () => {
    await cacheEditorShell(() => {})

    const truncated = requested.filter(
      (url) =>
        url.startsWith(`${ORIGIN}/_next/`) &&
        !url.endsWith(".js") &&
        !url.endsWith(".wasm")
    )
    expect(truncated).toEqual([])
  })

  it("survives a stale chunk and still finishes the progress bar", async () => {
    const updates: OfflineProgress[] = []
    const record = await cacheEditorShell((progress) => updates.push(progress))

    const last = updates.at(-1)
    expect(last?.current).toBe(last?.total)
    // The stale chunk and the two optional decorations are counted as done but
    // not as stored, which is what used to leave the bar short of the end.
    expect(record.files).toBeLessThan(last?.total ?? 0)
  })

  it("fails the capture when a chunk the next boot needs is missing", async () => {
    vi.stubGlobal("fetch", (input: string) => {
      const url = String(input)
      if (url === "/app") {
        return Promise.resolve(new Response(editorHtml(), { status: 200 }))
      }
      if (url === `${ORIGIN}${CHUNK_B}`) {
        return Promise.resolve(new Response("", { status: 404 }))
      }
      return Promise.resolve(new Response("chunk", { status: 200 }))
    })

    await expect(cacheEditorShell(() => {})).rejects.toThrow(/1 of \d+/)
  })
})
