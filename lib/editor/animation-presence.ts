import type { EditorState } from "./state-types"

/**
 * Anything that may carry a saved timeline: a canvas, a preset geometry. Only
 * `clips` is read, and whatever else the shape carries rides along untouched.
 */
type AnimationCarrier = {
  animation?: { clips?: readonly unknown[]; [key: string]: unknown } | null
}

/**
 * Whether an animation survived being applied.
 *
 * Every path that loads a saved composition — templates, animate presets,
 * drafts — hands the store an arbitrary payload that `normalizeEditorState`
 * (and the preset slot remapper) merge against current defaults. A timeline
 * whose shape no longer matches is reduced to zero clips rather than rejected,
 * so the composition still lands and the only difference is an empty timeline.
 * Callers compare the payload against the live canvas through these two helpers
 * so that drop is reported instead of passing as a successful apply.
 */
export function payloadClipCount(
  carriers: readonly (AnimationCarrier | undefined | null)[] | undefined
) {
  return (carriers ?? []).reduce(
    (total, carrier) => total + (carrier?.animation?.clips?.length ?? 0),
    0
  )
}

/** Clips the live editor holds on the canvas the user is looking at. */
export function liveClipCount(present: EditorState) {
  const active = present.canvases.find((c) => c.id === present.activeCanvasId)
  return active?.animation?.clips.length ?? 0
}

/**
 * What a saved preset should do with Animate mode.
 *
 * `"missing-timeline"` is the case worth naming: a preset saved as animate whose
 * clips are gone. Applying it would style the canvas and open Animate on an
 * empty track — the styling makes it look like it worked, so the caller has to
 * refuse rather than guess.
 */
export function resolvePresetAnimateIntent(
  type: string | undefined,
  geometry: AnimationCarrier
): "style" | "animate" | "missing-timeline" {
  const clips = payloadClipCount([geometry])
  if (clips > 0) return "animate"
  return type === "animate" ? "missing-timeline" : "style"
}
