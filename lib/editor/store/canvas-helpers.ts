import { LAYOUT_PRESETS, resolveLayoutPresetGeometry } from "../present-presets"
import { computeRowLayout } from "../screenshot-layout"
import type {
  AnnotationStroke,
  AspectState,
  BackdropLighting,
  Border,
  CanvasState,
  DeviceFrame,
  EditorState,
  ScreenshotSlot,
  Shadow,
} from "../state-types"

export type PresetTab = "single" | "multi" | "triple" | "custom"

export const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const CANVAS_BASE_W = 1100
export const CANVAS_GAP = 80
// Preset mainOffset Y values were tuned at the default 16:10 canvas height.
// Using this constant keeps the pixel offset consistent across all aspect ratios.
export const PRESET_DESIGN_HEIGHT = CANVAS_BASE_W * (10 / 16)

export const SLOT_DEFAULT_HEIGHT_PCT = 28
export const SLOT_DEFAULT_FALLBACK_WIDTH = 60

export const clampPct = (value: number) => Math.max(-20, Math.min(120, value))

export const canvasHeightFromAspectRatio = (canvasAspect: number) =>
  CANVAS_BASE_W / canvasAspect

export const aspectRatioFromState = (aspect: AspectState): number => {
  const w = aspect.w || 16
  const h = aspect.h || 10
  return w / h
}

export const stateCanvasAspect = (state: EditorState): number =>
  aspectRatioFromState(state.aspect)

export const scaleScreenshotOffsetForAspectChange = (
  offset: { x: number; y: number },
  currentAspect: number,
  nextAspect: number
) => {
  const currentHeight = canvasHeightFromAspectRatio(currentAspect)
  const nextHeight = canvasHeightFromAspectRatio(nextAspect)
  if (!currentHeight || !nextHeight) return offset
  return {
    x: offset.x,
    y: offset.y * (nextHeight / currentHeight),
  }
}

export const scaleAnnotationStrokesForAspectChange = (
  annotations: AnnotationStroke[],
  currentAspect: number,
  nextAspect: number
): AnnotationStroke[] => {
  const currentHeight = canvasHeightFromAspectRatio(currentAspect)
  const nextHeight = canvasHeightFromAspectRatio(nextAspect)
  if (!currentHeight || !nextHeight) return annotations

  const scaleY = nextHeight / currentHeight
  if (!Number.isFinite(scaleY) || Math.abs(scaleY - 1) < 0.0001) {
    return annotations
  }

  return annotations.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      x: point.x,
      y: point.y * scaleY,
    })),
  }))
}

export const layoutSlotsInRow = (
  slots: ScreenshotSlot[],
  canvasFrame: DeviceFrame,
  canvasAspect: number,
  options: { preservePositions?: boolean } = {}
): ScreenshotSlot[] => {
  const n = slots.length
  if (n === 0) return slots
  const layout = computeRowLayout(
    [
      { id: "__main__", frame: canvasFrame },
      ...slots.map((slot) => ({ id: slot.id, frame: canvasFrame })),
    ],
    canvasAspect
  )
  const slotLayoutById = new Map(
    layout.slice(1).map((entry) => [entry.id, entry])
  )
  return slots.map((slot) => {
    const entry = slotLayoutById.get(slot.id)
    if (!entry) return slot
    if (options.preservePositions) {
      return {
        ...slot,
        widthPct: entry.widthPct,
        heightPct: SLOT_DEFAULT_HEIGHT_PCT,
      }
    }
    return {
      ...slot,
      xPct: entry.xPct,
      yPct: 50,
      widthPct: entry.widthPct,
      heightPct: SLOT_DEFAULT_HEIGHT_PCT,
      rotation: 0,
    }
  })
}

/**
 * Append `newSlot` to `existingSlots`, then re-run the row layout for the full
 * set. The main screenshot and every slot share one row, so adding a slot has
 * to move the existing boxes too; otherwise older slots keep stale centers and
 * overlap the newly inserted slot.
 */
export const placeNewSlotInRow = (
  existingSlots: ScreenshotSlot[],
  newSlot: ScreenshotSlot,
  frame: DeviceFrame,
  aspect: number
): ScreenshotSlot[] => {
  return layoutSlotsInRow([...existingSlots, newSlot], frame, aspect)
}

/**
 * Remove a slot and reflow the remaining boxes through the same row math used
 * by preset previews. Keeping the old centers while widening the boxes makes
 * the live canvas diverge from the preset card after deletes.
 */
export const removeSlotFromRow = (
  slots: ScreenshotSlot[],
  slotId: string,
  frame: DeviceFrame,
  aspect: number
): ScreenshotSlot[] => {
  return layoutSlotsInRow(
    slots.filter((slot) => slot.id !== slotId),
    frame,
    aspect
  )
}

export function resolveActiveLayoutGeometry(
  state: { presetTab: PresetTab; activeLayoutPresetId: string | null },
  frame: DeviceFrame
) {
  if (state.presetTab !== "multi" && state.presetTab !== "triple") return null
  const preset = LAYOUT_PRESETS.find((p) => p.id === state.activeLayoutPresetId)
  return preset ? resolveLayoutPresetGeometry(preset, frame) : null
}

export function applyLayoutPresetGeometryToCanvas(
  canvas: CanvasState,
  state: EditorState,
  frame: DeviceFrame,
  activeLayoutPresetId: string | null
): Partial<CanvasState> | null {
  if (!activeLayoutPresetId) return null
  const preset = LAYOUT_PRESETS.find((p) => p.id === activeLayoutPresetId)
  if (!preset) return null
  if (canvas.screenshotSlots.length === 0) return null
  const geometry = resolveLayoutPresetGeometry(preset, frame)
  if (canvas.screenshotSlots.length !== geometry.slots.length) return null

  const aspect = stateCanvasAspect(state)
  const naturalLayout = computeRowLayout(
    [
      { id: "__main__", frame },
      ...canvas.screenshotSlots.map((slot) => ({ id: slot.id, frame })),
    ],
    aspect
  )

  const screenshotSlots = canvas.screenshotSlots.map((slot, i) => {
    const config = geometry.slots[i]
    const entry = naturalLayout[i + 1]
    if (!config || !entry) return slot
    const naturalSlotX = entry.xPct
    const xPct = geometry.relativeSlotPositions
      ? naturalSlotX + config.xPct
      : config.xPct
    const yPct = geometry.relativeSlotPositions ? 50 + config.yPct : config.yPct
    return {
      ...slot,
      xPct,
      yPct,
      rotation: config.rotation,
      tilt: { ...config.tilt },
      scale: config.scale,
      widthPct: entry.widthPct,
      heightPct: SLOT_DEFAULT_HEIGHT_PCT,
      ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
    }
  })

  const patch: Partial<CanvasState> = {
    screenshotSlots,
    tilt: { ...geometry.canvasTilt },
    scale: geometry.canvasScale,
  }
  if (geometry.mainOffset) {
    patch.screenshotOffset = {
      x: (geometry.mainOffset.xPct / 100) * CANVAS_BASE_W,
      y: (geometry.mainOffset.yPct / 100) * PRESET_DESIGN_HEIGHT,
    }
  }
  return patch
}

export function applySharedFrameToCanvas(
  canvas: CanvasState,
  state: EditorState,
  frame: DeviceFrame,
  activeLayoutPresetId: string | null,
  options: { preservePositions?: boolean } = { preservePositions: true }
): Partial<CanvasState> {
  const sharedFrame = { ...frame }
  const presetPatch = applyLayoutPresetGeometryToCanvas(
    canvas,
    state,
    sharedFrame,
    activeLayoutPresetId
  )
  if (presetPatch) {
    return { frame: sharedFrame, ...presetPatch }
  }
  return {
    frame: sharedFrame,
    screenshotSlots: layoutSlotsInRow(
      canvas.screenshotSlots,
      sharedFrame,
      stateCanvasAspect(state),
      options
    ),
  }
}

export const createScreenshotSlot = (
  base: Partial<ScreenshotSlot>,
  zIndex: number
): ScreenshotSlot => ({
  id: makeId(),
  src: null,
  originalSrc: null,
  lastCropRegion: null,
  xPct: 50,
  yPct: 50,
  widthPct: SLOT_DEFAULT_FALLBACK_WIDTH,
  heightPct: SLOT_DEFAULT_HEIGHT_PCT,
  rotation: 0,
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  zIndex,
  filter: "none",
  objectFit: "contain",
  ...base,
})

/**
 * Apply `patch` to every slot — used by canvas-level setters that mirror their
 * change down to every screenshot slot (padding, borderRadius, border, shadow,
 * lighting). Pass a function form when each slot needs a fresh clone of a
 * shared value.
 */
export const mirrorToSlots = (
  slots: ScreenshotSlot[],
  patch:
    | Partial<ScreenshotSlot>
    | ((slot: ScreenshotSlot) => Partial<ScreenshotSlot>)
): ScreenshotSlot[] =>
  slots.map((slot) => ({
    ...slot,
    ...(typeof patch === "function" ? patch(slot) : patch),
  }))

export const cloneBorder = (border: Border): Border => ({ ...border })

export const cloneShadow = (shadow: Shadow): Shadow => ({ ...shadow })

export const cloneLighting = (
  lighting: BackdropLighting
): BackdropLighting => ({
  ...lighting,
})

export function applySlotStyleDefaults(
  slot: ScreenshotSlot,
  canvas: CanvasState
) {
  return {
    ...slot,
    border: slot.border ?? cloneBorder(canvas.border),
    borderRadius: slot.borderRadius ?? canvas.borderRadius,
    padding: slot.padding ?? canvas.padding,
    shadow: slot.shadow ?? cloneShadow(canvas.shadow),
    lighting: slot.lighting ?? cloneLighting(canvas.backdrop.lighting),
  }
}

export function migrateLegacySlot(raw: unknown): ScreenshotSlot {
  const slot = (raw ?? {}) as Partial<ScreenshotSlot> & {
    tilt?: Partial<{ rx: number; ry: number; rz: number }>
  }
  const base: Partial<ScreenshotSlot> = {}
  if (typeof slot.id === "string") base.id = slot.id
  if (slot.src === null || typeof slot.src === "string") base.src = slot.src
  if (slot.originalSrc === null || typeof slot.originalSrc === "string") {
    base.originalSrc = slot.originalSrc
  }
  if (slot.lastCropRegion) base.lastCropRegion = slot.lastCropRegion
  if (typeof slot.xPct === "number") base.xPct = slot.xPct
  if (typeof slot.yPct === "number") base.yPct = slot.yPct
  if (typeof slot.widthPct === "number") base.widthPct = slot.widthPct
  if (typeof slot.heightPct === "number") base.heightPct = slot.heightPct
  if (typeof slot.rotation === "number") base.rotation = slot.rotation
  if (slot.tilt) {
    base.tilt = {
      rx: slot.tilt.rx ?? 0,
      ry: slot.tilt.ry ?? 0,
      rz: slot.tilt.rz ?? 0,
    }
  }
  if (typeof slot.scale === "number") base.scale = slot.scale
  if (typeof slot.zIndex === "number") base.zIndex = slot.zIndex
  if (typeof slot.filter === "string") base.filter = slot.filter
  if (typeof slot.hidden === "boolean") base.hidden = slot.hidden
  if (slot.objectFit) base.objectFit = slot.objectFit
  if (slot.border) base.border = cloneBorder(slot.border)
  if (typeof slot.borderRadius === "number") {
    base.borderRadius = slot.borderRadius
  }
  if (typeof slot.padding === "number") base.padding = slot.padding
  if (slot.shadow) base.shadow = cloneShadow(slot.shadow)
  if (slot.lighting) base.lighting = cloneLighting(slot.lighting)
  return createScreenshotSlot(base, slot.zIndex ?? 1)
}

export type DuplicableLayerItem = {
  id: string
  xPct: number
  yPct: number
  zIndex: number
}

export const duplicateLayerItem = <T extends DuplicableLayerItem>(
  items: T[],
  id: string,
  copyId: string,
  nextZ: number,
  options: { offset?: number; maxPct?: number } = {}
): { items: T[]; ok: boolean } => {
  const offset = options.offset ?? 4
  const maxPct = options.maxPct ?? 95
  const src = items.find((item) => item.id === id)
  if (!src) return { items, ok: false }
  const copy = {
    ...src,
    id: copyId,
    xPct: Math.min(maxPct, src.xPct + offset),
    yPct: Math.min(maxPct, src.yPct + offset),
    zIndex: nextZ,
  }
  return { items: [...items, copy], ok: true }
}

/**
 * Place a new canvas adjacent to an existing canvas without overlap.
 * - With an explicit `sourceId`: place to the right of that canvas, then if
 *   that spot collides with any other canvas, fall back to the rightmost free
 *   slot in the grid.
 * - Without a source: place to the right of the visually-rightmost canvas.
 */
export const placementAfterCanvas = (
  state: EditorState,
  sourceId?: string
): { x: number; y: number } => {
  if (state.canvases.length === 0) return { x: 0, y: 0 }

  const aw = state.aspect.w || 16
  const ah = state.aspect.h || 10
  const canvasW = CANVAS_BASE_W
  const canvasH = (CANVAS_BASE_W * ah) / aw
  const strideX = canvasW + CANVAS_GAP
  const strideY = canvasH + CANVAS_GAP

  const collidesWithExisting = (pos: { x: number; y: number }) =>
    state.canvases.some(
      (c) =>
        Math.abs(c.position.x - pos.x) < 1 && Math.abs(c.position.y - pos.y) < 1
    )

  // Anchor: the source canvas (when duplicating) or the rightmost canvas.
  const src = sourceId
    ? state.canvases.find((c) => c.id === sourceId)
    : state.canvases.reduce(
        (best, c) => (c.position.x > best.position.x ? c : best),
        state.canvases[0]
      )

  if (!src) {
    const rightmost = state.canvases.reduce(
      (max, c) => (c.position.x > max.position.x ? c : max),
      state.canvases[0]
    )
    return { x: rightmost.position.x + strideX, y: rightmost.position.y }
  }

  // First choice: directly to the right of the source.
  let candidate = { x: src.position.x + strideX, y: src.position.y }
  if (!collidesWithExisting(candidate)) return candidate

  // Otherwise, find the rightmost canvas overall and place after it.
  const rightmost = state.canvases.reduce(
    (max, c) => (c.position.x > max.position.x ? c : max),
    state.canvases[0]
  )
  candidate = { x: rightmost.position.x + strideX, y: rightmost.position.y }
  if (!collidesWithExisting(candidate)) return candidate

  // As a final fallback, drop one row below the source.
  return { x: src.position.x, y: src.position.y + strideY }
}
