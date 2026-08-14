import { URL_FUNCTION_RE } from "./export-asset-rewrite"

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("FileReader did not return a string"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"))
    reader.readAsDataURL(blob)
  })
}

export async function waitForImageElement(
  img: HTMLImageElement
): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return
  await new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true })
    img.addEventListener("error", () => resolve(), { once: true })
  })
}

/**
 * Inline every <img> in the export clone as a data URL. Preloading assets in
 * separate Image() objects does not update the cloned DOM nodes, so html-to-image
 * can otherwise paint stale decoded frames when a reused <img> src changes
 * between tweets (e.g. avatar from the previous post).
 */
export async function embedCloneImages(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src")
      if (!src) return

      if (!src.startsWith("data:")) {
        try {
          const response = await fetch(src, { credentials: "omit" })
          if (response.ok) {
            const dataUrl = await readBlobAsDataUrl(await response.blob())
            img.src = dataUrl
            img.removeAttribute("crossorigin")
          }
        } catch {
          /* keep original src and wait below */
        }
      }

      await waitForImageElement(img)
    })
  )
}

/** Every distinct `data:` image the clone will ask the SVG raster to paint. */
export function collectEmbeddedImageUrls(root: HTMLElement): string[] {
  const urls = new Set<string>()

  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src")
    if (src?.startsWith("data:image/")) urls.add(src)
  }

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const value = el.style.backgroundImage
    if (!value || !value.includes("url(")) continue
    for (const match of value.matchAll(URL_FUNCTION_RE)) {
      const url = match[2]
      if (url?.startsWith("data:image/")) urls.add(url)
    }
  }

  return Array.from(urls)
}

/** Bound the warm-up so one pathological decode cannot hang an export. */
const EMBEDDED_DECODE_TIMEOUT_MS = 8_000

/**
 * Decode every embedded image once, in this document, before the SVG raster
 * asks for them.
 *
 * This is the cause of the settling loop rather than another mitigation of it.
 * WebKit paints an SVG image's `<foreignObject>` with whatever subresources have
 * decoded at that instant, which is why an export could come back missing the
 * screenshot — and why re-rasterizing the same SVG gradually recovers it, each
 * attempt leaving more of the decode cache warm. Warming those decodes directly
 * costs one pass over the images instead of repeated passes over a
 * multi-megabyte SVG, and it happens before the first raster rather than after
 * several bad ones.
 *
 * It reduces the race, it does not close it: the cache is the engine's to
 * evict, and nothing here can prove the raster used it. `settleRasterCanvas`
 * still backs it up.
 */
export async function warmEmbeddedImageDecodes(
  root: HTMLElement
): Promise<void> {
  const urls = collectEmbeddedImageUrls(root)
  if (urls.length === 0) return

  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image()
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            resolve()
          }
          const timeoutId = window.setTimeout(
            finish,
            EMBEDDED_DECODE_TIMEOUT_MS
          )
          image.onerror = finish
          image.src = url
          // decode() resolves only once the bitmap is ready to paint; the load
          // event alone would put us back to guessing.
          image.decode().then(finish, finish)
        })
    )
  )
}

/**
 * Inline every CSS `background-image: url(...)` in the clone as a data URI.
 *
 * Animation export reuses ONE clone and calls html-to-image ~200 times, mutating
 * the crossfade layers' opacity between captures. html-to-image caches fetched
 * remote images and, with a reused node, pins each background-image element's
 * rendered state to the FIRST capture — so opacity changes on those elements
 * never register and the exported background freezes on a single frame. Embedding
 * the images as data URIs removes the fetch (and its cache) entirely, so every
 * frame re-reads the current opacity. (`<img>` layers are handled by
 * `embedCloneImages`; this is the background-image equivalent.)
 */
export async function embedCloneBackgroundImages(
  root: HTMLElement
): Promise<void> {
  const cache = new Map<string, Promise<string | null>>()
  const fetchDataUrl = (url: string): Promise<string | null> => {
    const existing = cache.get(url)
    if (existing) return existing
    const p = (async () => {
      try {
        const response = await fetch(url, { credentials: "omit" })
        if (!response.ok) return null
        return await readBlobAsDataUrl(await response.blob())
      } catch {
        return null
      }
    })()
    cache.set(url, p)
    return p
  }

  const jobs: Promise<void>[] = []
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const value = el.style.backgroundImage
    if (!value || !value.includes("url(")) continue
    const matches = Array.from(value.matchAll(URL_FUNCTION_RE))
    if (matches.length === 0) continue
    jobs.push(
      (async () => {
        let next = value
        for (const m of matches) {
          const raw = m[2]
          if (!raw || raw.startsWith("data:")) continue
          const dataUrl = await fetchDataUrl(raw)
          if (dataUrl) next = next.split(m[0]).join(`url("${dataUrl}")`)
        }
        if (next !== value) el.style.backgroundImage = next
      })()
    )
  }
  await Promise.all(jobs)
}
