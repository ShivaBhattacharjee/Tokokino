// Pure timing helpers for Animate-mode on-canvas playback.
//
// A clip reveals its target screenshot by interpolating that screenshot's
// transform from a neutral rest pose (progress 0) to the screenshot's current
// inspector pose (progress 1) over the clip's own window. This module only
// answers "how far toward the pose is a target at time T" — the AnimationLayer
// turns that progress into concrete CSS override vars. Kept React-free so it's
// testable and shared between live playback and (later) the exporter.

import { DEFAULT_CANVAS_BASE } from "./store/defaults"
import type {
  AnimationClip,
  AnimationClipTarget,
  AnimationEffect,
  Background,
  BackdropEffects,
  ClipBaseline,
  ClipSlotPose,
  Shadow,
} from "./state-types"

/**
 * Baseline used for clips saved before per-clip baselines existed: the canvas
 * defaults. New clips carry their own snapshot; this keeps old ones working.
 */
export const DEFAULT_BASELINE: ClipBaseline = {
  tilt: DEFAULT_CANVAS_BASE.tilt,
  scale: DEFAULT_CANVAS_BASE.scale,
  screenshotPosition: DEFAULT_CANVAS_BASE.screenshotPosition,
  screenshotOffset: DEFAULT_CANVAS_BASE.screenshotOffset,
  padding: DEFAULT_CANVAS_BASE.padding,
  shadow: DEFAULT_CANVAS_BASE.shadow,
  backdropEffects: DEFAULT_CANVAS_BASE.backdrop.effects,
  background: DEFAULT_CANVAS_BASE.background,
  slots: {},
}

/** A clip's captured baseline, falling back to the canvas defaults. */
export function clipBaseline(clip: AnimationClip): ClipBaseline {
  return clip.baseline ?? DEFAULT_BASELINE
}

/** Neutral rest pose for an extra screenshot slot (flat, full-size, no spin). */
export const NEUTRAL_SLOT_POSE: ClipSlotPose = {
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  rotation: 0,
}

/** A clip's target keyframe (`pose`), falling back to the legacy baseline. */
export function clipPose(clip: AnimationClip): ClipBaseline {
  return clip.pose ?? clip.baseline ?? DEFAULT_BASELINE
}

/**
 * The rest pose the very first clip reveals FROM. "Intro" properties start
 * neutral so they animate in — the screenshot tilts up from flat, scales up from
 * full size, the shadow grows from invisible, and placement slides from center.
 * The remaining properties (padding, background, backdrop) HOLD at the first
 * clip's own values so they don't animate unless a later clip changes them.
 */
export function restPoseFor(firstPose: ClipBaseline): ClipBaseline {
  return {
    tilt: { rx: 0, ry: 0, rz: 0 },
    scale: 100,
    screenshotPosition: "center",
    screenshotOffset: { x: 0, y: 0 },
    shadow: { ...firstPose.shadow, intensity: 0 },
    padding: firstPose.padding,
    background: firstPose.background,
    backdropEffects: firstPose.backdropEffects,
    slots: {},
  }
}

/** True when two backgrounds are different selections (robust to preview URLs). */
export function backgroundsDiffer(a: Background, b: Background): boolean {
  if (a.type !== b.type) return true
  // For images the stable selection identity is sourceUrl — `value` is a
  // resolution-dependent preview (thumb/preview/full) that varies for the same
  // library image, so comparing it gives false positives.
  if (a.type === "image") {
    return (a.sourceUrl ?? a.value) !== (b.sourceUrl ?? b.value)
  }
  return a.value !== b.value
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Smooth deceleration into the pose — matches the feel of a settled reveal. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Back-compat: clips saved before per-clip targeting animate every screenshot. */
export function clipTargetOf(clip: AnimationClip): AnimationClipTarget {
  return clip.target ?? { scope: "all" }
}

/** A shadow that renders nothing — `type: "none"` or zero intensity. */
function shadowInvisible(s: Shadow): boolean {
  return s.type === "none" || s.intensity <= 0
}

export function shadowsDiffer(a: Shadow, b: Shadow): boolean {
  // Two shadows that both render nothing are equal, even if their inert
  // intensity/color differ (the default shadow is type "none" with a nonzero
  // intensity, so this avoids a phantom "shadow animates" on every clip).
  if (shadowInvisible(a) && shadowInvisible(b)) return false
  return (
    a.type !== b.type ||
    a.intensity !== b.intensity ||
    a.color !== b.color ||
    a.lightSource !== b.lightSource
  )
}

/** Light source as grid coords (row/col 0..4); "center" is the 2,2 middle. */
function parseLightSource(ls: string): { r: number; c: number } {
  if (ls === "center") return { r: 2, c: 2 }
  const [r, c] = ls.split("-").map(Number)
  return { r: Number.isFinite(r) ? r : 2, c: Number.isFinite(c) ? c : 2 }
}

/**
 * Shadow at progress p, animating `from` → `to`. When the shadow type is
 * unchanged the intensity AND light direction ease between the two (so a shadow
 * cast in one direction rotates smoothly to another). When the type changed
 * (e.g. none → drop) the target shadow simply grows in from intensity 0 at its
 * own direction. `shadowCss` parses fractional grid coords, so the interpolated
 * "r-c" light source renders a smooth intermediate offset.
 */
export function shadowBetween(from: Shadow, to: Shadow, p: number): Shadow {
  const sameType = from.type === to.type
  const fromIntensity = sameType ? from.intensity : 0
  const toLs = parseLightSource(to.lightSource)
  const fromLs = sameType ? parseLightSource(from.lightSource) : toLs
  return {
    ...to,
    intensity: lerp(fromIntensity, to.intensity, p),
    lightSource: `${lerp(fromLs.r, toLs.r, p)}-${lerp(fromLs.c, toLs.c, p)}`,
  }
}

export function backdropEffectsDiffer(
  a: BackdropEffects,
  b: BackdropEffects
): boolean {
  return (
    a.noise !== b.noise ||
    a.blur !== b.blur ||
    a.brightness !== b.brightness ||
    a.contrast !== b.contrast ||
    a.saturation !== b.saturation ||
    a.hue !== b.hue ||
    a.grayscale !== b.grayscale ||
    a.sepia !== b.sepia ||
    a.invert !== b.invert ||
    a.opacity !== b.opacity
  )
}

/** Backdrop filter effects at progress p, easing each channel `from` → `to`. */
export function backdropEffectsBetween(
  from: BackdropEffects,
  to: BackdropEffects,
  p: number
): BackdropEffects {
  return {
    noise: lerp(from.noise, to.noise, p),
    blur: lerp(from.blur, to.blur, p),
    brightness: lerp(from.brightness, to.brightness, p),
    contrast: lerp(from.contrast, to.contrast, p),
    saturation: lerp(from.saturation, to.saturation, p),
    hue: lerp(from.hue, to.hue, p),
    grayscale: lerp(from.grayscale, to.grayscale, p),
    sepia: lerp(from.sepia, to.sepia, p),
    invert: lerp(from.invert, to.invert, p),
    opacity: lerp(from.opacity, to.opacity, p),
  }
}

/** True when this keyframe explicitly owns (animates) the given effect. */
export function clipOwns(
  clip: AnimationClip,
  effect: AnimationEffect
): boolean {
  return (clip.effects ?? []).includes(effect)
}

/**
 * Sample a per-effect keyframe track at time `timeMs`. Each frame is one
 * keyframe's window + the target value the effect reaches by the end of it.
 *  - no frames → null (the effect isn't animated; leave the committed value),
 *  - before the first frame → the neutral `rest` value (reveal origin),
 *  - inside a frame → eased interpolation from the PREVIOUS frame's value (or
 *    `rest` for the first) → this frame's value,
 *  - in a gap after a frame, or past the last → hold that frame's value.
 * This is the single source of truth for continuity + hold across the timeline.
 */
export function sampleKeyframes<V>(
  frames: readonly { startMs: number; durationMs: number; value: V }[],
  timeMs: number,
  rest: V,
  lerpValue: (from: V, to: V, p: number) => V
): V | null {
  if (frames.length === 0) return null
  const sorted = [...frames].sort((a, b) => a.startMs - b.startMs)
  if (timeMs < sorted[0].startMs) return rest
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]
    if (timeMs < f.startMs) return sorted[i - 1].value // gap → hold previous
    if (timeMs <= f.startMs + f.durationMs) {
      const from = i > 0 ? sorted[i - 1].value : rest
      return lerpValue(
        from,
        f.value,
        easeOut(clamp01((timeMs - f.startMs) / f.durationMs))
      )
    }
  }
  return sorted[sorted.length - 1].value // past the end → hold last
}

/** True when `clip` animates the main screenshot (its own target or "all"). */
export function clipAffectsMain(clip: AnimationClip): boolean {
  const t = clipTargetOf(clip)
  return t.scope === "main" || t.scope === "all"
}

/** True when `clip` animates the given slot (its own target or "all"). */
export function clipAffectsSlot(clip: AnimationClip, slotId: string): boolean {
  const t = clipTargetOf(clip)
  return t.scope === "all" || (t.scope === "slot" && t.slotId === slotId)
}

/**
 * Eased 0..1 progress toward the pose for a target's clips at `timeMs`:
 *  - before the first clip starts → 0 (neutral rest),
 *  - inside a clip → eased local progress,
 *  - in a gap after a clip, or past the last clip → 1 (holds the pose).
 * With no clips the target is never animated, so it sits at its full pose (1).
 */
export function clipsProgressAt(
  clips: readonly AnimationClip[],
  timeMs: number
): number {
  if (clips.length === 0) return 1
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  if (timeMs < sorted[0].startMs) return 0
  for (const c of sorted) {
    if (timeMs < c.startMs) return 1 // in a gap that follows an earlier clip
    if (timeMs <= c.startMs + c.durationMs) {
      return easeOut(clamp01((timeMs - c.startMs) / c.durationMs))
    }
  }
  return 1 // past every clip
}

/**
 * The clip whose baseline governs the pose at `timeMs`, with its eased progress,
 * the next clip in time (its animation target, for continuity), and whether it's
 * the first clip in the chain:
 *  - before the first clip → that clip at progress 0 (its baseline),
 *  - inside a clip → that clip at eased progress,
 *  - in a gap / past the end → the preceding clip held at progress 1.
 * Each clip animates from its own baseline → the NEXT clip's baseline, and the
 * last clip → the current committed value, so clips chain continuously instead
 * of each snapping back to the start. The FIRST clip is flagged so "reveal"
 * properties (shadow, position) can originate from a neutral rest state rather
 * than the captured baseline, then chain from there.
 */
export function activeClipAt(
  clips: readonly AnimationClip[],
  timeMs: number
): {
  clip: AnimationClip
  prev: AnimationClip | null
  next: AnimationClip | null
  progress: number
  isFirst: boolean
} | null {
  if (clips.length === 0) return null
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const at = (i: number, progress: number) => ({
    clip: sorted[i],
    prev: sorted[i - 1] ?? null,
    next: sorted[i + 1] ?? null,
    progress,
    isFirst: i === 0,
  })
  if (timeMs < sorted[0].startMs) return at(0, 0)
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]
    if (timeMs < c.startMs) return at(Math.max(0, i - 1), 1)
    if (timeMs <= c.startMs + c.durationMs) {
      return at(i, easeOut(clamp01((timeMs - c.startMs) / c.durationMs)))
    }
  }
  return at(sorted.length - 1, 1)
}
