import type { CSSProperties } from "react"

import type { FullPageCapture } from "./state-types"

type ImageFit = "contain" | "cover" | "fill"

const MIN_SCROLL_POSITION = 0
const MAX_SCROLL_POSITION = 100
const WHEEL_PIXELS_PER_PERCENT = 12

export function fullPageCaptureMediaStyle(
  capture: FullPageCapture | null | undefined
): CSSProperties | undefined {
  if (!capture) return undefined
  return { objectPosition: `50% ${capture.scrollPosition}%` }
}

export function fullPageCaptureObjectFit(
  capture: FullPageCapture | null | undefined,
  fallback: ImageFit
): ImageFit {
  return capture ? "cover" : fallback
}

export function nextFullPageCaptureScrollPosition(
  deltaY: number,
  current: number
) {
  return Math.max(
    MIN_SCROLL_POSITION,
    Math.min(MAX_SCROLL_POSITION, current + deltaY / WHEEL_PIXELS_PER_PERCENT)
  )
}
