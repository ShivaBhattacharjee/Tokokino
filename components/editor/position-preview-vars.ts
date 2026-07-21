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

/**
 * Live-preview the multi-row / framed main screenshot by driving its container
 * left/top (and zeroing the offset leg so the committed px offset doesn't fight
 * the absolute %).
 *
 * Intentionally does NOT set `--editor-main-bare-*`: those vars are for the
 * free-floating single bare screenshot only. Writing them on the canvas made
 * every nested bare image (main row content + every secondary slot) inherit a
 * non-50% left/top during pad drag, so all three images shifted inside their
 * boxes and the main selection outline detached from its image.
 */
export function setMainScreenshotPositionPreview(
  canvasElement: HTMLElement | null | undefined | Array<HTMLElement | null | undefined>,
  point: PositionSwipePoint
) {
  // Accepts a list so callers can pass every live-preview root and drive the
  // preset thumbnails alongside the canvas — these vars all live on the root,
  // so no per-element lookup is needed.
  for (const el of toElements(canvasElement)) {
    el.style.setProperty(MAIN_POSITION_X_VAR, `${point.xPct}%`)
    el.style.setProperty(MAIN_POSITION_Y_VAR, `${point.yPct}%`)
    el.style.setProperty(MAIN_ANCHOR_X_VAR, frameAnchorTravel(point.xPct, "x"))
    el.style.setProperty(MAIN_ANCHOR_Y_VAR, frameAnchorTravel(point.yPct, "y"))
    el.style.setProperty(MAIN_OFFSET_X_VAR, "0px")
    el.style.setProperty(MAIN_OFFSET_Y_VAR, "0px")
  }
}

function toElements(
  input: HTMLElement | null | undefined | Array<HTMLElement | null | undefined>
): HTMLElement[] {
  if (!input) return []
  if (Array.isArray(input)) return input.filter((el): el is HTMLElement => !!el)
  return [input]
}

/**
 * Live-preview the frame-less main screenshot by driving its top-left corner in
 * stage pixels. Once a screenshot exists the image renders without a centering
 * `translate(-50%, -50%)`, so the bare vars must carry the same px box-left the
 * commit will produce — a percentage would shift the image by half its size and
 * make it jump on release.
 */
export function setMainScreenshotBarePreviewPx(
  canvasElement: HTMLElement | null | undefined | Array<HTMLElement | null | undefined>,
  leftPx: number,
  topPx: number
) {
  for (const el of toElements(canvasElement)) {
    el.style.setProperty(MAIN_BARE_LEFT_VAR, `${leftPx}px`)
    el.style.setProperty(MAIN_BARE_TOP_VAR, `${topPx}px`)
  }
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

/**
 * Run `cb` one frame AFTER {@link clearPositionPreviewVarsAfterPaint}'s clear has
 * painted. Used to reset the "position dragging" flag (which suppresses the
 * boxes' move easing) at drag end: the main screenshot's committed position uses
 * a different representation (grid anchor + offset) than its live preview
 * (`--editor-main-position-x` = the exact point), so clearing the preview var
 * changes its `left` even though the visual position is identical. Re-enabling
 * the transition before that clear paints makes the main ease between the two
 * representations — the wobble slots (whose preview and committed positions share
 * one xPct) never show. Keeping the flag set through the clear frame avoids it.
 */
export function afterPositionPreviewCleared(cb: () => void) {
  if (typeof requestAnimationFrame === "undefined") {
    cb()
    return
  }
  requestAnimationFrame(() => requestAnimationFrame(cb))
}

function frameAnchorTravel(percent: number, axis: "x" | "y") {
  const delta = Math.max(-1, Math.min(1, (percent - 50) / 50))
  if (delta === 0) return "0px"

  const containerUnit = axis === "x" ? "cqw" : "cqh"
  const formattedDelta = Number(delta.toFixed(4))
  return `calc(${formattedDelta} * 50${containerUnit})`
}
