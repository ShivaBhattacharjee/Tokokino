// Per-clip transition easing + speed remap.
//
// Every animation clip eases its owned effects over its own window. Historically
// that easing was a single hard-coded ease-out cubic shared by all clips; this
// module makes the curve a per-clip choice (Linear / Cubic / In / Out / In Out /
// Out Circ) and adds an independent SPEED remap that lets the transition finish
// EARLY within the clip's window (then hold) WITHOUT moving the clip's keyframe
// time. A 5 s clip can complete its motion in 1 s and hold for the remaining 4 s.
//
// The same helpers drive live playback, the exporter, and the little curve
// thumbnails in the Transition popover — so the preview always matches output.

import type { AnimationClip, ClipEasingKind } from "./state-types"

export type { ClipEasingKind }

/**
 * The curve a clip uses when it hasn't picked one. `out` (ease-out cubic) is the
 * motion every clip shipped with before per-clip easing existed, so undefined
 * `easing` reads as this and old drafts animate identically.
 */
export const DEFAULT_CLIP_EASING: ClipEasingKind = "out"

/** Speed remap bounds. 1 = the transition uses the clip's full window (original
 * behaviour); higher finishes proportionally sooner (5 = in one-fifth of it). */
export const MIN_CLIP_SPEED = 1
export const MAX_CLIP_SPEED = 5
export const DEFAULT_CLIP_SPEED = 1

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Raw easing functions on t ∈ [0,1] → [0,1]. */
const EASING_FNS: Record<ClipEasingKind, (t: number) => number> = {
  linear: (t) => t,
  // Strong symmetric S — accelerate then decelerate (ease-in-out cubic).
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Accelerate from rest (ease-in cubic).
  in: (t) => t * t * t,
  // Decelerate into the pose (ease-out cubic) — the historic default.
  out: (t) => 1 - Math.pow(1 - t, 3),
  // Gentle symmetric S (ease-in-out quad) — softer than `cubic`.
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  // Circular ease-out — a snappy, near-instant settle.
  outCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
}

export const CLIP_EASING_KINDS: readonly ClipEasingKind[] = [
  "linear",
  "cubic",
  "in",
  "out",
  "inOut",
  "outCirc",
]

/** Human labels for the Transition popover tiles. */
export const CLIP_EASING_LABELS: Record<ClipEasingKind, string> = {
  linear: "Linear",
  cubic: "Cubic",
  in: "In",
  out: "Out",
  inOut: "In Out",
  outCirc: "Out Circ",
}

/** The easing kind a clip resolves to (its own, or the default). */
export function clipEasingKind(clip: {
  easing?: ClipEasingKind
}): ClipEasingKind {
  return clip.easing ?? DEFAULT_CLIP_EASING
}

/** Clamp a raw speed into range, treating undefined as the default. */
export function clipSpeed(clip: { speed?: number }): number {
  const s = clip.speed ?? DEFAULT_CLIP_SPEED
  if (!Number.isFinite(s)) return DEFAULT_CLIP_SPEED
  return Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, s))
}

/** The bare easing function for a kind (used by the curve thumbnails). */
export function easingFn(kind: ClipEasingKind): (t: number) => number {
  return EASING_FNS[kind]
}

/**
 * The full progress remap for a clip: takes RAW local progress (0..1 across the
 * clip's window) and returns the eased 0..1 the interpolators apply. Speed
 * compresses the raw progress so the curve reaches 1 early (then holds), and the
 * chosen curve shapes the ramp. This is the single function every sampler uses,
 * so a clip's speed + curve affect every effect it animates identically.
 */
export function clipProgressEase(clip: {
  easing?: ClipEasingKind
  speed?: number
}): (rawT: number) => number {
  const fn = EASING_FNS[clipEasingKind(clip)]
  const speed = clipSpeed(clip)
  return (rawT) => fn(clamp01(rawT * speed))
}

/**
 * Whether a clip releases back to its pre-clip state after its window instead of
 * holding the pose. On unless a clip opts out, so a keyframe's effect never
 * outlives the band that authored it — including in drafts saved before the
 * release existed.
 */
export function clipReturnsToDefault(clip: {
  returnToDefault?: boolean
}): boolean {
  return clip.returnToDefault !== false
}

/**
 * How long the release takes, starting at the clip's end. It mirrors the active
 * transition so the motion out is the motion in played backwards — a clip that
 * settles in 400ms of a 5 s window also unwinds in 400ms.
 */
export function clipReleaseMs(clip: AnimationClip): number {
  return clipReturnsToDefault(clip) ? effectiveActiveMs(clip) : 0
}

/**
 * The curve the release rides. It is the clip's own curve WITHOUT the speed
 * remap — speed already decided how long the release lasts, so folding it in
 * again would compress the curve inside its own shortened window.
 */
export function clipReleaseEase(clip: AnimationClip): (rawT: number) => number {
  const fn = EASING_FNS[clipEasingKind(clip)]
  return (rawT) => fn(clamp01(rawT))
}

/**
 * The effective active duration (ms) a clip's transition actually plays over,
 * given its speed — the rest of the window holds the pose. Shown in the UI so
 * "finish in 1 s of a 5 s clip" reads directly.
 */
export function effectiveActiveMs(clip: AnimationClip): number {
  return Math.round(clip.durationMs / clipSpeed(clip))
}

/**
 * An SVG path string for a curve, drawn in a `size`×`size` box with `pad` inset
 * on every edge. x = progress (0→1 left→right), y = eased output (inverted for
 * SVG's y-down). Used by the Transition popover thumbnails and the hover dot.
 */
export function easingSvgPath(
  kind: ClipEasingKind,
  size = 100,
  pad = 14,
  samples = 32
): string {
  const fn = EASING_FNS[kind]
  const span = size - pad * 2
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const x = pad + t * span
    const y = pad + (1 - clamp01(fn(t))) * span
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return pts.join(" ")
}

/** The dot's {x,y} on the curve at progress t, in the same box as `easingSvgPath`. */
export function easingDotAt(
  kind: ClipEasingKind,
  t: number,
  size = 100,
  pad = 14
): { x: number; y: number } {
  const fn = EASING_FNS[kind]
  const span = size - pad * 2
  const p = clamp01(t)
  return {
    x: pad + p * span,
    y: pad + (1 - clamp01(fn(p))) * span,
  }
}
