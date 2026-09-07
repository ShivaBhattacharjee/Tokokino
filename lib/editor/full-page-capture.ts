import type { CSSProperties } from "react"

import type { FullPageCapture } from "./state-types"

type ImageFit = "contain" | "cover" | "fill"

const MIN_SCROLL_POSITION = 0
const MAX_SCROLL_POSITION = 100
const WHEEL_PIXELS_PER_PERCENT = 36
const MAX_WHEEL_DELTA_PX = 48

export function fullPageCaptureMediaStyle(
  capture: FullPageCapture | null | undefined
): CSSProperties | undefined {
  if (!capture) return undefined
  return {
    objectPosition: `50% ${capture.scrollPosition}%`,
    transition: "object-position 180ms ease-out",
    willChange: "object-position",
  }
}

export function fullPageCaptureObjectFit(
  capture: FullPageCapture | null | undefined,
  fallback: ImageFit
): ImageFit {
  return capture ? "cover" : fallback
}

export function nextFullPageCaptureScrollPosition(
  deltaY: number,
  current: number,
  deltaMode = 0
) {
  const deltaPx =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  const clamped = Math.max(
    -MAX_WHEEL_DELTA_PX,
    Math.min(MAX_WHEEL_DELTA_PX, deltaPx)
  )
  return Math.max(
    MIN_SCROLL_POSITION,
    Math.min(MAX_SCROLL_POSITION, current + clamped / WHEEL_PIXELS_PER_PERCENT)
  )
}
