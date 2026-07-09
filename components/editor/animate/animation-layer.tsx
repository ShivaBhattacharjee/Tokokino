"use client"

/**
 * On-canvas Animate-mode playback.
 *
 * Drives the screenshots' live-preview override vars from the animation timeline.
 * Each keyframe (clip) OWNS a set of effects — the ones you changed while it was
 * selected (`clip.effects`). Every effect (tilt, zoom, position, padding, shadow,
 * background, backdrop) is animated INDEPENDENTLY across only the keyframes that
 * own it: it eases from the previous owner's value (or a neutral rest value for
 * its first appearance) → this keyframe's value, and holds between/after. An
 * effect no keyframe owns is left at the committed value. The clip currently open
 * for editing reads its live committed pose so edits preview in real time.
 *
 * The same vars the inspector uses for slider/pad live-preview are written here,
 * so the final keyframe lands exactly on the committed look.
 *
 * Motion is applied only while playing; at rest (and on unmount) every override
 * is cleared so the static committed pose shows through untouched.
 */

import * as React from "react"

import {
  bareScreenshotPositionPct,
  bareScreenshotTargetLeftTop,
  mainScreenshotPositionPct,
  type StagePlacementDims,
} from "@/components/editor/mobile-controls/position-math"
import {
  clearPositionPreviewVars,
  setElementPositionPreview,
  setMainScreenshotBarePreviewPx,
  setMainScreenshotPositionPreview,
} from "@/components/editor/position-preview-vars"
import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import {
  BACKDROP_FX_PREVIEW_VAR,
  BACKDROP_NOISE_PREVIEW_VAR,
  LIGHTING_IMAGE_VAR,
  LIGHTING_OPACITY_VAR,
} from "@/components/editor/inspector/backdrop-section-parts/constants"
import { lightingOverlayValues } from "@/components/editor/canvas/helpers"
import {
  backdropEffectsBetween,
  backgroundLayerOpacityVar,
  borderBetween,
  clipAffectsMain,
  clipAffectsSlot,
  clipBaseline,
  clipOwns,
  clipPose,
  clipsProgressAt,
  DEFAULT_BASELINE,
  filterLayerOpacityVar,
  INVISIBLE_BORDER,
  lerp,
  patternLayerOpacityVar,
  PATTERN_BASE_OPACITY_VAR,
  portraitLayerOpacityVar,
  PORTRAIT_BASE_OPACITY_VAR,
  overlayLayerOpacityVar,
  OVERLAY_BASE_OPACITY_VAR,
  lightingEntranceRest,
  lightingBetween,
  NEUTRAL_SLOT_POSE,
  REST_LIGHTING,
  sampleKeyframes,
  sampleShadowLayers,
} from "@/lib/editor/animation-playback"
import {
  BORDER_OFFSET_PREVIEW_VAR,
  BORDER_OUTLINE_PREVIEW_VAR,
  borderOffsetCss,
  borderOutlineCss,
  effectsFilterCss,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
  shadowCss,
  shadowDropFilterCss,
  SHADOW_FILTER_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
} from "@/lib/editor/css-utils"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type {
  AnimationClip,
  BackdropEffects,
  BackdropLighting,
  Border,
  ClipBaseline,
  ClipSlotPose,
  ScreenshotPosition,
  Shadow,
  Tilt,
} from "@/lib/editor/state-types"

const INVISIBLE_SHADOW: Shadow = {
  type: "none",
  intensity: 0,
  color: "#000000",
  lightSource: "center",
}

const tiltLerp = (a: Tilt, b: Tilt, p: number): Tilt => ({
  rx: lerp(a.rx, b.rx, p),
  ry: lerp(a.ry, b.ry, p),
  rz: lerp(a.rz, b.rz, p),
})

const pointLerp = (
  a: { xPct: number; yPct: number },
  b: { xPct: number; yPct: number },
  p: number
) => ({ xPct: lerp(a.xPct, b.xPct, p), yPct: lerp(a.yPct, b.yPct, p) })

function setVar(el: HTMLElement, name: string, value: string | null) {
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, value)
}

const PADDING_PREVIEW_VAR = "--editor-padding-preview"
const CANVAS_RADIUS_PREVIEW_VAR = "--canvas-bd-radius"
const BG_OPACITY_VAR = "--canvas-bg-opacity"
// Per-target padding/shadow overrides live on the screenshot's preview scope,
// canvas-wide background/backdrop overrides on the canvas node.
const SCOPE_VARS = [
  PADDING_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
  SHADOW_FILTER_PREVIEW_VAR,
  BORDER_OUTLINE_PREVIEW_VAR,
  BORDER_OFFSET_PREVIEW_VAR,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
]
const CANVAS_FX_VARS = [
  BG_OPACITY_VAR,
  BACKDROP_FX_PREVIEW_VAR,
  BACKDROP_NOISE_PREVIEW_VAR,
  LIGHTING_IMAGE_VAR,
  LIGHTING_OPACITY_VAR,
  `${LIGHTING_IMAGE_VAR}-in`,
  `${LIGHTING_OPACITY_VAR}-in`,
  CANVAS_RADIUS_PREVIEW_VAR,
]

const TILT_SCALE_VARS = [
  "--canvas-ts-rx",
  "--canvas-ts-ry",
  "--canvas-ts-rz",
  "--canvas-ts-scale",
]
const SLOT_VARS = [
  "--slot-ts-rx",
  "--slot-ts-ry",
  "--slot-ts-rz",
  "--slot-ts-scale",
  "--slot-ts-rot",
]
// Per-slot border / radius / padding / lighting preview vars (mirrors the main
// screenshot's, but scoped to the slot element). Cleared on the rest/no-clip
// paths so the committed slot look shows through.
const SLOT_FX_VARS = [
  BORDER_OUTLINE_PREVIEW_VAR,
  BORDER_OFFSET_PREVIEW_VAR,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
  PADDING_PREVIEW_VAR,
  `${LIGHTING_IMAGE_VAR}-in`,
  `${LIGHTING_OPACITY_VAR}-in`,
]

export function AnimationLayer() {
  const player = useAnimationPlayerOptional()
  const playheadMs = player?.playheadMs ?? 0
  const isPlaying = player?.isPlaying ?? false

  const canvas = useEditorStore((s) =>
    s.present.canvases.find((c) => c.id === s.present.activeCanvasId)
  )
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasId = canvas?.id ?? null
  const clips = canvas?.animation?.clips ?? []
  const tilt = canvas?.tilt
  const scale = canvas?.scale ?? 100
  const slots = canvas?.screenshotSlots ?? []
  const shadow = canvas?.shadow
  const padding = canvas?.padding ?? 0
  const backdrop = canvas?.backdrop
  const background = canvas?.background
  const selectedClipId = useEditorStore((s) => s.selectedAnimationClipId)
  // True while the user is dragging a box (on-canvas or position pad). While set,
  // this layer must not rewrite position CSS vars — the gesture owns them so the
  // box tracks the pointer in real time instead of sticking on the last sample
  // until mouse-up.
  const screenshotPositionDragging = useEditorStore(
    (s) => s.screenshotPositionDragging
  )

  // Frame-less single screenshots position by stage pixels (not %), so we need a
  // one-time stage measurement per playback; cache it and re-measure only when a
  // layout-affecting field changes.
  const frame = canvas?.frame
  const hasTweet = Boolean(canvas?.tweet)
  const hasDeviceFrame = (frame?.id ?? "none") !== "none"
  const hasMainScreenshot = Boolean(canvas?.screenshot)
  // A main-target box is ALWAYS on the canvas: a real screenshot, a tweet card,
  // a device frame, or — when none of those exist yet — an empty-state
  // placeholder box. Every one of them is positioned by the same preview vars,
  // so position (like zoom and tilt) must animate on all of them, including an
  // otherwise-empty canvas. Previously this gate excluded the empty box, so
  // position was the one effect that silently refused to animate there.
  //
  // "Bare" means specifically a frame-less REAL screenshot: it renders without
  // the centering translate, so it's placed by absolute px. The empty-state box
  // and framed/tweet/slot targets are placed by the %/anchor vars instead.
  const isBareMainTarget =
    !hasTweet && hasMainScreenshot && !hasDeviceFrame && slots.length === 0

  const dimsRef = React.useRef<StagePlacementDims | null>(null)
  React.useLayoutEffect(() => {
    dimsRef.current = null
  }, [canvasId, scale, canvas?.screenshot, globalAspect, canvas?.aspect])

  const measureDims = React.useCallback(
    (canvasEl: HTMLElement): StagePlacementDims | null => {
      if (dimsRef.current) return dimsRef.current
      const image = canvasEl.querySelector<HTMLElement>(
        "[data-editor-shadow-box-target]"
      )
      const stage = image?.parentElement
      if (!image || !stage) return null
      const computed = getComputedStyle(stage)
      const dims = {
        stageW: parseFloat(computed.width) || stage.clientWidth,
        stageH: parseFloat(computed.height) || stage.clientHeight,
        imgW: image.offsetWidth,
        imgH: image.offsetHeight,
      }
      if (!dims.stageW || !dims.stageH || !dims.imgW || !dims.imgH) return null
      dimsRef.current = dims
      return dims
    },
    []
  )

  // The screenshot elements carry a 300ms ease transition on transform/placement
  // (for smooth slider/preset changes). While PLAYING we drive those every frame,
  // so that transition would smear the motion ~300ms behind the playhead. But it
  // also causes the box to "drift" whenever a pose var changes OUTSIDE playback —
  // most visibly when you hit PAUSE (or reset), where the box eases between poses
  // and looks like it randomly moves. In animate mode every pose change is either
  // driven per-frame (play) or an intentional snap (pause / scrub / edit), so we
  // suppress the transition for the whole animate session and restore on exit.
  // Both the framed target and the frame-less bare image (different data-attrs)
  // need covering.
  React.useLayoutEffect(() => {
    if (typeof document === "undefined" || !canvasId) return
    const canvasEl = document.querySelector<HTMLElement>(
      `[data-canvas-id="${canvasId}"]`
    )
    if (!canvasEl) return
    const targets = Array.from(
      canvasEl.querySelectorAll<HTMLElement>(
        // The shadow targets carry the transform ease; the slot container carries
        // a left/top ease for its position — both would smear the per-frame
        // playback ~300ms behind the playhead, so suppress them for the session.
        // (The main-row positioning container disables its own transition
        // declaratively in Animate mode — see main-screenshot-row-item — since an
        // imperative override here is clobbered by its frequent re-renders.)
        "[data-editor-shadow-filter-target], [data-editor-shadow-box-target], [data-screenshot-slot-id]"
      )
    )
    for (const el of targets) el.style.transition = "none"
    return () => {
      for (const el of targets) el.style.removeProperty("transition")
    }
  }, [canvasId, isPlaying, hasMainScreenshot, slots.length])

  React.useLayoutEffect(() => {
    if (typeof document === "undefined" || !canvasId) return
    const canvasEl = document.querySelector<HTMLElement>(
      `[data-canvas-id="${canvasId}"]`
    )
    if (!canvasEl) return

    // The main screenshot's padding/shadow overrides live on its preview scope
    // (a descendant), falling back to the canvas node. Slots scope by their own
    // element.
    const mainScopeEl =
      canvasEl.querySelector<HTMLElement>(
        '[data-editor-shadow-preview-scope="canvas"]'
      ) ?? canvasEl

    const clearAll = () => {
      for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
      clearPositionPreviewVars(canvasEl)
      for (const v of CANVAS_FX_VARS) setVar(canvasEl, v, null)
      // Per-keyframe background + filter + portrait + pattern layer opacities →
      // back to their rest fallback.
      setVar(canvasEl, PORTRAIT_BASE_OPACITY_VAR, null)
      setVar(canvasEl, PATTERN_BASE_OPACITY_VAR, null)
      setVar(canvasEl, OVERLAY_BASE_OPACITY_VAR, null)
      for (const c of clips) {
        setVar(canvasEl, backgroundLayerOpacityVar(c.id), null)
        setVar(canvasEl, filterLayerOpacityVar(c.id), null)
        setVar(canvasEl, portraitLayerOpacityVar(c.id), null)
        setVar(canvasEl, patternLayerOpacityVar(c.id), null)
        setVar(canvasEl, overlayLayerOpacityVar(c.id), null)
      }
      for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
      canvasEl
        .querySelectorAll<HTMLElement>("[data-screenshot-slot-id]")
        .forEach((slotEl) => {
          for (const v of SLOT_VARS) setVar(slotEl, v, null)
          for (const v of SLOT_FX_VARS) setVar(slotEl, v, null)
          setVar(slotEl, SHADOW_PREVIEW_VAR, null)
          setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, null)
          clearPositionPreviewVars(slotEl)
        })
    }

    // Drive motion while PLAYING, and also while parked mid-timeline (paused or
    // scrubbed past the start) so a PAUSE HOLDS the current frame instead of
    // snapping the box back to the committed pose (and then snapping forward
    // again on resume). Only when truly at rest — stopped at the very start — do
    // we clear every override so the committed inspector pose shows through:
    // dragging the box or editing the inspector then reads naturally, and
    // whatever you leave it at simply becomes this clip's animation target.
    if (!isPlaying && playheadMs <= 0) {
      clearAll()
      return
    }

    // The live/committed pose. Each clip stores its own target keyframe; the
    // clip currently OPEN for editing reflects live canvas edits, so it reads
    // from the committed pose instead of its stored one. Reuse the store's
    // `captureClipPose` (rather than re-listing the fields here) so a new
    // animatable effect can never be silently dropped from the OPEN clip's pose
    // — a missing field makes its numeric track sample `undefined` and ease
    // toward a zero/invisible fallback instead of the value being edited.
    const committedPose: ClipBaseline | null = canvas
      ? captureClipPose(canvas)
      : null
    const poseOf = (c: AnimationClip): ClipBaseline =>
      committedPose && c.id === selectedClipId ? committedPose : clipPose(c)

    // ---- main screenshot: per-effect keyframe tracks --------------------
    // Each effect (tilt, zoom, position, padding, shadow, background, backdrop)
    // is animated INDEPENDENTLY across only the keyframes that OWN it. An owned
    // effect eases from the previous owner's value (or its neutral rest for the
    // first appearance) → this keyframe's value, and holds between/after. An
    // effect no keyframe owns is left at its committed value (var cleared).
    const mainClips = clips.filter(clipAffectsMain)
    if (committedPose && mainClips.length > 0) {
      // Keyframe windows that own `effect`, carrying the target value.
      const framesFor = <V,>(
        effect: Parameters<typeof clipOwns>[1],
        value: (pose: ClipBaseline) => V
      ) =>
        mainClips
          .filter((c) => clipOwns(c, effect))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: value(poseOf(c)),
          }))

      // The value an effect eases FROM before its first keyframe: the committed
      // base pose captured in the first owning clip's baseline. So a tilt/scale/
      // padding/shadow/… animation starts from the CURRENT canvas pose (e.g. a
      // -12° base tilt) instead of a neutral zero. Mirrors how background reveals
      // from clipBaseline(bgClips[0]).background. Falls back to `fallback` when no
      // clip owns the effect (never sampled) — its value doesn't matter then.
      const restFor = <V,>(
        effect: Parameters<typeof clipOwns>[1],
        value: (pose: ClipBaseline) => V,
        fallback: V
      ): V => {
        const first = mainClips
          .filter((c) => clipOwns(c, effect))
          .sort((a, b) => a.startMs - b.startMs)[0]
        return first ? value(clipBaseline(first)) : fallback
      }

      // --- tilt (rx/ry/rz) ---
      const tiltVal = sampleKeyframes<Tilt>(
        framesFor("tilt", (pz) => pz.tilt),
        playheadMs,
        restFor("tilt", (pz) => pz.tilt, { rx: 0, ry: 0, rz: 0 }),
        tiltLerp
      )
      if (tiltVal) {
        setVar(canvasEl, "--canvas-ts-rx", `${tiltVal.rx}deg`)
        setVar(canvasEl, "--canvas-ts-ry", `${tiltVal.ry}deg`)
        setVar(canvasEl, "--canvas-ts-rz", `${tiltVal.rz}deg`)
      } else {
        setVar(canvasEl, "--canvas-ts-rx", null)
        setVar(canvasEl, "--canvas-ts-ry", null)
        setVar(canvasEl, "--canvas-ts-rz", null)
      }

      // --- zoom (scale) ---
      const zoomVal = sampleKeyframes<number>(
        framesFor("zoom", (pz) => pz.scale),
        playheadMs,
        restFor("zoom", (pz) => pz.scale, 100),
        lerp
      )
      setVar(
        canvasEl,
        "--canvas-ts-scale",
        zoomVal != null ? String(zoomVal / 100) : null
      )

      // --- position (grid + offset → point, eases from the committed base
      // placement) ---
      // While the user is dragging (pad or on-canvas), leave the vars alone so
      // the live gesture can drive them without being overwritten each sample.
      const posFrames = mainClips.filter((c) => clipOwns(c, "position"))
      if (screenshotPositionDragging) {
        // Gesture owns the position vars this frame.
      } else if (posFrames.length > 0 && frame) {
        const dims = isBareMainTarget ? measureDims(canvasEl) : null
        const aspect = canvas?.aspect ?? globalAspect
        const pointFor = (
          pos: ScreenshotPosition,
          off: { x: number; y: number }
        ) =>
          dims != null
            ? bareScreenshotPositionPct({
                dims,
                scaleFactor: scale / 100,
                position: pos,
                offset: off,
              })
            : mainScreenshotPositionPct({
                aspect,
                frame,
                position: pos,
                offset: off,
                slots,
              })
        const frames = posFrames.map((c) => {
          const pz = poseOf(c)
          return {
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: pointFor(pz.screenshotPosition, pz.screenshotOffset),
          }
        })
        // Start from the committed base placement (first position clip's
        // baseline), not a hardcoded centre, so the move eases from where the
        // screenshot actually sits.
        const posRest = clipBaseline(
          [...posFrames].sort((a, b) => a.startMs - b.startMs)[0]
        )
        const point = sampleKeyframes(
          frames,
          playheadMs,
          pointFor(posRest.screenshotPosition, posRest.screenshotOffset),
          pointLerp
        )
        if (point && dims != null) {
          const { left, top } = bareScreenshotTargetLeftTop(dims, point)
          setMainScreenshotBarePreviewPx(canvasEl, left, top)
        } else if (point) {
          setMainScreenshotPositionPreview(canvasEl, point)
        } else {
          clearPositionPreviewVars(canvasEl)
        }
      } else {
        clearPositionPreviewVars(canvasEl)
      }

      // --- padding (main only) — eases from the committed base padding ---
      const padVal =
        slots.length === 0
          ? sampleKeyframes<number>(
              framesFor("padding", (pz) => pz.padding),
              playheadMs,
              restFor("padding", (pz) => pz.padding, 0),
              lerp
            )
          : null
      setVar(
        mainScopeEl,
        PADDING_PREVIEW_VAR,
        padVal != null
          ? `${(Math.max(0, Math.min(240, padVal)) / 12).toFixed(3)}%`
          : null
      )

      // --- canvas corner radius — eases from the previous owner's value (0 for
      // its first appearance) → this keyframe's value, and holds between/after,
      // exactly like padding. Drives the same var the inspector slider previews.
      const radiusVal = sampleKeyframes<number>(
        framesFor("canvasRadius", (pz) => pz.canvasBorderRadius),
        playheadMs,
        restFor(
          "canvasRadius",
          (pz) => pz.canvasBorderRadius ?? DEFAULT_BASELINE.canvasBorderRadius,
          DEFAULT_BASELINE.canvasBorderRadius
        ),
        lerp
      )
      setVar(
        canvasEl,
        CANVAS_RADIUS_PREVIEW_VAR,
        radiusVal != null
          ? `${Math.max(0, Math.min(80, radiusVal)).toFixed(3)}px`
          : null
      )

      // --- shadow — eases from the committed base shadow (invisible when the
      // base has none); between owners the old shadow eases OUT beneath the new
      // one easing IN, so different shadow types cross-blend instead of one
      // snapping off. May be 1 or 2 layered shadows.
      const shadowLayers = sampleShadowLayers(
        framesFor("shadow", (pz) => pz.shadow),
        playheadMs,
        restFor("shadow", (pz) => pz.shadow, INVISIBLE_SHADOW)
      )
      if (shadowLayers) {
        const box = shadowLayers
          .map(shadowCss)
          .filter((v): v is string => Boolean(v))
          .join(", ")
        const filter = shadowLayers
          .map(shadowDropFilterCss)
          .filter((v): v is string => Boolean(v))
          .join(" ")
        setVar(mainScopeEl, SHADOW_PREVIEW_VAR, box || "none")
        setVar(mainScopeEl, SHADOW_FILTER_PREVIEW_VAR, filter || "none")
      } else {
        setVar(mainScopeEl, SHADOW_PREVIEW_VAR, null)
        setVar(mainScopeEl, SHADOW_FILTER_PREVIEW_VAR, null)
      }

      // --- border — eases from the committed base border (INVISIBLE when the
      // base has none, so a first keyframe FADES the border in from 0); between
      // owners the colour/width cross-blend continuously, so a later keyframe can
      // recolour or resize without a jump. Drives the outline + offset vars the
      // canvas reads via var(...) fallbacks. ---
      const borderVal = sampleKeyframes<Border>(
        framesFor("border", (pz) => pz.border ?? INVISIBLE_BORDER),
        playheadMs,
        restFor(
          "border",
          (pz) => pz.border ?? INVISIBLE_BORDER,
          INVISIBLE_BORDER
        ),
        borderBetween
      )
      if (borderVal) {
        setVar(
          mainScopeEl,
          BORDER_OUTLINE_PREVIEW_VAR,
          borderOutlineCss(borderVal)
        )
        setVar(
          mainScopeEl,
          BORDER_OFFSET_PREVIEW_VAR,
          borderOffsetCss(borderVal)
        )
      } else {
        setVar(mainScopeEl, BORDER_OUTLINE_PREVIEW_VAR, null)
        setVar(mainScopeEl, BORDER_OFFSET_PREVIEW_VAR, null)
      }

      // --- screenshot corner radius (Border section "Radius") — eases from the
      // committed base radius, exactly like padding/canvasRadius. Drives the var
      // the screenshot reads via var(...) fallback. ---
      const screenshotRadiusVal = sampleKeyframes<number>(
        framesFor(
          "borderRadius",
          (pz) => pz.borderRadius ?? DEFAULT_BASELINE.borderRadius ?? 0
        ),
        playheadMs,
        restFor(
          "borderRadius",
          (pz) => pz.borderRadius ?? DEFAULT_BASELINE.borderRadius ?? 0,
          DEFAULT_BASELINE.borderRadius ?? 0
        ),
        lerp
      )
      setVar(
        mainScopeEl,
        SCREENSHOT_RADIUS_PREVIEW_VAR,
        screenshotRadiusVal != null
          ? `${Math.max(0, Math.min(48, screenshotRadiusVal)).toFixed(3)}px`
          : null
      )

      // --- background — each background keyframe owns its own layer and fades in
      // over its window, so multiple swaps chain (bg1 → bg2 → bg3). Drive every
      // background layer's opacity var to its reveal progress. ---
      for (const c of mainClips.filter((c) => clipOwns(c, "background"))) {
        setVar(
          canvasEl,
          backgroundLayerOpacityVar(c.id),
          String(clipsProgressAt([c], playheadMs))
        )
      }

      // --- backdrop filter — same stacked-layer crossfade as background: each
      // filter keyframe owns a layer that fades in over its window, so multiple
      // filter changes chain (f1 → f2 → f3). ---
      for (const c of mainClips.filter((c) => clipOwns(c, "filter"))) {
        setVar(
          canvasEl,
          filterLayerOpacityVar(c.id),
          String(clipsProgressAt([c], playheadMs))
        )
      }

      // --- portrait — CROSSFADE-CHAIN. Portrait overlays are additive, so a
      // layer must fade OUT as the next fades IN (not stay opaque like the bg /
      // filter stacks): layer_i = progress(i) · (1 − progress(i+1)); the base
      // fades out under the first keyframe (1 − progress(0)); the last holds. ---
      const portraitClips = mainClips
        .filter((c) => clipOwns(c, "portrait"))
        .sort((a, b) => a.startMs - b.startMs)
      if (portraitClips.length > 0) {
        setVar(
          canvasEl,
          PORTRAIT_BASE_OPACITY_VAR,
          String(1 - clipsProgressAt([portraitClips[0]], playheadMs))
        )
        portraitClips.forEach((c, i) => {
          const pIn = clipsProgressAt([c], playheadMs)
          const next = portraitClips[i + 1]
          const pOut = next ? clipsProgressAt([next], playheadMs) : 0
          setVar(
            canvasEl,
            portraitLayerOpacityVar(c.id),
            String(pIn * (1 - pOut))
          )
        })
      }

      // --- pattern — same additive CROSSFADE-CHAIN as portrait. ---
      const patternClips = mainClips
        .filter((c) => clipOwns(c, "pattern"))
        .sort((a, b) => a.startMs - b.startMs)
      if (patternClips.length > 0) {
        setVar(
          canvasEl,
          PATTERN_BASE_OPACITY_VAR,
          String(1 - clipsProgressAt([patternClips[0]], playheadMs))
        )
        patternClips.forEach((c, i) => {
          const pIn = clipsProgressAt([c], playheadMs)
          const next = patternClips[i + 1]
          const pOut = next ? clipsProgressAt([next], playheadMs) : 0
          setVar(
            canvasEl,
            patternLayerOpacityVar(c.id),
            String(pIn * (1 - pOut))
          )
        })
      }

      // --- overlay textures — same additive CROSSFADE-CHAIN as portrait. Each
      // layer renders in its own position (over/under the screenshot), so a
      // position change reads as the texture gliding between the two sides. ---
      const overlayClips = mainClips
        .filter((c) => clipOwns(c, "overlay"))
        .sort((a, b) => a.startMs - b.startMs)
      if (overlayClips.length > 0) {
        setVar(
          canvasEl,
          OVERLAY_BASE_OPACITY_VAR,
          String(1 - clipsProgressAt([overlayClips[0]], playheadMs))
        )
        overlayClips.forEach((c, i) => {
          const pIn = clipsProgressAt([c], playheadMs)
          const next = overlayClips[i + 1]
          const pOut = next ? clipsProgressAt([next], playheadMs) : 0
          setVar(
            canvasEl,
            overlayLayerOpacityVar(c.id),
            String(pIn * (1 - pOut))
          )
        })
      }

      // --- backdrop effects — eases from the committed base (first owning
      // clip's baseline), then chains keyframe → keyframe. ---
      const bdVal = sampleKeyframes<BackdropEffects>(
        framesFor("backdrop", (pz) => pz.backdropEffects),
        playheadMs,
        restFor(
          "backdrop",
          (pz) => pz.backdropEffects,
          DEFAULT_BASELINE.backdropEffects
        ),
        backdropEffectsBetween
      )
      if (bdVal) {
        setVar(
          canvasEl,
          BACKDROP_FX_PREVIEW_VAR,
          effectsFilterCss(bdVal) ?? "none"
        )
        setVar(canvasEl, BACKDROP_NOISE_PREVIEW_VAR, String(bdVal.noise / 100))
      } else {
        setVar(canvasEl, BACKDROP_FX_PREVIEW_VAR, null)
        setVar(canvasEl, BACKDROP_NOISE_PREVIEW_VAR, null)
      }

      // --- backdrop lighting — chains between keyframes. If the canvas already
      // has a lit backdrop, the first keyframe eases FROM that committed light
      // (start from the current pose). When the base is dark, the light fades in
      // AT its target position (no positional travel) so it brightens in place
      // instead of sliding/falling in. Position still eases BETWEEN keyframes.
      const lightingFrames = framesFor(
        "lighting",
        (pz) => pz.lighting ?? REST_LIGHTING
      )
      const lightingRestBase = restFor(
        "lighting",
        (pz) => pz.lighting ?? REST_LIGHTING,
        REST_LIGHTING
      )
      const lightingRest =
        lightingRestBase.intensity > 0
          ? lightingRestBase
          : lightingEntranceRest(lightingFrames[0]?.value)
      const lightVal = sampleKeyframes<BackdropLighting>(
        lightingFrames,
        playheadMs,
        lightingRest,
        lightingBetween
      )
      // The glow's inner/outer target eases as its own 0(outer)→1(inner) track,
      // so switching target between keyframes crossfades the light from the
      // backdrop into the screenshot (a depth shift) instead of snapping. The
      // outer overlay's opacity is scaled by (1 − mix), the inner by mix.
      // The mix eases from the base target when the canvas is already lit, else
      // from the first keyframe's target (the reveal's own side).
      const firstIsInner =
        (lightingRest.target ?? REST_LIGHTING.target) === "inner"
      const targetMix =
        sampleKeyframes<number>(
          lightingFrames.map((f) => ({
            ...f,
            value: f.value.target === "inner" ? 1 : 0,
          })),
          playheadMs,
          firstIsInner ? 1 : 0,
          lerp
        ) ?? (firstIsInner ? 1 : 0)
      if (lightVal) {
        const outer = lightingOverlayValues(lightVal)
        const inner = lightingOverlayValues(lightVal, { inner: true })
        setVar(canvasEl, LIGHTING_IMAGE_VAR, outer ? outer.image : "none")
        setVar(
          canvasEl,
          LIGHTING_OPACITY_VAR,
          outer ? (outer.opacity * (1 - targetMix)).toFixed(3) : "0"
        )
        setVar(
          canvasEl,
          `${LIGHTING_IMAGE_VAR}-in`,
          inner ? inner.image : "none"
        )
        setVar(
          canvasEl,
          `${LIGHTING_OPACITY_VAR}-in`,
          inner ? (inner.opacity * targetMix).toFixed(3) : "0"
        )
      } else {
        setVar(canvasEl, LIGHTING_IMAGE_VAR, null)
        setVar(canvasEl, LIGHTING_OPACITY_VAR, null)
        setVar(canvasEl, `${LIGHTING_IMAGE_VAR}-in`, null)
        setVar(canvasEl, `${LIGHTING_OPACITY_VAR}-in`, null)
      }
    } else {
      // No keyframes touch the main screenshot — leave its committed pose alone.
      for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
      clearPositionPreviewVars(canvasEl)
      for (const v of CANVAS_FX_VARS) setVar(canvasEl, v, null)
      for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
    }

    // ---- extra screenshot slots: per-effect ownership -------------------
    // Same model as the main screenshot: a slot's tilt (rx/ry/rz + rotation) and
    // zoom (scale) each animate only across the keyframes that own them, revealing
    // from neutral and holding otherwise.
    for (const slot of slots) {
      const slotEl = canvasEl.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${slot.id}"]`
      )
      if (!slotEl) continue
      const slotClips = clips.filter((c) => clipAffectsSlot(c, slot.id))
      if (slotClips.length === 0) {
        for (const v of SLOT_VARS) setVar(slotEl, v, null)
        for (const v of SLOT_FX_VARS) setVar(slotEl, v, null)
        setVar(slotEl, SHADOW_PREVIEW_VAR, null)
        setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, null)
        clearPositionPreviewVars(slotEl)
        continue
      }
      const slotPoseOf = (c: AnimationClip) =>
        poseOf(c).slots[slot.id] ?? NEUTRAL_SLOT_POSE

      // tilt + rotation (both under the "tilt" effect)
      const tiltVal = sampleKeyframes<{ tilt: Tilt; rotation: number }>(
        slotClips
          .filter((c) => clipOwns(c, "tilt"))
          .map((c) => {
            const sp = slotPoseOf(c)
            return {
              startMs: c.startMs,
              durationMs: c.durationMs,
              value: { tilt: sp.tilt, rotation: sp.rotation },
            }
          }),
        playheadMs,
        { tilt: { rx: 0, ry: 0, rz: 0 }, rotation: 0 },
        (a, b, pr) => ({
          tilt: tiltLerp(a.tilt, b.tilt, pr),
          rotation: lerp(a.rotation, b.rotation, pr),
        })
      )
      if (tiltVal) {
        setVar(slotEl, "--slot-ts-rx", `${tiltVal.tilt.rx}deg`)
        setVar(slotEl, "--slot-ts-ry", `${tiltVal.tilt.ry}deg`)
        setVar(slotEl, "--slot-ts-rz", `${tiltVal.tilt.rz}deg`)
        setVar(slotEl, "--slot-ts-rot", `${tiltVal.rotation}deg`)
      } else {
        setVar(slotEl, "--slot-ts-rx", null)
        setVar(slotEl, "--slot-ts-ry", null)
        setVar(slotEl, "--slot-ts-rz", null)
        setVar(slotEl, "--slot-ts-rot", null)
      }

      // zoom (scale)
      const slotZoom = sampleKeyframes<number>(
        slotClips
          .filter((c) => clipOwns(c, "zoom"))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: slotPoseOf(c).scale,
          })),
        playheadMs,
        100,
        lerp
      )
      setVar(
        slotEl,
        "--slot-ts-scale",
        slotZoom != null ? String(slotZoom / 100) : null
      )

      // position (xPct/yPct) — eases from the slot's committed home (the first
      // position keyframe's baseline) → each keyframe's value, driving the same
      // --editor-position-x/y vars the slot's left/top read. Only the keyframes
      // that OWN position animate; otherwise the committed position shows.
      // Skip while a drag/pad gesture owns the vars (same as main above).
      const slotPosClips = slotClips.filter((c) => clipOwns(c, "position"))
      if (screenshotPositionDragging) {
        // Gesture owns the position vars this frame.
      } else if (slotPosClips.length > 0) {
        const firstPos = [...slotPosClips].sort(
          (a, b) => a.startMs - b.startMs
        )[0]
        const restPose = clipBaseline(firstPos).slots[slot.id]
        const slotPoint = sampleKeyframes<{ xPct: number; yPct: number }>(
          slotPosClips.map((c) => {
            const sp = slotPoseOf(c)
            return {
              startMs: c.startMs,
              durationMs: c.durationMs,
              value: {
                xPct: sp.xPct ?? slot.xPct,
                yPct: sp.yPct ?? slot.yPct,
              },
            }
          }),
          playheadMs,
          {
            xPct: restPose?.xPct ?? slot.xPct,
            yPct: restPose?.yPct ?? slot.yPct,
          },
          pointLerp
        )
        if (slotPoint) setElementPositionPreview(slotEl, slotPoint)
        else clearPositionPreviewVars(slotEl)
      } else {
        clearPositionPreviewVars(slotEl)
      }

      // shadow — reveals from invisible; different shadow types cross-blend
      // between owners, exactly like the main screenshot. Vars are set on the
      // slot's own preview scope (this element carries data-editor-shadow-
      // preview-scope), so they only affect this slot's shadow.
      const slotShadowLayers = sampleShadowLayers(
        slotClips
          .filter((c) => clipOwns(c, "shadow"))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: slotPoseOf(c).shadow ?? INVISIBLE_SHADOW,
          })),
        playheadMs,
        INVISIBLE_SHADOW
      )
      if (slotShadowLayers) {
        const box = slotShadowLayers
          .map(shadowCss)
          .filter((v): v is string => Boolean(v))
          .join(", ")
        const filter = slotShadowLayers
          .map(shadowDropFilterCss)
          .filter((v): v is string => Boolean(v))
          .join(" ")
        setVar(slotEl, SHADOW_PREVIEW_VAR, box || "none")
        setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, filter || "none")
      } else {
        setVar(slotEl, SHADOW_PREVIEW_VAR, null)
        setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, null)
      }

      // The value a slot effect eases FROM before its first keyframe: the first
      // owning clip's captured baseline slot pose, so border/radius/padding/
      // lighting reveal from the slot's OWN committed look (mirrors the main
      // screenshot's restFor). Falls back when no clip owns the effect.
      const slotRestFor = <V,>(
        effect: Parameters<typeof clipOwns>[1],
        extract: (sp: ClipSlotPose | undefined) => V | undefined,
        fallback: V
      ): V => {
        const first = slotClips
          .filter((c) => clipOwns(c, effect))
          .sort((a, b) => a.startMs - b.startMs)[0]
        if (!first) return fallback
        return extract(clipBaseline(first).slots[slot.id]) ?? fallback
      }

      // border — reveals from the slot's committed border (INVISIBLE when none,
      // so a first keyframe FADES it in); between owners colour/width cross-blend.
      const committedBorder = slot.border ?? canvas?.border ?? INVISIBLE_BORDER
      const slotBorder = sampleKeyframes<Border>(
        slotClips
          .filter((c) => clipOwns(c, "border"))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: slotPoseOf(c).border ?? committedBorder,
          })),
        playheadMs,
        slotRestFor("border", (sp) => sp?.border, INVISIBLE_BORDER),
        borderBetween
      )
      if (slotBorder) {
        setVar(slotEl, BORDER_OUTLINE_PREVIEW_VAR, borderOutlineCss(slotBorder))
        setVar(slotEl, BORDER_OFFSET_PREVIEW_VAR, borderOffsetCss(slotBorder))
      } else {
        setVar(slotEl, BORDER_OUTLINE_PREVIEW_VAR, null)
        setVar(slotEl, BORDER_OFFSET_PREVIEW_VAR, null)
      }

      // corner radius — eases from the slot's committed radius.
      const committedRadius = slot.borderRadius ?? canvas?.borderRadius ?? 0
      const slotRadius = sampleKeyframes<number>(
        slotClips
          .filter((c) => clipOwns(c, "borderRadius"))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: slotPoseOf(c).borderRadius ?? committedRadius,
          })),
        playheadMs,
        slotRestFor("borderRadius", (sp) => sp?.borderRadius, committedRadius),
        lerp
      )
      setVar(
        slotEl,
        SCREENSHOT_RADIUS_PREVIEW_VAR,
        slotRadius != null ? `${Math.max(0, slotRadius).toFixed(3)}px` : null
      )

      // padding — eases from the slot's committed padding (same %-of-box formula
      // the slot element uses for its committed value).
      const committedPadding = slot.padding ?? canvas?.padding ?? 0
      const slotPadding = sampleKeyframes<number>(
        slotClips
          .filter((c) => clipOwns(c, "padding"))
          .map((c) => ({
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: slotPoseOf(c).padding ?? committedPadding,
          })),
        playheadMs,
        slotRestFor("padding", (sp) => sp?.padding, committedPadding),
        lerp
      )
      setVar(
        slotEl,
        PADDING_PREVIEW_VAR,
        slotPadding != null
          ? `${(Math.max(0, Math.min(240, slotPadding)) / 12).toFixed(3)}%`
          : null
      )

      // lighting — slots only carry the INNER glow (over the screenshot); it
      // eases position/strength/colour between owners like the main screenshot's,
      // and reveals from dark. Setting the `-in` vars on the slot element
      // overrides the canvas-level ones it would otherwise inherit.
      const slotLightingFrames = slotClips
        .filter((c) => clipOwns(c, "lighting"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).lighting ?? REST_LIGHTING,
        }))
      if (slotLightingFrames.length > 0) {
        const restBase = slotRestFor(
          "lighting",
          (sp) => sp?.lighting,
          REST_LIGHTING
        )
        const lightingRest =
          restBase.intensity > 0
            ? restBase
            : lightingEntranceRest(slotLightingFrames[0]?.value)
        const lightVal = sampleKeyframes<BackdropLighting>(
          slotLightingFrames,
          playheadMs,
          lightingRest,
          lightingBetween
        )
        // Inner-glow strength scales by how "inner" the target is (1 inner, 0
        // outer): slots don't render an outer glow, so an outer target reads as 0.
        const innerMix =
          sampleKeyframes<number>(
            slotLightingFrames.map((f) => ({
              ...f,
              value: f.value.target === "inner" ? 1 : 0,
            })),
            playheadMs,
            (lightingRest.target ?? REST_LIGHTING.target) === "inner" ? 1 : 0,
            lerp
          ) ?? 0
        const inner = lightVal
          ? lightingOverlayValues(lightVal, { inner: true })
          : null
        setVar(slotEl, `${LIGHTING_IMAGE_VAR}-in`, inner ? inner.image : "none")
        setVar(
          slotEl,
          `${LIGHTING_OPACITY_VAR}-in`,
          inner ? (inner.opacity * innerMix).toFixed(3) : "0"
        )
      } else {
        // No slot lighting keyframe → let the slot fall back to its committed
        // inner glow (or inherit the canvas-level animated glow, matching how a
        // slot shows the shared backdrop lighting at rest).
        setVar(slotEl, `${LIGHTING_IMAGE_VAR}-in`, null)
        setVar(slotEl, `${LIGHTING_OPACITY_VAR}-in`, null)
      }
    }

    // Clear everything when playback stops or animate mode exits so the static
    // inspector look (the var fallbacks) shows through untouched.
    return clearAll
  }, [
    canvas,
    canvasId,
    isPlaying,
    playheadMs,
    clips,
    selectedClipId,
    screenshotPositionDragging,
    tilt,
    scale,
    slots,
    shadow,
    padding,
    backdrop,
    background,
    frame,
    isBareMainTarget,
    globalAspect,
    measureDims,
  ])

  return null
}
