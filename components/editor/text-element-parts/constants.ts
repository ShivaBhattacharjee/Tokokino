import type { ResizeHandleId } from "./types"

export const DRAG_THRESHOLD = 4
export const CENTER_SNAP_ENTER_PX = 8
export const CENTER_SNAP_EXIT_PX = 14
export const RESIZE_LENS_PAD = 72
export const RESIZE_LENS_SIZE = 118

export const RESIZE_HANDLES: readonly [
  ResizeHandleId,
  string,
  string,
  string,
  string,
][] = [
  ["ml", "top-1/2", "left-0", "-translate-x-1/2 -translate-y-1/2", "ew-resize"],
  ["mr", "top-1/2", "right-0", "translate-x-1/2 -translate-y-1/2", "ew-resize"],
  ["mt", "top-0", "left-1/2", "-translate-x-1/2 -translate-y-1/2", "ns-resize"],
  [
    "mb",
    "bottom-0",
    "left-1/2",
    "-translate-x-1/2 translate-y-1/2",
    "ns-resize",
  ],
  ["tl", "top-0", "left-0", "-translate-x-1/2 -translate-y-1/2", "nwse-resize"],
  ["tr", "top-0", "right-0", "translate-x-1/2 -translate-y-1/2", "nesw-resize"],
  [
    "bl",
    "bottom-0",
    "left-0",
    "-translate-x-1/2 translate-y-1/2",
    "nesw-resize",
  ],
  [
    "br",
    "bottom-0",
    "right-0",
    "translate-x-1/2 translate-y-1/2",
    "nwse-resize",
  ],
]

export function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

export function readCanvasFitScale(
  canvas: HTMLElement | null,
  fallbackScale: number
) {
  if (!canvas) return fallbackScale
  const raw = window
    .getComputedStyle(canvas)
    .getPropertyValue("--canvas-fit-scale")
  const scale = Number.parseFloat(raw)
  return Number.isFinite(scale) && scale > 0 ? scale : fallbackScale
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
