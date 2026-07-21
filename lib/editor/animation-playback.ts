// Pure timing helpers for Animate-mode on-canvas playback.
//
// A clip reveals its target screenshot by interpolating that screenshot's
// transform from a neutral rest pose (progress 0) to the screenshot's current
// inspector pose (progress 1) over the clip's own window. This module only
// answers "how far toward the pose is a target at time T" — the AnimationLayer
// turns that progress into concrete CSS override vars. Kept React-free so it's
// testable and shared between live playback and (later) the exporter.

import { clipProgressEase, clipReleaseEase, clipReleaseMs } from "./clip-easing"
import { hexToRgb } from "./color-utils"
import { DEFAULT_CANVAS_BASE } from "./store/defaults"
import type {
  AnimationClip,
  AnimationClipTarget,
  AnimationEffect,
  AssetFilter,
  Background,
  BackdropEffects,
  BackdropLighting,
  BackdropPattern,
  Border,
  ClipBaseline,
  ClipSlotPose,
  CropRegion,
  Overlay,
  Portrait,
  ScreenshotPosition,
  Shadow,
  Tilt,
} from "./state-types"

/** The whole frame — what an un-cropped video reveals from / returns to. */
export const FULL_CROP_REGION: CropRegion = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}

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
  canvasBorderRadius: DEFAULT_CANVAS_BASE.canvasBorderRadius,
  shadow: DEFAULT_CANVAS_BASE.shadow,
  backdropEffects: DEFAULT_CANVAS_BASE.backdrop.effects,
  lighting: DEFAULT_CANVAS_BASE.backdrop.lighting,
  background: DEFAULT_CANVAS_BASE.background,
  filter: DEFAULT_CANVAS_BASE.backdrop.filter,
  portrait: DEFAULT_CANVAS_BASE.portrait,
  pattern: DEFAULT_CANVAS_BASE.backdrop.pattern,
  overlay: DEFAULT_CANVAS_BASE.overlay,
  border: DEFAULT_CANVAS_BASE.border,
  borderRadius: DEFAULT_CANVAS_BASE.borderRadius,
  crop: FULL_CROP_REGION,
  slots: {},
}

/** Neutral lighting the reveal flows FROM — dark (zero intensity). */
export const REST_LIGHTING: BackdropLighting = {
  ...DEFAULT_CANVAS_BASE.backdrop.lighting,
  intensity: 0,
}

/**
 * Dark entrance pose for the first lighting keyframe: the glow fades in AT its
 * own position (intensity 0 → target) with NO positional travel. A light placed
 * at "top" simply brightens at the top instead of dropping in from off-canvas —
 * so there's no falling/sliding motion on the reveal (or at the hold/loop
 * boundary). Position still animates BETWEEN keyframes via `lightingBetween`.
 */
export function lightingEntranceRest(
  lighting?: BackdropLighting
): BackdropLighting {
  const base = lighting ?? REST_LIGHTING
  return { ...base, intensity: 0 }
}

/** A clip's captured baseline, falling back to the canvas defaults. */
export function clipBaseline(clip: AnimationClip): ClipBaseline {
  return clip.baseline ?? DEFAULT_BASELINE
}

/** Neutral rest pose for an extra screenshot slot (flat, full-size, no spin,
 * no shadow — so shadow reveals in like the main screenshot's does). */
export const NEUTRAL_SLOT_POSE: ClipSlotPose = {
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  rotation: 0,
  shadow: {
    type: "none",
    intensity: 0,
    color: "#000000",
    lightSource: "center",
  },
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
    canvasBorderRadius: firstPose.canvasBorderRadius,
    background: firstPose.background,
    backdropEffects: firstPose.backdropEffects,
    // Lighting is an "intro" property: it enters from the target side/corner so
    // a top light travels top → target instead of coming from a fixed default.
    lighting: lightingEntranceRest(firstPose.lighting),
    slots: {},
  }
}

/** True when two lightings are a different selection (drives keyframe icons). */
export function lightingsDiffer(
  a: BackdropLighting,
  b: BackdropLighting
): boolean {
  return (
    a.target !== b.target ||
    a.intensity !== b.intensity ||
    a.direction !== b.direction ||
    a.color !== b.color
  )
}

/** Lighting direction as grid coords (row/col 0..4); "center" is the 2,2 middle. */
function lightingGridPoint(direction: string): { r: number; c: number } {
  if (direction === "center") return { r: 2, c: 2 }
  const match = direction.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/)
  const r = Number(match?.[1])
  const c = Number(match?.[2])
  return { r: Number.isFinite(r) ? r : 2, c: Number.isFinite(c) ? c : 2 }
}

/** Interpolate two "#rrggbb" colours in RGB space. */
function lerpHexColor(from: string, to: string, p: number): string {
  const a = hexToRgb(from || "#ffffff")
  const b = hexToRgb(to || "#ffffff")
  const ch = (x: number, y: number) =>
    Math.round(clampChannel(lerp(x, y, p)))
      .toString(16)
      .padStart(2, "0")
  return `#${ch(a.r, b.r)}${ch(a.g, b.g)}${ch(a.b, b.b)}`
}

function clampChannel(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

/**
 * Lighting at progress p, easing `from` → `to`. Intensity, direction (as
 * fractional grid coords, so the light MOVES smoothly across the backdrop) and
 * colour all ease, letting two lighting keyframes chain — the light glides from
 * one position/strength/colour to the next instead of both showing at once.
 * `target` (inner/outer) snaps to the destination keyframe.
 */
export function lightingBetween(
  from: BackdropLighting,
  to: BackdropLighting,
  p: number
): BackdropLighting {
  const a = lightingGridPoint(from.direction)
  const b = lightingGridPoint(to.direction)
  return {
    target: to.target,
    intensity: lerp(from.intensity, to.intensity, p),
    direction: `${lerp(a.r, b.r, p)}-${lerp(a.c, b.c, p)}`,
    color: lerpHexColor(from.color, to.color, p),
  }
}

/**
 * Which lighting sides (inner = on-screenshot, outer = on-canvas backdrop) a
 * timeline actually uses. Pure-inner animations must NOT mount/drive the outer
 * overlay — otherwise the glow appears on the canvas and only later "settles"
 * onto the image when targetMix reaches 1.
 *
 * A dark baseline (intensity 0) does not count as using its stored target —
 * the light enters on the first keyframe's own side via `lightingEntranceRest`.
 */
export function lightingSidesUsed(
  clips: readonly AnimationClip[],
  committed: BackdropLighting
): { inner: boolean; outer: boolean } {
  let inner = committed.intensity > 0 && committed.target === "inner"
  let outer = committed.intensity > 0 && committed.target === "outer"

  for (const c of clips) {
    if (!clipOwns(c, "lighting")) continue
    // Slot-only lighting drives the slot's own overlay — not the main
    // canvas inner/outer mounts.
    if (!clipAffectsMain(c)) continue

    const pose = clipPose(c).lighting
    if (pose) {
      // Keyframe target always counts — even at intensity 0 the side is where
      // the light will appear as it eases in.
      if (pose.target === "inner") inner = true
      if (pose.target === "outer") outer = true
    }
    const base = clipBaseline(c).lighting
    // Only a LIT baseline forces the opposite side (crossfade from an existing
    // light). A dark baseline is replaced by lightingEntranceRest on the
    // keyframe's own side, so it must not pull in the other overlay.
    if (base && base.intensity > 0) {
      if (base.target === "inner") inner = true
      if (base.target === "outer") outer = true
    }
  }

  return { inner, outer }
}

/**
 * 0 = fully outer (canvas), 1 = fully inner (screenshot). Locked when the
 * timeline never crosses sides; only lerps for a real inner↔outer depth shift.
 */
export function lightingTargetMixAt(
  frames: readonly {
    startMs: number
    durationMs: number
    value: BackdropLighting
    ease?: (rawT: number) => number
    releaseMs?: number
    releaseEase?: (rawT: number) => number
  }[],
  timeMs: number,
  rest: BackdropLighting
): number {
  if (frames.length === 0) {
    return rest.target === "inner" ? 1 : 0
  }
  const sides = new Set<string>()
  sides.add(rest.target === "inner" ? "inner" : "outer")
  for (const f of frames) {
    sides.add(f.value.target === "inner" ? "inner" : "outer")
  }
  if (sides.size === 1) {
    return sides.has("inner") ? 1 : 0
  }
  const restMix = rest.target === "inner" ? 1 : 0
  return (
    sampleKeyframes<number>(
      frames.map((f) => ({
        startMs: f.startMs,
        durationMs: f.durationMs,
        value: f.value.target === "inner" ? 1 : 0,
        ease: f.ease,
        // Forwarded, or a released clip would slide its light back to the rest
        // POSITION while the side it renders on stayed pinned to the pose.
        releaseMs: f.releaseMs,
        releaseEase: f.releaseEase,
      })),
      timeMs,
      restMix,
      lerp
    ) ?? restMix
  )
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

/** A border renders nothing when it has no colour or zero width. */
function borderVisible(b: Border): boolean {
  return !!b.color && b.width > 0
}

/** A border that renders nothing — the rest a first border keyframe reveals FROM. */
export const INVISIBLE_BORDER: Border = {
  color: null,
  width: 0,
  style: "solid",
  padding: 0,
}

/** True when two borders are a different look (both-invisible borders are equal). */
export function bordersDiffer(a: Border, b: Border): boolean {
  if (!borderVisible(a) && !borderVisible(b)) return false
  return (
    a.color !== b.color ||
    a.width !== b.width ||
    (a.style || "solid") !== (b.style || "solid") ||
    a.padding !== b.padding
  )
}

/**
 * Border at progress p, easing `from` → `to`. Width and inner padding ease
 * numerically; the colour eases as RGBA so a border can FADE in from nothing
 * (an invisible side lends its alpha=0 to the other's rgb) and a colour change
 * cross-blends continuously. Style snaps to the destination past the midpoint
 * (an `outline` can't render two styles at once). This lets a first border
 * keyframe emerge from the committed base (0-width / no colour) and lets a later
 * keyframe recolour or resize the border without any jump.
 */
export function borderBetween(from: Border, to: Border, p: number): Border {
  const fromVis = borderVisible(from)
  const toVis = borderVisible(to)
  // An invisible side borrows the other's rgb so ONLY the alpha fades (no hue
  // slide toward an arbitrary default colour).
  const fromRgb = hexToRgb(from.color || to.color || "#ffffff")
  const toRgb = hexToRgb(to.color || from.color || "#ffffff")
  const r = Math.round(clampChannel(lerp(fromRgb.r, toRgb.r, p)))
  const g = Math.round(clampChannel(lerp(fromRgb.g, toRgb.g, p)))
  const b = Math.round(clampChannel(lerp(fromRgb.b, toRgb.b, p)))
  const a = clamp01(lerp(fromVis ? 1 : 0, toVis ? 1 : 0, p))
  return {
    color: `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`,
    width: lerp(from.width, to.width, p),
    style: p >= 0.5 ? (to.style ?? "solid") : (from.style ?? "solid"),
    padding: lerp(from.padding, to.padding, p),
  }
}

/** Light source as grid coords (row/col 0..4); "center" is the 2,2 middle. */
function parseLightSource(ls: string): { r: number; c: number } {
  if (ls === "center") return { r: 2, c: 2 }
  const [r, c] = ls.split("-").map(Number)
  return { r: Number.isFinite(r) ? r : 2, c: Number.isFinite(c) ? c : 2 }
}

/**
 * Shadow at progress p, animating `from` → `to`. Intensity eases from whatever
 * the previous keyframe actually rendered, so back-to-back shadow keyframes stay
 * CONTINUOUS: a drop shadow morphing into a soft one keeps its weight instead of
 * snapping the old shadow to invisible and looking like it just ended. Only when
 * the previous shadow rendered NOTHING (type "none" or zero intensity) do we
 * grow in from 0 — the intended reveal for the first shadow keyframe.
 *
 * Light direction eases only when the type is unchanged (a same-type shadow
 * rotating its cast); across a type change it jumps straight to the target
 * direction. `shadowCss` parses fractional grid coords, so the interpolated
 * "r-c" light source renders a smooth intermediate offset.
 */
export function shadowBetween(from: Shadow, to: Shadow, p: number): Shadow {
  const sameType = from.type === to.type
  const fromIntensity = shadowInvisible(from) ? 0 : from.intensity
  const toLs = parseLightSource(to.lightSource)
  const fromLs = sameType ? parseLightSource(from.lightSource) : toLs
  return {
    ...to,
    intensity: lerp(fromIntensity, to.intensity, p),
    lightSource: `${lerp(fromLs.r, toLs.r, p)}-${lerp(fromLs.c, toLs.c, p)}`,
  }
}

/**
 * Sample the shadow keyframe track, returning the shadow LAYER(S) to render at
 * `timeMs`. `box-shadow` (and chained `drop-shadow()`) can stack layers, so a
 * transition between two DIFFERENT, both-visible shadow types is rendered as a
 * cross-blend: the previous shadow eases back OUT (mirroring how it revealed)
 * beneath the next shadow easing IN, instead of the old one snapping off and the
 * new one popping in. Every other case is a single continuous layer:
 *  - before the first keyframe → the neutral rest shadow,
 *  - a same-type change → one shadow morphing intensity + direction,
 *  - a reveal from nothing → one shadow growing in from 0,
 *  - a retract to nothing → the old shadow easing OUT (keeping its own type so
 *    it fades rather than vanishing),
 *  - a gap / past the end → hold that keyframe's shadow, or blend it back to
 *    `rest` over `releaseMs` when the frame releases.
 * Returns null when no keyframe animates the shadow (leave the committed value).
 */
export function sampleShadowLayers(
  frames: readonly {
    startMs: number
    durationMs: number
    value: Shadow
    ease?: (rawT: number) => number
    /** Blend back to `rest` over this many ms after the frame ends. 0 = hold. */
    releaseMs?: number
    /** Curve for that release. Falls back to the historic ease-out. */
    releaseEase?: (rawT: number) => number
  }[],
  timeMs: number,
  rest: Shadow
): Shadow[] | null {
  if (frames.length === 0) return null
  const sorted = [...frames].sort((a, b) => a.startMs - b.startMs)

  /** How far frame `i` has released at `at` (0 = still on its pose). */
  const releaseProgress = (i: number, at: number): number => {
    const f = sorted[i]
    const release = f.releaseMs ?? 0
    if (release <= 0) return 0
    const raw = clamp01((at - (f.startMs + f.durationMs)) / release)
    return raw <= 0 ? 0 : (f.releaseEase ?? easeOut)(raw)
  }

  // What frame `i` renders at a time past its own window: its pose held, or run
  // back out to rest under the same blend rules the reveal used — so a shadow
  // recedes exactly the way it arrived, cross-blending when rest is a different
  // visible type and fading on its own type when rest renders nothing.
  const releasedLayers = (i: number, at: number): Shadow[] => {
    const p = releaseProgress(i, at)
    return p <= 0 ? [sorted[i].value] : layersBetween(sorted[i].value, rest, p)
  }

  // The single shadow a later frame departs FROM. Taking the OUTGOING layer
  // keeps the pose's own type: blending straight to rest would adopt rest's
  // type, and a rest of `none` would leave a shadow that renders nothing.
  const settledValue = (i: number, at: number): Shadow =>
    releasedLayers(i, at)[0]

  if (timeMs < sorted[0].startMs) return [rest]
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]
    // Gap: released frames keep blending toward rest instead of holding.
    if (timeMs < f.startMs) return releasedLayers(i - 1, timeMs)
    if (timeMs <= f.startMs + f.durationMs) {
      const from = i > 0 ? settledValue(i - 1, f.startMs) : rest
      const ease = f.ease ?? easeOut
      return layersBetween(
        from,
        f.value,
        ease(clamp01((timeMs - f.startMs) / f.durationMs))
      )
    }
  }
  return releasedLayers(sorted.length - 1, timeMs)
}

/**
 * The shadow layer(s) rendering a `from` → `to` blend at progress p. Shared by
 * the reveal and the release so both directions cross-blend identically.
 */
function layersBetween(from: Shadow, to: Shadow, p: number): Shadow[] {
  const fromVisible = !shadowInvisible(from)
  const toVisible = !shadowInvisible(to)
  // Retract to nothing: fade the source out on its own type so it recedes
  // the way it arrived rather than blinking off.
  if (fromVisible && !toVisible) {
    return [{ ...from, intensity: lerp(from.intensity, 0, p) }]
  }
  // Two different visible shadows → cross-blend (old OUT, new IN).
  if (fromVisible && toVisible && from.type !== to.type) {
    return [
      { ...from, intensity: lerp(from.intensity, 0, p) },
      { ...to, intensity: lerp(0, to.intensity, p) },
    ]
  }
  // Same-type morph, reveal from nothing, or nothing→nothing: one layer.
  return [shadowBetween(from, to, p)]
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

/**
 * Crop source rect at progress p. Eased on x/y/width/height directly, which pans
 * and zooms the visible window in one motion; the laid-out box is never touched
 * (see `ClipBaseline.crop`).
 */
export function cropRegionBetween(
  from: CropRegion,
  to: CropRegion,
  p: number
): CropRegion {
  return {
    x: lerp(from.x, to.x, p),
    y: lerp(from.y, to.y, p),
    width: lerp(from.width, to.width, p),
    height: lerp(from.height, to.height, p),
  }
}

/** True when this keyframe explicitly owns (animates) the given effect. */
export function clipOwns(
  clip: AnimationClip,
  effect: AnimationEffect
): boolean {
  return (clip.effects ?? []).includes(effect)
}

/** CSS var carrying a background keyframe layer's opacity (its reveal progress
 * during playback; falls back to a rest opacity when unset). */
export const backgroundLayerOpacityVar = (clipId: string) =>
  `--canvas-bg-op-${clipId}`

export type AnimateBgLayer = {
  id: string
  background: Background
  /** Opacity at REST (not playing): true (1) when this keyframe is at/before the
   * selected one, false (0) otherwise — so at rest the selected keyframe's
   * background shows through the stack. */
  restOpaque: boolean
}

export type AnimateBgStack = {
  /** Background shown before the first background keyframe (null → reveal from
   * black, i.e. the first background keyframe is the very first clip). */
  base: Background | null
  /** One layer per background keyframe, chronological (bottom → top). */
  layers: AnimateBgLayer[]
}

export const EMPTY_BG_STACK: AnimateBgStack = { base: null, layers: [] }

/**
 * Build the stacked background layers for Animate mode. Each background keyframe
 * gets its OWN layer; AnimationLayer fades them in one after another so multiple
 * background swaps CHAIN (bg1 → bg2 → bg3) — each cross-fading from the previous
 * one — instead of every swap cross-fading from the same initial background. The
 * selected keyframe's layer uses the live committed background so its edits
 * preview; the others read their captured pose. Empty stack when the background
 * isn't animated (the caller renders the committed background as usual).
 */
export function resolveAnimateBgStack(
  clips: readonly AnimationClip[],
  committedBackground: Background,
  selectedClipId: string | null
): AnimateBgStack {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const isBgKeyframe = (c: AnimationClip) =>
    clipAffectsMain(c) && clipOwns(c, "background")
  const bgClips = sorted.filter(isBgKeyframe)
  if (bgClips.length === 0) return EMPTY_BG_STACK

  // Base = the background shown BEFORE the first background keyframe. A canvas
  // always has a background, so this is that keyframe's captured baseline (the
  // background it was changed FROM). The first swap cross-fades from it — never
  // from black — even when the keyframe is the very first clip.
  const base = clipBaseline(bgClips[0]).background

  // At rest, show the selected keyframe's background (or the final one when the
  // selection isn't a background keyframe): everything up to that index opaque.
  const selectedBgIndex = bgClips.findIndex((c) => c.id === selectedClipId)
  const restCutoff =
    selectedBgIndex === -1 ? bgClips.length - 1 : selectedBgIndex

  const layers: AnimateBgLayer[] = bgClips.map((c, i) => ({
    id: c.id,
    background:
      c.id === selectedClipId ? committedBackground : clipPose(c).background,
    restOpaque: i <= restCutoff,
  }))
  return { base, layers }
}

/** True when two backdrop filters are a different selection. */
export function filtersDiffer(a: AssetFilter, b: AssetFilter): boolean {
  return a !== b
}

/** CSS var carrying a filter keyframe layer's opacity (its reveal progress). */
export const filterLayerOpacityVar = (clipId: string) =>
  `--canvas-filter-op-${clipId}`

export type AnimateFilterLayer = {
  id: string
  filter: AssetFilter
  /** Opacity at REST (not playing): true (1) when at/before the selected
   * keyframe, false (0) otherwise — so at rest the selected keyframe shows. */
  restOpaque: boolean
}

export type AnimateFilterStack = {
  /** Filter shown before the first filter keyframe (the one it changed FROM). */
  base: AssetFilter
  /** One layer per filter keyframe, chronological (bottom → top). */
  layers: AnimateFilterLayer[]
}

export const EMPTY_FILTER_STACK: AnimateFilterStack = {
  base: "none",
  layers: [],
}

/**
 * Build the stacked filter layers for Animate mode — the exact mirror of
 * `resolveAnimateBgStack`, but the layers differ by backdrop FILTER (each is the
 * committed background rendered with that keyframe's filter). AnimationLayer
 * fades them in one after another so multiple filter changes CHAIN (f1 → f2 →
 * f3), each cross-fading over the one beneath. Empty stack when the filter isn't
 * animated (the caller renders the committed filter as usual).
 */
export function resolveAnimateFilterStack(
  clips: readonly AnimationClip[],
  committedFilter: AssetFilter,
  selectedClipId: string | null
): AnimateFilterStack {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const isFilterKeyframe = (c: AnimationClip) =>
    clipAffectsMain(c) && clipOwns(c, "filter")
  const filterClips = sorted.filter(isFilterKeyframe)
  if (filterClips.length === 0) return EMPTY_FILTER_STACK

  const base = clipBaseline(filterClips[0]).filter ?? "none"

  const selectedIndex = filterClips.findIndex((c) => c.id === selectedClipId)
  const restCutoff =
    selectedIndex === -1 ? filterClips.length - 1 : selectedIndex

  const layers: AnimateFilterLayer[] = filterClips.map((c, i) => ({
    id: c.id,
    filter:
      c.id === selectedClipId
        ? committedFilter
        : (clipPose(c).filter ?? "none"),
    restOpaque: i <= restCutoff,
  }))
  return { base, layers }
}

/** True when two portraits are a different selection (any field). */
export function portraitsDiffer(a: Portrait, b: Portrait): boolean {
  return (
    a.mode !== b.mode ||
    a.intensity !== b.intensity ||
    a.position !== b.position ||
    a.distance !== b.distance
  )
}

/** CSS var carrying a portrait keyframe layer's crossfade opacity. */
export const portraitLayerOpacityVar = (clipId: string) =>
  `--canvas-portrait-op-${clipId}`

/** CSS var for the pre-first-keyframe base portrait's crossfade opacity. */
export const PORTRAIT_BASE_OPACITY_VAR = "--canvas-portrait-op-base"

export type AnimatePortraitLayer = {
  id: string
  portrait: Portrait
  /** Opacity at REST (not playing): true (1) ONLY for the selected keyframe.
   * Portrait overlays are additive/transparent, so unlike the opaque bg/filter
   * stacks exactly ONE may show at rest — never a cumulative stack. */
  restOpaque: boolean
}

export type AnimatePortraitStack = {
  /** Portrait shown before the first portrait keyframe (changed FROM). */
  base: Portrait
  /** One layer per portrait keyframe, chronological (bottom → top). */
  layers: AnimatePortraitLayer[]
}

export const EMPTY_PORTRAIT_STACK: AnimatePortraitStack = {
  base: DEFAULT_CANVAS_BASE.portrait,
  layers: [],
}

/**
 * Build the portrait keyframe layers for Animate mode. Like the bg/filter stacks
 * it's a base + one layer per keyframe, but because portrait overlays are
 * SEMI-TRANSPARENT (additive), the AnimationLayer drives a CROSSFADE-CHAIN: each
 * layer fades in over its window then fades back out as the NEXT one fades in, so
 * only one (or a blend of two adjacent) portrait shows at a time instead of the
 * vignettes accumulating. At rest only the selected keyframe's layer is opaque.
 */
export function resolveAnimatePortraitStack(
  clips: readonly AnimationClip[],
  committedPortrait: Portrait,
  selectedClipId: string | null
): AnimatePortraitStack {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const isPortraitKeyframe = (c: AnimationClip) =>
    clipAffectsMain(c) && clipOwns(c, "portrait")
  const portraitClips = sorted.filter(isPortraitKeyframe)
  if (portraitClips.length === 0) return EMPTY_PORTRAIT_STACK

  const base =
    clipBaseline(portraitClips[0]).portrait ?? DEFAULT_CANVAS_BASE.portrait

  const selectedIndex = portraitClips.findIndex((c) => c.id === selectedClipId)
  const restCutoff =
    selectedIndex === -1 ? portraitClips.length - 1 : selectedIndex

  const layers: AnimatePortraitLayer[] = portraitClips.map((c, i) => ({
    id: c.id,
    portrait:
      c.id === selectedClipId
        ? committedPortrait
        : (clipPose(c).portrait ?? DEFAULT_CANVAS_BASE.portrait),
    // Additive overlays → exactly the current keyframe shows at rest.
    restOpaque: i === restCutoff,
  }))
  return { base, layers }
}

/** True when two patterns are a different selection (ids or any param). */
export function patternsDiffer(
  a: BackdropPattern,
  b: BackdropPattern
): boolean {
  return (
    a.intensity !== b.intensity ||
    a.thickness !== b.thickness ||
    a.color !== b.color ||
    a.ids.length !== b.ids.length ||
    a.ids.some((id, i) => id !== b.ids[i])
  )
}

/** CSS var carrying a pattern keyframe layer's crossfade opacity. */
export const patternLayerOpacityVar = (clipId: string) =>
  `--canvas-pattern-op-${clipId}`

/** CSS var for the pre-first-keyframe base pattern's crossfade opacity. */
export const PATTERN_BASE_OPACITY_VAR = "--canvas-pattern-op-base"

export type AnimatePatternLayer = {
  id: string
  pattern: BackdropPattern
  /** Opacity at REST (not playing): true (1) ONLY for the selected keyframe —
   * pattern overlays are additive, so exactly one shows at rest. */
  restOpaque: boolean
}

export type AnimatePatternStack = {
  /** Pattern shown before the first pattern keyframe (changed FROM). */
  base: BackdropPattern
  /** One layer per pattern keyframe, chronological (bottom → top). */
  layers: AnimatePatternLayer[]
}

export const EMPTY_PATTERN_STACK: AnimatePatternStack = {
  base: DEFAULT_CANVAS_BASE.backdrop.pattern,
  layers: [],
}

/**
 * Build the pattern keyframe layers for Animate mode — same crossfade-chain as
 * the portrait stack (patterns are additive overlays): each layer fades in over
 * its window then back out as the next fades in. Each layer carries a full
 * BackdropPattern (its own ids/intensity/thickness/colour). At rest only the
 * selected keyframe's layer shows.
 */
export function resolveAnimatePatternStack(
  clips: readonly AnimationClip[],
  committedPattern: BackdropPattern,
  selectedClipId: string | null
): AnimatePatternStack {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const isPatternKeyframe = (c: AnimationClip) =>
    clipAffectsMain(c) && clipOwns(c, "pattern")
  const patternClips = sorted.filter(isPatternKeyframe)
  if (patternClips.length === 0) return EMPTY_PATTERN_STACK

  const base =
    clipBaseline(patternClips[0]).pattern ??
    DEFAULT_CANVAS_BASE.backdrop.pattern

  const selectedIndex = patternClips.findIndex((c) => c.id === selectedClipId)
  const restCutoff =
    selectedIndex === -1 ? patternClips.length - 1 : selectedIndex

  const layers: AnimatePatternLayer[] = patternClips.map((c, i) => ({
    id: c.id,
    pattern:
      c.id === selectedClipId
        ? committedPattern
        : (clipPose(c).pattern ?? DEFAULT_CANVAS_BASE.backdrop.pattern),
    restOpaque: i === restCutoff,
  }))
  return { base, layers }
}

/** True when two overlays are a different selection (texture, opacity, side). */
export function overlaysDiffer(a: Overlay, b: Overlay): boolean {
  return a.id !== b.id || a.opacity !== b.opacity || a.position !== b.position
}

/** CSS var carrying an overlay keyframe layer's crossfade opacity. */
export const overlayLayerOpacityVar = (clipId: string) =>
  `--canvas-overlay-op-${clipId}`

/** CSS var for the pre-first-keyframe base overlay's crossfade opacity. */
export const OVERLAY_BASE_OPACITY_VAR = "--canvas-overlay-op-base"

export type AnimateOverlayLayer = {
  id: string
  overlay: Overlay
  /** Opacity at REST (not playing): true (1) ONLY for the selected keyframe —
   * overlay textures are additive, so exactly one shows at rest. */
  restOpaque: boolean
}

export type AnimateOverlayStack = {
  /** Overlay shown before the first overlay keyframe (changed FROM). */
  base: Overlay
  /** One layer per overlay keyframe, chronological (bottom → top). Each renders
   * in ITS position's location (over vs under the screenshot), so a position
   * change crossfades the texture from one side to the other. */
  layers: AnimateOverlayLayer[]
}

export const EMPTY_OVERLAY_STACK: AnimateOverlayStack = {
  base: DEFAULT_CANVAS_BASE.overlay,
  layers: [],
}

/**
 * Build the texture-overlay keyframe layers for Animate mode — same additive
 * crossfade-chain as the portrait/pattern stacks. Each layer carries a full
 * Overlay (id/opacity/position); the renderer places it over OR under the
 * screenshot per its `position`, so a position change reads as the texture
 * gliding between the two sides (like lighting's inner↔outer). At rest only the
 * selected keyframe's layer shows.
 */
export function resolveAnimateOverlayStack(
  clips: readonly AnimationClip[],
  committedOverlay: Overlay,
  selectedClipId: string | null
): AnimateOverlayStack {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const isOverlayKeyframe = (c: AnimationClip) =>
    clipAffectsMain(c) && clipOwns(c, "overlay")
  const overlayClips = sorted.filter(isOverlayKeyframe)
  if (overlayClips.length === 0) return EMPTY_OVERLAY_STACK

  const base =
    clipBaseline(overlayClips[0]).overlay ?? DEFAULT_CANVAS_BASE.overlay

  const selectedIndex = overlayClips.findIndex((c) => c.id === selectedClipId)
  const restCutoff =
    selectedIndex === -1 ? overlayClips.length - 1 : selectedIndex

  const layers: AnimateOverlayLayer[] = overlayClips.map((c, i) => ({
    id: c.id,
    overlay:
      c.id === selectedClipId
        ? committedOverlay
        : (clipPose(c).overlay ?? DEFAULT_CANVAS_BASE.overlay),
    restOpaque: i === restCutoff,
  }))
  return { base, layers }
}

/**
 * Sample a per-effect keyframe track at time `timeMs`. Each frame is one
 * keyframe's window + the target value the effect reaches by the end of it.
 *  - no frames → null (the effect isn't animated; leave the committed value),
 *  - before the first frame → the neutral `rest` value (reveal origin),
 *  - inside a frame → eased interpolation from the PREVIOUS frame's value (or
 *    `rest` for the first) → this frame's value,
 *  - in a gap after a frame, or past the last → hold that frame's value, or ease
 *    it back to `rest` over `releaseMs` when the frame releases.
 * This is the single source of truth for continuity + hold across the timeline.
 */
export function sampleKeyframes<V>(
  frames: readonly {
    startMs: number
    durationMs: number
    value: V
    /** Per-clip progress remap (curve + speed). Falls back to the historic
     * ease-out when a caller doesn't supply the owning clip's easing. */
    ease?: (rawT: number) => number
    /** Ease back to `rest` over this many ms after the frame ends. 0 = hold. */
    releaseMs?: number
    /** Curve for that release. Falls back to the historic ease-out. */
    releaseEase?: (rawT: number) => number
  }[],
  timeMs: number,
  rest: V,
  lerpValue: (from: V, to: V, p: number) => V
): V | null {
  if (frames.length === 0) return null
  const sorted = [...frames].sort((a, b) => a.startMs - b.startMs)

  // What frame `i` reads as at a time past its own window: its pose, unwinding
  // toward rest when it releases. Sampling it AT the next frame's start (rather
  // than taking the pose flat) is what keeps a chain continuous — a frame that
  // begins the instant the previous one ends still departs from the full pose,
  // and one that begins mid-release departs from wherever the release got to.
  const settledAt = (i: number, at: number): V => {
    const f = sorted[i]
    const release = f.releaseMs ?? 0
    if (release <= 0) return f.value
    const p = clamp01((at - (f.startMs + f.durationMs)) / release)
    if (p <= 0) return f.value
    return lerpValue(f.value, rest, (f.releaseEase ?? easeOut)(p))
  }

  if (timeMs < sorted[0].startMs) return rest
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]
    if (timeMs < f.startMs) return settledAt(i - 1, timeMs) // gap
    if (timeMs <= f.startMs + f.durationMs) {
      const from = i > 0 ? settledAt(i - 1, f.startMs) : rest
      const ease = f.ease ?? easeOut
      return lerpValue(
        from,
        f.value,
        ease(clamp01((timeMs - f.startMs) / f.durationMs))
      )
    }
  }
  return settledAt(sorted.length - 1, timeMs) // past the end
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
 *  - in a gap after a clip, or past the last clip → 1 (holds the pose), or eased
 *    back down toward 0 when that clip releases.
 * With no clips the target is never animated, so it sits at its full pose (1).
 */
export function clipsProgressAt(
  clips: readonly AnimationClip[],
  timeMs: number
): number {
  if (clips.length === 0) return 1
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)

  const settledAt = (c: AnimationClip, at: number): number => {
    const release = clipReleaseMs(c)
    if (release <= 0) return 1
    const p = clamp01((at - (c.startMs + c.durationMs)) / release)
    return 1 - clipReleaseEase(c)(p)
  }

  if (timeMs < sorted[0].startMs) return 0
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]
    if (timeMs < c.startMs) return settledAt(sorted[i - 1], timeMs) // gap
    if (timeMs <= c.startMs + c.durationMs) {
      return clipProgressEase(c)((timeMs - c.startMs) / c.durationMs)
    }
  }
  return settledAt(sorted[sorted.length - 1], timeMs) // past every clip
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
      return at(i, clipProgressEase(c)((timeMs - c.startMs) / c.durationMs))
    }
  }
  return at(sorted.length - 1, 1)
}

const tiltLerp = (a: Tilt, b: Tilt, p: number): Tilt => ({
  rx: lerp(a.rx, b.rx, p),
  ry: lerp(a.ry, b.ry, p),
  rz: lerp(a.rz, b.rz, p),
})

/**
 * The keyframe pose at a cut point, used by the razor tool to split one clip
 * into two that reproduce the original motion. A clip eases each owned effect
 * from `fromPose` (its previous keyframe / reveal-rest) → `toPose` (its own
 * pose). At `fraction` (0..1) through the clip, this returns the eased midpoint
 * pose: give it to the first half and keep `toPose` on the second, and the pair
 * plays the first and second portions of the original transition.
 *
 * Only owned effects are interpolated; everything else keeps `toPose` (those
 * properties hold the previous value at playback and never animate here).
 * Continuous effects (shadow, tilt, zoom, padding, radii, border, backdrop,
 * lighting) ease exactly. The main screenshot's position is a grid cell + pixel
 * offset that playback interpolates in percent-point space, so the caller passes
 * `mainPosition` to compute the eased mid position (cell + offset) in that space;
 * without it, position falls back to easing the pixel offset only. Discrete
 * crossfades (background, filter, portrait, pattern, overlay) resolve within
 * whichever half the cut is nearer to.
 */
export function poseAtCut(
  fromPose: ClipBaseline,
  toPose: ClipBaseline,
  fraction: number,
  effects: readonly AnimationEffect[],
  affectsMain: boolean,
  affectedSlotIds: readonly string[],
  mainPosition?: (easedProgress: number) => {
    screenshotPosition: ScreenshotPosition
    screenshotOffset: { x: number; y: number }
  }
): ClipBaseline {
  const p = easeOut(clamp01(fraction))
  const owns = (e: AnimationEffect) => effects.includes(e)
  const disc = <V>(from: V, to: V): V => (p >= 0.5 ? to : from)
  const mid: ClipBaseline = { ...toPose, slots: { ...toPose.slots } }

  if (affectsMain) {
    if (owns("tilt")) mid.tilt = tiltLerp(fromPose.tilt, toPose.tilt, p)
    if (owns("zoom")) mid.scale = lerp(fromPose.scale, toPose.scale, p)
    if (owns("position")) {
      if (mainPosition) {
        const r = mainPosition(p)
        mid.screenshotPosition = r.screenshotPosition
        mid.screenshotOffset = r.screenshotOffset
      } else {
        mid.screenshotOffset = {
          x: lerp(fromPose.screenshotOffset.x, toPose.screenshotOffset.x, p),
          y: lerp(fromPose.screenshotOffset.y, toPose.screenshotOffset.y, p),
        }
      }
    }
    if (owns("padding")) mid.padding = lerp(fromPose.padding, toPose.padding, p)
    if (owns("canvasRadius")) {
      mid.canvasBorderRadius = lerp(
        fromPose.canvasBorderRadius,
        toPose.canvasBorderRadius,
        p
      )
    }
    if (owns("shadow")) {
      mid.shadow = shadowBetween(fromPose.shadow, toPose.shadow, p)
    }
    if (owns("backdrop")) {
      mid.backdropEffects = backdropEffectsBetween(
        fromPose.backdropEffects,
        toPose.backdropEffects,
        p
      )
    }
    if (owns("lighting")) {
      const from = fromPose.lighting ?? REST_LIGHTING
      mid.lighting = lightingBetween(from, toPose.lighting ?? from, p)
    }
    if (owns("border")) {
      const from = fromPose.border ?? INVISIBLE_BORDER
      mid.border = borderBetween(from, toPose.border ?? from, p)
    }
    if (owns("borderRadius")) {
      mid.borderRadius = lerp(
        fromPose.borderRadius ?? 0,
        toPose.borderRadius ?? 0,
        p
      )
    }
    if (owns("background")) {
      mid.background = disc(fromPose.background, toPose.background)
    }
    if (owns("filter")) mid.filter = disc(fromPose.filter, toPose.filter)
    if (owns("portrait"))
      mid.portrait = disc(fromPose.portrait, toPose.portrait)
    if (owns("pattern")) mid.pattern = disc(fromPose.pattern, toPose.pattern)
    if (owns("overlay")) mid.overlay = disc(fromPose.overlay, toPose.overlay)
  }

  for (const id of affectedSlotIds) {
    const f = fromPose.slots[id]
    const tp = toPose.slots[id]
    if (!f || !tp) continue
    const s: ClipSlotPose = { ...tp }
    if (owns("tilt")) {
      s.tilt = tiltLerp(f.tilt, tp.tilt, p)
      s.rotation = lerp(f.rotation, tp.rotation, p)
    }
    if (owns("zoom")) s.scale = lerp(f.scale, tp.scale, p)
    if (owns("shadow") && f.shadow && tp.shadow) {
      s.shadow = shadowBetween(f.shadow, tp.shadow, p)
    }
    if (owns("position")) {
      s.xPct = lerp(f.xPct ?? tp.xPct ?? 0, tp.xPct ?? 0, p)
      s.yPct = lerp(f.yPct ?? tp.yPct ?? 0, tp.yPct ?? 0, p)
    }
    if (owns("border") && f.border && tp.border) {
      s.border = borderBetween(f.border, tp.border, p)
    }
    if (
      owns("borderRadius") &&
      f.borderRadius != null &&
      tp.borderRadius != null
    ) {
      s.borderRadius = lerp(f.borderRadius, tp.borderRadius, p)
    }
    if (owns("padding") && f.padding != null && tp.padding != null) {
      s.padding = lerp(f.padding, tp.padding, p)
    }
    if (owns("lighting") && f.lighting && tp.lighting) {
      s.lighting = lightingBetween(f.lighting, tp.lighting, p)
    }
    mid.slots[id] = s
  }

  return mid
}
