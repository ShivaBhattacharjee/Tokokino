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
  clipAffectsMain,
  clipAffectsSlot,
  clipOwns,
  clipPose,
  clipsProgressAt,
  DEFAULT_BASELINE,
  lerp,
  lightingEntranceRest,
  lightingBetween,
  NEUTRAL_SLOT_POSE,
  REST_LIGHTING,
  sampleKeyframes,
  sampleShadowLayers,
} from "@/lib/editor/animation-playback"
import {
  effectsFilterCss,
  shadowCss,
  shadowDropFilterCss,
  SHADOW_FILTER_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
} from "@/lib/editor/css-utils"
import { useEditorStore } from "@/lib/editor/store"
import type {
  AnimationClip,
  BackdropEffects,
  BackdropLighting,
  ClipBaseline,
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
        "[data-editor-shadow-filter-target], [data-editor-shadow-box-target]"
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
      // Per-keyframe background layer opacities → back to their rest fallback.
      for (const c of clips)
        setVar(canvasEl, backgroundLayerOpacityVar(c.id), null)
      for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
      canvasEl
        .querySelectorAll<HTMLElement>("[data-screenshot-slot-id]")
        .forEach((slotEl) => {
          for (const v of SLOT_VARS) setVar(slotEl, v, null)
          setVar(slotEl, SHADOW_PREVIEW_VAR, null)
          setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, null)
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
    // from the committed pose instead of its stored one.
    const committedPose: ClipBaseline | null = canvas
      ? {
          tilt: canvas.tilt,
          scale: canvas.scale,
          screenshotPosition: canvas.screenshotPosition,
          screenshotOffset: canvas.screenshotOffset,
          padding: canvas.padding,
          canvasBorderRadius: canvas.canvasBorderRadius,
          shadow: canvas.shadow,
          backdropEffects: canvas.backdrop.effects,
          lighting: canvas.backdrop.lighting,
          background: canvas.background,
          slots: Object.fromEntries(
            canvas.screenshotSlots.map((s) => [
              s.id,
              {
                tilt: s.tilt,
                scale: s.scale,
                rotation: s.rotation,
                shadow: s.shadow ?? canvas.shadow,
              },
            ])
          ),
        }
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

      // --- tilt (rx/ry/rz) ---
      const tiltVal = sampleKeyframes<Tilt>(
        framesFor("tilt", (pz) => pz.tilt),
        playheadMs,
        { rx: 0, ry: 0, rz: 0 },
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
        100,
        lerp
      )
      setVar(
        canvasEl,
        "--canvas-ts-scale",
        zoomVal != null ? String(zoomVal / 100) : null
      )

      // --- position (grid + offset → point, revealing from center) ---
      const posFrames = mainClips.filter((c) => clipOwns(c, "position"))
      if (posFrames.length > 0 && frame) {
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
        const point = sampleKeyframes(
          frames,
          playheadMs,
          pointFor("center", { x: 0, y: 0 }),
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

      // --- padding (main only) — reveals from 0 ---
      const padVal =
        slots.length === 0
          ? sampleKeyframes<number>(
              framesFor("padding", (pz) => pz.padding),
              playheadMs,
              0,
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
        DEFAULT_BASELINE.canvasBorderRadius,
        lerp
      )
      setVar(
        canvasEl,
        CANVAS_RADIUS_PREVIEW_VAR,
        radiusVal != null
          ? `${Math.max(0, Math.min(80, radiusVal)).toFixed(3)}px`
          : null
      )

      // --- shadow — reveals in from invisible; between owners the old shadow
      // eases OUT beneath the new one easing IN, so different shadow types
      // cross-blend instead of one snapping off. May be 1 or 2 layered shadows.
      const shadowLayers = sampleShadowLayers(
        framesFor("shadow", (pz) => pz.shadow),
        playheadMs,
        INVISIBLE_SHADOW
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

      // --- backdrop effects — reveals from neutral ---
      const bdVal = sampleKeyframes<BackdropEffects>(
        framesFor("backdrop", (pz) => pz.backdropEffects),
        playheadMs,
        DEFAULT_BASELINE.backdropEffects,
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

      // --- backdrop lighting — chains between keyframes. The first lighting
      // keyframe starts just outside its target side/corner, so a top light
      // travels downward into place instead of coming from a fixed default edge.
      const lightingFrames = framesFor(
        "lighting",
        (pz) => pz.lighting ?? REST_LIGHTING
      )
      const lightVal = sampleKeyframes<BackdropLighting>(
        lightingFrames,
        playheadMs,
        lightingEntranceRest(lightingFrames[0]?.value),
        lightingBetween
      )
      if (lightVal) {
        const outer = lightingOverlayValues(lightVal)
        const inner = lightingOverlayValues(lightVal, { inner: true })
        setVar(canvasEl, LIGHTING_IMAGE_VAR, outer ? outer.image : "none")
        setVar(
          canvasEl,
          LIGHTING_OPACITY_VAR,
          outer ? outer.opacity.toFixed(3) : "0"
        )
        setVar(
          canvasEl,
          `${LIGHTING_IMAGE_VAR}-in`,
          inner ? inner.image : "none"
        )
        setVar(
          canvasEl,
          `${LIGHTING_OPACITY_VAR}-in`,
          inner ? inner.opacity.toFixed(3) : "0"
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
        setVar(slotEl, SHADOW_PREVIEW_VAR, null)
        setVar(slotEl, SHADOW_FILTER_PREVIEW_VAR, null)
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
