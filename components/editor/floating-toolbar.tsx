"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiFocus3Line,
  RiFullscreenLine,
  RiGalleryLine,
  RiGroupLine,
  RiImageAddLine,
  RiLayoutColumnLine,
  RiLayoutGridLine,
  RiLayoutRowLine,
  RiResetLeftLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { AnnotationToolbar } from "@/components/editor/annotation-toolbar"
import { LayersPanelContent } from "@/components/editor/layers-popover"
import {
  ToolbarButton,
  ToolbarPopover,
} from "@/components/editor/toolbar/primitives"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type EditorTool,
  type EnhancePreset,
  MAX_CANVASES,
  MAX_SCREENSHOT_SLOTS,
  SCREENSHOT_POSITIONS,
  type ScreenshotPosition,
  screenshotPositionAnchor as screenshotPositionAnchorFn,
  useActiveCanvasField,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { computeRowLayout } from "@/lib/editor/screenshot-layout"
import type {
  AspectState,
  DeviceFrame,
  ScreenshotSlot,
} from "@/lib/editor/state-types"
import { editorValueSchemas } from "@/lib/editor/value-schemas"
import { cn } from "@/lib/utils"

const ENHANCE_PRESETS: {
  id: EnhancePreset
  label: string
  swatch: string
  filter?: string
}[] = [
  { id: "off", label: "Off", swatch: "linear-gradient(135deg,#888,#555)" },
  {
    id: "auto",
    label: "Auto",
    swatch: "linear-gradient(135deg,#7dd3fc,#a78bfa)",
    filter: "brightness(1.04) contrast(1.08) saturate(1.1)",
  },
  {
    id: "vivid",
    label: "Vivid",
    swatch: "linear-gradient(135deg,#f43f5e,#f59e0b)",
    filter: "saturate(1.35) contrast(1.12)",
  },
  {
    id: "soft",
    label: "Soft",
    swatch: "linear-gradient(135deg,#fde2e4,#cdb4db)",
    filter: "brightness(1.06) saturate(0.9)",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    swatch: "linear-gradient(135deg,#1f2937,#6b7280)",
    filter: "contrast(1.25) saturate(1.2)",
  },
  {
    id: "sharp",
    label: "Sharp",
    swatch: "linear-gradient(135deg,#10b981,#0ea5e9)",
    filter: "contrast(1.18)",
  },
]

type BulkLayout = "grid" | "row" | "column"

const BASE_CANVAS_WIDTH = 1100
const ARRANGE_GAP = 80
const SCREENSHOT_OFFSET_GRID_SPREAD_PX = 300
const POSITION_GRID_OUT_OF_BOUNDS_PCT = 25
const SCREENSHOT_GROUP_BOX_HEIGHT_PCT = 28

type PercentPoint = { xPct: number; yPct: number }
type PercentBox = PercentPoint & { widthPct: number; heightPct: number }

function positionIdFromPercent(xPct: number, yPct: number): ScreenshotPosition {
  const col = Math.round(Math.max(0, Math.min(4, xPct / 25)))
  const row = Math.round(Math.max(0, Math.min(4, yPct / 25)))
  if (col === 2 && row === 2) return "center"
  return `${row}-${col}` as ScreenshotPosition
}

function screenshotPositionFromOffset(
  position: ScreenshotPosition,
  offset: { x: number; y: number }
): ScreenshotPosition {
  const anchor = screenshotPositionAnchorFn(position)
  const xPct = anchor.x + (offset.x / SCREENSHOT_OFFSET_GRID_SPREAD_PX) * 50
  const yPct = anchor.y + (offset.y / SCREENSHOT_OFFSET_GRID_SPREAD_PX) * 50
  const min = -POSITION_GRID_OUT_OF_BOUNDS_PCT
  const max = 100 + POSITION_GRID_OUT_OF_BOUNDS_PCT

  if (xPct < min || xPct > max || yPct < min || yPct > max) return "center"
  return positionIdFromPercent(xPct, yPct)
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

function mainScreenshotRowPositionPct({
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
}) {
  if (slots.length === 0) return null
  const dims = canvasDimsFromAspect(aspect)
  const rowLayout = computeRowLayout(
    [
      { id: "__main__", frame },
      ...slots.map((slot) => ({ id: slot.id, frame })),
    ],
    dims.ratio
  )
  const mainLayout = rowLayout[0]
  if (!mainLayout) return null

  const anchor = screenshotPositionAnchorFn(position)
  const baseX = position === "center" ? mainLayout.xPct : anchor.x
  const baseY = position === "center" ? 50 : anchor.y
  return {
    xPct: baseX + (offset.x / dims.width) * 100,
    yPct: baseY + (offset.y / dims.height) * 100,
  }
}

function mainScreenshotPositionPct({
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
  const rowPosition = mainScreenshotRowPositionPct({
    aspect,
    frame,
    position,
    offset,
    slots,
  })
  if (rowPosition) return rowPosition

  const dims = canvasDimsFromAspect(aspect)
  const anchor = screenshotPositionAnchorFn(position)
  return {
    xPct: anchor.x + (offset.x / dims.width) * 100,
    yPct: anchor.y + (offset.y / dims.height) * 100,
  }
}

function mainScreenshotOffsetForPoint({
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
  const anchor = screenshotPositionAnchorFn(position)
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

function mainScreenshotOffsetForAnchor({
  aspect,
  frame,
  position,
  slots,
}: {
  aspect: AspectState
  frame: DeviceFrame
  position: ScreenshotPosition
  slots: ScreenshotSlot[]
}) {
  const anchor = screenshotPositionAnchorFn(position)
  return mainScreenshotOffsetForPoint({
    aspect,
    frame,
    position,
    slots,
    point: { xPct: anchor.x, yPct: anchor.y },
  })
}

function centerOfBoxes(boxes: PercentBox[]): PercentPoint | null {
  if (boxes.length === 0) return null
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
    xPct: (bounds.minX + bounds.maxX) / 2,
    yPct: (bounds.minY + bounds.maxY) / 2,
  }
}

function screenshotSlotGroupCenter(slots: ScreenshotSlot[]) {
  return centerOfBoxes(
    slots.map((slot) => ({
      xPct: slot.xPct,
      yPct: slot.yPct,
      widthPct: slot.widthPct,
      heightPct: slot.heightPct,
    }))
  )
}

function allScreenshotGroupCenter({
  hasMainScreenshot,
  aspect,
  frame,
  position,
  offset,
  slots,
}: {
  hasMainScreenshot: boolean
  aspect: AspectState
  frame: DeviceFrame
  position: ScreenshotPosition
  offset: { x: number; y: number }
  slots: ScreenshotSlot[]
}) {
  const boxes: PercentBox[] = slots.map((slot) => ({
    xPct: slot.xPct,
    yPct: slot.yPct,
    widthPct: slot.widthPct,
    heightPct: slot.heightPct,
  }))

  if (hasMainScreenshot) {
    const dims = canvasDimsFromAspect(aspect)
    const rowLayout =
      slots.length > 0
        ? computeRowLayout(
            [
              { id: "__main__", frame },
              ...slots.map((slot) => ({ id: slot.id, frame })),
            ],
            dims.ratio
          )
        : null
    const mainCenter = mainScreenshotPositionPct({
      aspect,
      frame,
      position,
      offset,
      slots,
    })
    boxes.push({
      ...mainCenter,
      widthPct: rowLayout?.[0]?.widthPct ?? 60,
      heightPct: SCREENSHOT_GROUP_BOX_HEIGHT_PCT,
    })
  }

  return centerOfBoxes(boxes)
}

function computeArrangedPositions(
  canvasIds: string[],
  layout: BulkLayout,
  widthPx: number,
  heightPx: number
): Record<string, { x: number; y: number }> {
  const n = canvasIds.length
  const positions: Record<string, { x: number; y: number }> = {}
  if (n === 0) return positions

  if (layout === "row") {
    const stride = widthPx + ARRANGE_GAP
    const totalW = stride * (n - 1)
    canvasIds.forEach((id, i) => {
      positions[id] = { x: -totalW / 2 + i * stride, y: 0 }
    })
    return positions
  }
  if (layout === "column") {
    const stride = heightPx + ARRANGE_GAP
    const totalH = stride * (n - 1)
    canvasIds.forEach((id, i) => {
      positions[id] = { x: 0, y: -totalH / 2 + i * stride }
    })
    return positions
  }
  // grid
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const strideX = widthPx + ARRANGE_GAP
  const strideY = heightPx + ARRANGE_GAP
  const totalW = strideX * (cols - 1)
  const totalH = strideY * (rows - 1)
  canvasIds.forEach((id, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    positions[id] = {
      x: -totalW / 2 + col * strideX,
      y: -totalH / 2 + row * strideY,
    }
  })
  return positions
}

export function FloatingToolbar() {
  const { activeTool, setActiveTool, addCanvas, bulkEditMode } = useEditor()
  const canvasIds = useEditorStore(
    useShallow((s) => s.present.canvases.map((canvas) => canvas.id))
  )
  const aspect = useEditorStore((s) => s.present.aspect)
  const setCanvasPositions = useEditorStore((s) => s.setCanvasPositions)
  const requestBulkFitView = useEditorStore((s) => s.requestBulkFitView)
  const isAnnotateMode = activeTool === "arrow"

  const applyLayout = React.useCallback(
    (layout: BulkLayout) => {
      const aw = aspect.w || 16
      const ah = aspect.h || 10
      const widthPx = BASE_CANVAS_WIDTH
      const heightPx = (BASE_CANVAS_WIDTH * ah) / aw
      setCanvasPositions(
        computeArrangedPositions(canvasIds, layout, widthPx, heightPx)
      )
      requestBulkFitView()
    },
    [aspect.w, aspect.h, canvasIds, setCanvasPositions, requestBulkFitView]
  )

  const resetPositions = React.useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const id of canvasIds) positions[id] = { x: 0, y: 0 }
    setCanvasPositions(positions)
    requestBulkFitView()
    toast("Positions reset")
  }, [canvasIds, setCanvasPositions, requestBulkFitView])

  const showBulkBar = bulkEditMode && !isAnnotateMode

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex w-full max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 px-3 sm:w-auto sm:px-0">
      <AnimatePresence initial={false}>
        {showBulkBar ? (
          <motion.div
            key="bulk-bar"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyLayout("grid")}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent"
                >
                  <RiLayoutGridLine className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Arrange in grid</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyLayout("row")}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent"
                >
                  <RiLayoutRowLine className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Arrange in a row</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyLayout("column")}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent"
                >
                  <RiLayoutColumnLine className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Arrange in a column</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={resetPositions}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent"
                >
                  <RiResetLeftLine className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Reset positions</TooltipContent>
            </Tooltip>
            <span className="mx-1 h-5 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={canvasIds.length >= MAX_CANVASES}
                  onClick={() => {
                    const id = addCanvas()
                    if (!id) toast(`Canvas limit reached (${MAX_CANVASES})`)
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <RiAddLine className="size-4" />
                  Add canvas
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {canvasIds.length >= MAX_CANVASES
                  ? `Canvas limit reached (${MAX_CANVASES})`
                  : "Insert a new canvas"}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        data-mode={isAnnotateMode ? "annotate" : "default"}
        className={cn(
          "pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isAnnotateMode ? "annotate" : "default"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex items-center gap-0.5"
          >
            {isAnnotateMode ? (
              <AnnotationToolbar onExit={() => setActiveTool("pointer")} />
            ) : (
              <DefaultToolbarContents />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function DefaultToolbarContents() {
  const {
    activeTool,
    setActiveTool,
    aspect,
    screenshotPosition,
    screenshotOffset,
    setScreenshotPosition,
    setScreenshotPlacement,
    addText,
    setSelectedTextId,
    addAsset,
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setIsScreenshotSelected,
    screenshot,
    frame,
    enhance,
    setEnhance,
    scale,
    setScale,
    selectedTextId,
    selectedAssetId,
    selectedAnnotationShapeId,
    texts,
    assets,
    annotationShapes,
    updateText,
    updateAsset,
    updateAnnotationShape,
    addScreenshotSlot,
    screenshotSlots,
    updateScreenshotSlot,
    setSelectedScreenshotSlotId,
    setScreenshotSlotGroupPosition,
    objectFit,
    setObjectFit,
  } = useEditor()
  const presetTab = useEditorStore((s) => s.presetTab)
  const assetInputRef = React.useRef<HTMLInputElement>(null)

  const selectedText = selectedTextId
    ? texts.find((t) => t.id === selectedTextId)
    : null
  const selectedAsset = selectedAssetId
    ? assets.find((a) => a.id === selectedAssetId)
    : null
  const selectedAnnotation = selectedAnnotationShapeId
    ? annotationShapes.find((s) => s.id === selectedAnnotationShapeId)
    : null
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const selectedSlot = selectedScreenshotSlotId
    ? screenshotSlots.find((slot) => slot.id === selectedScreenshotSlotId)
    : null

  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const activeCanvasPosition = useActiveCanvasField((c) => c.position)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setCanvasPosition = useEditorStore((s) => s.setCanvasPosition)

  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)

  const [groupAllScreenshots, setGroupAllScreenshots] = React.useState(false)

  type PositionTarget =
    | "text"
    | "asset"
    | "annotation"
    | "slot"
    | "slotGroup"
    | "screenshot"
    | "canvas"
    | "allScreenshots"
    | null
  // Frame and enhance are canvas-shared now; scale is still per-slot.
  const activeFrame = frame
  const activeScale = selectedSlot?.scale ?? scale
  const activeEnhance = enhance
  const hasDeviceFrame = activeFrame.id !== "none"
  const hasMainScreenshotTarget =
    Boolean(screenshot) || hasDeviceFrame || screenshotSlots.length > 0
  const hasMainScreenshot = Boolean(screenshot) || hasDeviceFrame
  const hasScalableContent = selectedSlot ? true : hasMainScreenshotTarget
  const hasAnyScreenshotContent =
    Boolean(screenshot) || hasDeviceFrame || screenshotSlots.length > 0
  const positionTarget: PositionTarget =
    groupAllScreenshots && hasAnyScreenshotContent
      ? "allScreenshots"
      : selectedText
        ? "text"
        : selectedAsset
          ? "asset"
          : selectedAnnotation
            ? "annotation"
            : selectedSlot
              ? "slot"
              : isScreenshotSelected && hasMainScreenshotTarget
                ? "screenshot"
                : screenshotSlots.length > 0
                  ? "slotGroup"
                  : bulkEditMode
                    ? "canvas"
                    : screenshot || hasDeviceFrame
                      ? "screenshot"
                      : null

  const currentPositionId = React.useMemo<ScreenshotPosition | null>(() => {
    let xPct: number
    let yPct: number
    if (positionTarget === "text" && selectedText) {
      xPct = selectedText.xPct
      yPct = selectedText.yPct
    } else if (positionTarget === "asset" && selectedAsset) {
      xPct = selectedAsset.xPct
      yPct = selectedAsset.yPct
    } else if (positionTarget === "annotation" && selectedAnnotation) {
      xPct = selectedAnnotation.xPct
      yPct = selectedAnnotation.yPct
    } else if (positionTarget === "slot" && selectedSlot) {
      xPct = selectedSlot.xPct
      yPct = selectedSlot.yPct
    } else if (positionTarget === "slotGroup") {
      if (screenshotSlots.length === 0) return null
      const bounds = screenshotSlots.reduce(
        (acc, slot) => ({
          minX: Math.min(acc.minX, slot.xPct - slot.widthPct / 2),
          maxX: Math.max(acc.maxX, slot.xPct + slot.widthPct / 2),
          minY: Math.min(acc.minY, slot.yPct - slot.heightPct / 2),
          maxY: Math.max(acc.maxY, slot.yPct + slot.heightPct / 2),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      )
      xPct = (bounds.minX + bounds.maxX) / 2
      yPct = (bounds.minY + bounds.maxY) / 2
    } else if (positionTarget === "canvas") {
      // Map canvas pixel position to grid position
      // Canvas coordinates: center is {0,0}, spread of CANVAS_POS_SPREAD px
      const CANVAS_POS_SPREAD = 600
      const colPct = (activeCanvasPosition.x / CANVAS_POS_SPREAD) * 50 + 50
      const rowPct = (activeCanvasPosition.y / CANVAS_POS_SPREAD) * 50 + 50
      return positionIdFromPercent(colPct, rowPct)
    } else if (positionTarget === "allScreenshots") {
      const center = allScreenshotGroupCenter({
        hasMainScreenshot,
        aspect,
        frame,
        position: screenshotPosition,
        offset: screenshotOffset,
        slots: screenshotSlots,
      })
      if (!center) return null
      return positionIdFromPercent(center.xPct, center.yPct)
    } else if (positionTarget === "screenshot") {
      const rowPosition = mainScreenshotRowPositionPct({
        aspect,
        frame,
        position: screenshotPosition,
        offset: screenshotOffset,
        slots: screenshotSlots,
      })
      if (rowPosition) {
        return positionIdFromPercent(rowPosition.xPct, rowPosition.yPct)
      }
      return screenshotPositionFromOffset(screenshotPosition, screenshotOffset)
    } else {
      return null
    }
    return positionIdFromPercent(xPct, yPct)
  }, [
    positionTarget,
    selectedText,
    selectedAsset,
    selectedAnnotation,
    selectedSlot,
    screenshotSlots,
    aspect,
    frame,
    screenshotPosition,
    screenshotOffset,
    activeCanvasPosition,
    hasMainScreenshot,
  ])

  const handlePositionClick = (posId: ScreenshotPosition) => {
    const emitHideFloatingToolbar = (
      kind: "text" | "asset" | "annotation" | "slot" | "screenshot",
      id: string
    ) => {
      window.dispatchEvent(
        new CustomEvent("beautiful-screenshots:hide-floating-toolbar", {
          detail: { kind, id, durationMs: 320 },
        })
      )
    }
    const anchor = screenshotPositionAnchorFn(posId)
    const latest = useEditorStore.getState()
    const latestSlotId = latest.selectedScreenshotSlotId
    const latestCanvas = latest.present.canvases.find(
      (c) => c.id === latest.present.activeCanvasId
    )
    const latestSelectedSlot = latestSlotId
      ? (latestCanvas?.screenshotSlots.find((s) => s.id === latestSlotId) ??
        null)
      : null
    if (positionTarget === "text" && selectedTextId) {
      emitHideFloatingToolbar("text", selectedTextId)
      updateText(selectedTextId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "asset" && selectedAssetId) {
      emitHideFloatingToolbar("asset", selectedAssetId)
      updateAsset(selectedAssetId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "annotation" && selectedAnnotationShapeId) {
      emitHideFloatingToolbar("annotation", selectedAnnotationShapeId)
      updateAnnotationShape(selectedAnnotationShapeId, {
        xPct: anchor.x,
        yPct: anchor.y,
      })
    } else if (positionTarget === "slot" && latestSelectedSlot) {
      emitHideFloatingToolbar("slot", latestSelectedSlot.id)
      updateScreenshotSlot(latestSelectedSlot.id, {
        xPct: anchor.x,
        yPct: anchor.y,
      })
    } else if (positionTarget === "slotGroup" && !latestSelectedSlot) {
      setScreenshotSlotGroupPosition({ xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "canvas" && activeCanvasId) {
      // Map anchor percentage (0-100) to canvas pixel coordinates
      // center=50% maps to 0px, 0% maps to -SPREAD, 100% maps to +SPREAD
      const CANVAS_POS_SPREAD = 600
      const x = ((anchor.x - 50) / 50) * CANVAS_POS_SPREAD
      const y = ((anchor.y - 50) / 50) * CANVAS_POS_SPREAD
      setCanvasPosition(activeCanvasId, { x, y })
    } else if (positionTarget === "screenshot") {
      emitHideFloatingToolbar("screenshot", "")
      if (screenshotSlots.length > 0) {
        setScreenshotPlacement(
          posId,
          mainScreenshotOffsetForAnchor({
            aspect,
            frame,
            position: posId,
            slots: screenshotSlots,
          })
        )
      } else {
        setScreenshotPosition(posId)
      }
    } else if (positionTarget === "allScreenshots") {
      const currentGroupCenter = allScreenshotGroupCenter({
        hasMainScreenshot,
        aspect,
        frame,
        position: screenshotPosition,
        offset: screenshotOffset,
        slots: screenshotSlots,
      })
      if (!currentGroupCenter) return

      const dx = anchor.x - currentGroupCenter.xPct
      const dy = anchor.y - currentGroupCenter.yPct

      if (hasMainScreenshot) {
        const mainCenter = mainScreenshotPositionPct({
          aspect,
          frame,
          position: screenshotPosition,
          offset: screenshotOffset,
          slots: screenshotSlots,
        })
        setScreenshotPlacement(
          posId,
          mainScreenshotOffsetForPoint({
            aspect,
            frame,
            position: posId,
            slots: screenshotSlots,
            point: {
              xPct: mainCenter.xPct + dx,
              yPct: mainCenter.yPct + dy,
            },
          })
        )
      }

      if (screenshotSlots.length > 0) {
        const slotCenter = screenshotSlotGroupCenter(screenshotSlots)
        if (slotCenter) {
          setScreenshotSlotGroupPosition({
            xPct: slotCenter.xPct + dx,
            yPct: slotCenter.yPct + dy,
          })
        }
      }
    }
  }

  const positionTargetLabel =
    positionTarget === "text"
      ? "text"
      : positionTarget === "asset"
        ? "asset"
        : positionTarget === "annotation"
          ? "annotation"
          : positionTarget === "slot"
            ? "screenshot box"
            : positionTarget === "slotGroup"
              ? "screenshot boxes"
              : positionTarget === "canvas"
                ? "canvas"
                : positionTarget === "allScreenshots"
                  ? "all screenshots"
                  : positionTarget === "screenshot"
                    ? hasDeviceFrame
                      ? "device frame"
                      : "screenshot"
                    : null

  const handleAssetUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const id = addAsset(reader.result)
        setSelectedAssetId(id)
        setSelectedTextId(null)
        setSelectedScreenshotSlotId(null)
        setIsScreenshotSelected(false)
        setActiveTool("pointer")
      }
    }
    reader.readAsDataURL(file)
  }

  const handleToolClick = (id: EditorTool) => {
    if (id === "text") {
      const newId = addText()
      setSelectedTextId(newId)
      setSelectedScreenshotSlotId(null)
      setIsScreenshotSelected(false)
      setActiveTool("pointer")
      return
    }
    setActiveTool(id)
  }

  const items: {
    id: EditorTool
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: "pointer", label: "Select", icon: RiCursorLine },
    { id: "text", label: "Text", icon: RiText },
    { id: "arrow", label: "Annotate", icon: RiArrowRightUpLine },
    { id: "position", label: "Position", icon: RiDragMove2Line },
    { id: "layers", label: "Layers", icon: RiStackLine },
    { id: "enhance", label: "Enhance", icon: RiSparkling2Line },
  ]

  return (
    <>
      <input
        ref={assetInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) {
            for (const f of Array.from(files)) handleAssetUpload(f)
          }
          e.target.value = ""
        }}
      />
      <ToolbarButton
        aria-label="Add asset"
        tooltip="Add asset (image)"
        onClick={() => assetInputRef.current?.click()}
      >
        <RiImageAddLine className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        aria-label="Add screenshot box"
        tooltip={
          presetTab === "multi" || presetTab === "triple"
            ? `Disabled in ${presetTab === "triple" ? "Triple" : "Multi"} preset mode`
            : screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
              ? `Maximum ${MAX_SCREENSHOT_SLOTS} screenshot boxes`
              : "Add screenshot box"
        }
        disabled={
          presetTab === "multi" ||
          presetTab === "triple" ||
          screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
        }
        onClick={() => {
          const id = addScreenshotSlot()
          if (id) {
            setSelectedScreenshotSlotId(id)
            setSelectedTextId(null)
            setSelectedAssetId(null)
            setSelectedAnnotationShapeId(null)
            setIsScreenshotSelected(false)
          } else {
            toast.error(
              `Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`
            )
          }
        }}
      >
        <RiGalleryLine className="size-4" />
      </ToolbarButton>

      {(() => {
        const fitHasScreenshot = selectedSlot
          ? Boolean(selectedSlot.src)
          : Boolean(screenshot)
        const showImageFit = fitHasScreenshot
        if (!showImageFit) return null
        const currentFit = selectedSlot?.objectFit ?? objectFit ?? "cover"
        const FIT_OPTIONS: {
          value: "contain" | "cover" | "fill"
          label: string
          icon: React.ReactNode
        }[] = [
          {
            value: "contain",
            label: "Contain",
            icon: (
              <svg viewBox="0 0 32 32" className="size-full" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="3"
                  className="stroke-current opacity-30"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <rect
                  x="7"
                  y="5"
                  width="18"
                  height="22"
                  rx="2"
                  className="fill-current opacity-25"
                />
                <rect
                  x="7"
                  y="5"
                  width="18"
                  height="22"
                  rx="2"
                  className="stroke-current"
                  strokeWidth="1.5"
                />
              </svg>
            ),
          },
          {
            value: "cover",
            label: "Cover",
            icon: (
              <svg viewBox="0 0 32 32" className="size-full" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="3"
                  className="stroke-current opacity-30"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="3"
                  className="fill-current opacity-25"
                />
                <rect
                  x="-2"
                  y="4"
                  width="36"
                  height="24"
                  rx="2"
                  className="stroke-current"
                  strokeWidth="1.5"
                />
              </svg>
            ),
          },
          {
            value: "fill",
            label: "Fill",
            icon: (
              <svg viewBox="0 0 32 32" className="size-full" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="3"
                  className="fill-current opacity-25"
                />
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="3"
                  className="stroke-current"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 8L5 5M24 8l3-3M8 24l-3 3M24 24l3 3"
                  className="stroke-current opacity-50"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ),
          },
        ]
        return (
          <ToolbarPopover
            tooltip="Image fit"
            contentClassName="w-56 p-2"
            trigger={({ open }) => (
              <ToolbarButton aria-label="Image fit" active={open}>
                <RiFullscreenLine className="size-4" />
              </ToolbarButton>
            )}
          >
            <div className="flex flex-col gap-2">
              <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Image Fit
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {FIT_OPTIONS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      if (selectedSlot) {
                        updateScreenshotSlot(selectedSlot.id, {
                          objectFit: value,
                        })
                      } else {
                        setObjectFit(value)
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-[11px] transition-all",
                      currentFit === value
                        ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <span className="size-7">{icon}</span>
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </ToolbarPopover>
        )
      })()}

      <span className="mx-1 h-5 w-px bg-border" />
      {items.map((it) => {
        const isActive = activeTool === it.id
        const Icon = it.icon

        if (it.id === "layers") {
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={it.label}
              contentClassName="w-auto p-0"
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isActive}
                  onClick={() => handleToolClick(it.id)}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <LayersPanelContent />
            </ToolbarPopover>
          )
        }

        if (it.id === "enhance") {
          const isOn = activeEnhance !== "off"
          const canEnhance = selectedSlot
            ? Boolean(selectedSlot.src)
            : Boolean(screenshot)
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={canEnhance ? "Enhance image" : "Add a screenshot first"}
              contentClassName="w-56 p-2"
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isOn}
                  disabled={!canEnhance}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Enhance
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {ENHANCE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEnhance(p.id)}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-all",
                        activeEnhance === p.id
                          ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      <span
                        className="block size-6 rounded-full border border-border/60"
                        style={{
                          background: p.swatch,
                          filter: p.filter,
                        }}
                      />
                      <span className="font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </ToolbarPopover>
          )
        }

        if (it.id === "position") {
          const isDisabled = positionTarget === null
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={
                isDisabled
                  ? "Nothing to position — select an element or add a screenshot"
                  : `Position ${positionTargetLabel}`
              }
              contentClassName="w-52 p-3"
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open}
                  disabled={isDisabled}
                  onClick={() => handleToolClick(it.id)}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Position {positionTargetLabel}
                </span>
                {hasAnyScreenshotContent ? (
                  <button
                    type="button"
                    onClick={() => setGroupAllScreenshots((v) => !v)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                      groupAllScreenshots
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                    aria-pressed={groupAllScreenshots}
                  >
                    <span className="flex items-center gap-1.5">
                      <RiGroupLine className="size-3.5" />
                      Group all screenshots
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors",
                        groupAllScreenshots ? "bg-primary" : "bg-border"
                      )}
                    >
                      <span
                        className={cn(
                          "block size-2.5 rounded-full bg-white transition-transform",
                          groupAllScreenshots && "translate-x-2.5"
                        )}
                      />
                    </span>
                  </button>
                ) : null}
                <div className="grid grid-cols-5 gap-1.5">
                  {SCREENSHOT_POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => handlePositionClick(pos.id)}
                      aria-label={`Move ${positionTargetLabel} to ${positionLabel(pos.id)}`}
                      className={cn(
                        "relative flex size-8 cursor-pointer items-center justify-center rounded-md border transition-all duration-200 ease-out active:scale-95",
                        currentPositionId === pos.id
                          ? "border-primary bg-primary text-white shadow-[0_0_0_3px_rgba(255,85,113,0.18)]"
                          : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30 hover:bg-secondary/55"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-0 rounded-md bg-white/10 transition-all duration-200 ease-out",
                          currentPositionId === pos.id
                            ? "scale-100 opacity-100"
                            : "scale-75 opacity-0"
                        )}
                      />
                      {pos.isCenter ? (
                        <RiFocus3Line
                          className={cn(
                            "size-3.5 transition-transform duration-200 ease-out",
                            currentPositionId === pos.id && "scale-110"
                          )}
                        />
                      ) : (
                        <RiArrowRightLine
                          className={cn(
                            "size-3.5 transition-transform duration-200 ease-out",
                            currentPositionId === pos.id && "scale-110"
                          )}
                          style={{ transform: `rotate(${pos.angle}deg)` }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </ToolbarPopover>
          )
        }

        return (
          <ToolbarButton
            key={it.id}
            aria-label={it.label}
            tooltip={it.label}
            active={isActive}
            onClick={() => handleToolClick(it.id)}
          >
            <Icon className="size-4" />
          </ToolbarButton>
        )
      })}

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        aria-label="Zoom out"
        tooltip={
          hasScalableContent ? "Zoom out" : "Add a screenshot or frame first"
        }
        disabled={!hasScalableContent || activeScale <= 10}
        onClick={() => {
          const nextScale = editorValueSchemas.scale
            .catch(100)
            .parse(activeScale - 10)
          if (selectedSlot) {
            updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
            return
          }
          setScale(nextScale)
        }}
      >
        <span className="text-base leading-none">−</span>
      </ToolbarButton>

      <button
        type="button"
        disabled={!hasScalableContent}
        onClick={() => {
          const resetScale = editorValueSchemas.scale.catch(100).parse(100)
          if (selectedSlot) {
            updateScreenshotSlot(selectedSlot.id, { scale: resetScale })
            return
          }
          setScale(resetScale)
        }}
        className={cn(
          "tabular min-w-[3.25rem] cursor-pointer rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent",
          !hasScalableContent && "cursor-not-allowed opacity-40"
        )}
      >
        {activeScale}%
      </button>

      <ToolbarButton
        aria-label="Zoom in"
        tooltip={
          hasScalableContent ? "Zoom in" : "Add a screenshot or frame first"
        }
        disabled={!hasScalableContent || activeScale >= 300}
        onClick={() => {
          const nextScale = editorValueSchemas.scale
            .catch(100)
            .parse(activeScale + 10)
          if (selectedSlot) {
            updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
            return
          }
          setScale(nextScale)
        }}
      >
        <span className="text-base leading-none">+</span>
      </ToolbarButton>
    </>
  )
}

function positionLabel(id: ScreenshotPosition) {
  if (id === "center") return "center"
  const [row, col] = id.split("-").map(Number)
  const vertical = ["top", "upper middle", "middle", "lower middle", "bottom"][
    row
  ]
  const horizontal = ["left", "left middle", "center", "right middle", "right"][
    col
  ]
  return `${vertical} ${horizontal}`
}
