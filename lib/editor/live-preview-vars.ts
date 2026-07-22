/**
 * Live-preview CSS variables — the single home for every var a slider or drag
 * writes to the DOM so the canvas repaints without a React render until the
 * value is committed.
 *
 * Two layers live here:
 *   1. Root fan-out ({@link livePreviewRoots}, {@link setLivePreviewVar}, the
 *      per-element position vars). Sliders/drags write to the real canvas *and*
 *      every preset-thumbnail stage at once, so thumbnails track the gesture.
 *   2. Main-screenshot position preview ({@link setMainScreenshotPositionPreview}
 *      and friends), which drives the framed/bare main image during a pad drag
 *      and has its own clear-after-paint lifecycle.
 */

/** A percentage point on the canvas, `{ xPct, yPct }`. */
export type LivePreviewPoint = { xPct: number; yPct: number }

// ---------------------------------------------------------------------------
// Root fan-out
// ---------------------------------------------------------------------------

/**
 * Resolves every DOM root that should receive live-preview CSS vars while a
 * slider or drag is in flight.
 *
 * Sliders write vars like `--editor-padding-preview` instead of dispatching to
 * the store on every tick, so the canvas repaints without a React render until
 * the value is committed. Those writes used to target the canvas element alone,
 * which left the preset thumbnails frozen mid-drag: they mirror the same canvas
 * but mount under a synthetic `data-canvas-id`, so the selector never reached
 * them and they only caught up on release.
 *
 * Preset preview stages tag themselves with {@link LIVE_PREVIEW_ROOT_ATTR} set
 * to the canvas they mirror. Writing the same vars to every root keeps the
 * thumbnails in step with the canvas for free — the vars inherit down each
 * preview subtree exactly as they do in the real canvas.
 *
 * A preview that pins a var itself (a preset thumbnail pins its own tilt) sets
 * it on its own stage element, so the inherited value from a canvas-level drag
 * loses to it. That is the intended precedence: dragging canvas tilt must not
 * retilt the thumbnails, but dragging padding must repad them.
 */

export const LIVE_PREVIEW_ROOT_ATTR = "data-live-preview-root"

export function livePreviewRoots(
  activeCanvasId: string | null | undefined
): HTMLElement[] {
  if (typeof document === "undefined" || !activeCanvasId) return []
  const id = CSS.escape(activeCanvasId)
  const canvasEl = document.querySelector<HTMLElement>(
    `[data-canvas-id="${id}"]`
  )
  const previewRoots = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[${LIVE_PREVIEW_ROOT_ATTR}="${id}"]`
    )
  )
  return canvasEl ? [canvasEl, ...previewRoots] : previewRoots
}

/** Set or remove a var across every live-preview root. */
export function setLivePreviewVar(
  roots: HTMLElement[],
  name: string,
  value: string | null
) {
  for (const root of roots) {
    if (value === null) root.style.removeProperty(name)
    else root.style.setProperty(name, value)
  }
}

/**
 * Per-element position vars, keyed by the element's own id.
 *
 * Dragging a text, asset or annotation layer used to write straight to the
 * dragged element's inline style. That can't reach the preset thumbnails: they
 * render their own copy of the element, and preview subtrees deliberately strip
 * identifying attributes like `data-screenshot-slot-id`, so there is nothing to
 * look the copy up by.
 *
 * Putting the id in the var *name* sidesteps that entirely. The var is written
 * once on each root and inherits down to whichever element reads it, so the
 * canvas and every thumbnail follow the drag without any of them having to be
 * found individually. Element ids are UUIDs or `t-<ts>-<rand>`, both of which
 * are valid custom-property idents.
 */
export function elementPositionVars(elementId: string) {
  return {
    x: `--tk-el-${elementId}-x`,
    y: `--tk-el-${elementId}-y`,
  }
}

export function setElementLivePosition(
  roots: HTMLElement[],
  elementId: string,
  xPct: number,
  yPct: number
) {
  const { x, y } = elementPositionVars(elementId)
  setLivePreviewVar(roots, x, `${xPct}%`)
  setLivePreviewVar(roots, y, `${yPct}%`)
}

export function clearElementLivePosition(
  roots: HTMLElement[],
  elementId: string
) {
  const { x, y } = elementPositionVars(elementId)
  setLivePreviewVar(roots, x, null)
  setLivePreviewVar(roots, y, null)
}

// ---------------------------------------------------------------------------
// Main-screenshot position preview
// ---------------------------------------------------------------------------

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
  point: LivePreviewPoint
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
  canvasElement:
    | HTMLElement
    | null
    | undefined
    | Array<HTMLElement | null | undefined>,
  point: LivePreviewPoint
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
  canvasElement:
    | HTMLElement
    | null
    | undefined
    | Array<HTMLElement | null | undefined>,
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
  elements: Array<HTMLElement | null | undefined>,
  shouldRun?: () => boolean
) {
  if (typeof requestAnimationFrame === "undefined") {
    if (shouldRun && !shouldRun()) return
    for (const element of elements) clearPositionPreviewVars(element)
    return
  }

  requestAnimationFrame(() => {
    if (shouldRun && !shouldRun()) return
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
export function afterPositionPreviewCleared(
  cb: () => void,
  shouldRun?: () => boolean
) {
  if (typeof requestAnimationFrame === "undefined") {
    if (!shouldRun || shouldRun()) cb()
    return
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!shouldRun || shouldRun()) cb()
    })
  )
}

function frameAnchorTravel(percent: number, axis: "x" | "y") {
  const delta = Math.max(-1, Math.min(1, (percent - 50) / 50))
  if (delta === 0) return "0px"

  const containerUnit = axis === "x" ? "cqw" : "cqh"
  const formattedDelta = Number(delta.toFixed(4))
  return `calc(${formattedDelta} * 50${containerUnit})`
}
