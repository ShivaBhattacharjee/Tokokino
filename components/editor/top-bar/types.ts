import type { AspectState, CanvasState } from "@/lib/editor/store"
import { useEditorStore } from "@/lib/editor/store"

export type ProtectedTopBarAction = "save" | "share" | "open"

export type ShareMediaKind = "style" | "animate"

export type ShareDialogState = {
  open: boolean
  /**
   * idle — closed/default
   * configure — animate options (format/resolution + storage)
   * preparing — encoding/uploading
   * ready — public URL ready
   * error — failed
   */
  status: "idle" | "configure" | "preparing" | "ready" | "error"
  url: string | null
  signature: string | null
  error: string | null
  mediaKind: ShareMediaKind
  storage: { used: number; limit: number } | null
}

export const SHARE_SKELETON_MIN_MS = 700
export const CHOICE_DIALOG_NAME_LIMIT = 12

export function truncateChoiceDialogName(name: string) {
  if (name.length <= CHOICE_DIALOG_NAME_LIMIT) return name
  return `${name.slice(0, CHOICE_DIALOG_NAME_LIMIT).trimEnd()}...`
}

export function waitForShareSkeleton(startedAt: number) {
  const elapsed = performance.now() - startedAt
  const remaining = Math.max(0, SHARE_SKELETON_MIN_MS - elapsed)
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

export function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

function shareableCanvasSource(
  canvas: CanvasState,
  fallbackAspect: AspectState
) {
  return {
    version: 1,
    aspect: canvas.aspect ?? fallbackAspect,
    screenshot: canvas.screenshot,
    background: canvas.background,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    canvasBorderRadius: canvas.canvasBorderRadius,
    border: canvas.border,
    backdrop: canvas.backdrop,
    tilt: canvas.tilt,
    scale: canvas.scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    screenshotLayer: canvas.screenshotLayer,
    shadow: canvas.shadow,
    overlay: canvas.overlay,
    frame: canvas.frame,
    portrait: canvas.portrait,
    texts: canvas.texts,
    assets: canvas.assets,
    enhance: canvas.enhance,
    annotations: canvas.annotations,
    annotationShapes: canvas.annotationShapes,
    screenshotSlots: canvas.screenshotSlots,
    frameAddress: canvas.frameAddress,
    objectFit: canvas.objectFit,
  }
}

export async function createShareSignature(
  canvasId: string,
  includeWatermark: boolean
) {
  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((item) => item.id === canvasId)
  if (!canvas) return null

  const source = stableStringify({
    canvas: shareableCanvasSource(canvas, state.present.aspect),
    includeWatermark,
  })
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
