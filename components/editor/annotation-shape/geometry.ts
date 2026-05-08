import type { AnnotationBlurEffect, AnnotationShape } from "@/lib/editor/store"

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function getBlurEffect(shape: AnnotationShape): AnnotationBlurEffect {
  return shape.blurEffect ?? "blur"
}

export function getBlurAmount(shape: AnnotationShape) {
  return clamp(shape.blurAmount ?? 14, 2, 32)
}

export function lineDashArray(style: AnnotationShape["lineStyle"]) {
  if (style === "dashed") return "5 3"
  if (style === "dotted") return "2.2 2.2"
  return undefined
}

export function scaledLineDashArray(
  style: AnnotationShape["lineStyle"],
  strokeWidth: number
) {
  if (style === "dashed") return `${strokeWidth * 2.2} ${strokeWidth * 1.35}`
  if (style === "dotted") return `0.1 ${strokeWidth * 1.75}`
  return undefined
}

export function getArrowGeometry(
  width: number,
  height: number,
  strokeWidth: number
) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const visualStrokeWidth = clamp(
    strokeWidth * 2.8,
    8,
    Math.max(8, safeHeight * 0.58)
  )
  const pad = Math.max(visualStrokeWidth / 2, 1)
  const centerY = safeHeight / 2
  const tipX = Math.max(pad, safeWidth - pad)
  const tailX = Math.min(pad, tipX - 1)
  const availableLength = Math.max(1, tipX - tailX)
  const targetHead = clamp(visualStrokeWidth * 3.2, 28, 72)
  const headLength = Math.min(targetHead, availableLength * 0.42)
  const headSpread = Math.min(
    targetHead * 0.72,
    Math.max(4, safeHeight / 2 - pad)
  )
  const headBaseX = Math.max(tailX, tipX - headLength)
  const topY = clamp(centerY - headSpread, pad, safeHeight - pad)
  const bottomY = clamp(centerY + headSpread, pad, safeHeight - pad)

  return {
    width: safeWidth,
    height: safeHeight,
    tailX,
    tipX,
    centerY,
    strokeWidth: visualStrokeWidth,
    headPoints: `${headBaseX},${topY} ${tipX},${centerY} ${headBaseX},${bottomY}`,
  }
}

export function getArrowEndpoints(
  shape: AnnotationShape,
  canvasW: number,
  canvasH: number
) {
  const centerX = (shape.xPct / 100) * canvasW
  const centerY = (shape.yPct / 100) * canvasH
  const length = (shape.widthPct / 100) * canvasW
  const theta = ((shape.rotation ?? 0) * Math.PI) / 180
  const dx = (Math.cos(theta) * length) / 2
  const dy = (Math.sin(theta) * length) / 2

  return {
    tail: {
      xPct: ((centerX - dx) / canvasW) * 100,
      yPct: ((centerY - dy) / canvasH) * 100,
    },
    head: {
      xPct: ((centerX + dx) / canvasW) * 100,
      yPct: ((centerY + dy) / canvasH) * 100,
    },
  }
}
