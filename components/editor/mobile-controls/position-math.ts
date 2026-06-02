import { screenshotPlacementStyle } from "@/components/editor/canvas/helpers"
import { computeRowLayout } from "@/lib/editor/screenshot-layout"
import {
  SCREENSHOT_POSITIONS,
  screenshotPositionAnchor,
} from "@/lib/editor/store"
import type {
  AspectState,
  DeviceFrame,
  ScreenshotPosition,
} from "@/lib/editor/store"
import type { ScreenshotSlot } from "@/lib/editor/state-types"

export type PercentPoint = { xPct: number; yPct: number }
type PercentBox = PercentPoint & { widthPct: number; heightPct: number }

/**
 * Real (DOM-measured) geometry of the main screenshot stage and image, in the
 * same CSS-pixel space the canvas renderer and pointer-drag use for
 * `screenshotOffset`. This is intentionally NOT the base-canvas coordinate
 * space — the stored offset is rendered as raw stage pixels, so the move panel
 * must compute it from the actual on-screen size.
 */
export type StagePlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

const BASE_CANVAS_WIDTH = 1100

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function placementLeftTop(
  dims: StagePlacementDims,
  scaleFactor: number,
  position: ScreenshotPosition
) {
  const anchor = screenshotPositionAnchor(position)
  const placement = screenshotPlacementStyle(
    dims,
    scaleFactor,
    anchor.x / 100,
    anchor.y / 100
  )
  return {
    left: typeof placement.left === "number" ? placement.left : 0,
    top: typeof placement.top === "number" ? placement.top : 0,
  }
}

/**
 * The frame-less main screenshot box's top-left position (stage px) that places
 * its center at `point` (percent of the stage). Because the image renders
 * without a centering `translate(-50%, -50%)` once `placementDims` exists, the
 * commit, the live preview, and the handle read must all use this exact value.
 */
export function bareScreenshotTargetLeftTop(
  dims: StagePlacementDims,
  point: PercentPoint
) {
  return {
    left: (clampPercent(point.xPct) / 100) * dims.stageW - dims.imgW / 2,
    top: (clampPercent(point.yPct) / 100) * dims.stageH - dims.imgH / 2,
  }
}

/**
 * Convert a target center point (percent of the stage) into the
 * `{ position, offset }` pair the store expects for a frame-less main
 * screenshot. Mirrors `screenshotPlacementStyle` so the committed result lands
 * exactly where the preview showed it.
 */
export function resolveBareScreenshotPlacement({
  dims,
  scaleFactor,
  point,
}: {
  dims: StagePlacementDims
  scaleFactor: number
  point: PercentPoint
}): { position: ScreenshotPosition; offset: { x: number; y: number } } {
  const target = bareScreenshotTargetLeftTop(dims, point)

  let best: {
    position: ScreenshotPosition
    left: number
    top: number
    distance: number
  } | null = null

  for (const pos of SCREENSHOT_POSITIONS) {
    const { left, top } = placementLeftTop(dims, scaleFactor, pos.id)
    const dx = target.left - left
    const dy = target.top - top
    const distance = dx * dx + dy * dy
    if (!best || distance < best.distance) {
      best = { position: pos.id, left, top, distance }
    }
  }

  if (!best) return { position: "center", offset: { x: 0, y: 0 } }
  return {
    position: best.position,
    offset: { x: target.left - best.left, y: target.top - best.top },
  }
}

/**
 * Inverse of {@link resolveBareScreenshotPlacement}: where the current
 * `{ position, offset }` puts the frame-less main screenshot's center, as a
 * percent of the stage, so the swipe field's handle starts in the right spot.
 */
export function bareScreenshotPositionPct({
  dims,
  scaleFactor,
  position,
  offset,
}: {
  dims: StagePlacementDims
  scaleFactor: number
  position: ScreenshotPosition
  offset: { x: number; y: number }
}): PercentPoint {
  const { left, top } = placementLeftTop(dims, scaleFactor, position)
  return {
    xPct: clampPercent(((left + offset.x + dims.imgW / 2) / dims.stageW) * 100),
    yPct: clampPercent(((top + offset.y + dims.imgH / 2) / dims.stageH) * 100),
  }
}

export function positionIdFromPercent(
  xPct: number,
  yPct: number
): ScreenshotPosition {
  const col = Math.round(Math.max(0, Math.min(4, xPct / 25)))
  const row = Math.round(Math.max(0, Math.min(4, yPct / 25)))
  if (col === 2 && row === 2) return "center"
  return `${row}-${col}` as ScreenshotPosition
}

function canvasDimsFromAspect(aspect: AspectState) {
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  return {
    width: BASE_CANVAS_WIDTH,
    height: (BASE_CANVAS_WIDTH * ah) / aw,
    ratio: aw / ah,
  }
}

export function mainScreenshotPositionPct({
  aspect,
  frame,
  position,
  offset,
  slots,
}: {
  aspect: AspectState
  frame: DeviceFrame
  position: ScreenshotPosition
  offset: { x: number; y: number }
  slots: ScreenshotSlot[]
}): PercentPoint {
  const dims = canvasDimsFromAspect(aspect)

  if (slots.length > 0) {
    const rowLayout = computeRowLayout(
      [
        { id: "__main__", frame },
        ...slots.map((slot) => ({ id: slot.id, frame })),
      ],
      dims.ratio
    )
    const mainLayout = rowLayout[0]
    if (mainLayout) {
      const anchor = screenshotPositionAnchor(position)
      const baseX = position === "center" ? mainLayout.xPct : anchor.x
      const baseY = position === "center" ? 50 : anchor.y
      return {
        xPct: baseX + (offset.x / dims.width) * 100,
        yPct: baseY + (offset.y / dims.height) * 100,
      }
    }
  }

  const anchor = screenshotPositionAnchor(position)
  return {
    xPct: anchor.x + (offset.x / dims.width) * 100,
    yPct: anchor.y + (offset.y / dims.height) * 100,
  }
}

export function mainScreenshotOffsetForPoint({
  aspect,
  frame,
  position,
  slots,
  point,
}: {
  aspect: AspectState
  frame: DeviceFrame
  position: ScreenshotPosition
  slots: ScreenshotSlot[]
  point: PercentPoint
}) {
  const dims = canvasDimsFromAspect(aspect)
  const anchor = screenshotPositionAnchor(position)
  let baseX = anchor.x
  let baseY = anchor.y

  if (slots.length > 0 && position === "center") {
    const rowLayout = computeRowLayout(
      [
        { id: "__main__", frame },
        ...slots.map((slot) => ({ id: slot.id, frame })),
      ],
      dims.ratio
    )
    const mainLayout = rowLayout[0]
    if (mainLayout) {
      baseX = mainLayout.xPct
      baseY = 50
    }
  }

  return {
    x: ((point.xPct - baseX) / 100) * dims.width,
    y: ((point.yPct - baseY) / 100) * dims.height,
  }
}

export function screenshotSlotGroupCenter(slots: ScreenshotSlot[]) {
  if (slots.length === 0) return null
  const boxes: PercentBox[] = slots.map((slot) => ({
    xPct: slot.xPct,
    yPct: slot.yPct,
    widthPct: slot.widthPct,
    heightPct: slot.heightPct,
  }))
  const bounds = boxes.reduce(
    (acc, box) => ({
      minX: Math.min(acc.minX, box.xPct - box.widthPct / 2),
      maxX: Math.max(acc.maxX, box.xPct + box.widthPct / 2),
      minY: Math.min(acc.minY, box.yPct - box.heightPct / 2),
      maxY: Math.max(acc.maxY, box.yPct + box.heightPct / 2),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )
  return {
    xPct: clampPercent((bounds.minX + bounds.maxX) / 2),
    yPct: clampPercent((bounds.minY + bounds.maxY) / 2),
  }
}
