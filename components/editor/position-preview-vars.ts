"use client"

import type { PositionSwipePoint } from "@/components/editor/position-swipe-field"

export const POSITION_X_VAR = "--editor-position-x"
export const POSITION_Y_VAR = "--editor-position-y"
export const MAIN_POSITION_X_VAR = "--editor-main-position-x"
export const MAIN_POSITION_Y_VAR = "--editor-main-position-y"
export const MAIN_ANCHOR_X_VAR = "--editor-main-anchor-x"
export const MAIN_ANCHOR_Y_VAR = "--editor-main-anchor-y"
export const MAIN_OFFSET_X_VAR = "--editor-main-offset-x"
export const MAIN_OFFSET_Y_VAR = "--editor-main-offset-y"
export const MAIN_BARE_LEFT_VAR = "--editor-main-bare-left"
export const MAIN_BARE_TOP_VAR = "--editor-main-bare-top"

export const POSITION_PREVIEW_VARS = [
  POSITION_X_VAR,
  POSITION_Y_VAR,
  MAIN_POSITION_X_VAR,
  MAIN_POSITION_Y_VAR,
  MAIN_ANCHOR_X_VAR,
  MAIN_ANCHOR_Y_VAR,
  MAIN_OFFSET_X_VAR,
  MAIN_OFFSET_Y_VAR,
  MAIN_BARE_LEFT_VAR,
  MAIN_BARE_TOP_VAR,
]

export function setElementPositionPreview(
  element: HTMLElement | null | undefined,
  point: PositionSwipePoint
) {
  if (!element) return
  element.style.setProperty(POSITION_X_VAR, `${point.xPct}%`)
  element.style.setProperty(POSITION_Y_VAR, `${point.yPct}%`)
}

export function setMainScreenshotPositionPreview(
  canvasElement: HTMLElement | null | undefined,
  point: PositionSwipePoint
) {
  if (!canvasElement) return
  canvasElement.style.setProperty(MAIN_POSITION_X_VAR, `${point.xPct}%`)
  canvasElement.style.setProperty(MAIN_POSITION_Y_VAR, `${point.yPct}%`)
  canvasElement.style.setProperty(
    MAIN_ANCHOR_X_VAR,
    frameAnchorTravel(point.xPct, "x")
  )
  canvasElement.style.setProperty(
    MAIN_ANCHOR_Y_VAR,
    frameAnchorTravel(point.yPct, "y")
  )
  canvasElement.style.setProperty(MAIN_OFFSET_X_VAR, "0px")
  canvasElement.style.setProperty(MAIN_OFFSET_Y_VAR, "0px")
  canvasElement.style.setProperty(MAIN_BARE_LEFT_VAR, `${point.xPct}%`)
  canvasElement.style.setProperty(MAIN_BARE_TOP_VAR, `${point.yPct}%`)
}

/**
 * Live-preview the frame-less main screenshot by driving its top-left corner in
 * stage pixels. Once a screenshot exists the image renders without a centering
 * `translate(-50%, -50%)`, so the bare vars must carry the same px box-left the
 * commit will produce — a percentage (as `setMainScreenshotPositionPreview`
 * uses) would shift the image by half its size and make it jump on release.
 */
export function setMainScreenshotBarePreviewPx(
  canvasElement: HTMLElement | null | undefined,
  leftPx: number,
  topPx: number
) {
  if (!canvasElement) return
  canvasElement.style.setProperty(MAIN_BARE_LEFT_VAR, `${leftPx}px`)
  canvasElement.style.setProperty(MAIN_BARE_TOP_VAR, `${topPx}px`)
}

export function clearPositionPreviewVars(
  element: HTMLElement | null | undefined
) {
  if (!element) return
  for (const name of POSITION_PREVIEW_VARS) {
    element.style.removeProperty(name)
  }
}

export function clearPositionPreviewVarsAfterPaint(
  elements: Array<HTMLElement | null | undefined>
) {
  if (typeof requestAnimationFrame === "undefined") {
    for (const element of elements) clearPositionPreviewVars(element)
    return
  }

  requestAnimationFrame(() => {
    for (const element of elements) clearPositionPreviewVars(element)
  })
}

function frameAnchorTravel(percent: number, axis: "x" | "y") {
  const delta = Math.max(-1, Math.min(1, (percent - 50) / 50))
  if (delta === 0) return "0px"

  const containerUnit = axis === "x" ? "cqw" : "cqh"
  const formattedDelta = Number(delta.toFixed(4))
  return `calc(${formattedDelta} * 50${containerUnit})`
}
