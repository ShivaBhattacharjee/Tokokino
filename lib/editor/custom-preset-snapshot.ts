import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"

import type {
  AnimationClip,
  AnimationClipTarget,
  AspectState,
  Background,
  CanvasAnimation,
  CanvasState,
  ClipBaseline,
  ClipSlotPose,
} from "./state-types"
import type {
  CustomPresetAnimation,
  CustomPresetGeometry,
  CustomPresetType,
} from "./store"
import { tweetSettingsFromCard } from "./tweet-settings"

export type { CustomPresetType }

export type CaptureCustomPresetOptions = {
  /** Include timeline clips (animate presets). */
  includeAnimation?: boolean
}

const round = (n: number) => Number(n.toFixed(2))

function isBulkyImageValue(value: string | undefined | null): boolean {
  if (!value) return false
  return value.startsWith("data:") || value.startsWith("blob:")
}

/**
 * Prefer a compact background for preset storage: keep solids/gradients and
 * remote/library URLs; drop huge inline data URLs (still keep source/thumb if
 * present so apply can recover a library identity).
 */
function sanitizeBackgroundForPreset(bg: Background): Background {
  if (bg.type !== "image") return bg
  if (!isBulkyImageValue(bg.value)) return bg
  return {
    ...bg,
    value: bg.sourceUrl || bg.thumbUrl || "",
  }
}

function backgroundsLookEqual(a: Background, b: Background): boolean {
  return (
    a.type === b.type &&
    a.value === b.value &&
    (a.sourceUrl ?? "") === (b.sourceUrl ?? "") &&
    (a.thumbUrl ?? "") === (b.thumbUrl ?? "")
  )
}

function sanitizePoseForPreset(
  pose: ClipBaseline,
  styleBackground: Background | undefined
): ClipBaseline {
  const next: ClipBaseline = {
    ...pose,
    background: sanitizeBackgroundForPreset(pose.background),
    slots: { ...pose.slots },
  }
  // If the pose background matches the canvas style background, drop the bulky
  // image payload from the pose so N clips don't multiply the same image bytes.
  if (
    styleBackground &&
    backgroundsLookEqual(
      sanitizeBackgroundForPreset(pose.background),
      sanitizeBackgroundForPreset(styleBackground)
    ) &&
    next.background.type === "image" &&
    isBulkyImageValue(pose.background.value)
  ) {
    next.background = {
      type: "image",
      value: styleBackground.sourceUrl || styleBackground.thumbUrl || "",
      sourceUrl: styleBackground.sourceUrl,
      thumbUrl: styleBackground.thumbUrl,
    }
  }
  return next
}

function sanitizeClipForPreset(
  clip: AnimationClip,
  styleBackground: Background | undefined
): AnimationClip {
  return {
    ...clip,
    pose: clip.pose
      ? sanitizePoseForPreset(clip.pose, styleBackground)
      : clip.pose,
    baseline: clip.baseline
      ? sanitizePoseForPreset(clip.baseline, styleBackground)
      : clip.baseline,
  }
}

/**
 * Capture the active canvas as a custom preset geometry snapshot.
 * Never includes screenshot pixels or slot image sources.
 */
export function captureCustomPresetGeometry(
  canvas: CanvasState,
  aspect: AspectState,
  opts: CaptureCustomPresetOptions = {}
): CustomPresetGeometry {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const designWidth = BASE_CANVAS_WIDTH
  const designHeight = (BASE_CANVAS_WIDTH * ah) / aw

  const background = sanitizeBackgroundForPreset(canvas.background)

  const geometry: CustomPresetGeometry = {
    canvasTilt: {
      rx: round(canvas.tilt.rx),
      ry: round(canvas.tilt.ry),
      rz: round(canvas.tilt.rz),
    },
    canvasScale: round(canvas.scale),
    slots: canvas.screenshotSlots.map((slot) => ({
      xPct: round(slot.xPct),
      yPct: round(slot.yPct),
      widthPct: round(slot.widthPct),
      heightPct: round(slot.heightPct),
      rotation: round(slot.rotation),
      tilt: {
        rx: round(slot.tilt.rx),
        ry: round(slot.tilt.ry),
        rz: round(slot.tilt.rz),
      },
      scale: round(slot.scale),
      zIndex: slot.zIndex,
      filter: slot.filter,
      hidden: slot.hidden,
      objectFit: slot.objectFit,
      shadow: slot.shadow,
    })),
    mainOffset: {
      xPct: round(
        designWidth ? (canvas.screenshotOffset.x / designWidth) * 100 : 0
      ),
      yPct: round(
        designHeight ? (canvas.screenshotOffset.y / designHeight) * 100 : 0
      ),
    },
    canvasStyle: {
      background,
      padding: canvas.padding,
      borderRadius: canvas.borderRadius,
      canvasBorderRadius: canvas.canvasBorderRadius,
      border: canvas.border,
      backdrop: canvas.backdrop,
      screenshotPosition: canvas.screenshotPosition,
      screenshotLayer: canvas.screenshotLayer,
      shadow: canvas.shadow,
      overlay: canvas.overlay,
      frame: canvas.frame,
      portrait: canvas.portrait,
      enhance: canvas.enhance,
      objectFit: canvas.objectFit,
      frameAddress: canvas.frameAddress,
      texts: canvas.texts,
      assets: canvas.assets,
      annotations: canvas.annotations,
      annotationShapes: canvas.annotationShapes,
      aspect: canvas.aspect,
      tweetSettings: canvas.tweet
        ? tweetSettingsFromCard(canvas.tweet)
        : undefined,
    },
  }

  if (opts.includeAnimation) {
    const anim = canvas.animation
    const clips = Array.isArray(anim?.clips) ? anim.clips : []
    if (clips.length > 0) {
      geometry.animation = {
        durationMs: anim?.durationMs ?? 5000,
        clips: clips.map((c) => sanitizeClipForPreset(c, background)),
        sourceSlotIds: canvas.screenshotSlots.map((s) => s.id),
      }
    }
  }

  return geometry
}

/** True when the user is in Animate mode with at least one clip. */
export function shouldSaveAsAnimatePreset(
  isAnimateMode: boolean,
  canvas: CanvasState | undefined | null
): boolean {
  if (!isAnimateMode || !canvas) return false
  const clips = canvas.animation?.clips
  return Array.isArray(clips) && clips.length > 0
}

export function resolvePresetType(
  isAnimateMode: boolean,
  canvas: CanvasState | undefined | null
): CustomPresetType {
  return shouldSaveAsAnimatePreset(isAnimateMode, canvas) ? "animate" : "style"
}

/**
 * Build a slot-id remap from the saved source slot ids (or pose keys) onto the
 * live slot list (by index).
 */
export function buildSlotIdRemap(
  liveSlotIds: string[],
  sourceSlotIds: string[] | undefined,
  clips: AnimationClip[]
): Map<string, string> {
  const map = new Map<string, string>()
  const sources =
    sourceSlotIds && sourceSlotIds.length > 0
      ? sourceSlotIds
      : (() => {
          // Fallback: ordered unique keys from the first clip that has slots.
          for (const clip of clips) {
            const pose = clip.pose ?? clip.baseline
            if (pose?.slots && Object.keys(pose.slots).length > 0) {
              return Object.keys(pose.slots)
            }
          }
          return [] as string[]
        })()

  sources.forEach((sourceId, index) => {
    const liveId = liveSlotIds[index]
    if (liveId) map.set(sourceId, liveId)
  })
  return map
}

function remapClipTarget(
  target: AnimationClipTarget | undefined,
  slotMap: Map<string, string>
): AnimationClipTarget | undefined {
  if (!target) return target
  if (target.scope !== "slot") return target
  const next = slotMap.get(target.slotId)
  if (!next) return { scope: "all" }
  return { scope: "slot", slotId: next }
}

function remapPoseSlots(
  slots: Record<string, ClipSlotPose> | undefined,
  slotMap: Map<string, string>
): Record<string, ClipSlotPose> {
  if (!slots) return {}
  const next: Record<string, ClipSlotPose> = {}
  for (const [sourceId, pose] of Object.entries(slots)) {
    const liveId = slotMap.get(sourceId) ?? sourceId
    // Prefer mapped id; if the source id still exists on the live canvas as the
    // same string (unlikely after remap), keep it.
    next[liveId] = pose
  }
  return next
}

function remapPose(
  pose: ClipBaseline | undefined,
  slotMap: Map<string, string>,
  styleBackground: Background | undefined
): ClipBaseline | undefined {
  if (!pose) return pose
  let background = pose.background
  // If pose background was stripped to empty image, restore from style.
  if (
    background?.type === "image" &&
    !background.value &&
    styleBackground?.type === "image"
  ) {
    background = styleBackground
  }
  return {
    ...pose,
    background: background ?? pose.background,
    slots: remapPoseSlots(pose.slots, slotMap),
  }
}

/**
 * Remap a saved animation onto the destination canvas's slot ids and mint
 * fresh clip ids.
 */
export function remapAnimationForApply(
  animation: CustomPresetAnimation,
  liveSlotIds: string[],
  styleBackground: Background | undefined
): CanvasAnimation {
  const clips: AnimationClip[] = Array.isArray(animation.clips)
    ? animation.clips
    : []
  const slotMap = buildSlotIdRemap(liveSlotIds, animation.sourceSlotIds, clips)

  const remapped: AnimationClip[] = clips.map((clip) => {
    const newId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `clip_${Math.random().toString(36).slice(2, 10)}`
    return {
      ...clip,
      id: newId,
      target: remapClipTarget(clip.target, slotMap),
      pose: remapPose(clip.pose, slotMap, styleBackground),
      baseline: remapPose(clip.baseline, slotMap, styleBackground),
    }
  })

  return {
    durationMs:
      typeof animation.durationMs === "number" &&
      Number.isFinite(animation.durationMs)
        ? animation.durationMs
        : 5000,
    clips: remapped,
  }
}
