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
