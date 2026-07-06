"use client"

/**
 * On-canvas Animate-mode playback.
 *
 * Drives the screenshots' live-preview override vars from the animation timeline:
 * every targeted screenshot animates from a neutral rest pose (progress 0) to its
 * current inspector pose (progress 1) over its clip window. The same vars the
 * inspector uses for slider/pad live-preview are written here, so the animated
 * result always lands exactly on the inspector look at rest.
 *
 * Neutral rest pose:
 *  - tilt 0, scale 1
 *  - placement centered (the Position pad's centre dot, 50/50)
 *
 * Vars are cleared on unmount (leaving animate mode) and for any screenshot with
 * no clips, so the static inspector values show through untouched.
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
  clipAffectsMain,
  clipAffectsSlot,
  clipsProgressAt,
  lerp,
} from "@/lib/editor/animation-playback"
import { useEditorStore } from "@/lib/editor/store"

function setVar(el: HTMLElement, name: string, value: string | null) {
  if (value === null) el.style.removeProperty(name)
  else el.style.setProperty(name, value)
}

// The neutral placement the animation starts from: the Position pad's centre.
const CENTER = { xPct: 50, yPct: 50 }

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

    const clearAll = () => {
      for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
      clearPositionPreviewVars(canvasEl)
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
    const mainClips = clips.filter(clipAffectsMain)
    if (mainClips.length > 0 && tilt) {
      const p = clipsProgressAt(mainClips, playheadMs)
      setVar(canvasEl, "--canvas-ts-rx", `${lerp(0, tilt.rx, p)}deg`)
      setVar(canvasEl, "--canvas-ts-ry", `${lerp(0, tilt.ry, p)}deg`)
      setVar(canvasEl, "--canvas-ts-rz", `${lerp(0, tilt.rz, p)}deg`)
      setVar(canvasEl, "--canvas-ts-scale", String(lerp(1, scale / 100, p)))

      // Placement: interpolate the target centre point from the centre dot, then
      // drive it through the same preview vars the Position pad uses. Only when
      // the placement is actually off-centre — otherwise leave placement alone so
      // a tilt/scale-only clip doesn't pick up a spurious drift from the
      // centre-point rounding.
      const offset = canvas?.screenshotOffset ?? { x: 0, y: 0 }
      const position = canvas?.screenshotPosition ?? "center"
      const placementIsNeutral =
        position === "center" && offset.x === 0 && offset.y === 0
      if (hasMainTarget && frame && !placementIsNeutral) {
        const dims = isBareMainTarget ? measureDims(canvasEl) : null
        const aspect = canvas?.aspect ?? globalAspect
        const target =
          dims != null
            ? bareScreenshotPositionPct({
                dims,
                scaleFactor: scale / 100,
                position,
                offset,
              })
            : mainScreenshotPositionPct({
                aspect,
                frame,
                position,
                offset,
                slots,
              })
        const point = {
          xPct: lerp(CENTER.xPct, target.xPct, p),
          yPct: lerp(CENTER.yPct, target.yPct, p),
        }
        if (dims != null) {
          const { left, top } = bareScreenshotTargetLeftTop(dims, point)
          setMainScreenshotBarePreviewPx(canvasEl, left, top)
        } else {
          setMainScreenshotPositionPreview(canvasEl, point)
        }
      } else {
        // Placement is neutral (or no main target) — don't touch placement vars.
        clearPositionPreviewVars(canvasEl)
      }
    } else {
      for (const v of TILT_SCALE_VARS) setVar(canvasEl, v, null)
      clearPositionPreviewVars(canvasEl)
    }

    // ---- extra screenshot slots: tilt, scale, rotation ------------------
    for (const slot of slots) {
      const slotEl = canvasEl.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${slot.id}"]`
      )
      if (!slotEl) continue
      const slotClips = clips.filter((c) => clipAffectsSlot(c, slot.id))
      if (slotClips.length === 0) {
        for (const v of SLOT_VARS) setVar(slotEl, v, null)
        continue
      }
      const p = clipsProgressAt(slotClips, playheadMs)
      setVar(slotEl, "--slot-ts-rx", `${lerp(0, slot.tilt.rx, p)}deg`)
      setVar(slotEl, "--slot-ts-ry", `${lerp(0, slot.tilt.ry, p)}deg`)
      setVar(slotEl, "--slot-ts-rz", `${lerp(0, slot.tilt.rz, p)}deg`)
      setVar(slotEl, "--slot-ts-scale", String(lerp(1, slot.scale / 100, p)))
      setVar(slotEl, "--slot-ts-rot", `${lerp(0, slot.rotation, p)}deg`)
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
