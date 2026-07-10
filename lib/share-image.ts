import type { ShareContentType } from "@/lib/share"

export type ShareImageContentType = ShareContentType

export function detectShareImageContentType(
  bytes: Uint8Array
): ShareContentType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }

  // GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif"
  }

  // WebM / Matroska EBML header
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm"
  }

  // MP4 / ISO BMFF — ftyp box at offset 4
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "video/mp4"
  }

  return null
}

export function shareTypeForContentType(
  contentType: ShareContentType
): "style" | "animate" {
  if (
    contentType === "video/mp4" ||
    contentType === "video/webm" ||
    contentType === "image/gif"
  ) {
    return "animate"
  }
  return "style"
}
