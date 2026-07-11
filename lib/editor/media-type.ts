// Screenshots, GIFs, and now short videos all live in the same `screenshot`
// slot as a single src string. GIFs are still plain images (an <img> animates
// them natively), so only real video files need the <video> element + play /
// pause control. Detect those from the src.

const VIDEO_EXTENSION_RE = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i

// Videos are held as object URLs (blob:) instead of base64 data URLs — no ~33%
// inflation, GPU-decoded, and 1 GB files stay cheap. A blob: URL string carries
// no MIME hint, so we remember which ones point at a video.
const videoObjectUrls = new Set<string>()

// Registry mapping every object URL we mint back to its source Blob. The draft
// persistence layer (draft-persistence.ts) reads this on save so it can copy the
// bytes into IndexedDB under an `@idb:` sentinel — otherwise a dead blob: URL
// gets persisted and the video vanishes on the next reload. It's also written to
// during hydration when persistence mints fresh URLs for restored blobs.
const objectUrlBlobs = new Map<string, Blob>()

/**
 * Mint an object URL for a Blob and remember its bytes so the draft persistence
 * layer can round-trip it through IndexedDB. Video-typed blobs are additionally
 * flagged so isVideoSrc() recognises the URL — this is what makes a restored
 * video render as a <video> (not an <img>) after a reload.
 */
export function registerObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  objectUrlBlobs.set(url, blob)
  if (blob.type.startsWith("video/")) videoObjectUrls.add(url)
  return url
}

/** Look the source Blob for a previously registered object URL back up. */
export function getBlobForObjectUrl(
  src: string | null | undefined
): Blob | null {
  if (!src) return null
  return objectUrlBlobs.get(src) ?? null
}

/**
 * Create a session object URL for a video File and remember it as a video so
 * isVideoSrc() can recognise it later. The File's type is video/*, so
 * registerObjectUrl flags it automatically.
 */
export function createVideoObjectUrl(file: File): string {
  return registerObjectUrl(file)
}

/** Release a previously created video object URL (call when it's replaced). */
export function revokeVideoObjectUrl(src: string | null | undefined) {
  if (!src || !videoObjectUrls.has(src)) return
  videoObjectUrls.delete(src)
  objectUrlBlobs.delete(src)
  URL.revokeObjectURL(src)
}

/** True when the given screenshot src should render as a <video>. */
export function isVideoSrc(src: string | null | undefined): boolean {
  if (!src) return false
  if (src.startsWith("data:video/")) return true
  // Any other data: URL (including data:image/gif) is an image.
  if (src.startsWith("data:")) return false
  if (src.startsWith("blob:")) return videoObjectUrls.has(src)
  return VIDEO_EXTENSION_RE.test(src)
}

/** True when a File is a video we accept in the canvas. */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/")
}

/** True when a File is an animated GIF (must skip canvas re-encode to keep it moving). */
export function isGifFile(file: File): boolean {
  return file.type === "image/gif"
}
