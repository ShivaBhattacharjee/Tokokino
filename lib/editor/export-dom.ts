import {
  EXPORT_RESOLUTION_WIDTHS,
  type ExportResolution,
} from "./export-constants"

export function findCanvasElement(canvasId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-canvas-id="${canvasId}"]`)
}

/**
 * Return the CSS layout dimensions of the canvas element, ignoring any
 * ancestor transforms (viewport zoom/scale). We use offsetWidth/offsetHeight
 * which give the border-box size in CSS pixels before transforms are applied.
 * This is important because container-query units (cqw / cqh) used by device
 * mockup frames resolve against CSS dimensions, not transformed/visual ones.
 */
export function getCanvasLayoutDims(node: HTMLElement): {
  width: number
  height: number
} | null {
  const width = node.offsetWidth
  const height = node.offsetHeight
  if (!width || !height) return null
  return { width, height }
}

export function getCanvasRenderedDims(canvasId: string): {
  width: number
  height: number
} | null {
  const node = findCanvasElement(canvasId)
  if (!node) return null
  return getCanvasLayoutDims(node)
}

export function getOutputDims(
  canvasId: string,
  resolution: ExportResolution
): { width: number; height: number } | null {
  const dims = getCanvasRenderedDims(canvasId)
  if (!dims) return null
  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const ratio = targetWidth / dims.width
  return {
    width: Math.round(targetWidth),
    height: Math.round(dims.height * ratio),
  }
}

export function getNodeBorderRadius(node: HTMLElement): number {
  return parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
}

export function filterExportHidden(node: Node) {
  if (node instanceof Element) {
    if (node.getAttribute("data-export-hidden") === "true") return false
  }
  return true
}

/** Layout dimensions for HTML or SVG roots used by export sub-rasterization. */
export function exportElementLayoutSize(
  node: Element
): { width: number; height: number } | null {
  const htmlNode = node as HTMLElement
  const width = htmlNode.offsetWidth || Number(node.getAttribute("width"))
  const height = htmlNode.offsetHeight || Number(node.getAttribute("height"))
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** Rotation of an element's computed transform, in radians. */
export function elementRotation(el: HTMLElement): number {
  const transform = window.getComputedStyle(el).transform
  const values = /matrix(?:3d)?\(([^)]+)\)/.exec(transform)?.[1]
  if (!values) return 0
  const parts = values.split(",").map(Number)
  if (parts.length !== 6 && parts.length !== 16) return 0
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return 0
  return Math.atan2(parts[1], parts[0])
}
