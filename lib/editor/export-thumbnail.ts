import { proxiedAssetUrl } from "./export-asset-rewrite"
import { shouldProxyAssetUrl } from "./export-assets"
import { captureCanvasAsPngBlob } from "./export-still"

/**
 * Small JPEG thumbnail used by the saved-drafts grid. Renders at 480px wide
 * (enough for sharp retina rendering at typical card sizes) and re-encodes
 * as JPEG quality 0.8 to keep the payload well under the per-request body
 * limit. Returns null if capture fails so the caller can still finish the
 * save without a preview.
 */
export async function captureCanvasThumbnail(
  canvasId: string,
  targetWidth = 480
): Promise<Blob | null> {
  try {
    const pngBlob = await captureCanvasAsPngBlob(canvasId, targetWidth)
    const bitmap = await createImageBitmap(pngBlob)
    const offscreen = document.createElement("canvas")
    offscreen.width = bitmap.width
    offscreen.height = bitmap.height
    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)
    ctx.drawImage(bitmap, 0, 0)
    return await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", 0.8)
    )
  } catch (err) {
    console.warn("Could not capture draft thumbnail", err)
    return null
  }
}

export async function createImageThumbnailBlob(
  source: string,
  targetWidth = 480
): Promise<Blob | null> {
  if (!source) return null

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Could not load thumbnail source"))
      if (shouldProxyAssetUrl(source)) {
        img.crossOrigin = "anonymous"
        img.src = proxiedAssetUrl(source)
      } else {
        img.src = source
      }
    })

    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return null

    const width = Math.min(targetWidth, sourceWidth)
    const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width))
    const offscreen = document.createElement("canvas")
    offscreen.width = width
    offscreen.height = height

    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", 0.8)
    )
  } catch (err) {
    console.warn("Could not create image thumbnail", err)
    return null
  }
}
