import type * as React from "react"

import {
  ARC_BROWSER_FRAME_ID,
  CHROME_BROWSER_FRAME_ID,
  isBrowserFrame,
  SAFARI_BROWSER_FRAME_ID,
} from "@/lib/browser-frame"
import { hexToRgb } from "@/lib/editor/color-utils"
import { shadowDropFilterPreviewCss } from "@/lib/editor/css-utils"
import {
  LIGHTING_IMAGE_VAR,
  LIGHTING_OPACITY_VAR,
} from "@/components/editor/inspector/backdrop-section-parts/constants"
import { DEVICE_MOCKUP_SPECS } from "@/lib/mockups"
import type {
  BackdropLighting,
  PortraitMode,
  ScreenshotLayer,
} from "@/lib/editor/store"

export const NOISE_DATA_URL =
  'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyMDAgMjAwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdmFsdWVzPScwIDAgMCAwIDEgMCAwIDAgMCAxIDAgMCAwIDAgMSAwIDAgMCAxIDAnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbiknIG9wYWNpdHk9JzAuODUnLz48L3N2Zz4=")'

export function portraitOverlayCss(
  mode: PortraitMode,
  intensity: number,
  position = 50,
  distance = 50
): React.CSSProperties | null {
  if (mode === "off") return null
  const t = Math.max(0, Math.min(100, intensity)) / 100
  const px = Math.max(0, Math.min(100, position))
  const d = Math.max(0, Math.min(100, distance))

  if (mode === "blur" || mode === "stage") {
    const blurEm = ((100 - d) * 0.01).toFixed(3)
    const start = px - d
    const center = px
    const end = px + d
    const mask = `linear-gradient(0deg, rgba(100,100,100,1) ${start}%, rgba(100,100,100,0) ${center}%, rgba(100,100,100,1) ${end}%), linear-gradient(0deg, rgba(100,100,100,1) ${start}%, rgba(100,100,100,0) ${center}%, rgba(100,100,100,1) ${end}%)`
    return {
      willChange: "backdrop-filter, mask-image",
      background:
        mode === "stage" ? `rgba(0,0,0,${(0.3 * t).toFixed(3)})` : "none",
      backdropFilter: `blur(${blurEm}em)`,
      WebkitBackdropFilter: `blur(${blurEm}em)`,
      maskImage: mask,
      WebkitMaskImage: mask,
    }
  }

  const dPct = d * 0.4
  switch (mode) {
    case "soft":
      return {
        background: `radial-gradient(ellipse at ${px}% 50%, transparent ${30 + dPct}%, rgba(0,0,0,${0.45 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    case "studio":
      return {
        background: `radial-gradient(ellipse 70% 60% at ${px}% 45%, transparent 0%, transparent ${15 + dPct}%, rgba(0,0,0,${0.85 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    case "spot":
      return {
        background: `radial-gradient(circle at ${px}% 45%, rgba(255,255,255,${0.18 * t}) 0%, transparent ${20 + dPct}%), radial-gradient(circle at ${px}% 45%, transparent ${25 + dPct}%, rgba(0,0,0,${0.7 * t}) 100%)`,
        mixBlendMode: "normal",
      }
    case "frame":
      return {
        boxShadow: `inset 0 0 ${80 * t}px ${30 * t}px rgba(0,0,0,${0.7 * t})`,
        background: "transparent",
      }
    case "iris":
      return {
        background: `radial-gradient(circle at ${px}% 50%, transparent ${25 + dPct}%, rgba(0,0,0,${0.55 * t}) ${50 + dPct}%, rgba(0,0,0,${0.95 * t}) 100%)`,
        mixBlendMode: "multiply",
      }
    default:
      return null
  }
}

function lightSourcePoint(direction: string) {
  if (direction === "center") return { x: 50, y: 50 }
  const match = direction.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/)
  const row = Number(match?.[1])
  const col = Number(match?.[2])
  if (!Number.isFinite(row) || !Number.isFinite(col)) return { x: 50, y: 50 }
  return {
    // Animate-mode lighting uses temporary off-canvas grid points so the glow can
    // enter from the selected side instead of being clamped onto the edge.
    x: clamp(col, -4, 8) * 25,
    y: clamp(row, -4, 8) * 25,
  }
}

function lightRgba(color: string, opacity: number) {
  const { r, g, b } = hexToRgb(color || "#ffffff")
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`
}

function lightGradientDirection(x: number, y: number) {
  if (x === 50 && y === 50) return "to bottom"
  const vertical = y <= 50 ? "bottom" : "top"
  const horizontal = x <= 50 ? "right" : "left"
  return `to ${vertical} ${horizontal}`
}

/**
 * The raw gradient image + opacity for a lighting overlay. Returns null when the
 * light is off (zero intensity). Kept separate from `lightingOverlayCss` so the
 * Animate-mode player can compute the SAME values for an interpolated lighting
 * and push them into the overlay's vars each frame.
 */
export function lightingOverlayValues(
  lighting: BackdropLighting | undefined,
  options: { inner?: boolean } = {}
): { image: string; opacity: number } | null {
  if (!lighting || lighting.intensity <= 0) return null

  const intensity = clamp(lighting.intensity, 0, 100) / 100
  const { x, y } = lightSourcePoint(lighting.direction)
  const strong = lightRgba(lighting.color, options.inner ? 0.56 : 0.62)
  const mid = lightRgba(lighting.color, options.inner ? 0.32 : 0.36)
  const soft = lightRgba(lighting.color, options.inner ? 0.22 : 0.26)

  return {
    image: [
      `radial-gradient(circle at ${x}% ${y}%, ${strong} 0%, ${mid} 22%, transparent 58%)`,
      `linear-gradient(${lightGradientDirection(x, y)}, ${soft} 0%, transparent 62%)`,
    ].join(", "),
    opacity: 0.15 + intensity * 0.85,
  }
}

export function lightingOverlayCss(
  lighting: BackdropLighting | undefined,
  options: { inner?: boolean } = {}
): React.CSSProperties | null {
  const values = lightingOverlayValues(lighting, options)
  if (!values) return null

  // In Animate mode the player overrides the image + opacity per frame (so the
  // light chains between keyframes — its position, strength and colour easing
  // from one to the next). At rest the vars are unset and fall back to the
  // committed values, so the static look is untouched.
  const suffix = options.inner ? "-in" : ""
  return {
    backgroundImage: `var(${LIGHTING_IMAGE_VAR}${suffix}, ${values.image})`,
    opacity:
      `var(${LIGHTING_OPACITY_VAR}${suffix}, ${values.opacity.toFixed(3)})` as unknown as number,
  }
}

export function annotationPath(points: { x: number; y: number }[]) {
  const first = points[0]
  if (!first) return ""
  if (points.length === 1)
    return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y + 0.01}`
  return points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ")
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function frameSelectionRadius(frameId: string, fallback: number) {
  if (frameId === "none") return fallback
  if (frameId === CHROME_BROWSER_FRAME_ID) return 8
  if (frameId === SAFARI_BROWSER_FRAME_ID) return 14
  if (frameId === ARC_BROWSER_FRAME_ID) return 18
  if (isBrowserFrame(frameId)) return 12
  return fallback
}

export function snapCenterToTarget({
  centerX,
  centerY,
  targetX,
  targetY,
  threshold = 8,
}: {
  centerX: number
  centerY: number
  targetX: number
  targetY: number
  threshold?: number
}) {
  const snapX = Math.abs(centerX - targetX) <= threshold
  const snapY = Math.abs(centerY - targetY) <= threshold

  return {
    deltaX: snapX ? targetX - centerX : 0,
    deltaY: snapY ? targetY - centerY : 0,
    guides: { x: snapX, y: snapY },
  }
}

export function snapBoxToTarget({
  centerX,
  centerY,
  width,
  height,
  targetX,
  targetY,
  threshold = 8,
}: {
  centerX: number
  centerY: number
  width: number
  height: number
  targetX: number
  targetY: number
  threshold?: number
}) {
  const xCandidates = [centerX, centerX - width / 2, centerX + width / 2]
  const yCandidates = [centerY, centerY - height / 2, centerY + height / 2]
  const x = nearestSnapDelta(xCandidates, targetX, threshold)
  const y = nearestSnapDelta(yCandidates, targetY, threshold)

  return {
    deltaX: x.delta,
    deltaY: y.delta,
    guides: { x: x.snapped, y: y.snapped },
  }
}

function nearestSnapDelta(
  candidates: number[],
  target: number,
  threshold: number
) {
  let bestDelta = 0
  let bestDistance = Infinity

  for (const candidate of candidates) {
    const delta = target - candidate
    const distance = Math.abs(delta)
    if (distance <= threshold && distance < bestDistance) {
      bestDelta = delta
      bestDistance = distance
    }
  }

  return { delta: bestDelta, snapped: bestDistance !== Infinity }
}

export function positionFloatingToolbar(
  target: string,
  rect: DOMRect,
  scale = 1
) {
  if (typeof document === "undefined") return
  const toolbar = document.querySelector<HTMLElement>(
    `[data-editor-floating-toolbar-target="${CSS.escape(target)}"]`
  )
  if (!toolbar) return

  const flipBelow = rect.top < 80
  const placement = flipBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)"
  toolbar.style.top = `${flipBelow ? rect.bottom + 12 : rect.top - 12}px`
  toolbar.style.left = `${rect.left + rect.width / 2}px`
  toolbar.style.transform =
    scale === 1 ? placement : `${placement} scale(${scale})`
  toolbar.style.transformOrigin = flipBelow ? "top center" : "bottom center"
}

export function deviceMockupSpec(deviceId: string) {
  return (
    DEVICE_MOCKUP_SPECS[deviceId] ?? {
      aspectRatio: "450 / 920",
      screen: {
        aspectRatio: "390 / 844",
        scale: 0.895,
        borderRadius: 0,
      },
    }
  )
}

export function mockupScreenTransform(screen: {
  scale: number
  offsetX?: number
  offsetY?: number
}) {
  const transforms = [`scale(${screen.scale})`]
  if (screen.offsetX) transforms.push(`translateX(${screen.offsetX}%)`)
  if (screen.offsetY) transforms.push(`translateY(${screen.offsetY}%)`)
  return transforms.join(" ")
}

export function mockupScreenClipStyle(
  screen: {
    aspectRatio: string
    borderRadius: number
  },
  stageWidth?: number
): React.CSSProperties {
  const supportsCornerShape =
    typeof CSS !== "undefined" &&
    CSS.supports?.("corner-shape", "superellipse(1.3)")
  const radius = supportsCornerShape
    ? screen.borderRadius
    : Math.max(0, screen.borderRadius - 10)
  const screenWidth = mockupScreenAspectWidth(screen.aspectRatio)
  const borderRadius =
    stageWidth && screenWidth
      ? `${(radius / screenWidth) * stageWidth}px`
      : `calc(${radius / 16} * 1em)`

  return {
    borderRadius,
    ...({
      cornerShape: "var(--theme-corner-shape, superellipse(1.3))",
    } as React.CSSProperties),
  }
}

export function frameFitStyle(
  aspectRatio: string,
  rotation = 0,
  options: { scopeToMinSide?: boolean; fitFraction?: number } = {}
): React.CSSProperties {
  const ratio = parseAspectRatio(aspectRatio) ?? 16 / 10
  const normalizedRotation = Math.abs(rotation % 180)
  const { scopeToMinSide = false, fitFraction = 0.8 } = options

  if (normalizedRotation === 90) {
    const inverseRatio = 1 / ratio
    if (scopeToMinSide) {
      const rotatedFitFraction = Math.min(fitFraction, 0.75)
      return {
        aspectRatio,
        width: "auto",
        height: `min(calc(100cqw * ${rotatedFitFraction}), calc(100cqh * ${rotatedFitFraction} * ${inverseRatio}))`,
        maxWidth: "none",
        maxHeight: "none",
      }
    }
    return {
      aspectRatio,
      width: "auto",
      height: `min(100cqw, calc(100cqh * ${inverseRatio}))`,
      maxWidth: "none",
      maxHeight: "none",
    }
  }

  if (scopeToMinSide) {
    return {
      aspectRatio,
      width: `min(100cqw, calc(100cqh * ${fitFraction} * ${ratio}))`,
      height: "auto",
    }
  }
  return {
    aspectRatio,
    width: `min(100cqw, calc(100cqh * ${ratio}))`,
    height: "auto",
  }
}

export function framePositionTransform({
  anchor,
  offset,
  transform,
  rotation = 0,
}: {
  anchor: { x: number; y: number }
  offset: { x: number; y: number }
  transform: string
  rotation?: number
}) {
  const rotationTransform = rotation ? ` rotate(${rotation}deg)` : ""

  return [
    "translate(-50%, -50%)",
    `translate(var(--editor-main-anchor-x, ${frameAnchorTravel(anchor.x, "x")}), var(--editor-main-anchor-y, ${frameAnchorTravel(anchor.y, "y")}))`,
    `translate(var(--editor-main-offset-x, ${offset.x}px), var(--editor-main-offset-y, ${offset.y}px))`,
    transform,
    rotationTransform,
  ].join(" ")
}

function frameAnchorTravel(percent: number, axis: "x" | "y") {
  const delta = clamp((percent - 50) / 50, -1, 1)
  if (delta === 0) return "0px"

  const containerUnit = axis === "x" ? "cqw" : "cqh"
  const formattedDelta = Number(delta.toFixed(4))

  return `calc(${formattedDelta} * 50${containerUnit})`
}

function mockupScreenAspectWidth(aspectRatio: string) {
  const [width] = aspectRatio.split("/")
  const parsed = Number(width?.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio
    .split("/")
    .map((part) => Number(part.trim()))

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (!width || !height || height <= 0) return null
  return width / height
}

export function isDesktopMockup(deviceId: string) {
  return (
    deviceId.startsWith("macbook") ||
    deviceId.startsWith("imac") ||
    deviceId.includes("display")
  )
}

/**
 * Centralized style block for a positioned device/browser frame box.
 * Used by ScreenshotBrowserFrame, ScreenshotMockup, BrowserFrameEmptyState,
 * and MockupEmptyState — they share the same fit/position/filter math.
 *
 * Pass `layer` only when rendering a content variant (with src); empty-state
 * variants omit it so opacity/blendMode are left unset.
 */
export function framePositionedStyle({
  aspectRatio,
  rotation = 0,
  scopeToMinSide = false,
  fitFraction,
  anchor,
  offset,
  transform,
  shadowFilter,
  enhanceFilter,
  layer,
}: {
  aspectRatio: string
  rotation?: number
  scopeToMinSide?: boolean
  fitFraction?: number
  anchor: { x: number; y: number }
  offset: { x: number; y: number }
  transform: string
  shadowFilter?: string
  enhanceFilter?: string
  layer?: ScreenshotLayer
}): React.CSSProperties {
  const filter =
    [shadowDropFilterPreviewCss(shadowFilter), enhanceFilter]
      .filter(Boolean)
      .join(" ") || undefined

  return {
    ...frameFitStyle(aspectRatio, rotation, {
      scopeToMinSide,
      ...(fitFraction !== undefined ? { fitFraction } : {}),
    }),
    left: "50%",
    top: "50%",
    transform: framePositionTransform({ anchor, offset, transform, rotation }),
    transformOrigin: "center",
    transformStyle: "preserve-3d",
    filter,
    ...(layer
      ? {
          opacity: layer.hidden ? 0 : layer.opacity / 100,
          mixBlendMode:
            layer.blendMode && layer.blendMode !== "normal"
              ? layer.blendMode
              : undefined,
        }
      : null),
  }
}

export function screenshotPlacementStyle(
  dims: {
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  },
  scaleFactor: number,
  positionX: number,
  positionY: number
): React.CSSProperties {
  const visualW = dims.imgW * scaleFactor
  const visualH = dims.imgH * scaleFactor
  const overflowX = Math.min(visualW * 0.18, dims.stageW * 0.24)
  const overflowY = Math.min(visualH * 0.18, dims.stageH * 0.24)

  const visualLeft =
    -overflowX + (dims.stageW - visualW + overflowX * 2) * positionX
  const visualTop =
    -overflowY + (dims.stageH - visualH + overflowY * 2) * positionY

  return {
    left: visualLeft + (visualW - dims.imgW) / 2,
    top: visualTop + (visualH - dims.imgH) / 2,
  }
}
