"use client"

/**
 * On-canvas Animate-mode playback.
 *
 * Drives the screenshots' live-preview override vars from the animation timeline.
 * Each clip carries a baseline (the canvas state captured when it was added); at
 * a given playhead the active clip interpolates every property from its own
 * baseline → the NEXT clip's baseline, so clips chain continuously (clip 2 starts
 * where clip 1 ended). The last clip animates → the current committed value. Only
 * properties that differ between from → to animate (untouched defaults never
 * move). The same vars the inspector uses for slider/pad live-preview are written
 * here, so the final clip always lands exactly on the committed look.
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
} from "@/components/editor/inspector/backdrop-section-parts/constants"
import {
  activeClipAt,
  backdropEffectsBetween,
  backdropEffectsDiffer,
  backgroundsDiffer,
  clipAffectsMain,
  clipAffectsSlot,
  clipBaseline,
  lerp,
  shadowBetween,
  shadowsDiffer,
} from "@/lib/editor/animation-playback"
import {
  effectsFilterCss,
  shadowCss,
  shadowDropFilterCss,
  SHADOW_FILTER_PREVIEW_VAR,
  SHADOW_PREVIEW_VAR,
} from "@/lib/editor/css-utils"
import { useEditorStore } from "@/lib/editor/store"
import type { ClipBaseline, ScreenshotPosition } from "@/lib/editor/state-types"

function setVar(el: HTMLElement, name: string, value: string | null) {
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, value)
}

const PADDING_PREVIEW_VAR = "--editor-padding-preview"
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

  // Frame-less single screenshots position by stage pixels (not %), so we need a
  // one-time stage measurement per playback; cache it and re-measure only when a
  // layout-affecting field changes.
  const frame = canvas?.frame
  const hasTweet = Boolean(canvas?.tweet)
  const hasDeviceFrame = (frame?.id ?? "none") !== "none"
  const hasMainTarget =
    Boolean(canvas?.screenshot) || hasTweet || hasDeviceFrame
  const isBareMainTarget =
    !hasTweet && hasMainTarget && !hasDeviceFrame && slots.length === 0

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
  // so that transition would smear the motion ~300ms behind the playhead and make
  // it "finish at the end". Suppress it during playback and restore when stopped.
  // Both the framed target and the frame-less bare image (different data-attrs)
  // need covering.
  React.useLayoutEffect(() => {
    if (typeof document === "undefined" || !canvasId || !isPlaying) return
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
  }, [canvasId, isPlaying])

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
      for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
      canvasEl
        .querySelectorAll<HTMLElement>("[data-screenshot-slot-id]")
        .forEach((slotEl) => {
          for (const v of SLOT_VARS) setVar(slotEl, v, null)
        })
    }

    // Only drive motion while playing. At rest we clear every override so the
    // committed inspector pose shows through — which means dragging the box or
    // editing the inspector in animate mode reads naturally, and whatever you
    // leave it at simply becomes this clip's animation target.
    if (!isPlaying) {
      clearAll()
      return
    }

    // ---- main screenshot: tilt, scale, placement ------------------------
    // Each clip animates from its own baseline → the NEXT clip's baseline (or
    // the current committed value for the last clip). This chains clips so the
    // second clip continues from where the first ended instead of snapping back.
    // Only properties that differ between from → to animate.
    const mainClips = clips.filter(clipAffectsMain)
    const mainActive = activeClipAt(mainClips, playheadMs)
    if (mainActive && tilt) {
      const p = mainActive.progress
      const from = clipBaseline(mainActive.clip)
      const current: ClipBaseline = {
        tilt,
        scale,
        screenshotPosition:
          canvas?.screenshotPosition ?? from.screenshotPosition,
        screenshotOffset: canvas?.screenshotOffset ?? from.screenshotOffset,
        padding,
        shadow: shadow ?? from.shadow,
        backdropEffects: backdrop?.effects ?? from.backdropEffects,
        background: background ?? from.background,
        slots: {},
      }
      const to = mainActive.next ? clipBaseline(mainActive.next) : current

      // tilt + scale — from → to (a no-op when unchanged).
      setVar(
        canvasEl,
        "--canvas-ts-rx",
        `${lerp(from.tilt.rx, to.tilt.rx, p)}deg`
      )
      setVar(
        canvasEl,
        "--canvas-ts-ry",
        `${lerp(from.tilt.ry, to.tilt.ry, p)}deg`
      )
      setVar(
        canvasEl,
        "--canvas-ts-rz",
        `${lerp(from.tilt.rz, to.tilt.rz, p)}deg`
      )
      setVar(
        canvasEl,
        "--canvas-ts-scale",
        String(lerp(from.scale / 100, to.scale / 100, p))
      )

      // Placement — from point → to point, only if it changed. Driven through
      // the same preview vars the Position pad uses.
      const placementChanged =
        to.screenshotPosition !== from.screenshotPosition ||
        to.screenshotOffset.x !== from.screenshotOffset.x ||
        to.screenshotOffset.y !== from.screenshotOffset.y
      if (hasMainTarget && frame && placementChanged) {
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
        const fromPt = pointFor(from.screenshotPosition, from.screenshotOffset)
        const toPt = pointFor(to.screenshotPosition, to.screenshotOffset)
        const point = {
          xPct: lerp(fromPt.xPct, toPt.xPct, p),
          yPct: lerp(fromPt.yPct, toPt.yPct, p),
        }
        if (dims != null) {
          const { left, top } = bareScreenshotTargetLeftTop(dims, point)
          setMainScreenshotBarePreviewPx(canvasEl, left, top)
        } else {
          setMainScreenshotPositionPreview(canvasEl, point)
        }
      } else {
        clearPositionPreviewVars(canvasEl)
      }

      // ---- padding (main only) — from → to, only if changed ------------
      if (slots.length === 0 && from.padding !== to.padding) {
        const raw = Math.max(
          0,
          Math.min(240, lerp(from.padding, to.padding, p))
        )
        setVar(mainScopeEl, PADDING_PREVIEW_VAR, `${(raw / 12).toFixed(3)}%`)
      } else {
        setVar(mainScopeEl, PADDING_PREVIEW_VAR, null)
      }

      // ---- shadow — from → to, only if changed -------------------------
      if (shadowsDiffer(from.shadow, to.shadow)) {
        const s = shadowBetween(from.shadow, to.shadow, p)
        setVar(mainScopeEl, SHADOW_PREVIEW_VAR, shadowCss(s) ?? "none")
        setVar(
          mainScopeEl,
          SHADOW_FILTER_PREVIEW_VAR,
          shadowDropFilterCss(s) ?? "none"
        )
      } else {
        setVar(mainScopeEl, SHADOW_PREVIEW_VAR, null)
        setVar(mainScopeEl, SHADOW_FILTER_PREVIEW_VAR, null)
      }

      // ---- background — soft fade in, only if changed ------------------
      if (backgroundsDiffer(from.background, to.background)) {
        setVar(canvasEl, BG_OPACITY_VAR, String(lerp(0, 1, p)))
      } else {
        setVar(canvasEl, BG_OPACITY_VAR, null)
      }

      // ---- backdrop effects — from → to, only if changed ---------------
      if (backdropEffectsDiffer(from.backdropEffects, to.backdropEffects)) {
        const fx = backdropEffectsBetween(
          from.backdropEffects,
          to.backdropEffects,
          p
        )
        setVar(
          canvasEl,
          BACKDROP_FX_PREVIEW_VAR,
          effectsFilterCss(fx) ?? "none"
        )
        setVar(
          canvasEl,
          BACKDROP_NOISE_PREVIEW_VAR,
          String(
            lerp(
              from.backdropEffects.noise / 100,
              to.backdropEffects.noise / 100,
              p
            )
          )
        )
      } else {
        setVar(canvasEl, BACKDROP_FX_PREVIEW_VAR, null)
        setVar(canvasEl, BACKDROP_NOISE_PREVIEW_VAR, null)
      }
    } else {
      // No clip animates the main screenshot — leave its committed pose alone.
      for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
      clearPositionPreviewVars(canvasEl)
      for (const v of CANVAS_FX_VARS) setVar(canvasEl, v, null)
      for (const v of SCOPE_VARS) setVar(mainScopeEl, v, null)
    }

    // ---- extra screenshot slots: tilt, scale, rotation ------------------
    for (const slot of slots) {
      const slotEl = canvasEl.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${slot.id}"]`
      )
      if (!slotEl) continue
      const slotClips = clips.filter((c) => clipAffectsSlot(c, slot.id))
      const slotActive = activeClipAt(slotClips, playheadMs)
      if (!slotActive) {
        for (const v of SLOT_VARS) setVar(slotEl, v, null)
        continue
      }
      const p = slotActive.progress
      const NEUTRAL_SLOT = {
        tilt: { rx: 0, ry: 0, rz: 0 },
        scale: 100,
        rotation: 0,
      }
      const fromSlot =
        clipBaseline(slotActive.clip).slots[slot.id] ?? NEUTRAL_SLOT
      // Chain to the next clip's baseline; the last clip targets the current pose.
      const currentSlot = {
        tilt: slot.tilt,
        scale: slot.scale,
        rotation: slot.rotation,
      }
      const toSlot = slotActive.next
        ? (clipBaseline(slotActive.next).slots[slot.id] ?? currentSlot)
        : currentSlot
      setVar(
        slotEl,
        "--slot-ts-rx",
        `${lerp(fromSlot.tilt.rx, toSlot.tilt.rx, p)}deg`
      )
      setVar(
        slotEl,
        "--slot-ts-ry",
        `${lerp(fromSlot.tilt.ry, toSlot.tilt.ry, p)}deg`
      )
      setVar(
        slotEl,
        "--slot-ts-rz",
        `${lerp(fromSlot.tilt.rz, toSlot.tilt.rz, p)}deg`
      )
      setVar(
        slotEl,
        "--slot-ts-scale",
        String(lerp(fromSlot.scale / 100, toSlot.scale / 100, p))
      )
      setVar(
        slotEl,
        "--slot-ts-rot",
        `${lerp(fromSlot.rotation, toSlot.rotation, p)}deg`
      )
    }

    // Clear everything when playback stops or animate mode exits so the static
    // inspector look (the var fallbacks) shows through untouched.
    return clearAll
  }, [
    canvasId,
    isPlaying,
    playheadMs,
    clips,
    tilt,
    scale,
    slots,
    shadow,
    padding,
    backdrop,
    background,
    frame,
    hasMainTarget,
    isBareMainTarget,
    canvas?.screenshotOffset,
    canvas?.screenshotPosition,
    canvas?.aspect,
    globalAspect,
    measureDims,
  ])

  return null
}
