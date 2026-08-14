import {
  SHARE_RESOLUTION_WIDTH,
  type ExportCaptureOptions,
} from "./export-constants"
import { captureCanvasAsPngBlob } from "./export-still"

// 4 MB — conservative limit that works on all hosting platforms
const CLIENT_MAX_SHARE_BYTES = 4 * 1024 * 1024

async function compressBlobAsJpeg(
  pngBlob: Blob,
  maxBytes: number
): Promise<Blob> {
  const bitmap = await createImageBitmap(pngBlob)
  const offscreen = document.createElement("canvas")
  offscreen.width = bitmap.width
  offscreen.height = bitmap.height
  const ctx = offscreen.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context")
  ctx.drawImage(bitmap, 0, 0)

  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    const jpeg = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", quality)
    )
    if (jpeg && jpeg.size <= maxBytes) return jpeg
  }

  throw new Error(
    "Image is too large to share. Try simplifying the canvas or reducing its size."
  )
}

export async function captureCanvasForShare(
  canvasId: string,
  options: ExportCaptureOptions = { watermark: true }
): Promise<{ blob: Blob; contentType: string }> {
  const pngBlob = await captureCanvasAsPngBlob(
    canvasId,
    SHARE_RESOLUTION_WIDTH,
    options
  )

  if (pngBlob.size <= CLIENT_MAX_SHARE_BYTES) {
    return { blob: pngBlob, contentType: "image/png" }
  }

  const jpegBlob = await compressBlobAsJpeg(pngBlob, CLIENT_MAX_SHARE_BYTES)
  return { blob: jpegBlob, contentType: "image/jpeg" }
}
