import type * as React from "react"

import type { TextElement } from "@/lib/editor/state-types"

export type TextElementViewProps = {
  text: TextElement
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
  previewMode?: boolean
}

export type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
  moved: boolean
  snapXActive: boolean
  snapYActive: boolean
  /** Last previewed position. The drag publishes CSS vars rather than writing
   * the element's inline style, so the commit reads the value from here
   * instead of parsing it back off the element. */
  lastXPct: number
  lastYPct: number
}

export type RotateState = {
  pointerId: number
  centerX: number
  centerY: number
  startAngle: number
  startRotation: number
}

export type ResizeHandleId =
  | "ml"
  | "mr"
  | "mt"
  | "mb"
  | "tl"
  | "tr"
  | "bl"
  | "br"

export type ResizeState = {
  pointerId: number
  handle: ResizeHandleId
  startClientX: number
  startClientY: number
  startXPct: number
  startYPct: number
  startWidthPx: number
  startHeightPx: number
  startFontSize: number
  storeWidthPx: number | null
  storeHeightPx: number | null
  canvasW: number
  canvasH: number
  elW: number
  elH: number
  lastPatch: Partial<TextElement> | null
}

export type ResizeLensState = {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

export type PinchState = {
  pointer1Id: number
  pointer2Id: number
  startDistance: number
  startFontSize: number
}
