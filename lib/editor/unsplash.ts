/**
 * Unsplash API compliance helpers.
 *
 * Hotlinking: display must use `images.unsplash.com` URLs from `photo.urls.*`
 * so photographer view counts increment. Do not re-host or convert those URLs
 * into data URLs for live editor display.
 *
 * Downloads: when a user chooses a photo, ping `photo.links.download_location`
 * (via `/api/unsplash/download`) so Unsplash can attribute the download.
 */

const UNSPLASH_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
])

export function isUnsplashImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false
    }
    const host = parsed.hostname.toLowerCase()
    return (
      UNSPLASH_IMAGE_HOSTS.has(host) || host.endsWith(".images.unsplash.com")
    )
  } catch {
    return false
  }
}

/** Fire-and-forget download tracking. Failures must never block selection. */
export function trackUnsplashDownload(downloadLocation: string): void {
  const location = downloadLocation.trim()
  if (!location) return

  void fetch(`/api/unsplash/download?url=${encodeURIComponent(location)}`, {
    method: "GET",
    // Survive tab close / navigation so Unsplash still gets the event.
    keepalive: true,
    credentials: "omit",
    cache: "no-store",
  }).catch(() => {
    // Tracking is best-effort; selection must still succeed.
  })
}
