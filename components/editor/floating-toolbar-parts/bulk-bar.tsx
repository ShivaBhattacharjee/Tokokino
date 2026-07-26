"use client"

import * as React from "react"
import {
  RiAddLine,
  RiLayoutColumnLine,
  RiLayoutGridLine,
  RiLayoutRowLine,
  RiResetLeftLine,
} from "@remixicon/react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MAX_CANVASES, useEditor, useEditorStore } from "@/lib/editor/store"

import {
  BASE_CANVAS_WIDTH,
  computeArrangedPositions,
  type BulkLayout,
} from "./geometry"

export function useBulkBarState() {
  const { addCanvas, bulkEditMode, activeTool } = useEditor()
  const canvasIds = useEditorStore(
    useShallow((s) => s.present.canvases.map((canvas) => canvas.id))
  )
  const aspect = useEditorStore((s) => s.present.aspect)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
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

  return {
    canvasIds,
    addCanvas,
    bulkEditMode,
    isAnnotateMode,
    isPreviewMode,
    applyLayout,
    resetPositions,
  }
}

function BulkBarContent({
  canvasIds,
  addCanvas,
  applyLayout,
  resetPositions,
}: {
  canvasIds: string[]
  addCanvas: () => string | null
  applyLayout: (layout: BulkLayout) => void
  resetPositions: () => void
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md">
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
        <TooltipContent side="bottom">Arrange in grid</TooltipContent>
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
        <TooltipContent side="bottom">Arrange in a row</TooltipContent>
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
        <TooltipContent side="bottom">Arrange in a column</TooltipContent>
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
        <TooltipContent side="bottom">Reset positions</TooltipContent>
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
        <TooltipContent side="bottom">
          {canvasIds.length >= MAX_CANVASES
            ? `Canvas limit reached (${MAX_CANVASES})`
            : "Add canvas"}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/** Bulk arrange bar — shown at the top of the canvas area on all screen sizes. */
export function BulkBar() {
  const {
    canvasIds,
    addCanvas,
    bulkEditMode,
    isAnnotateMode,
    isPreviewMode,
    applyLayout,
    resetPositions,
  } = useBulkBarState()
  // Preview keeps bulk edit on underneath, but its chrome must go — the bar
  // otherwise sits behind the Exit Preview pill.
  const showBulkBar = bulkEditMode && !isAnnotateMode && !isPreviewMode

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2">
      <AnimatePresence initial={false}>
        {showBulkBar ? (
          <motion.div
            key="bulk-bar"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <BulkBarContent
              canvasIds={canvasIds}
              addCanvas={addCanvas}
              applyLayout={applyLayout}
              resetPositions={resetPositions}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
