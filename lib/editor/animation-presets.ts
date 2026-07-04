// Animation presets for Animate mode.
//
// A preset is a set of numeric keyframe arrays evaluated over a clip's local
// progress (0..1). The SAME `samplePreset` interpolator drives both the live
// in-editor playback and the exported video/GIF frames, so the preview always
// matches the output.
//
// Conventions:
//  - x / y are percentages of the animated element's own box (resolution
//    independent — CSS `translate(%)` is relative to the element), so exports
//    at any resolution move by the same visual amount.
//  - scale: 1 = 100%. rotate*: degrees. blur: px. opacity: 0..1.

export type AnimationCategory = "Reveal" | "Emphasis" | "Exit"

export type PresetKeyframes = {
  opacity?: number[]
  scale?: number[]
  x?: number[]
  y?: number[]
  rotate?: number[]
  rotateX?: number[]
  rotateY?: number[]
  blur?: number[]
}

export type EaseName = "linear" | "easeOut" | "easeInOut" | "easeOutBack"

export type AnimationPreset = {
  id: string
  name: string
  category: AnimationCategory
  defaultDurationMs: number
  ease: EaseName
  keyframes: PresetKeyframes
  /** When true, the preset reads as an idle loop rather than a one-shot reveal. */
  loop?: boolean
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

export const BASE_TRANSFORM: SampledTransform = {
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  blur: 0,
}

// ---------------------------------------------------------------------------
// Easing (pure functions so export stays deterministic)
// ---------------------------------------------------------------------------

const EASE_FNS: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
}

/** Interpolate a keyframe array at eased progress p (0..1). */
function sampleTrack(track: number[] | undefined, fallback: number, p: number) {
  if (!track || track.length === 0) return fallback
  if (track.length === 1) return track[0]
  const segments = track.length - 1
  const scaled = clamp01(p) * segments
  const idx = Math.min(Math.floor(scaled), segments - 1)
  const localT = scaled - idx
  return lerp(track[idx], track[idx + 1], localT)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * Sample a preset at raw progress `p` (0..1, unclamped-safe). Returns the full
 * transform; keys the preset doesn't define fall back to BASE_TRANSFORM.
 */
export function samplePreset(
  preset: AnimationPreset,
  p: number
): SampledTransform {
  const eased = EASE_FNS[preset.ease](clamp01(p))
  const kf = preset.keyframes
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
  // A leading perspective() gives this element's own 3D rotations depth
  // without needing `perspective`/`preserve-3d` on an ancestor.
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

function round(n: number) {
  return Math.round(n * 1000) / 1000
}

/**
 * Compose the transform of every clip active at `timeMs` into one transform.
 * Used identically by live playback and by the frame exporter so preview and
 * output match. Contributions compose multiplicatively for scale/opacity and
 * additively for translation/rotation/blur.
 *
 * A one-shot clip holds progress 0 before its start (e.g. a reveal keeps the
 * screenshot hidden until it plays) and progress 1 after its end. Loop clips
 * cycle continuously once started.
 */
export function composeTransformAtTime(
  clips: { presetId: string; startMs: number; durationMs: number }[],
  timeMs: number
): SampledTransform {
  const result: SampledTransform = { ...BASE_TRANSFORM }
  for (const clip of clips) {
    const preset = getAnimationPreset(clip.presetId)
    if (!preset || clip.durationMs <= 0) continue

    let progress: number
    if (preset.loop) {
      if (timeMs < clip.startMs) continue
      progress = ((timeMs - clip.startMs) % clip.durationMs) / clip.durationMs
    } else {
      progress = (timeMs - clip.startMs) / clip.durationMs
      progress = progress < 0 ? 0 : progress > 1 ? 1 : progress
    }

    const s = samplePreset(preset, progress)
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

// ---------------------------------------------------------------------------
// Preset catalogue
// ---------------------------------------------------------------------------

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "hero-landing",
    name: "Hero Landing",
    category: "Reveal",
    defaultDurationMs: 1200,
    ease: "easeOutBack",
    keyframes: {
      opacity: [0, 1],
      scale: [0.82, 1],
      y: [14, 0],
      blur: [10, 0],
    },
  },
  {
    id: "rise-up",
    name: "Rise Up",
    category: "Reveal",
    defaultDurationMs: 1000,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
      y: [40, 0],
      blur: [6, 0],
    },
  },
  {
    id: "fade-in",
    name: "Fade In",
    category: "Reveal",
    defaultDurationMs: 900,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
    },
  },
  {
    id: "slide-in-left",
    name: "Slide In Left",
    category: "Reveal",
    defaultDurationMs: 1000,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
      x: [-45, 0],
    },
  },
  {
    id: "slide-in-right",
    name: "Slide In Right",
    category: "Reveal",
    defaultDurationMs: 1000,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
      x: [45, 0],
    },
  },
  {
    id: "zoom-blur-in",
    name: "Zoom Blur In",
    category: "Reveal",
    defaultDurationMs: 1100,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
      scale: [1.25, 1],
      blur: [16, 0],
    },
  },
  {
    id: "tilt-reveal",
    name: "Tilt Reveal",
    category: "Reveal",
    defaultDurationMs: 1200,
    ease: "easeOut",
    keyframes: {
      opacity: [0, 1],
      rotateX: [24, 0],
      y: [12, 0],
      scale: [0.94, 1],
    },
  },
  {
    id: "pop",
    name: "Pop",
    category: "Emphasis",
    defaultDurationMs: 700,
    ease: "easeOutBack",
    keyframes: {
      scale: [1, 1.12, 1],
    },
  },
  {
    id: "float-loop",
    name: "Float Loop",
    category: "Emphasis",
    defaultDurationMs: 2600,
    ease: "easeInOut",
    loop: true,
    keyframes: {
      y: [0, -4, 0, 4, 0],
      rotate: [0, 0.6, 0, -0.6, 0],
    },
  },
]

export const ANIMATION_CATEGORY_ORDER: AnimationCategory[] = [
  "Reveal",
  "Emphasis",
  "Exit",
]

const PRESET_BY_ID = new Map(ANIMATION_PRESETS.map((p) => [p.id, p]))

export function getAnimationPreset(id: string): AnimationPreset | undefined {
  return PRESET_BY_ID.get(id)
}

export function presetsByCategory(): Record<
  AnimationCategory,
  AnimationPreset[]
> {
  const grouped = { Reveal: [], Emphasis: [], Exit: [] } as Record<
    AnimationCategory,
    AnimationPreset[]
  >
  for (const preset of ANIMATION_PRESETS) grouped[preset.category].push(preset)
  return grouped
}
