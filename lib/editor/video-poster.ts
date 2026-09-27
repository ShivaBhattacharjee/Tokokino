/**
 * Where to seek for the crop dialog's still preview: the playhead the user is
 * cropping against, clamped inside the clip. Only when there is no usable
 * playhead does it fall back to a small nudge off zero — decoding at exactly 0
 * yields a black/empty frame on some codecs, which is why the original code
 * always seeked there, and why cropping six seconds in framed the wrong shot.
 */
export function posterSeekTime(atSec: number, duration: number): number {
  const fallback = Math.min(0.1, duration / 2)
  if (!Number.isFinite(atSec) || atSec <= 0) return fallback
  if (!(duration > 0)) return atSec
  // Never land ON the final boundary — seeking to exactly `duration` decodes
  // past the last frame and paints black.
  return Math.min(atSec, Math.max(0, duration - 0.01))
}

/**
 * Grab a still poster frame from a video src so react-image-crop (which is
 * image-only) has something to draw the crop handles over. The returned frame
 * is only used for handle placement — the video itself is never re-encoded; the
 * caller applies the resulting CropRegion at render time.
 *
 * `atSec` is the playhead the user is cropping against. It matters: framing a
 * crop on frame 0 while the canvas shows six seconds in means placing the
 * handles over content that isn't on screen.
 */
export async function videoPosterBlob(
  url: string,
  atSec = 0,
  maxWidth = Infinity
): Promise<Blob> {
  const video = document.createElement("video")
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.crossOrigin = "anonymous"
  // Explicit load() — required for reliable metadata on Firefox/Safari when the
  // element is created off-DOM (setting src alone is not always enough).
  video.load()

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadeddata = null
        video.onerror = null
        video.onseeked = null
      }
      const onError = () => {
        cleanup()
        reject(new Error("video load failed"))
      }
      const onLoaded = () => {
        const target = posterSeekTime(atSec, video.duration || 0)
        if (
          Number.isFinite(target) &&
          target > 0 &&
          video.currentTime !== target
        ) {
          video.onseeked = () => {
            cleanup()
            resolve()
          }
          video.currentTime = target
        } else {
          cleanup()
          resolve()
        }
      }
      video.onloadeddata = onLoaded
      video.onerror = onError
    })

    const sourceW = video.videoWidth || 1280
    const sourceH = video.videoHeight || 720
    const ratio = Math.min(1, maxWidth / sourceW)
    const w = Math.max(1, Math.round(sourceW * ratio))
    const h = Math.max(1, Math.round(sourceH * ratio))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    ctx.drawImage(video, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    )
    if (!blob) throw new Error("poster encode failed")
    return blob
  } finally {
    // Drop the decoded media even if encoding failed — an off-DOM video can
    // otherwise hold a full-frame buffer until GC.
    video.removeAttribute("src")
    video.load()
  }
}
