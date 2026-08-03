// Per-clip transition easing + speed remap.
//
// Every animation clip eases its owned effects over its own window. Named
// presets (Linear / Cubic / In / Out / In Out / Out Circ) cover common motion;
// Custom uses a CSS-style cubic-bezier the user can edit in the Transition
// popover. An independent SPEED remap lets the transition finish EARLY within
// the clip's window (then hold) WITHOUT moving the clip's keyframe time.
//
// The same helpers drive live playback, the exporter, and the little curve
// thumbnails in the Transition popover — so the preview always matches output.

import type {
  AnimationClip,
  ClipEasingBezier,
  ClipEasingKind,
} from "./state-types"

export type { ClipEasingBezier, ClipEasingKind }

/**
 * Fallback when a clip has no `easing` field. Ease-out cubic is the historic
 * default from before per-clip easing existed, so undefined keeps old drafts
 * and templates animating identically.
 */
export const DEFAULT_CLIP_EASING: ClipEasingKind = "out"

/**
 * Easing written onto newly created clips (and used by Transition reset).
 * Explicit so the shared fallback above can stay legacy-safe.
 */
export const NEW_CLIP_EASING: ClipEasingKind = "linear"

/** Default custom cubic-bezier — soft ease-in-out (matches CSS `ease-in-out`). */
export const DEFAULT_CUSTOM_BEZIER: ClipEasingBezier = {
  x1: 0.42,
  y1: 0,
  x2: 0.58,
  y2: 1,
}

/** Control-point y stays inside the plot box — same [0,1] clamp as x. */
export const BEZIER_Y_MIN = 0
export const BEZIER_Y_MAX = 1

/** Speed remap bounds. 1 = the transition uses the clip's full window (original
 * behaviour); higher finishes proportionally sooner (5 = in one-fifth of it). */
export const MIN_CLIP_SPEED = 1
export const MAX_CLIP_SPEED = 5
export const DEFAULT_CLIP_SPEED = 1

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Named preset easing functions on t ∈ [0,1] → [0,1]. */
const PRESET_EASING_FNS: Record<
  Exclude<ClipEasingKind, "custom">,
  (t: number) => number
> = {
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

/**
 * Preset tiles in the Transition grid (5 presets + Custom = 3×2).
 * `outCirc` stays in the type system for drafts/templates that already use it,
 * but is not offered as a grid tile.
 */
export const CLIP_EASING_KINDS: readonly Exclude<ClipEasingKind, "custom">[] = [
  "linear",
  "cubic",
  "in",
  "out",
  "inOut",
]

/** Human labels for the Transition popover tiles. */
export const CLIP_EASING_LABELS: Record<ClipEasingKind, string> = {
  linear: "Linear",
  cubic: "Cubic",
  in: "In",
  out: "Out",
  inOut: "In Out",
  outCirc: "Out Circ",
  custom: "Custom",
}

/**
 * Seed bezier values when the user flips a named preset into Custom so the
 * graph starts near the curve they were just looking at.
 */
export const PRESET_BEZIER_SEEDS: Record<
  Exclude<ClipEasingKind, "custom">,
  ClipEasingBezier
> = {
  // Approximate the named curves as cubic-beziers for a sensible hand-off.
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  cubic: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  in: { x1: 0.55, y1: 0.055, x2: 0.675, y2: 0.19 },
  out: { x1: 0.215, y1: 0.61, x2: 0.355, y2: 1 },
  inOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  outCirc: { x1: 0.08, y1: 0.82, x2: 0.17, y2: 1 },
}

/** The easing kind a clip resolves to (its own, or the default). */
export function clipEasingKind(clip: {
  easing?: ClipEasingKind
}): ClipEasingKind {
  return clip.easing ?? DEFAULT_CLIP_EASING
}

/** Clamp / fill a bezier so both axes stay inside the unit plot [0,1]. */
export function normalizeBezier(
  raw?: Partial<ClipEasingBezier> | null
): ClipEasingBezier {
  const base = DEFAULT_CUSTOM_BEZIER
  const x1 = Number.isFinite(raw?.x1) ? clamp01(raw!.x1!) : base.x1
  const x2 = Number.isFinite(raw?.x2) ? clamp01(raw!.x2!) : base.x2
  const y1 = Number.isFinite(raw?.y1) ? clamp01(raw!.y1!) : base.y1
  const y2 = Number.isFinite(raw?.y2) ? clamp01(raw!.y2!) : base.y2
  return { x1, y1, x2, y2 }
}

/** Resolved bezier for a clip (custom handles, or default). */
export function clipEasingBezier(clip: {
  easingBezier?: ClipEasingBezier
}): ClipEasingBezier {
  return normalizeBezier(clip.easingBezier)
}

/** Clamp a raw speed into range, treating undefined as the default. */
export function clipSpeed(clip: { speed?: number }): number {
  const s = clip.speed ?? DEFAULT_CLIP_SPEED
  if (!Number.isFinite(s)) return DEFAULT_CLIP_SPEED
  return Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, s))
}

/**
 * CSS cubic-bezier evaluator: given x ∈ [0,1] (time), return y (eased progress).
 * Newton-Raphson with binary-search fallback — same approach browsers use.
 */
export function cubicBezierEase(
  bezier: ClipEasingBezier
): (x: number) => number {
  const { x1, y1, x2, y2 } = normalizeBezier(bezier)

  // Bezier component: 3(1-t)²t·a + 3(1-t)t²·b + t³
  const sampleCurve = (a: number, b: number, t: number) => {
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    return 3 * mt2 * t * a + 3 * mt * t2 * b + t3
  }
  const sampleDerivative = (a: number, b: number, t: number) => {
    const mt = 1 - t
    return 3 * mt * mt * a + 6 * mt * t * (b - a) + 3 * t * t * (1 - b)
  }

  return (x: number) => {
    const xx = clamp01(x)
    if (xx <= 0) return 0
    if (xx >= 1) return 1

    // Newton-Raphson for t such that Bx(t) ≈ x
    let t = xx
    for (let i = 0; i < 8; i++) {
      const xEst = sampleCurve(x1, x2, t)
      const dx = sampleDerivative(x1, x2, t)
      if (Math.abs(dx) < 1e-6) break
      t = clamp01(t - (xEst - xx) / dx)
    }

    // Binary refine if Newton left residual
    let lo = 0
    let hi = 1
    for (let i = 0; i < 8; i++) {
      const xEst = sampleCurve(x1, x2, t)
      if (Math.abs(xEst - xx) < 1e-6) break
      if (xEst < xx) lo = t
      else hi = t
      t = (lo + hi) / 2
    }

    return sampleCurve(y1, y2, t)
  }
}

/**
 * The bare easing function for a kind. `custom` uses `DEFAULT_CUSTOM_BEZIER`
 * unless you pass a bezier via `resolveEasingFn`.
 */
export function easingFn(kind: ClipEasingKind): (t: number) => number {
  if (kind === "custom") return cubicBezierEase(DEFAULT_CUSTOM_BEZIER)
  return PRESET_EASING_FNS[kind]
}

/** Resolve the full easing function for a clip (presets + custom bezier). */
export function resolveEasingFn(clip: {
  easing?: ClipEasingKind
  easingBezier?: ClipEasingBezier
}): (t: number) => number {
  const kind = clipEasingKind(clip)
  if (kind === "custom") return cubicBezierEase(clipEasingBezier(clip))
  return PRESET_EASING_FNS[kind]
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
  easingBezier?: ClipEasingBezier
  speed?: number
}): (rawT: number) => number {
  const fn = resolveEasingFn(clip)
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
  const fn = resolveEasingFn(clip)
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
  samples = 32,
  bezier?: ClipEasingBezier
): string {
  const fn =
    kind === "custom"
      ? cubicBezierEase(normalizeBezier(bezier))
      : PRESET_EASING_FNS[kind]
  return easingSvgPathFromFn(fn, size, pad, samples)
}

export function easingSvgPathFromFn(
  fn: (t: number) => number,
  size = 100,
  pad = 14,
  samples = 32
): string {
  const span = size - pad * 2
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const x = pad + t * span
    // Don't clamp y for display — custom curves can overshoot the pad box
    // slightly; the editor shows that intentionally. Thumbnails still look fine.
    const y = pad + (1 - fn(t)) * span
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return pts.join(" ")
}

/** The dot's {x,y} on the curve at progress t, in the same box as `easingSvgPath`. */
export function easingDotAt(
  kind: ClipEasingKind,
  t: number,
  size = 100,
  pad = 14,
  bezier?: ClipEasingBezier
): { x: number; y: number } {
  const fn =
    kind === "custom"
      ? cubicBezierEase(normalizeBezier(bezier))
      : PRESET_EASING_FNS[kind]
  const span = size - pad * 2
  const p = clamp01(t)
  return {
    x: pad + p * span,
    y: pad + (1 - fn(p)) * span,
  }
}

/** Map unit (x,y) in [0,1]² (y-up) into the padded SVG box (y-down). */
export function unitToSvg(
  x: number,
  y: number,
  size = 100,
  pad = 14
): { x: number; y: number } {
  const span = size - pad * 2
  return {
    x: pad + x * span,
    // y can sit outside [0,1] for overshoot — map linearly so handles leave the
    // pad when the user drags past the endpoints.
    y: pad + (1 - y) * span,
  }
}

/** Inverse of `unitToSvg`. */
export function svgToUnit(
  sx: number,
  sy: number,
  size = 100,
  pad = 14
): { x: number; y: number } {
  const span = size - pad * 2
  return {
    x: (sx - pad) / span,
    y: 1 - (sy - pad) / span,
  }
}
