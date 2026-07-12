const VIDEO_EXTENSION_RE = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i

export const VIDEO_SIZE_LIMIT = 1024 * 1024 * 1024

// blob: URLs carry no MIME hint, so remember which ones point at a video.
const videoObjectUrls = new Set<string>()

// url → source Blob, so draft persistence can round-trip the bytes through
// IndexedDB (a raw blob: URL is dead after reload).
const objectUrlBlobs = new Map<string, Blob>()

export function registerObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  objectUrlBlobs.set(url, blob)
  if (blob.type.startsWith("video/")) videoObjectUrls.add(url)
  return url
}

export function getBlobForObjectUrl(
  src: string | null | undefined
): Blob | null {
  if (!src) return null
  return objectUrlBlobs.get(src) ?? null
}

export function createVideoObjectUrl(file: File): string {
  return registerObjectUrl(file)
}

export function revokeVideoObjectUrl(src: string | null | undefined) {
  if (!src || !videoObjectUrls.has(src)) return
  videoObjectUrls.delete(src)
  objectUrlBlobs.delete(src)
  URL.revokeObjectURL(src)
}

export function revokeObjectUrl(src: string | null | undefined) {
  if (!src || !objectUrlBlobs.has(src)) return
  videoObjectUrls.delete(src)
  objectUrlBlobs.delete(src)
  URL.revokeObjectURL(src)
}

/** True when the given screenshot src should render as a <video>. */
export function isVideoSrc(src: string | null | undefined): boolean {
  if (!src) return false
  if (src.startsWith("data:video/")) return true
  if (src.startsWith("data:")) return false
  if (src.startsWith("blob:")) return videoObjectUrls.has(src)
  return VIDEO_EXTENSION_RE.test(src)
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/")
}

export function isGifFile(file: File): boolean {
  return file.type === "image/gif"
}

type AudioProbeVideo = HTMLVideoElement & {
  mozHasAudio?: boolean
  webkitAudioDecodedByteCount?: number
  audioTracks?: { length: number }
}

/**
 * Best-effort audio-track check. Assumes audio until the element has decoded
 * enough to prove otherwise (Chromium's byte counter starts at 0 either way).
 */
export function videoElementHasAudio(video: HTMLVideoElement): boolean {
  const v = video as AudioProbeVideo
  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio
  if (v.audioTracks && typeof v.audioTracks.length === "number") {
    return v.audioTracks.length > 0
  }
  if (typeof v.webkitAudioDecodedByteCount === "number") {
    if (v.webkitAudioDecodedByteCount > 0) return true
    return video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  }
  return true
}
