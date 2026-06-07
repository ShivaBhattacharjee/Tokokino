"use client"

import * as React from "react"
import {
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useStore as useFlowStore,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiFileCopyLine,
  RiFocus3Line,
  RiSubtractLine,
} from "@remixicon/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MAX_CANVASES, useEditorStore } from "@/lib/editor/store"
import type { AspectState, CanvasState } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { CanvasView } from "./canvas"
import { BASE_CANVAS_WIDTH } from "./canvas/constants"

function canvasDims(
  canvas: CanvasState,
  globalAspect: AspectState
): { widthPx: number; heightPx: number } {
  const aspect = canvas.aspect ?? globalAspect
  const aw = aspect.w || 16
  const ah = aspect.h || 10
  return { widthPx: BASE_CANVAS_WIDTH, heightPx: (BASE_CANVAS_WIDTH * ah) / aw }
}

type CanvasNodeData = {
  canvasId: string
  widthPx: number
  heightPx: number
}

type CanvasFlowNode = Node<CanvasNodeData, "canvas">

function CanvasNodeToolbar({
  canvasId,
  isActive,
  canvasCount,
  onActivate,
  onDuplicate,
  removeCanvas,
}: {
  canvasId: string
  isActive: boolean
  canvasCount: number
  onActivate: () => void
  onDuplicate: () => void
  removeCanvas: (id: string) => void
}) {
  const zoom = useFlowStore((s) => s.transform[2])
  const inverseZoom = zoom > 0 ? Math.min(10, 1 / Math.sqrt(zoom / 2)) : 1

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: "50%",
        transformOrigin: "bottom center",
        transform: `translate(-50%, -${12 * inverseZoom}px) scale(${inverseZoom})`,
      }}
      className="z-10 flex items-center gap-1.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag to move canvas"
            className={cn(
              "canvas-drag-handle inline-flex size-9 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing",
              isActive ? "bg-accent text-foreground" : ""
            )}
            onClick={(e) => {
              e.stopPropagation()
              onActivate()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                onActivate()
              }
            }}
          >
            <RiDragMove2Line className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">Drag to move</TooltipContent>
      </Tooltip>

      <span className="nodrag mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={canvasCount >= MAX_CANVASES}
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            aria-label="Duplicate canvas"
            className="nodrag inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <RiFileCopyLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {canvasCount >= MAX_CANVASES
            ? `Canvas limit reached (${MAX_CANVASES})`
            : "Duplicate"}
        </TooltipContent>
      </Tooltip>

      {canvasCount > 1 ? (
        <>
          <span className="nodrag mx-0.5 h-5 w-px bg-border" />
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Delete canvas"
                    className="nodrag inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <RiDeleteBinLine className="size-4" />
                  </button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete canvas?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the canvas and all its content.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
                <AlertDialogCancel className="cursor-pointer">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => removeCanvas(canvasId)}
                  className="cursor-pointer"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

function CanvasNode({ data }: NodeProps<CanvasFlowNode>) {
  const { canvasId, widthPx, heightPx } = data
  const isActive = useEditorStore((s) => s.present.activeCanvasId === canvasId)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const setActiveCanvasId = useEditorStore((s) => s.setActiveCanvasId)
  const removeCanvas = useEditorStore((s) => s.removeCanvas)

  const onActivate = React.useCallback(() => {
    setActiveCanvasId(canvasId)
  }, [canvasId, setActiveCanvasId])

  const onDuplicate = React.useCallback(() => {
    const newId = useEditorStore.getState().duplicateCanvas(canvasId)
    if (newId) toast("Canvas duplicated")
    else toast(`Canvas limit reached (${MAX_CANVASES})`)
  }, [canvasId])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      style={{ width: widthPx, height: heightPx }}
      className="relative"
      onClick={onActivate}
    >
      <CanvasNodeToolbar
        canvasId={canvasId}
        isActive={isActive}
        canvasCount={canvasCount}
        onActivate={onActivate}
        onDuplicate={onDuplicate}
        removeCanvas={removeCanvas}
      />

      <CanvasView
        canvasId={canvasId}
        isActive={isActive}
        widthPx={widthPx}
        heightPx={heightPx}
        effectiveScale={1}
        onActivate={onActivate}
      />
    </div>
  )
}

const nodeTypes: NodeTypes = { canvas: CanvasNode }

function buildNodes(
  canvases: CanvasState[],
  globalAspect: AspectState
): CanvasFlowNode[] {
  return canvases.map((c) => {
    const { widthPx, heightPx } = canvasDims(c, globalAspect)
    return {
      id: c.id,
      type: "canvas",
      position: {
        x: c.position.x - widthPx / 2,
        y: c.position.y - heightPx / 2,
      },
      dragHandle: ".canvas-drag-handle",
      data: { canvasId: c.id, widthPx, heightPx },
    }
  })
}

function BulkCanvasFlowInner() {
  const canvases = useEditorStore((s) => s.present.canvases)
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const setCanvasPosition = useEditorStore((s) => s.setCanvasPosition)
  const setBulkCanvasDragging = useEditorStore((s) => s.setBulkCanvasDragging)
  const setBulkViewportZoom = useEditorStore((s) => s.setBulkViewportZoom)
  const fitViewSeq = useEditorStore((s) => s.bulkFitViewSeq)
  const { fitView } = useReactFlow()
  const { resolvedTheme } = useTheme()
  const colorMode = resolvedTheme === "dark" ? "dark" : "light"

  React.useEffect(() => {
    return () => setBulkViewportZoom(1)
  }, [setBulkViewportZoom])

  React.useEffect(() => {
    if (fitViewSeq === 0) return
    const id = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 350 })
    })
    return () => cancelAnimationFrame(id)
  }, [fitViewSeq, fitView])

  const [nodes, setNodes] = React.useState<CanvasFlowNode[]>(() =>
    buildNodes(canvases, globalAspect)
  )

  const draggingRef = React.useRef(false)
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    if (draggingRef.current) return
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return canvases.map((c) => {
        const { widthPx, heightPx } = canvasDims(c, globalAspect)
        const target = {
          x: c.position.x - widthPx / 2,
          y: c.position.y - heightPx / 2,
        }
        const existing = prevById.get(c.id)
        if (
          existing &&
          existing.position.x === target.x &&
          existing.position.y === target.y &&
          existing.data.widthPx === widthPx &&
          existing.data.heightPx === heightPx
        ) {
          return existing
        }
        return {
          id: c.id,
          type: "canvas" as const,
          position: target,
          dragHandle: ".canvas-drag-handle",
          data: { canvasId: c.id, widthPx, heightPx },
        }
      })
    })
  }, [canvases, globalAspect])

  const onNodesChange: OnNodesChange<CanvasFlowNode> = React.useCallback(
    (changes) => {
      setNodes((prev) => applyNodeChanges(changes, prev))
    },
    []
  )

  const onNodeDragStart: OnNodeDrag<CanvasFlowNode> = React.useCallback(() => {
    draggingRef.current = true
    setBulkCanvasDragging(true)
  }, [setBulkCanvasDragging])

  const onNodeDragStop: OnNodeDrag<CanvasFlowNode> = React.useCallback(
    (_e, node) => {
      draggingRef.current = false
      setBulkCanvasDragging(false)
      setCanvasPosition(node.id, {
        x: node.position.x + node.data.widthPx / 2,
        y: node.position.y + node.data.heightPx / 2,
      })
    },
    [setBulkCanvasDragging, setCanvasPosition]
  )

  const onViewportMoveStart = React.useCallback(() => {
    setBulkCanvasDragging(true)
  }, [setBulkCanvasDragging])

  const onViewportMoveEnd = React.useCallback(
    (_e: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setBulkCanvasDragging(false)
      setBulkViewportZoom(viewport.zoom)
    },
    [setBulkCanvasDragging, setBulkViewportZoom]
  )

  return (
    <div className="absolute inset-0 bg-background dark:bg-black">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onMoveStart={onViewportMoveStart}
        onMoveEnd={onViewportMoveEnd}
        onInit={(instance) => {
          void instance.fitView({ padding: 0.2 })
          requestAnimationFrame(() => setIsReady(true))
        }}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        selectionOnDrag={false}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{
          background: "transparent",
          opacity: isReady ? 1 : 0,
          transition: "opacity 150ms ease-out",
        }}
      >
        <GlassControls />
      </ReactFlow>
    </div>
  )
}

function GlassControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-50 flex flex-col items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-white/5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void zoomIn({ duration: 150 })}
            aria-label="Zoom in"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground/85 transition-colors hover:bg-white/10"
          >
            <RiAddLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void zoomOut({ duration: 150 })}
            aria-label="Zoom out"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground/85 transition-colors hover:bg-white/10"
          >
            <RiSubtractLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom out</TooltipContent>
      </Tooltip>
      <span className="my-0.5 h-px w-5 bg-white/10" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.2, duration: 300 })}
            aria-label="Fit view"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground/85 transition-colors hover:bg-white/10"
          >
            <RiFocus3Line className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Fit view</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function BulkCanvasFlow() {
  return (
    <ReactFlowProvider>
      <BulkCanvasFlowInner />
    </ReactFlowProvider>
  )
}
