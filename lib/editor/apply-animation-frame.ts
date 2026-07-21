/**
 * Shared Animate-mode frame applicator.
 *
 * Samples every owned effect at a playhead time and writes the same CSS
 * preview vars the live player (`AnimationLayer`) and the GIF/WebM exporter
 * both drive. One implementation → preview always matches export.
 */

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
import {
  BACKDROP_FX_PREVIEW_VAR,
  BACKDROP_NOISE_PREVIEW_VAR,
  LIGHTING_IMAGE_VAR,
  LIGHTING_OPACITY_VAR,
} from "@/components/editor/inspector/backdrop-section-parts/constants"
import {
  coverContainerBox,
  fitContainBox,
  lightingOverlayValues,
} from "@/components/editor/canvas/helpers"
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
  cropRegionBetween,
  DEFAULT_BASELINE,
  filterLayerOpacityVar,
  FULL_CROP_REGION,
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
  lightingTargetMixAt,
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
import {
  CROP_ANIMATION_VARS,
  CROP_FIT_ORIGIN_VAR,
  CROP_FIT_SX_VAR,
  CROP_FIT_SY_VAR,
  CROP_HEIGHT_VAR,
  CROP_LEFT_VAR,
  CROP_SHELL_H_VAR,
  CROP_SHELL_W_VAR,
  CROP_TOP_VAR,
  CROP_VIEW_BOX_VAR,
  CROP_WIDTH_VAR,
  cropObjectMetrics,
  cropOriginCss,
  cropRegionRatio,
  cropViewBoxValue,
} from "@/lib/editor/crop-utils"
import { clipProgressEase } from "@/lib/editor/clip-easing"
import { captureClipPose } from "@/lib/editor/store"
import type {
  AnimationClip,
  AspectState,
  BackdropEffects,
  BackdropLighting,
  Border,
  CanvasState,
  ClipBaseline,
  ClipSlotPose,
  CropRegion,
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

const SCOPE_VARS = [
  PADDING_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
  SHADOW_FILTER_PREVIEW_VAR,
  BORDER_OUTLINE_PREVIEW_VAR,
  BORDER_OFFSET_PREVIEW_VAR,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
]
const CROP_VARS = CROP_ANIMATION_VARS
const CANVAS_FX_VARS = [
  BG_OPACITY_VAR,
  ...CROP_VARS,
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
const SLOT_FX_VARS = [
  BORDER_OUTLINE_PREVIEW_VAR,
  BORDER_OFFSET_PREVIEW_VAR,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
  PADDING_PREVIEW_VAR,
  `${LIGHTING_IMAGE_VAR}-in`,
  `${LIGHTING_OPACITY_VAR}-in`,
]

export function measureBareStageDims(
  canvasEl: HTMLElement
): StagePlacementDims | null {
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
  return dims
}

/** Clear every animate override so committed CSS fallbacks show through. */
export function clearAnimationFrameVars(
  canvasEl: HTMLElement,
  clips: AnimationClip[]
) {
  const mainScopeEl =
    canvasEl.querySelector<HTMLElement>(
      '[data-editor-shadow-preview-scope="canvas"]'
    ) ?? canvasEl

  for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
  clearPositionPreviewVars(canvasEl)
  for (const v of CANVAS_FX_VARS) setVar(canvasEl, v, null)
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

/**
 * The geometry an animated crop implies this frame, or null when it implies
 * none (no media, unmeasurable stage, or `fill` — which maps 1:1 by
 * definition).
 *
 * The polyfill maps the crop region onto the media shell exactly — `fill`
 * semantics — so honouring the canvas's fill mode means giving the shell the
 * window's own ratio (contain) or scaling the video up to cover it (cover). The
 * ratio can change every frame, so neither can be static CSS.
 *
 * `shellBox` is set only for `contain`, the one mode that resizes the shell;
 * `cover` leaves the shell at the stage box and scales the video inside it.
 * It is derived, never measured: the shell's size and the placement that
 * centres on it are decided in the same pass, so reading it back from the DOM
 * could only ever report the previous frame's box.
 *
 * Measures the stage and the media's natural size because neither lives in the
 * state tree. A missing measurement returns null and the caller clears the
 * vars rather than guessing, leaving the committed styles in play.
 */
function cropFitGeometry(
  canvasEl: HTMLElement,
  canvas: CanvasState,
  region: CropRegion
): {
  fit: "contain" | "cover"
  stageW: number
  stageH: number
  ratio: number
  shellBox: { width: number; height: number } | null
} | null {
  const fit = canvas.objectFit ?? "contain"
  if (fit === "fill") return null

  const shell = canvasEl.querySelector<HTMLElement>(
    '[data-export-stack="media"]'
  )
  // `video, img`: the export clone swaps the serialized `<video>` for an `<img>`
  // stand-in (see video-layer), so matching only `video` found nothing there and
  // silently cleared the correction for every exported frame — the crop window
  // landed with the polyfill's raw fill mapping while the preview, which still
  // has a real `<video>`, was correct.
  const media = shell?.querySelector<HTMLVideoElement | HTMLImageElement>(
    "video, img"
  )
  const stage = shell?.parentElement
  if (!shell || !media || !stage) return null

  // The stand-in reports no natural size until its first paint, so fall back to
  // the dimensions the swap seeded from the source video.
  const naturalW =
    media instanceof HTMLVideoElement
      ? media.videoWidth
      : media.naturalWidth || Number(media.dataset.naturalW) || 0
  const naturalH =
    media instanceof HTMLVideoElement
      ? media.videoHeight
      : media.naturalHeight || Number(media.dataset.naturalH) || 0
  const ratio = cropRegionRatio(region, naturalW, naturalH)
  const stageW = parseFloat(getComputedStyle(stage).width) || stage.clientWidth
  const stageH =
    parseFloat(getComputedStyle(stage).height) || stage.clientHeight
  if (!ratio || !(stageW > 0) || !(stageH > 0)) return null

  return {
    fit,
    stageW,
    stageH,
    ratio,
    shellBox: fit === "contain" ? fitContainBox(stageW, stageH, ratio) : null,
  }
}

function applyCropFitVars(
  canvasEl: HTMLElement,
  region: CropRegion,
  geometry: ReturnType<typeof cropFitGeometry>
) {
  const clearFit = () => {
    setVar(canvasEl, CROP_SHELL_W_VAR, null)
    setVar(canvasEl, CROP_SHELL_H_VAR, null)
    setVar(canvasEl, CROP_FIT_SX_VAR, null)
    setVar(canvasEl, CROP_FIT_SY_VAR, null)
    setVar(canvasEl, CROP_FIT_ORIGIN_VAR, null)
  }

  if (!geometry) return clearFit()
  const { stageW, stageH, ratio, shellBox } = geometry

  setVar(canvasEl, CROP_FIT_ORIGIN_VAR, cropOriginCss(region))

  if (shellBox) {
    // Shell shrinks to the window's ratio; the mapping is then 1:1, no scale.
    setVar(canvasEl, CROP_SHELL_W_VAR, `${shellBox.width}px`)
    setVar(canvasEl, CROP_SHELL_H_VAR, `${shellBox.height}px`)
    setVar(canvasEl, CROP_FIT_SX_VAR, "1")
    setVar(canvasEl, CROP_FIT_SY_VAR, "1")
    return
  }

  // cover: the shell stays the stage box (it is the clip), so the window has to
  // grow past it — scale about the window's own centre and let overflow clip.
  const box = coverContainerBox(stageW, stageH, ratio)
  setVar(canvasEl, CROP_SHELL_W_VAR, null)
  setVar(canvasEl, CROP_SHELL_H_VAR, null)
  setVar(canvasEl, CROP_FIT_SX_VAR, String(box.width / stageW))
  setVar(canvasEl, CROP_FIT_SY_VAR, String(box.height / stageH))
}

export type ApplyAnimationFrameOptions = {
  canvasEl: HTMLElement
  canvas: CanvasState
  /** Global editor aspect (fallback when canvas has no per-canvas aspect). */
  globalAspect: AspectState
  clips: AnimationClip[]
  timeMs: number
  /**
   * Clip currently open for editing — its pose is read live from the canvas.
   * Export snapshots the open selected keyframe before capture, then passes null.
   */
  selectedClipId?: string | null
  /** When true, leave position vars alone (gesture owns them). */
  screenshotPositionDragging?: boolean
  /** Cached bare stage dims; measured from canvasEl when omitted. */
  bareDims?: StagePlacementDims | null
}

/**
 * Sample every owned effect at `timeMs` and write CSS preview vars onto
 * `canvasEl` (and its slots). Used by live playback and GIF/WebM export.
 */
export function applyAnimationFrameAtTime({
  canvasEl,
  canvas,
  globalAspect,
  clips,
  timeMs,
  selectedClipId = null,
  screenshotPositionDragging = false,
  bareDims = null,
}: ApplyAnimationFrameOptions) {
  const playheadMs = timeMs
  const slots = canvas.screenshotSlots ?? []
  const scale = canvas.scale ?? 100
  const frame = canvas.frame
  const hasTweet = Boolean(canvas.tweet)
  const hasDeviceFrame = (frame?.id ?? "none") !== "none"
  const hasMainScreenshot = Boolean(canvas.screenshot)
  const isBareMainTarget =
    !hasTweet && hasMainScreenshot && !hasDeviceFrame && slots.length === 0

  const mainScopeEl =
    canvasEl.querySelector<HTMLElement>(
      '[data-editor-shadow-preview-scope="canvas"]'
    ) ?? canvasEl

  const committedPose: ClipBaseline = captureClipPose(canvas)
  const poseOf = (c: AnimationClip): ClipBaseline =>
    selectedClipId && c.id === selectedClipId ? committedPose : clipPose(c)

  const mainClips = clips.filter(clipAffectsMain)
  if (mainClips.length > 0) {
    const framesFor = <V>(
      effect: Parameters<typeof clipOwns>[1],
      value: (pose: ClipBaseline) => V
    ) =>
      mainClips
        .filter((c) => clipOwns(c, effect))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: value(poseOf(c)),
          ease: clipProgressEase(c),
        }))

    const restFor = <V>(
      effect: Parameters<typeof clipOwns>[1],
      value: (pose: ClipBaseline) => V,
      fallback: V
    ): V => {
      const first = mainClips
        .filter((c) => clipOwns(c, effect))
        .sort((a, b) => a.startMs - b.startMs)[0]
      return first ? value(clipBaseline(first)) : fallback
    }

    // tilt
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

    // zoom
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

    // The crop this frame lands on, and the shell geometry it implies. Sampled
    // here rather than in the crop block below because the placement needs it:
    // in contain mode the crop resizes the shell, and the bare placement
    // centres on that size.
    const cropVal = sampleKeyframes<CropRegion>(
      framesFor("crop", (pz) => pz.crop ?? FULL_CROP_REGION),
      playheadMs,
      restFor("crop", (pz) => pz.crop ?? FULL_CROP_REGION, FULL_CROP_REGION),
      cropRegionBetween
    )
    const cropGeometry = cropVal
      ? cropFitGeometry(canvasEl, canvas, cropVal)
      : null

    // position
    const posFrames = mainClips.filter((c) => clipOwns(c, "position"))
    // A crop that resizes the shell has to drive the placement too, even when
    // nothing animates position. The committed `left` is a px value React baked
    // from the uncropped box; the export clone is a static snapshot that cannot
    // recompute it, so the shell would shrink about a frozen left edge instead
    // of about its centre. (The live preview re-renders and re-centres, which
    // is exactly why this only ever showed up in exports.)
    const cropResizesShell = cropGeometry?.shellBox != null
    if (screenshotPositionDragging) {
      // gesture owns vars
    } else if ((posFrames.length > 0 || cropResizesShell) && frame) {
      // The bare-pixel positioning path is ONLY valid for the free-floating
      // single screenshot. For a framed or multi-slot (row) main, `dims` must be
      // null so the percentage/anchor path runs — otherwise a caller that always
      // passes `bareDims` (the exporter measures it unconditionally) would push
      // the row main onto the wrong path and misplace it. Never trust a passed
      // `bareDims` unless this really is the bare target.
      const measured = isBareMainTarget
        ? (bareDims ?? measureBareStageDims(canvasEl))
        : null
      // Take the shell size from the crop that is being applied THIS frame, not
      // from the DOM. A measurement can only ever report the previous frame's
      // box — the crop resizing the shell and the placement centring on it
      // happen in the same pass — so the centre would trail the width by a
      // frame and the box would appear to crop in from one edge only.
      const dims =
        measured && cropGeometry?.shellBox
          ? {
              ...measured,
              imgW: cropGeometry.shellBox.width,
              imgH: cropGeometry.shellBox.height,
            }
          : measured
      const aspect = canvas.aspect ?? globalAspect
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
          ease: clipProgressEase(c),
        }
      })
      const posRest =
        posFrames.length > 0
          ? clipBaseline(
              [...posFrames].sort((a, b) => a.startMs - b.startMs)[0]
            )
          : null
      // No position clip: hold the committed placement, re-resolved against
      // this frame's shell box so a crop-only clip still stays centred.
      const point = posRest
        ? sampleKeyframes(
            frames,
            playheadMs,
            pointFor(posRest.screenshotPosition, posRest.screenshotOffset),
            pointLerp
          )
        : pointFor(
            committedPose.screenshotPosition,
            committedPose.screenshotOffset
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

    // padding (main only, no slots)
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

    // canvas radius
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

    // shadow
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

    // border
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
      setVar(mainScopeEl, BORDER_OFFSET_PREVIEW_VAR, borderOffsetCss(borderVal))
    } else {
      setVar(mainScopeEl, BORDER_OUTLINE_PREVIEW_VAR, null)
      setVar(mainScopeEl, BORDER_OFFSET_PREVIEW_VAR, null)
    }

    // screenshot radius
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

    // background layers
    for (const c of mainClips.filter((c) => clipOwns(c, "background"))) {
      setVar(
        canvasEl,
        backgroundLayerOpacityVar(c.id),
        String(clipsProgressAt([c], playheadMs))
      )
    }

    // filter layers
    for (const c of mainClips.filter((c) => clipOwns(c, "filter"))) {
      setVar(
        canvasEl,
        filterLayerOpacityVar(c.id),
        String(clipsProgressAt([c], playheadMs))
      )
    }

    // portrait crossfade chain
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

    // pattern crossfade chain
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
        setVar(canvasEl, patternLayerOpacityVar(c.id), String(pIn * (1 - pOut)))
      })
    }

    // overlay crossfade chain
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
        setVar(canvasEl, overlayLayerOpacityVar(c.id), String(pIn * (1 - pOut)))
      })
    }

    // backdrop effects
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
        effectsFilterCss(bdVal) ?? "brightness(1)"
      )
      setVar(canvasEl, BACKDROP_NOISE_PREVIEW_VAR, String(bdVal.noise / 100))
    } else {
      setVar(canvasEl, BACKDROP_FX_PREVIEW_VAR, null)
      setVar(canvasEl, BACKDROP_NOISE_PREVIEW_VAR, null)
    }

    // crop (video only) — the source rect, never the laid-out box: the canvas
    // aspect keeps reading the committed region so the encoder's frame size is
    // constant. Both render paths get their var because browser support for
    // `object-view-box` differs and the clone may rasterize on either.
    // `cropVal`/`cropGeometry` are sampled above, where the placement needs them.
    if (cropVal) {
      const metrics = cropObjectMetrics(cropVal)
      setVar(canvasEl, CROP_VIEW_BOX_VAR, cropViewBoxValue(cropVal))
      setVar(canvasEl, CROP_WIDTH_VAR, metrics.width)
      setVar(canvasEl, CROP_HEIGHT_VAR, metrics.height)
      setVar(canvasEl, CROP_LEFT_VAR, metrics.left)
      setVar(canvasEl, CROP_TOP_VAR, metrics.top)
      applyCropFitVars(canvasEl, cropVal, cropGeometry)
    } else {
      for (const v of CROP_VARS) setVar(canvasEl, v, null)
    }

    // lighting — pure-inner stays ON the screenshot; pure-outer stays on the
    // canvas backdrop. Only a real inner↔outer depth shift crossfades the two.
    // (Previously any lighting animation drove both overlays and could ease
    // from outer→inner, so an "Inner" light appeared to start on the canvas
    // then settle on the image — especially visible with position/tilt.)
    const lightingFrames = framesFor(
      "lighting",
      (pz) => pz.lighting ?? REST_LIGHTING
    )
    const lightingRestBase = restFor(
      "lighting",
      (pz) => pz.lighting ?? REST_LIGHTING,
      REST_LIGHTING
    )
    // Dark base → fade in AT the first keyframe's side/position (no travel,
    // no crossfade from the other side). Lit base → ease from that pose.
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
    const targetMix = lightingTargetMixAt(
      lightingFrames,
      playheadMs,
      lightingRest
    )
    if (lightVal) {
      // Only drive the side(s) the mix actually uses so a pure-inner light
      // never paints the canvas-level (outer) overlay at all.
      const driveOuter = targetMix < 1 - 1e-6
      const driveInner = targetMix > 1e-6
      const outer = driveOuter
        ? lightingOverlayValues(lightVal, { forceMount: true })
        : null
      const inner = driveInner
        ? lightingOverlayValues(lightVal, { inner: true, forceMount: true })
        : null
      setVar(canvasEl, LIGHTING_IMAGE_VAR, outer ? outer.image : "none")
      setVar(
        canvasEl,
        LIGHTING_OPACITY_VAR,
        outer ? (outer.opacity * (1 - targetMix)).toFixed(3) : "0"
      )
      setVar(canvasEl, `${LIGHTING_IMAGE_VAR}-in`, inner ? inner.image : "none")
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
    for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
    clearPositionPreviewVars(canvasEl)
    for (const v of CANVAS_FX_VARS) setVar(canvasEl, v, null)
    for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
  }

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

    const tiltVal = sampleKeyframes<{ tilt: Tilt; rotation: number }>(
      slotClips
        .filter((c) => clipOwns(c, "tilt"))
        .map((c) => {
          const sp = slotPoseOf(c)
          return {
            startMs: c.startMs,
            durationMs: c.durationMs,
            value: { tilt: sp.tilt, rotation: sp.rotation },
            ease: clipProgressEase(c),
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

    const slotZoom = sampleKeyframes<number>(
      slotClips
        .filter((c) => clipOwns(c, "zoom"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).scale,
          ease: clipProgressEase(c),
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

    const slotPosClips = slotClips.filter((c) => clipOwns(c, "position"))
    if (screenshotPositionDragging) {
      // gesture owns vars
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
            ease: clipProgressEase(c),
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

    const slotShadowLayers = sampleShadowLayers(
      slotClips
        .filter((c) => clipOwns(c, "shadow"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).shadow ?? INVISIBLE_SHADOW,
          ease: clipProgressEase(c),
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

    const slotRestFor = <V>(
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

    const committedBorder = slot.border ?? canvas.border ?? INVISIBLE_BORDER
    const slotBorder = sampleKeyframes<Border>(
      slotClips
        .filter((c) => clipOwns(c, "border"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).border ?? committedBorder,
          ease: clipProgressEase(c),
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

    const committedRadius = slot.borderRadius ?? canvas.borderRadius ?? 0
    const slotRadius = sampleKeyframes<number>(
      slotClips
        .filter((c) => clipOwns(c, "borderRadius"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).borderRadius ?? committedRadius,
          ease: clipProgressEase(c),
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

    const committedPadding = slot.padding ?? canvas.padding ?? 0
    const slotPadding = sampleKeyframes<number>(
      slotClips
        .filter((c) => clipOwns(c, "padding"))
        .map((c) => ({
          startMs: c.startMs,
          durationMs: c.durationMs,
          value: slotPoseOf(c).padding ?? committedPadding,
          ease: clipProgressEase(c),
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

    const slotLightingFrames = slotClips
      .filter((c) => clipOwns(c, "lighting"))
      .map((c) => ({
        startMs: c.startMs,
        durationMs: c.durationMs,
        value: slotPoseOf(c).lighting ?? REST_LIGHTING,
        ease: clipProgressEase(c),
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
      // Slots only have an on-box overlay — never crossfade to canvas-outer.
      // Always apply full on-box strength so an "outer" target on a slot still
      // lights the slot rather than fading to zero via targetMix.
      const inner = lightVal
        ? lightingOverlayValues(lightVal, { inner: true, forceMount: true })
        : null
      setVar(slotEl, `${LIGHTING_IMAGE_VAR}-in`, inner ? inner.image : "none")
      setVar(
        slotEl,
        `${LIGHTING_OPACITY_VAR}-in`,
        inner ? inner.opacity.toFixed(3) : "0"
      )
    } else {
      setVar(slotEl, `${LIGHTING_IMAGE_VAR}-in`, null)
      setVar(slotEl, `${LIGHTING_OPACITY_VAR}-in`, null)
    }
  }
}
