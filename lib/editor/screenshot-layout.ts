import { isBrowserFrame } from "@/lib/browser-frame"
import { DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import type { DeviceFrame } from "@/lib/editor/state-types"

export const SLOT_ROW_MARGIN = 1
export const SLOT_ROW_GAP = 2

const SOLO_HEIGHT_PCT = 70
const MULTI_MAX_HEIGHT_PCT = 92
const BROWSER_FRAME_ASPECT = 16 / 10
const NONE_LANDSCAPE_ASPECT = 16 / 10
const NONE_PORTRAIT_ASPECT = 10 / 14

export function frameNaturalAspect(frame: DeviceFrame): number | null {
  if (frame.id === "none") return null
  if (isBrowserFrame(frame.id)) return BROWSER_FRAME_ASPECT
  const spec = DEVICE_MOCKUP_SPECS[frame.id]
  if (!spec) return null
  const [w, h] = spec.aspectRatio.split("/").map((part) => Number(part.trim()))
  if (!w || !h) return null
  const natural = w / h
  if (frame.orientation === "horizontal" && natural < 1) return 1 / natural
  return natural
}

function noneFallbackAspect(canvasAspect: number) {
  return canvasAspect < 0.85 ? NONE_PORTRAIT_ASPECT : NONE_LANDSCAPE_ASPECT
}

export function slotBoxAspectRatio(
  frame: DeviceFrame,
  canvasAspect: number,
  naturalDims?: { w: number; h: number } | null
): string {
  if (frame.id === "none") {
    if (naturalDims && naturalDims.w > 0 && naturalDims.h > 0) {
      return `${naturalDims.w} / ${naturalDims.h}`
    }
    return canvasAspect < 0.85 ? "10 / 14" : "16 / 10"
  }
  const aspect = frameNaturalAspect(frame) ?? noneFallbackAspect(canvasAspect)
  return String(aspect)
}

export type RowItemInput = { id: string; frame: DeviceFrame }
export type RowItemLayout = { id: string; widthPct: number; xPct: number }

export function computeRowLayout(
  items: RowItemInput[],
  canvasAspect: number
): RowItemLayout[] {
  if (items.length === 0) return []

  const aspects = items.map(
    (item) => frameNaturalAspect(item.frame) ?? noneFallbackAspect(canvasAspect)
  )
  const totalGaps = SLOT_ROW_GAP * (items.length - 1)
  const usableW = 100 - 2 * SLOT_ROW_MARGIN
  const widthBudget = Math.max(0, usableW - totalGaps)
  const aspectSum = aspects.reduce((acc, a) => acc + a, 0)

  // Largest shared row height (in canvas-height %) that fits the row width.
  const maxHByWidth =
    aspectSum > 0 ? (widthBudget * canvasAspect) / aspectSum : Infinity
  const maxHByCap =
    items.length === 1 ? SOLO_HEIGHT_PCT : MULTI_MAX_HEIGHT_PCT
  const targetH = Math.min(maxHByWidth, maxHByCap)

  const widths = aspects.map((aspect) => (targetH * aspect) / canvasAspect)

  const totalW = widths.reduce((acc, w) => acc + w, 0) + totalGaps
  const startX = 50 - totalW / 2
  let cursor = startX
  return items.map((item, i) => {
    const w = widths[i]
    const x = cursor + w / 2
    cursor += w + SLOT_ROW_GAP
    return { id: item.id, widthPct: w, xPct: x }
  })
}
