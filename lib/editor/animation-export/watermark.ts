/**
 * "Designed by Tokokino" watermark: preload the logo, then paint the mark onto
 * each frame canvas so it survives every encoder (GIF / WebCodecs /
 * MediaRecorder) without touching the DOM capture clone.
 */

import type { WatermarkAssets } from "./types"

const WATERMARK_LOGO_SRC = "/logo.png"
const WATERMARK_PREFIX = "Designed by"
const WATERMARK_APP_NAME = "Tokokino"
// Generic fallbacks only — the real Inter family is resolved at runtime (see
// resolveWatermarkFontStack). "Inter" is kept as a hint for the rare browser
// that does have it installed system-wide.
const WATERMARK_FALLBACK_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/**
 * Preload the watermark logo once before the frame loop. Same-origin (`/logo.png`)
 * so it never taints the canvas that GIF export reads back via getImageData.
 * Resolves to `null` on failure so the text-only watermark still renders.
 */
export function loadWatermarkLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = WATERMARK_LOGO_SRC
  })
}

/**
 * Read the actual Inter family injected by next/font. It lives on the document
 * under `--font-inter` as a hashed name like `"__Inter_abc123"`, so a canvas
 * `ctx.font` of `"Inter"` would never match it. A probe element resolves the
 * real name; we return the full computed list so its own fallback is preserved.
 */
function resolveInterFamily(): string | null {
  if (typeof document === "undefined") return null
  const probe = document.createElement("span")
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;font-family:var(--font-inter)"
  document.body.appendChild(probe)
  const family = getComputedStyle(probe).fontFamily
  document.body.removeChild(probe)
  const trimmed = family?.trim()
  return trimmed ? trimmed : null
}

/**
 * Resolve and preload the watermark font before the frame loop so canvas text
 * rasterizes with Inter identically on every OS instead of falling back to each
 * platform's `system-ui`. Returns a font stack ready to hand to `ctx.font`.
 * Always resolves — on any failure it degrades to the generic stack.
 */
export async function resolveWatermarkFontStack(): Promise<string> {
  const inter = resolveInterFamily()
  const stack = inter
    ? `${inter}, ${WATERMARK_FALLBACK_STACK}`
    : WATERMARK_FALLBACK_STACK

  if (inter && typeof document !== "undefined" && document.fonts) {
    // Load only the primary (hashed) family in the weights the mark uses; the
    // computed list's trailing fallback isn't a loadable web font.
    const primary = inter.split(",")[0]?.trim()
    if (primary) {
      try {
        await Promise.all([
          document.fonts.load(`500 16px ${primary}`),
          document.fonts.load(`700 16px ${primary}`),
        ])
      } catch {
        /* fall through — the fallback stack still renders */
      }
    }
  }
  return stack
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Bottom-left "Designed by Tokokino" watermark, painted straight onto the frame
 * canvas so it survives every encoder (GIF / WebCodecs / MediaRecorder) without
 * touching the DOM capture clone. Scales with the frame's shorter edge.
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assets: WatermarkAssets
) {
  const minEdge = Math.max(1, Math.min(width, height))
  const scale = Math.max(0.72, Math.min(1.6, minEdge / 720))
  const margin = Math.round(18 * scale)
  const padX = Math.round(12 * scale)
  const padY = Math.round(9 * scale)
  const gap = Math.round(9 * scale)
  const logoSize = Math.round(26 * scale)
  const prefixSize = Math.round(11 * scale)
  const nameSize = Math.round(17 * scale)
  const lineGap = Math.round(2 * scale)
  const logo = assets.logo
  const fontStack = assets.fontStack || WATERMARK_FALLBACK_STACK

  ctx.save()
  // Keep the whole mark subtle so it reads as a credit, not a banner.
  ctx.globalAlpha = 0.32

  ctx.font = `500 ${prefixSize}px ${fontStack}`
  const prefixWidth = ctx.measureText(WATERMARK_PREFIX).width
  ctx.font = `700 ${nameSize}px ${fontStack}`
  const nameWidth = ctx.measureText(WATERMARK_APP_NAME).width
  const textWidth = Math.max(prefixWidth, nameWidth)
  const textHeight = prefixSize + lineGap + nameSize

  const logoBlock = logo ? logoSize + gap : 0
  const contentW = logoBlock + textWidth
  const contentH = Math.max(logo ? logoSize : 0, textHeight)

  const pillW = contentW + padX * 2
  const pillH = contentH + padY * 2
  const pillX = margin
  const pillY = height - margin - pillH

  traceRoundRect(ctx, pillX, pillY, pillW, pillH, Math.round(10 * scale))
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)"
  ctx.fill()

  const centerY = pillY + pillH / 2
  const contentX = pillX + padX
  let textX = contentX
  if (logo) {
    try {
      ctx.drawImage(logo, contentX, centerY - logoSize / 2, logoSize, logoSize)
    } catch {
      /* ignore a broken logo — keep the text */
    }
    textX = contentX + logoSize + gap
  }

  const textTop = centerY - textHeight / 2
  ctx.textBaseline = "top"
  ctx.font = `500 ${prefixSize}px ${fontStack}`
  ctx.fillStyle = "rgba(255, 255, 255, 0.74)"
  ctx.fillText(WATERMARK_PREFIX, textX, textTop)
  ctx.font = `700 ${nameSize}px ${fontStack}`
  ctx.fillStyle = "rgba(255, 255, 255, 0.97)"
  ctx.fillText(WATERMARK_APP_NAME, textX, textTop + prefixSize + lineGap)

  ctx.restore()
}
