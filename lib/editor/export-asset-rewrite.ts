import { shouldProxyAssetUrl } from "./export-assets"

type AssetRewrite = {
  restore: () => void
}

export const URL_FUNCTION_RE = /url\((['"]?)(.*?)\1\)/g
const EXPORT_IMAGE_PROXY_PATH = "/api/export/image"
const EXPORT_ASSET_PRELOAD_TIMEOUT_MS = 12_000

export function proxiedAssetUrl(value: string) {
  const absoluteUrl = new URL(value, window.location.href).toString()
  const params = new URLSearchParams({ url: absoluteUrl })
  return `${EXPORT_IMAGE_PROXY_PATH}?${params.toString()}`
}

function rewriteCssUrls(value: string): { value: string; urls: string[] } {
  const urls: string[] = []
  const rewritten = value.replace(
    URL_FUNCTION_RE,
    (match: string, quote: string, rawUrl: string) => {
      if (!shouldProxyAssetUrl(rawUrl)) return match
      const proxied = proxiedAssetUrl(rawUrl)
      urls.push(proxied)
      return `url(${quote || '"'}${proxied}${quote || '"'})`
    }
  )
  return { value: rewritten, urls }
}

export function rewriteExportAssets(root: HTMLElement): {
  rewrites: AssetRewrite[]
  preloadUrls: string[]
} {
  const rewrites: AssetRewrite[] = []
  const preloadUrls: string[] = []

  for (const img of Array.from(root.querySelectorAll("img"))) {
    const currentSrc = img.getAttribute("src")
    if (!currentSrc || !shouldProxyAssetUrl(currentSrc)) continue

    const nextSrc = proxiedAssetUrl(currentSrc)
    const previousSrc = currentSrc
    const previousCrossOrigin = img.getAttribute("crossorigin")

    img.setAttribute("src", nextSrc)
    img.setAttribute("crossorigin", "anonymous")
    preloadUrls.push(nextSrc)

    rewrites.push({
      restore: () => {
        img.setAttribute("src", previousSrc)
        if (previousCrossOrigin === null) {
          img.removeAttribute("crossorigin")
        } else {
          img.setAttribute("crossorigin", previousCrossOrigin)
        }
      },
    })
  }

  // Swap background thumbnail → full-res source URL for elements that carry
  // data-bg-source-url. The editor renders the thumb for perf; export needs
  // the full image so the output isn't blurry.
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>("[data-bg-source-url]")
  )) {
    const sourceUrl = el.getAttribute("data-bg-source-url")
    if (!sourceUrl) continue
    const exportUrl = shouldProxyAssetUrl(sourceUrl)
      ? proxiedAssetUrl(sourceUrl)
      : sourceUrl
    const previousValue = el.style.backgroundImage
    el.style.backgroundImage = `url("${exportUrl}")`
    preloadUrls.push(exportUrl)
    rewrites.push({
      restore: () => {
        el.style.backgroundImage = previousValue
      },
    })
  }

  const styleProps = [
    "backgroundImage",
    "borderImageSource",
    "listStyleImage",
    "maskImage",
    "webkitMaskImage",
  ] as const

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    for (const prop of styleProps) {
      const currentValue = el.style[prop]
      if (!currentValue || currentValue === "none") continue

      const { value: nextValue, urls } = rewriteCssUrls(currentValue)
      if (nextValue === currentValue) continue

      const previousValue = currentValue
      el.style[prop] = nextValue
      preloadUrls.push(...urls)

      rewrites.push({
        restore: () => {
          el.style[prop] = previousValue
        },
      })
    }
  }

  return { rewrites, preloadUrls }
}

export async function waitForExportAssets(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls))
  await Promise.all(
    uniqueUrls.map(
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
            EXPORT_ASSET_PRELOAD_TIMEOUT_MS
          )
          image.crossOrigin = "anonymous"
          image.onload = finish
          image.onerror = finish
          image.src = url
        })
    )
  )
}
