"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiFocus3Line,
  RiImageAddLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

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

export function FloatingToolbar() {
  const { activeTool, setActiveTool, addCanvas, bulkEditMode } = useEditor()
  const isAnnotateMode = activeTool === "arrow"

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex w-full max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col items-center gap-2 px-3 sm:w-auto sm:px-0">
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

        {bulkEditMode && !isAnnotateMode ? (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    addCanvas()
                    toast("Canvas added")
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent cursor-pointer whitespace-nowrap"
                >
                  <RiAddLine className="size-4" />
                  Add canvas
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Insert a new canvas</TooltipContent>
            </Tooltip>
          </>
        ) : null}
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
  } = useEditor()
  const assetInputRef = React.useRef<HTMLInputElement>(null)

  const selectedText = selectedTextId ? texts.find((t) => t.id === selectedTextId) : null
  const selectedAsset = selectedAssetId ? assets.find((a) => a.id === selectedAssetId) : null
  const selectedAnnotation = selectedAnnotationShapeId
    ? annotationShapes.find((s) => s.id === selectedAnnotationShapeId)
    : null

  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const canvases = useEditorStore((s) => s.present.canvases)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setCanvasPosition = useEditorStore((s) => s.setCanvasPosition)

  type PositionTarget = "text" | "asset" | "annotation" | "screenshot" | "canvas" | null
  const hasDeviceFrame = frame.id !== "none"
  const positionTarget: PositionTarget = selectedText
    ? "text"
    : selectedAsset
      ? "asset"
      : selectedAnnotation
        ? "annotation"
        : bulkEditMode && canvases.length > 1
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
    } else if (positionTarget === "canvas") {
      const canvas = canvases.find((c) => c.id === activeCanvasId)
      if (!canvas) return null
      // Map canvas pixel position to grid position
      // Canvas coordinates: center is {0,0}, spread of CANVAS_POS_SPREAD px
      const CANVAS_POS_SPREAD = 600
      const colPct = ((canvas.position.x / CANVAS_POS_SPREAD) * 50 + 50)
      const rowPct = ((canvas.position.y / CANVAS_POS_SPREAD) * 50 + 50)
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
  }, [positionTarget, selectedText, selectedAsset, selectedAnnotation, screenshotPosition, canvases, activeCanvasId])

  const handlePositionClick = (posId: ScreenshotPosition) => {
    const anchor = screenshotPositionAnchorFn(posId)
    if (positionTarget === "text" && selectedTextId) {
      updateText(selectedTextId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "asset" && selectedAssetId) {
      updateAsset(selectedAssetId, { xPct: anchor.x, yPct: anchor.y })
    } else if (positionTarget === "annotation" && selectedAnnotationShapeId) {
      updateAnnotationShape(selectedAnnotationShapeId, { xPct: anchor.x, yPct: anchor.y })
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
        setActiveTool("pointer")
      }
    }
    reader.readAsDataURL(file)
  }

  const handleToolClick = (id: EditorTool) => {
    if (id === "text") {
      const newId = addText()
      setSelectedTextId(newId)
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
          const isOn = enhance !== "off"
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={
                screenshot ? "Enhance image" : "Add a screenshot first"
              }
              contentClassName="w-56 p-2"
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isOn}
                  disabled={!screenshot}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Enhance
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {ENHANCE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEnhance(p.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-all cursor-pointer",
                        enhance === p.id
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
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isActive}
                  disabled={isDisabled}
                  onClick={() => handleToolClick(it.id)}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Position {positionTargetLabel}
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {SCREENSHOT_POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => handlePositionClick(pos.id as ScreenshotPosition)}
                      aria-label={`Move ${positionTargetLabel} to ${positionLabel(pos.id)}`}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md border transition-all cursor-pointer",
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
        tooltip={screenshot ? "Zoom out" : "Add a screenshot first"}
        disabled={!screenshot}
        onClick={() => setScale(Math.max(10, scale - 10))}
      >
        <span className="text-base leading-none">−</span>
      </ToolbarButton>

      <button
        type="button"
        disabled={!screenshot}
        onClick={() => setScale(100)}
        className={cn(
          "tabular min-w-[3.25rem] rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent cursor-pointer",
          !screenshot && "opacity-40 cursor-not-allowed"
        )}
      >
        {scale}%
      </button>

      <ToolbarButton
        aria-label="Zoom in"
        tooltip={screenshot ? "Zoom in" : "Add a screenshot first"}
        disabled={!screenshot}
        onClick={() => setScale(Math.min(300, scale + 10))}
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
