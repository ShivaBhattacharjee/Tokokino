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
  Background,
  BackdropEffects,
  ClipBaseline,
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

export function shadowsDiffer(a: Shadow, b: Shadow): boolean {
  return (
    a.type !== b.type ||
    a.intensity !== b.intensity ||
    a.color !== b.color ||
    a.lightSource !== b.lightSource
  )
}

/**
 * Shadow at progress p, animating `from` → `to`. When the type is unchanged the
 * intensity eases between the two; when the type changed (e.g. none → drop) the
 * target shadow simply grows in from intensity 0.
 */
export function shadowBetween(from: Shadow, to: Shadow, p: number): Shadow {
  const fromIntensity = from.type === to.type ? from.intensity : 0
  return { ...to, intensity: lerp(fromIntensity, to.intensity, p) }
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
 * The clip whose baseline governs the pose at `timeMs`, with its eased progress
 * and the next clip in time (its animation target, for continuity):
 *  - before the first clip → that clip at progress 0 (its baseline),
 *  - inside a clip → that clip at eased progress,
 *  - in a gap / past the end → the preceding clip held at progress 1.
 * Each clip animates from its own baseline → the NEXT clip's baseline, and the
 * last clip → the current committed value, so clips chain continuously instead
 * of each snapping back to the start.
 */
export function activeClipAt(
  clips: readonly AnimationClip[],
  timeMs: number
): {
  clip: AnimationClip
  next: AnimationClip | null
  progress: number
} | null {
  if (clips.length === 0) return null
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const at = (i: number, progress: number) => ({
    clip: sorted[i],
    next: sorted[i + 1] ?? null,
    progress,
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
