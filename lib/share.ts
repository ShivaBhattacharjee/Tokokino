export const SHARE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ShareType = "style" | "animate"

export type ShareContentType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "video/mp4"
  | "video/webm"

export function isValidShareId(id: string) {
  return SHARE_ID_PATTERN.test(id)
}

export function extensionForShareContentType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? ""
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg"
  if (normalized === "image/gif") return "gif"
  if (normalized === "video/mp4") return "mp4"
  if (normalized === "video/webm") return "webm"
  return "png"
}

/**
 * R2 object key for a share. Historically always `.png`; animate shares use
 * the real media extension. Lookup still goes through objectKey in D1.
 */
export function getShareObjectKey(
  id: string,
  contentType: string = "image/png"
) {
  const ext = extensionForShareContentType(contentType)
  return `shares/${id}.${ext}`
}

/** Legacy key used by pre-video shares (always .png). */
export function getLegacyShareObjectKey(id: string) {
  return `shares/${id}.png`
}

/** R2 object key for an animate share's poster still-frame. */
export function getSharePosterObjectKey(id: string) {
  return `shares/${id}-poster.png`
}

/** Same-origin URL that serves an animate share's poster still-frame. */
export function getSharePosterUrl(id: string, baseUrl?: string | URL) {
  const path = `/api/share/${id}/poster`
  if (!baseUrl) return path
  return new URL(path, baseUrl).toString()
}

export function getShareImageUrl(id: string, baseUrl?: string | URL) {
  const path = `/api/share/${id}/image`
  if (!baseUrl) return path
  return new URL(path, baseUrl).toString()
}

export function getPublicShareImageUrl(id: string, contentType?: string) {
  return `https://assets.tokokino.com/${getShareObjectKey(id, contentType)}`
}

export function isVideoShareContentType(
  contentType: string | null | undefined
) {
  const t = (contentType ?? "").toLowerCase()
  return t.startsWith("video/")
}

export function isAnimateShareContentType(
  contentType: string | null | undefined
) {
  const t = (contentType ?? "").toLowerCase()
  return t.startsWith("video/") || t === "image/gif"
}
