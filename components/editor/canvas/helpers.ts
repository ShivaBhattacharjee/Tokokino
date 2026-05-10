import type * as React from "react"

import { DEVICE_MOCKUP_SPECS } from "@/lib/mockups"
import type { PortraitMode } from "@/lib/editor/store"

export const NOISE_DATA_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/></svg>\")"

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

export function positionFloatingToolbar(target: string, rect: DOMRect) {
  if (typeof document === "undefined") return
  const toolbar = document.querySelector<HTMLElement>(
    `[data-editor-floating-toolbar-target="${CSS.escape(target)}"]`
  )
  if (!toolbar) return

  const flipBelow = rect.top < 80
  toolbar.style.top = `${flipBelow ? rect.bottom + 12 : rect.top - 12}px`
  toolbar.style.left = `${rect.left + rect.width / 2}px`
  toolbar.style.transform = flipBelow
    ? "translate(-50%, 0)"
    : "translate(-50%, -100%)"
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

export function frameFitStyle(aspectRatio: string): React.CSSProperties {
  const ratio = parseAspectRatio(aspectRatio) ?? 16 / 10

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
    `translate(${frameAnchorTravel(anchor.x, "x")}, ${frameAnchorTravel(anchor.y, "y")})`,
    `translate(${offset.x}px, ${offset.y}px)`,
    transform,
    rotationTransform,
  ].join(" ")
}

function frameAnchorTravel(percent: number, axis: "x" | "y") {
  const delta = clamp((percent - 50) / 50, -1, 1)
  if (delta === 0) return "0px"

  const containerUnit = axis === "x" ? "cqw" : "cqh"
  const formattedDelta = Number(delta.toFixed(4))

  return `calc(${formattedDelta} * ((100${containerUnit} - 100%) / 2 + min(18%, 24${containerUnit})))`
}

function mockupScreenAspectWidth(aspectRatio: string) {
  const [width] = aspectRatio.split("/")
  const parsed = Number(width?.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio
    .split("/")
    .map((part) => Number(part.trim()))

  if (!width || !height) return null
  return width / height
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
