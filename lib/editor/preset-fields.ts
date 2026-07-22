import type { CanvasState } from "./state-types"
import type { TweetCardSettings } from "./tweet-settings"

/**
 * Single source of truth for how a canvas field relates to a custom preset.
 *
 * A preset saves a *look*, not a specific screenshot. Rather than an allow-list
 * that has to be extended for every new styling field (and kept in sync across
 * capture, apply, and the preview), we keep one deny-list of the fields a preset
 * must **not** carry in its style bag. Everything else is "style" and flows in
 * automatically.
 *
 * Only add a key here when it is one of:
 *   - identity / bulk-canvas placement — `id`, `position`
 *   - live screenshot pixels the preset must never freeze — `screenshot`,
 *     `originalScreenshot`, `lastCropRegion`, `fullPageCapture`, `videoClips`
 *   - geometry that rides in {@link CustomPresetGeometry} instead — `tilt`,
 *     `scale`, `screenshotOffset`, `screenshotSlots`
 *   - stored in a transformed form — `tweet` (saved as `tweetSettings`)
 *   - stored separately — `animation` (on animate presets)
 *
 * `screenshotPosition` is deliberately NOT here: it stays in the style bag for
 * backward compatibility with presets already saved in D1, even though apply and
 * preview treat it as geometry and set it alongside tilt/scale/offset.
 */
export const PRESET_NON_STYLE_KEYS = [
  "id",
  "position",
  "screenshot",
  "originalScreenshot",
  "lastCropRegion",
  "fullPageCapture",
  "videoClips",
  "tilt",
  "scale",
  "screenshotOffset",
  "screenshotSlots",
  "tweet",
  "animation",
] as const satisfies readonly (keyof CanvasState)[]

export type PresetNonStyleKey = (typeof PRESET_NON_STYLE_KEYS)[number]
export type PresetStyleKey = Exclude<keyof CanvasState, PresetNonStyleKey>

/**
 * A preset's saved look: every style field, plus `screenshotPosition` (kept for
 * backward compat) and `tweet` stored transformed as `tweetSettings`.
 */
export type CustomPresetCanvasStyle = Partial<
  Pick<CanvasState, PresetStyleKey>
> & {
  /** `tweet` is stored transformed so apply can re-hydrate a card frame. */
  tweetSettings?: TweetCardSettings
}

const NON_STYLE = new Set<string>(PRESET_NON_STYLE_KEYS)

// Style keys the merge resolves specially instead of blind-copying:
//   frame — a tweet card owns its own frame, so a preset never overrides it there
//   screenshotPosition — geometry; the caller sets it beside tilt/scale/offset
const STYLE_MERGE_SPECIAL = new Set<string>(["frame", "screenshotPosition"])

/**
 * Copy the style fields off a canvas, dropping the non-style (geometry / live /
 * transformed) keys and any `undefined` optional. Callers layer on the
 * transformed fields (a sanitized `background`, `tweetSettings`).
 */
export function pickPresetStyle(
  canvas: CanvasState
): Partial<Pick<CanvasState, PresetStyleKey>> {
  const style: Partial<Pick<CanvasState, PresetStyleKey>> = {}
  const record = style as Record<string, unknown>
  for (const key of Object.keys(canvas)) {
    if (NON_STYLE.has(key)) continue
    const value = canvas[key as keyof CanvasState]
    if (value === undefined) continue
    record[key] = value
  }
  return style
}

/**
 * Layer a preset's saved style over a base canvas. Only the style bag is applied
 * here — geometry (tilt/scale/slots/offset/position) and live pixels stay with
 * the base and are set by the caller afterwards. Undefined fields are skipped so
 * a sparse or legacy bag never clobbers a live value.
 */
export function mergeCanvasStyle(
  base: CanvasState,
  style: CustomPresetCanvasStyle | undefined
): CanvasState {
  if (!style) return base
  const next: CanvasState = { ...base }
  const record = next as Record<string, unknown>
  for (const [key, value] of Object.entries(style)) {
    // A persisted bag is untrusted: a malformed or newer preset may carry
    // non-style keys (id, position, screenshot, geometry…) or a nullish value.
    // Only copy real style fields that carry a value, so a preset can never
    // overwrite canvas identity/placement or blank out a live field.
    if (value == null || NON_STYLE.has(key)) continue
    if (key === "tweetSettings" || STYLE_MERGE_SPECIAL.has(key)) continue
    record[key] = value
  }
  // A tweet card owns its own frame — never let a preset retarget it.
  if (style.frame && !base.tweet) next.frame = style.frame
  if (style.tweetSettings && base.tweet) {
    next.tweet = { ...base.tweet, ...style.tweetSettings }
  }
  return next
}
