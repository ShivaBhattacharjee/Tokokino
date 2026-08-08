import { NEUTRAL_MEDIA_ADJUSTMENTS } from "../css-utils"
import {
  clipAffectsMain,
  clipAffectsSlot,
  clipBaseline,
  clipPose,
  DEFAULT_BASELINE,
  REST_LIGHTING,
} from "../animation-playback"
import { MAX_DURATION_MS } from "../animation-timeline"
import { screenshotPositionAnchor } from "../presets"
import { computeRowLayout } from "../screenshot-layout"
import type {
  AnimationClip,
  AnimationClipTarget,
  AnimationEffect,
  ClipBaseline,
  ClipSlotPose,
  CanvasAnimation,
  AspectState,
  AssetFilter,
  CanvasState,
  CropRegion,
  DeviceFrame,
  MediaAdjustments,
  ScreenshotPosition,
  ScreenshotSlot,
  Shadow,
} from "../state-types"
import {
  aspectRatioFromState,
  cloneLighting,
  cloneShadow,
  resolveMainScreenshotStyle,
  resolveSlotScreenshotStyle,
  stateCanvasAspect,
} from "./canvas-helpers"

/** Smallest an animation clip may be trimmed/fitted to (keep in sync with the
 * timeline UI's MIN_CLIP_MS). */
export const MIN_ANIMATION_CLIP_MS = 200

/** Effects an extra screenshot slot can actually animate (its keyframe pose only
 * carries transform + shadow). Used to decide when editing an effect may auto-
 * bind an unbound keyframe to a slot. */
export const SLOT_ANIMATABLE_EFFECTS: AnimationEffect[] = [
  "tilt",
  "zoom",
  "shadow",
  "position",
  "border",
  "borderRadius",
  "padding",
  "lighting",
  "mediaEffects",
  "mediaFilter",
]

/** Canvas.animation is optional (older drafts) — always read through this. */
export const getCanvasAnimation = (canvas: CanvasState): CanvasAnimation =>
  canvas.animation ?? { durationMs: 5000, clips: [] }

/** Snapshot the canvas's animatable state as a clip's target keyframe (pose). */
export const captureClipPose = (canvas: CanvasState): ClipBaseline => {
  // Main and slot style are projected through the same resolver pair so the two
  // branches of the pose stay structurally identical.
  const main = resolveMainScreenshotStyle(canvas)
  return {
    tilt: main.tilt,
    scale: main.scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    padding: main.padding,
    canvasBorderRadius: canvas.canvasBorderRadius,
    shadow: main.shadow,
    backdropEffects: canvas.backdrop.effects,
    lighting: main.lighting,
    background: canvas.background,
    filter: canvas.backdrop.filter,
    mediaAdjustments: main.adjustments,
    mediaFilter: main.filter,
    portrait: canvas.portrait,
    pattern: canvas.backdrop.pattern,
    overlay: canvas.overlay,
    border: main.border,
    borderRadius: main.borderRadius,
    // null (not undefined) so a clip with no crop stays distinguishable from a
    // pose captured before crop animated — see poseCrop.
    crop: canvas.lastCropRegion,
    slots: Object.fromEntries(
      canvas.screenshotSlots.map((s) => {
        // resolveSlotScreenshotStyle is the single owner of the slot→canvas
        // inheritance rule (a slot with no shadow/border/… borrows the canvas's).
        const style = resolveSlotScreenshotStyle(s, canvas)
        return [
          s.id,
          {
            tilt: style.tilt,
            scale: style.scale,
            rotation: s.rotation,
            shadow: style.shadow,
            xPct: s.xPct,
            yPct: s.yPct,
            border: style.border,
            borderRadius: style.borderRadius,
            padding: style.padding,
            lighting: style.lighting,
            filter: style.filter,
            adjustments: style.adjustments,
          },
        ]
      })
    ),
  }
}

/**
 * Resolve a pose's crop against the live one. Poses captured before crop
 * animated omit the key entirely (undefined) and inherit the live crop; an
 * explicit null means this clip has no crop and must NOT inherit one, or
 * clearing a crop would come back the moment another clip applied one.
 */
const poseCrop = (pose: ClipBaseline, live: CropRegion | null) =>
  pose.crop !== undefined ? pose.crop : live

/**
 * Load a clip's pose onto the canvas's live/committed style so the inspector and
 * canvas show that clip's keyframe. Slots not present in the pose keep their
 * current transform.
 */
export const applyPoseToCanvas = (
  canvas: CanvasState,
  pose: ClipBaseline
): Partial<CanvasState> => ({
  tilt: pose.tilt,
  scale: pose.scale,
  screenshotPosition: pose.screenshotPosition,
  screenshotOffset: pose.screenshotOffset,
  padding: pose.padding,
  // Fall back to the live value for poses captured before this field existed.
  canvasBorderRadius: pose.canvasBorderRadius ?? canvas.canvasBorderRadius,
  shadow: pose.shadow,
  background: pose.background,
  // Fall back to the live value for poses captured before portrait animated.
  portrait: pose.portrait ?? canvas.portrait,
  // Fall back to the live value for poses captured before overlay animated.
  overlay: pose.overlay ?? canvas.overlay,
  // Fall back to the live value for poses captured before border animated.
  border: pose.border ?? canvas.border,
  // Fall back to the live value for poses captured before radius animated.
  borderRadius: pose.borderRadius ?? canvas.borderRadius,
  // Fall back to the live values for poses captured before the media grade
  // animated.
  mediaAdjustments: pose.mediaAdjustments ?? canvas.mediaAdjustments,
  mediaFilter: pose.mediaFilter ?? canvas.mediaFilter,
  lastCropRegion: poseCrop(pose, canvas.lastCropRegion),
  backdrop: {
    ...canvas.backdrop,
    effects: pose.backdropEffects,
    // Fall back to the live value for poses captured before lighting animated.
    lighting: pose.lighting ?? canvas.backdrop.lighting,
    // Fall back to the live value for poses captured before filter animated.
    filter: pose.filter ?? canvas.backdrop.filter,
    // Fall back to the live value for poses captured before pattern animated.
    pattern: pose.pattern ?? canvas.backdrop.pattern,
  },
  screenshotSlots: canvas.screenshotSlots.map((s) => {
    const sp = pose.slots[s.id]
    if (!sp) return s
    return {
      ...s,
      tilt: sp.tilt,
      scale: sp.scale,
      rotation: sp.rotation,
      // Only overwrite the slot's shadow when the pose captured one (older poses
      // are transform-only, so leave the committed shadow untouched there).
      ...(sp.shadow ? { shadow: sp.shadow } : {}),
      // Likewise only restore position for poses that captured it (older poses
      // omit it, so leave the committed position untouched there).
      ...(sp.xPct != null && sp.yPct != null
        ? { xPct: sp.xPct, yPct: sp.yPct }
        : {}),
      // Border / radius / padding / lighting: only restore when the pose captured
      // them (older poses omit them → leave the committed slot values untouched).
      ...(sp.border ? { border: sp.border } : {}),
      ...(sp.borderRadius != null ? { borderRadius: sp.borderRadius } : {}),
      ...(sp.padding != null ? { padding: sp.padding } : {}),
      ...(sp.lighting ? { lighting: sp.lighting } : {}),
      ...(sp.filter ? { filter: sp.filter } : {}),
      ...(sp.adjustments ? { adjustments: sp.adjustments } : {}),
    }
  }),
})

/**
 * The pose the static/committed canvas holds while it carries an animation:
 * where the animation STARTS.
 *
 * Every effect resolves to the first keyframe that owns it — the value that
 * keyframe eases FROM — and an effect no keyframe owns keeps the canvas's own
 * committed value. So an animation stays a *description of motion* rather than
 * a style edit: leaving Animate mode never repaints the document with the last
 * keyframe's look, and the still/PNG export shows the composition the user
 * built, not the end of its animation. (Position always worked this way; the
 * rest used to rest at the final frame.)
 */
export const buildRestingPose = (
  canvas: CanvasState,
  clips: readonly AnimationClip[]
): ClipBaseline | null => {
  if (clips.length === 0) return null
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const committed = captureClipPose(canvas)
  const rest: ClipBaseline = { ...committed, slots: { ...committed.slots } }
  const restRec = rest as Record<string, unknown>

  for (const effect of ANIMATION_EFFECTS) {
    const firstMain = sorted.find(
      (c) => clipAffectsMain(c) && clipOwnsEffect(c, effect)
    )
    if (firstMain) {
      const base = clipBaseline(firstMain) as unknown as Record<string, unknown>
      for (const field of EFFECT_MAIN_POSE_FIELDS[effect]) {
        if (base[field] !== undefined) restRec[field] = base[field]
      }
    }

    const slotFields = EFFECT_SLOT_POSE_FIELDS[effect]
    if (!slotFields) continue
    for (const slotId of Object.keys(rest.slots)) {
      const firstSlot = sorted.find(
        (c) => clipAffectsSlot(c, slotId) && clipOwnsEffect(c, effect)
      )
      if (!firstSlot) continue
      const from = clipBaseline(firstSlot).slots[slotId] as
        | Record<string, unknown>
        | undefined
      if (!from) continue
      const next = { ...rest.slots[slotId] } as Record<string, unknown>
      for (const field of slotFields) {
        if (from[field] !== undefined) next[field] = from[field]
      }
      rest.slots[slotId] = next as unknown as ClipSlotPose
    }
  }

  return rest
}

export const clipOwnsEffect = (clip: AnimationClip, effect: AnimationEffect) =>
  (clip.effects ?? []).includes(effect)

/**
 * Copy `from`'s value for every effect `owns` selects onto a copy of `base`,
 * field by field (main pose and per-slot alike). `clips` is scanned for the
 * ownership test, so a caller can ask "whatever ANY of these clips animates" or
 * narrow it to one clip's own effects.
 */
export const overlayEffectFields = (
  base: ClipBaseline,
  from: ClipBaseline,
  clips: readonly AnimationClip[],
  owns: (clip: AnimationClip, effect: AnimationEffect) => boolean
): ClipBaseline => {
  const next: ClipBaseline = { ...base, slots: { ...base.slots } }
  const nextRec = next as unknown as Record<string, unknown>
  const fromRec = from as unknown as Record<string, unknown>

  for (const effect of ANIMATION_EFFECTS) {
    if (clips.some((c) => clipAffectsMain(c) && owns(c, effect))) {
      for (const field of EFFECT_MAIN_POSE_FIELDS[effect]) {
        if (fromRec[field] !== undefined) nextRec[field] = fromRec[field]
      }
    }
    const slotFields = EFFECT_SLOT_POSE_FIELDS[effect]
    if (!slotFields) continue
    for (const slotId of Object.keys(next.slots)) {
      if (!clips.some((c) => clipAffectsSlot(c, slotId) && owns(c, effect))) {
        continue
      }
      const src = from.slots[slotId] as Record<string, unknown> | undefined
      if (!src) continue
      const merged = { ...next.slots[slotId] } as Record<string, unknown>
      for (const field of slotFields) {
        if (src[field] !== undefined) merged[field] = src[field]
      }
      next.slots[slotId] = merged as unknown as ClipSlotPose
    }
  }
  return next
}

/** Main-pose fields each animation effect owns. Used to copy just the edited
 * property into every clip of a multi-selection (leaving the rest intact). */
const EFFECT_MAIN_POSE_FIELDS: Record<
  AnimationEffect,
  readonly (keyof ClipBaseline)[]
> = {
  position: ["screenshotPosition", "screenshotOffset"],
  zoom: ["scale"],
  tilt: ["tilt"],
  padding: ["padding"],
  shadow: ["shadow"],
  background: ["background"],
  backdrop: ["backdropEffects"],
  canvasRadius: ["canvasBorderRadius"],
  lighting: ["lighting"],
  filter: ["filter"],
  mediaEffects: ["mediaAdjustments"],
  mediaFilter: ["mediaFilter"],
  portrait: ["portrait"],
  pattern: ["pattern"],
  overlay: ["overlay"],
  border: ["border"],
  borderRadius: ["borderRadius"],
  crop: ["crop"],
}

export const ANIMATION_EFFECTS = Object.keys(
  EFFECT_MAIN_POSE_FIELDS
) as AnimationEffect[]

/** Per-slot pose fields an effect owns (only the slot-animatable ones). */
const EFFECT_SLOT_POSE_FIELDS: Partial<
  Record<AnimationEffect, readonly (keyof ClipSlotPose)[]>
> = {
  position: ["xPct", "yPct"],
  zoom: ["scale"],
  tilt: ["tilt", "rotation"],
  padding: ["padding"],
  shadow: ["shadow"],
  border: ["border"],
  borderRadius: ["borderRadius"],
  lighting: ["lighting"],
  mediaEffects: ["adjustments"],
  mediaFilter: ["filter"],
}

const poseValueEq = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b)

/**
 * Copy just the fields owned by `effects` from `edited` onto `basePose`, so
 * applying one inspector edit across a multi-selection updates only that
 * property on every selected clip and leaves each clip's other keyframed values
 * intact.
 *
 * `before`/`edited` are the canvas pose just before and after the edit. Only
 * fields (and slots) that actually changed between them are merged: an effect
 * can own several fields (e.g. zoom owns both the main and per-slot scale), so
 * editing one must not overwrite a clip's keyframed value for the others. This
 * keeps `setScale` from propagating slot scale and `updateScreenshotSlot` from
 * propagating main fields or unrelated slots.
 */
export const mergeEffectsIntoPose = (
  basePose: ClipBaseline,
  before: ClipBaseline,
  edited: ClipBaseline,
  effects: AnimationEffect[]
): ClipBaseline => {
  const next: ClipBaseline = { ...basePose, slots: { ...basePose.slots } }
  const nextRec = next as Record<string, unknown>
  for (const effect of effects) {
    for (const field of EFFECT_MAIN_POSE_FIELDS[effect]) {
      if (poseValueEq(before[field], edited[field])) continue
      nextRec[field] = edited[field]
    }
    const slotFields = EFFECT_SLOT_POSE_FIELDS[effect]
    if (!slotFields) continue
    for (const [slotId, editedSlot] of Object.entries(edited.slots)) {
      const target = next.slots[slotId]
      if (!target) continue
      const beforeSlot = before.slots[slotId]
      let mergedSlot = target
      for (const field of slotFields) {
        if (poseValueEq(beforeSlot?.[field], editedSlot[field])) continue
        if (mergedSlot === target) mergedSlot = { ...target }
        ;(mergedSlot as Record<string, unknown>)[field] = editedSlot[field]
      }
      if (mergedSlot !== target) next.slots[slotId] = mergedSlot
    }
  }
  return next
}

/**
 * The resolved look AT a keyframe: for each effect, the value from the latest
 * keyframe that owns it at/before `target` (so held effects from earlier
 * keyframes show through), falling back to the final look for effects no
 * keyframe animates. Loading THIS onto the canvas makes selecting a keyframe show
 * its true accumulated state — which is what you edit.
 */
const REST_SHADOW: Shadow = {
  type: "none",
  intensity: 0,
  color: "#000000",
  lightSource: "center",
}

// Non-bare (aspect-based) main-screenshot position geometry, mirroring
// mainScreenshotPositionPct / mainScreenshotOffsetForPoint in position-math.ts
// (which can't be imported here — it imports from this store). The razor split
// uses these to interpolate position in the same percent-point space playback
// uses, then invert the eased mid point back to a (cell, offset) keyframe.
const POSITION_BASE_CANVAS_WIDTH = 1100
const mainPositionBase = (
  aspect: AspectState,
  frame: DeviceFrame,
  position: ScreenshotPosition,
  slots: ScreenshotSlot[]
) => {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const width = POSITION_BASE_CANVAS_WIDTH
  const height = (POSITION_BASE_CANVAS_WIDTH * ah) / aw
  const anchor = screenshotPositionAnchor(position)
  let baseX = anchor.x
  let baseY = anchor.y
  // With extra screenshots, a centered main sits at its row-layout slot; other
  // cells still anchor to the grid (matches mainScreenshotPositionPct).
  if (slots.length > 0 && position === "center") {
    const rowLayout = computeRowLayout(
      [
        { id: "__main__", frame },
        ...slots.map((s) => ({ id: s.id, frame: s.frame ?? frame })),
      ],
      aw / ah
    )
    const mainLayout = rowLayout[0]
    if (mainLayout) {
      baseX = mainLayout.xPct
      baseY = 50
    }
  }
  return { width, height, baseX, baseY }
}
export const mainPositionPoint = (
  aspect: AspectState,
  frame: DeviceFrame,
  position: ScreenshotPosition,
  offset: { x: number; y: number },
  slots: ScreenshotSlot[]
) => {
  const { width, height, baseX, baseY } = mainPositionBase(
    aspect,
    frame,
    position,
    slots
  )
  return {
    xPct: baseX + (offset.x / width) * 100,
    yPct: baseY + (offset.y / height) * 100,
  }
}
export const mainPositionOffsetForPoint = (
  aspect: AspectState,
  frame: DeviceFrame,
  position: ScreenshotPosition,
  slots: ScreenshotSlot[],
  point: { xPct: number; yPct: number }
) => {
  const { width, height, baseX, baseY } = mainPositionBase(
    aspect,
    frame,
    position,
    slots
  )
  return {
    x: ((point.xPct - baseX) / 100) * width,
    y: ((point.yPct - baseY) / 100) * height,
  }
}

export const resolveKeyframePose = (
  canvas: CanvasState,
  clips: AnimationClip[],
  target: AnimationClip
): ClipBaseline => {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const last = sorted[sorted.length - 1]
  const fallback = last ? clipPose(last) : captureClipPose(canvas)

  // Latest keyframe that owns an effect at/before `target`, plus whether ANY
  // keyframe owns it — so we can tell "held from an earlier keyframe" apart from
  // "revealed by a later keyframe" (→ neutral rest) apart from "never animated"
  // (→ the constant final value).
  const latestOwner = (
    owns: (c: AnimationClip) => boolean
  ): { at: AnimationClip | null; any: boolean } => {
    let at: AnimationClip | null = null
    let any = false
    for (const c of clips) {
      if (!owns(c)) continue
      any = true
      if (c.startMs <= target.startMs && (!at || c.startMs >= at.startMs))
        at = c
    }
    return { at, any }
  }
  const ownsMain = (effect: AnimationEffect) => (c: AnimationClip) =>
    clipAffectsMain(c) && (c.effects ?? []).includes(effect)
  const ownsSlot =
    (slotId: string, effect: AnimationEffect) => (c: AnimationClip) =>
      clipAffectsSlot(c, slotId) && (c.effects ?? []).includes(effect)

  const main = <V>(
    effect: AnimationEffect,
    extract: (p: ClipBaseline) => V,
    rest: V
  ): V => {
    const { at, any } = latestOwner(ownsMain(effect))
    if (at) return extract(clipPose(at))
    return any ? rest : extract(fallback)
  }

  // Like `main`, but the "owned only by a LATER keyframe" case resolves to the
  // value the effect REVEALS FROM — the first owner's baseline — instead of the
  // final look. This mirrors playback (which eases from that baseline), so
  // selecting a keyframe BEFORE the first change shows the pre-animation state,
  // not the end state. Without this, editing a later keyframe (e.g. border →
  // orange) makes every earlier keyframe resolve to that end value too.
  const mainReveal = <V>(
    effect: AnimationEffect,
    extract: (p: ClipBaseline) => V
  ): V => {
    const owners = clips
      .filter((c) => ownsMain(effect)(c))
      .sort((a, b) => a.startMs - b.startMs)
    if (owners.length === 0) return extract(fallback)
    const { at } = latestOwner(ownsMain(effect))
    return extract(at ? clipPose(at) : clipBaseline(owners[0]))
  }

  return {
    tilt: main("tilt", (p) => p.tilt, { rx: 0, ry: 0, rz: 0 }),
    scale: main("zoom", (p) => p.scale, 100),
    screenshotPosition: main("position", (p) => p.screenshotPosition, "center"),
    screenshotOffset: main("position", (p) => p.screenshotOffset, {
      x: 0,
      y: 0,
    }),
    padding: main("padding", (p) => p.padding, 0),
    canvasBorderRadius: main(
      "canvasRadius",
      (p) => p.canvasBorderRadius ?? canvas.canvasBorderRadius,
      DEFAULT_BASELINE.canvasBorderRadius
    ),
    shadow: main("shadow", (p) => p.shadow, REST_SHADOW),
    // Background is a single layer (no true crossfade), so always show the final.
    background: (() => {
      const { at } = latestOwner(ownsMain("background"))
      return at ? clipPose(at).background : fallback.background
    })(),
    // Reveal effects: held from an earlier owner if one exists at/before this
    // keyframe, else the value they reveal FROM (first owner's baseline) — never
    // the final look, so an earlier keyframe never inherits a later edit.
    filter: mainReveal("filter", (p) => p.filter ?? "none"),
    mediaFilter: mainReveal(
      "mediaFilter",
      (p) => p.mediaFilter ?? canvas.mediaFilter ?? "none"
    ),
    mediaAdjustments: mainReveal(
      "mediaEffects",
      (p) =>
        p.mediaAdjustments ??
        canvas.mediaAdjustments ??
        NEUTRAL_MEDIA_ADJUSTMENTS
    ),
    portrait: mainReveal("portrait", (p) => p.portrait ?? canvas.portrait),
    pattern: mainReveal("pattern", (p) => p.pattern ?? canvas.backdrop.pattern),
    overlay: mainReveal("overlay", (p) => p.overlay ?? canvas.overlay),
    border: mainReveal("border", (p) => p.border ?? canvas.border),
    crop: mainReveal("crop", (p) => poseCrop(p, canvas.lastCropRegion)),
    borderRadius: main(
      "borderRadius",
      (p) => p.borderRadius ?? canvas.borderRadius,
      DEFAULT_BASELINE.borderRadius ?? canvas.borderRadius
    ),
    backdropEffects: main(
      "backdrop",
      (p) => p.backdropEffects,
      DEFAULT_BASELINE.backdropEffects
    ),
    lighting: main(
      "lighting",
      (p) => p.lighting ?? canvas.backdrop.lighting,
      REST_LIGHTING
    ),
    slots: Object.fromEntries(
      canvas.screenshotSlots.map((s) => {
        const committed: ClipSlotPose = {
          tilt: s.tilt,
          scale: s.scale,
          rotation: s.rotation,
          shadow: s.shadow ?? canvas.shadow,
          xPct: s.xPct,
          yPct: s.yPct,
        }
        const slot = (effect: AnimationEffect, rest: ClipSlotPose) => {
          const { at, any } = latestOwner(ownsSlot(s.id, effect))
          if (at) return clipPose(at).slots[s.id] ?? rest
          return any ? rest : committed
        }
        const t = slot("tilt", {
          ...committed,
          tilt: { rx: 0, ry: 0, rz: 0 },
          rotation: 0,
        })
        const z = slot("zoom", { ...committed, scale: 100 })
        const sh = slot("shadow", { ...committed, shadow: REST_SHADOW })
        // Reveal-from semantics (mirrors mainReveal): held from the latest owner
        // at/before this keyframe, else the value it reveals FROM (the first
        // owner's captured baseline), else the committed slot value. Used for the
        // effects that ease from the slot's own committed look — position, border,
        // radius, padding, lighting — rather than from a neutral rest.
        const slotReveal = <V>(
          effect: AnimationEffect,
          extract: (sp: ClipSlotPose | undefined) => V | undefined,
          committedVal: V
        ): V => {
          const owners = clips
            .filter((c) => ownsSlot(s.id, effect)(c))
            .sort((a, b) => a.startMs - b.startMs)
          if (owners.length === 0) return committedVal
          const { at } = latestOwner(ownsSlot(s.id, effect))
          const src = at
            ? clipPose(at).slots[s.id]
            : clipBaseline(owners[0]).slots[s.id]
          return extract(src) ?? committedVal
        }
        return [
          s.id,
          {
            tilt: t.tilt,
            rotation: t.rotation,
            scale: z.scale,
            shadow: sh.shadow ?? committed.shadow,
            xPct: slotReveal("position", (sp) => sp?.xPct, s.xPct),
            yPct: slotReveal("position", (sp) => sp?.yPct, s.yPct),
            border: slotReveal(
              "border",
              (sp) => sp?.border,
              s.border ?? canvas.border
            ),
            borderRadius: slotReveal(
              "borderRadius",
              (sp) => sp?.borderRadius,
              s.borderRadius ?? canvas.borderRadius
            ),
            padding: slotReveal(
              "padding",
              (sp) => sp?.padding,
              s.padding ?? canvas.padding
            ),
            lighting: slotReveal(
              "lighting",
              (sp) => sp?.lighting,
              s.lighting ?? canvas.backdrop.lighting
            ),
            filter: slotReveal("mediaFilter", (sp) => sp?.filter, s.filter),
            adjustments: slotReveal(
              "mediaEffects",
              (sp) => sp?.adjustments,
              s.adjustments ?? canvas.mediaAdjustments
            ),
          },
        ]
      })
    ),
  }
}

/**
 * Which screenshot a newly-added clip should bind to, mirroring the inspector's
 * ScreenshotStyleTarget: a selected slot → that slot, else the main screenshot
 * if it's selected, else "all". Validates the slot still exists on `canvas`.
 */
export const resolveSelectionTarget = (
  canvas: CanvasState,
  selectedScreenshotSlotId: string | null,
  isScreenshotSelected: boolean
): AnimationClipTarget => {
  if (
    selectedScreenshotSlotId &&
    canvas.screenshotSlots.some((s) => s.id === selectedScreenshotSlotId)
  ) {
    return { scope: "slot", slotId: selectedScreenshotSlotId }
  }
  if (isScreenshotSelected) return { scope: "main" }
  return { scope: "all" }
}

/**
 * Insert a copy of `sourceId` right after it in the array, rippling later clips
 * right just enough to open a gap (preserving their spacing). Shared by single-
 * and bulk-duplicate.
 */
export const insertClipCopy = (
  clips: AnimationClip[],
  sourceId: string,
  newId: string
): AnimationClip[] => {
  const source = clips.find((c) => c.id === sourceId)
  if (!source) return clips
  const dur = source.durationMs
  const insertStart = Math.min(
    source.startMs + dur,
    Math.max(0, MAX_DURATION_MS - dur)
  )
  const nextStart = clips
    .filter((clip) => clip.id !== source.id && clip.startMs >= insertStart)
    .reduce((min, clip) => Math.min(min, clip.startMs), Infinity)
  const shift = Number.isFinite(nextStart)
    ? Math.max(0, insertStart + dur - nextStart)
    : 0
  const shifted = clips.map((clip) =>
    clip.id !== source.id && clip.startMs >= insertStart
      ? {
          ...clip,
          startMs: Math.min(
            clip.startMs + shift,
            Math.max(0, MAX_DURATION_MS - clip.durationMs)
          ),
        }
      : clip
  )
  const copy: AnimationClip = { ...source, id: newId, startMs: insertStart }
  const sourceIndex = shifted.findIndex((cl) => cl.id === source.id)
  return [
    ...shifted.slice(0, sourceIndex + 1),
    copy,
    ...shifted.slice(sourceIndex + 1),
  ]
}

/**
 * Strip a clip's animated effects in-array: reverts its pose to its captured
 * baseline and clears `effects`. Returns the same array reference when the clip
 * owns nothing (so callers can detect a no-op). Shared by single- and bulk-clear.
 */
export const clearClipEffectsInArray = (
  clips: AnimationClip[],
  id: string
): AnimationClip[] => {
  const clip = clips.find((c) => c.id === id)
  if (!clip || (clip.effects ?? []).length === 0) return clips
  const cleared: AnimationClip = {
    ...clip,
    effects: [],
    pose: { ...DEFAULT_BASELINE, ...clipBaseline(clip) },
  }
  return clips.map((c) => (c.id === id ? cleared : c))
}
