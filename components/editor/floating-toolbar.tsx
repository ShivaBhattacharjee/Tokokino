"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiFocus3Line,
  RiGalleryLine,
  RiImageAddLine,
  RiLayoutColumnLine,
  RiLayoutGridLine,
  RiLayoutRowLine,
  RiResetLeftLine,
  RiSmartphoneLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { AnnotationToolbar } from "@/components/editor/annotation-toolbar"
import { FramePopover } from "@/components/editor/frame-popover"
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
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
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
  const canvases = useEditorStore((s) => s.present.canvases)
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
      const ids = canvases.map((c) => c.id)
      setCanvasPositions(
        computeArrangedPositions(ids, layout, widthPx, heightPx)
      )
      requestBulkFitView()
    },
    [aspect.w, aspect.h, canvases, setCanvasPositions, requestBulkFitView]
  )

  const resetPositions = React.useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const c of canvases) positions[c.id] = { x: 0, y: 0 }
    setCanvasPositions(positions)
    requestBulkFitView()
    toast("Positions reset")
  }, [canvases, setCanvasPositions, requestBulkFitView])

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
                  disabled={canvases.length >= MAX_CANVASES}
                  onClick={() => {
                    const id = addCanvas()
                    if (id) toast("Canvas added")
                    else toast(`Canvas limit reached (${MAX_CANVASES})`)
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <RiAddLine className="size-4" />
                  Add canvas
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {canvases.length >= MAX_CANVASES
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
    screenshotPosition,
    setScreenshotPosition,
    addText,
    setSelectedTextId,
    addAsset,
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setIsScreenshotSelected,
    screenshot,
    frame,
    setFrame,
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
  } = useEditor()
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
  const canvases = useEditorStore((s) => s.present.canvases)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setCanvasPosition = useEditorStore((s) => s.setCanvasPosition)

  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)

  type PositionTarget =
    | "text"
    | "asset"
    | "annotation"
    | "slot"
    | "slotGroup"
    | "screenshot"
    | "canvas"
    | null
  const activeFrame = selectedSlot?.frame ?? frame
  const activeScale = selectedSlot?.scale ?? scale
  const activeEnhance = selectedSlot?.enhance ?? enhance
  const hasDeviceFrame = activeFrame.id !== "none"
  const hasScalableContent = selectedSlot
    ? true
    : Boolean(screenshot || hasDeviceFrame)
  const positionTarget: PositionTarget = selectedText
    ? "text"
    : selectedAsset
      ? "asset"
      : selectedAnnotation
        ? "annotation"
        : selectedSlot
          ? "slot"
          : isScreenshotSelected && (screenshot || hasDeviceFrame)
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
      const canvas = canvases.find((c) => c.id === activeCanvasId)
      if (!canvas) return null
      // Map canvas pixel position to grid position
      // Canvas coordinates: center is {0,0}, spread of CANVAS_POS_SPREAD px
      const CANVAS_POS_SPREAD = 600
      const colPct = (canvas.position.x / CANVAS_POS_SPREAD) * 50 + 50
      const rowPct = (canvas.position.y / CANVAS_POS_SPREAD) * 50 + 50
      const col = Math.round(Math.max(0, Math.min(4, colPct / 25)))
      const row = Math.round(Math.max(0, Math.min(4, rowPct / 25)))
      if (col === 2 && row === 2) return "center"
      return `${row}-${col}` as ScreenshotPosition
    } else if (positionTarget === "screenshot") {
      return screenshotPosition
    } else {
      return null
    }
    const col = Math.round(xPct / 25)
    const row = Math.round(yPct / 25)
    if (col === 2 && row === 2) return "center"
    return `${row}-${col}` as ScreenshotPosition
  }, [
    positionTarget,
    selectedText,
    selectedAsset,
    selectedAnnotation,
    selectedSlot,
    screenshotSlots,
    screenshotPosition,
    canvases,
    activeCanvasId,
  ])

  const handlePositionClick = (posId: ScreenshotPosition) => {
    const anchor = screenshotPositionAnchorFn(posId)
    if (positionTarget === "text" && selectedTextId) {
      updateText(selectedTextId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "asset" && selectedAssetId) {
      updateAsset(selectedAssetId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "annotation" && selectedAnnotationShapeId) {
      updateAnnotationShape(selectedAnnotationShapeId, {
        xPct: anchor.x,
        yPct: anchor.y,
      })
    } else if (positionTarget === "slot" && selectedSlot) {
      updateScreenshotSlot(selectedSlot.id, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "slotGroup") {
      setScreenshotSlotGroupPosition({ xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "canvas" && activeCanvasId) {
      // Map anchor percentage (0-100) to canvas pixel coordinates
      // center=50% maps to 0px, 0% maps to -SPREAD, 100% maps to +SPREAD
      const CANVAS_POS_SPREAD = 600
      const x = ((anchor.x - 50) / 50) * CANVAS_POS_SPREAD
      const y = ((anchor.y - 50) / 50) * CANVAS_POS_SPREAD
      setCanvasPosition(activeCanvasId, { x, y })
    } else if (positionTarget === "screenshot") {
      setScreenshotPosition(posId)
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
          screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
            ? `Maximum ${MAX_SCREENSHOT_SLOTS} screenshot boxes`
            : "Add screenshot box"
        }
        disabled={screenshotSlots.length >= MAX_SCREENSHOT_SLOTS}
        onClick={() => {
          const id = addScreenshotSlot()
          if (id) {
            setSelectedScreenshotSlotId(id)
            setSelectedTextId(null)
            setSelectedAssetId(null)
            setSelectedAnnotationShapeId(null)
            setIsScreenshotSelected(false)
            toast("Screenshot box added")
          } else {
            toast(`Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`)
          }
        }}
      >
        <RiGalleryLine className="size-4" />
      </ToolbarButton>
      <ToolbarPopover
        tooltip={
          selectedSlot
            ? "Frame for selected screenshot box"
            : "Frame for main screenshot"
        }
        contentClassName="w-72 p-3"
        trigger={({ open }) => (
          <ToolbarButton
            aria-label="Frame"
            active={open || activeFrame.id !== "none"}
          >
            <RiSmartphoneLine className="size-4" />
          </ToolbarButton>
        )}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {selectedSlot ? "Screenshot box frame" : "Main screenshot frame"}
          </span>
          <FramePopover
            value={activeFrame}
            previewImage={selectedSlot ? selectedSlot.src : undefined}
            onChange={(nextFrame) => {
              if (selectedSlot) {
                updateScreenshotSlot(selectedSlot.id, { frame: nextFrame })
                return
              }
              setFrame(nextFrame)
            }}
          />
        </div>
      </ToolbarPopover>
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
                      onClick={() => {
                        if (selectedSlot) {
                          updateScreenshotSlot(selectedSlot.id, {
                            enhance: p.id,
                          })
                          return
                        }
                        setEnhance(p.id)
                      }}
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
                <div className="grid grid-cols-5 gap-1.5">
                  {SCREENSHOT_POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() =>
                        handlePositionClick(pos.id as ScreenshotPosition)
                      }
                      aria-label={`Move ${positionTargetLabel} to ${positionLabel(pos.id)}`}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-md border transition-all",
                        currentPositionId === pos.id
                          ? "border-primary bg-primary text-white"
                          : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      {pos.isCenter ? (
                        <RiFocus3Line className="size-3.5" />
                      ) : (
                        <RiArrowRightLine
                          className="size-3.5"
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
          const nextScale = Math.max(10, activeScale - 10)
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
          if (selectedSlot) {
            updateScreenshotSlot(selectedSlot.id, { scale: 100 })
            return
          }
          setScale(100)
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
          const nextScale = Math.min(300, activeScale + 10)
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
