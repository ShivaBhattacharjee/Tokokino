// The single motion applied to every animation clip.
//
// A clip reveals the screenshot by interpolating these keyframe arrays over the
// clip's local progress (0..1). The SAME sampler drives both the live in-editor
// playback and the exported video/GIF frames, so the preview always matches the
// output.
//
// Conventions:
//  - x / y are percentages of the animated element's own box (resolution
//    independent — CSS `translate(%)` is relative to the element).
//  - scale: 1 = 100%. rotate*: degrees. blur: px. opacity: 0..1.

/** Default length of a newly-added clip. */
export const DEFAULT_CLIP_DURATION_MS = 1200

type Keyframes = {
  opacity?: number[]
  scale?: number[]
  x?: number[]
  y?: number[]
  rotate?: number[]
  rotateX?: number[]
  rotateY?: number[]
  blur?: number[]
}

export type SampledTransform = {
  opacity: number
  scale: number
  x: number
  y: number
  rotate: number
  rotateX: number
  rotateY: number
  blur: number
}

const BASE_TRANSFORM: SampledTransform = {
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  blur: 0,
}

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const MOTION_KEYFRAMES: Keyframes = {
  opacity: [0, 1],
  scale: [0.82, 1],
  y: [14, 0],
  blur: [10, 0],
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Interpolate a keyframe array at eased progress p (0..1). */
function sampleTrack(track: number[] | undefined, fallback: number, p: number) {
  if (!track || track.length === 0) return fallback
  if (track.length === 1) return track[0]
  const segments = track.length - 1
  const scaled = clamp01(p) * segments
  const idx = Math.min(Math.floor(scaled), segments - 1)
  return lerp(track[idx], track[idx + 1], scaled - idx)
}

function sampleMotion(p: number): SampledTransform {
  const eased = easeOutBack(clamp01(p))
  const kf = MOTION_KEYFRAMES
  return {
    opacity: sampleTrack(kf.opacity, BASE_TRANSFORM.opacity, eased),
    scale: sampleTrack(kf.scale, BASE_TRANSFORM.scale, eased),
    x: sampleTrack(kf.x, BASE_TRANSFORM.x, eased),
    y: sampleTrack(kf.y, BASE_TRANSFORM.y, eased),
    rotate: sampleTrack(kf.rotate, BASE_TRANSFORM.rotate, eased),
    rotateX: sampleTrack(kf.rotateX, BASE_TRANSFORM.rotateX, eased),
    rotateY: sampleTrack(kf.rotateY, BASE_TRANSFORM.rotateY, eased),
    blur: sampleTrack(kf.blur, BASE_TRANSFORM.blur, eased),
  }
}

function round(n: number) {
  return Math.round(n * 1000) / 1000
}

/**
 * Convert a sampled transform into concrete CSS applied to the animation
 * wrapper. `blurScale` (default 1) lets the exporter scale blur px by the
 * export pixel ratio so it matches the preview visually.
 */
export function transformToCss(
  t: SampledTransform,
  blurScale = 1
): { transform: string; opacity: string; filter: string } {
  const parts: string[] = []
  if (t.rotateX !== 0 || t.rotateY !== 0) parts.push("perspective(900px)")
  if (t.x !== 0 || t.y !== 0)
    parts.push(`translate(${round(t.x)}%, ${round(t.y)}%)`)
  if (t.scale !== 1) parts.push(`scale(${round(t.scale)})`)
  if (t.rotate !== 0) parts.push(`rotate(${round(t.rotate)}deg)`)
  if (t.rotateX !== 0) parts.push(`rotateX(${round(t.rotateX)}deg)`)
  if (t.rotateY !== 0) parts.push(`rotateY(${round(t.rotateY)}deg)`)
  return {
    transform: parts.length ? parts.join(" ") : "none",
    opacity: String(round(t.opacity)),
    filter: t.blur > 0.01 ? `blur(${round(t.blur * blurScale)}px)` : "none",
  }
}

/**
 * Compose the motion of every clip active at `timeMs` into one transform. Used
 * identically by live playback and by the frame exporter so preview and output
 * match. Contributions compose multiplicatively for scale/opacity and additively
 * for translation/rotation/blur. A clip holds progress 0 before its start and 1
 * after its end.
 */
export function composeTransformAtTime(
  clips: { startMs: number; durationMs: number }[],
  timeMs: number
): SampledTransform {
  const result: SampledTransform = { ...BASE_TRANSFORM }
  for (const clip of clips) {
    if (clip.durationMs <= 0) continue
    const progress = clamp01((timeMs - clip.startMs) / clip.durationMs)
    const s = sampleMotion(progress)
    result.opacity *= s.opacity
    result.scale *= s.scale
    result.x += s.x
    result.y += s.y
    result.rotate += s.rotate
    result.rotateX += s.rotateX
    result.rotateY += s.rotateY
    result.blur += s.blur
  }
  return result
}
