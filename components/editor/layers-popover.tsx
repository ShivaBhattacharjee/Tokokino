"use client"

import * as React from "react"
import {
  DndContext,
  type DragEndEvent,
  type Modifier,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useShallow } from "zustand/react/shallow"
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiBlurOffLine,
  RiDeleteBinLine,
  RiDraggable,
  RiEyeCloseLine,
  RiEyeLine,
  RiGalleryLine,
  RiImage2Line,
  RiLock2Line,
  RiMoreFill,
  RiPencilRulerLine,
  RiSmartphoneLine,
  RiText,
  RiTwitterXLine,
} from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { Slider } from "@/components/ui/slider"
import {
  backgroundCss,
  type AssetBlendMode,
  type DeviceFrame,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { getDeviceMockup } from "@/lib/mockups"
import { BROWSER_FRAMES } from "@/lib/browser-frame"
import { cn } from "@/lib/utils"

type EditableLayerType =
  | "screenshot"
  | "tweet"
  | "slot"
  | "asset"
  | "text"
  | "annotation"

type EditorLayer = {
  key: string
  id: string
  type: EditableLayerType
  source?: "annotation-shape" | "annotation-stroke"
  name: string
  meta: string
  zIndex: number
  hidden: boolean
  opacity: number
  blendMode: AssetBlendMode
  thumbnail?: string
}

const ASSET_BLEND_MODES: { id: AssetBlendMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "darken", label: "Darken" },
  { id: "lighten", label: "Lighten" },
  { id: "color-burn", label: "Color Burn" },
  { id: "color-dodge", label: "Color Dodge" },
  { id: "hard-light", label: "Hard Light" },
  { id: "soft-light", label: "Soft Light" },
  { id: "difference", label: "Difference" },
  { id: "exclusion", label: "Exclusion" },
  { id: "hue", label: "Hue" },
  { id: "saturation", label: "Saturation" },
  { id: "color", label: "Color" },
  { id: "luminosity", label: "Luminosity" },
]

const restrictLayerDrag: Modifier = ({
  activeNodeRect,
  containerNodeRect,
  transform,
}) => {
  let y = transform.y

  if (activeNodeRect && containerNodeRect) {
    const minY = containerNodeRect.top - activeNodeRect.top
    const maxY = containerNodeRect.bottom - activeNodeRect.bottom
    y = Math.min(maxY, Math.max(minY, y))
  }

  return { ...transform, x: 0, y }
}

export function LayersPanelContent({ flat }: { flat?: boolean }) {
  const {
    screenshot,
    background,
    screenshotLayer,
    updateScreenshotLayer,
    screenshotSlots,
    updateScreenshotSlot,
    deleteScreenshotSlot,
    assets,
    updateAsset,
    deleteAsset,
    texts,
    updateText,
    deleteText,
    annotations,
    updateAnnotationStrokeLayer,
    deleteAnnotationStroke,
    annotationShapes,
    updateAnnotationShape,
    deleteAnnotationShape,
    selectedAssetId,
    setSelectedAssetId,
    selectedTextId,
    setSelectedTextId,
    selectedAnnotationShapeId,
    setSelectedAnnotationShapeId,
    selectedScreenshotSlotId,
    setSelectedScreenshotSlotId,
    isScreenshotSelected,
    setIsScreenshotSelected,
    setActiveTool,
    activeCanvasId,
    setActiveCanvasId,
    frame,
    setFrame,
    tweet,
  } = useEditor()
  const canvasIds = useEditorStore(
    useShallow((s) => s.present.canvases.map((canvas) => canvas.id))
  )
  const [selectedLayerKey, setSelectedLayerKey] = React.useState<string | null>(
    null
  )

  const layers = React.useMemo(() => {
    const next: EditorLayer[] = []

    if (screenshot) {
      next.push({
        key: "screenshot:main",
        id: "main",
        type: "screenshot",
        name: "Screenshot",
        meta: "Base image",
        zIndex: screenshotLayer.zIndex,
        hidden: screenshotLayer.hidden,
        opacity: screenshotLayer.opacity,
        blendMode: screenshotLayer.blendMode,
        thumbnail: screenshot,
      })
    }

    if (tweet) {
      next.push({
        key: "tweet:main",
        id: "main",
        type: "tweet",
        name: tweet.data.source === "bluesky" ? "Bluesky Post" : "X Post",
        meta: tweet.data.author.handle
          ? `@${tweet.data.author.handle}`
          : "Post card",
        zIndex: screenshotLayer.zIndex,
        hidden: screenshotLayer.hidden,
        opacity: screenshotLayer.opacity,
        blendMode: screenshotLayer.blendMode,
      })
    }

    for (const asset of assets) {
      next.push({
        key: `asset:${asset.id}`,
        id: asset.id,
        type: "asset",
        name: "Image layer",
        meta: asset.blendMode === "normal" ? "Image" : asset.blendMode,
        zIndex: asset.zIndex,
        hidden: Boolean(asset.hidden),
        opacity: asset.opacity,
        blendMode: asset.blendMode,
        thumbnail: asset.src,
      })
    }

    for (const [index, slot] of screenshotSlots.entries()) {
      next.push({
        key: `slot:${slot.id}`,
        id: slot.id,
        type: "slot",
        name: `Screenshot box ${index + 1}`,
        meta:
          frame.id === "none"
            ? "Screenshot box"
            : `Frame · ${frame.id.replace(/_/g, " ")}`,
        zIndex: slot.zIndex,
        hidden: Boolean(slot.hidden),
        opacity: screenshotLayer.opacity,
        blendMode: screenshotLayer.blendMode,
        thumbnail: slot.src ?? undefined,
      })
    }

    for (const text of texts) {
      const name = text.content.replace(/\s+/g, " ").trim()
      next.push({
        key: `text:${text.id}`,
        id: text.id,
        type: "text",
        name: name || "Text layer",
        meta: "Text",
        zIndex: text.zIndex,
        hidden: Boolean(text.hidden),
        opacity: text.opacity ?? 100,
        blendMode: text.blendMode ?? "normal",
      })
    }

    for (const [index, stroke] of annotations.entries()) {
      if (stroke.mode === "eraser") continue
      next.push({
        key: `annotation-stroke:${stroke.id}`,
        id: stroke.id,
        type: "annotation",
        source: "annotation-stroke",
        name: annotationStrokeName(stroke.mode),
        meta: "Annotation",
        zIndex: stroke.zIndex ?? index + 1,
        hidden: Boolean(stroke.hidden),
        opacity: stroke.opacity ?? 100,
        blendMode:
          stroke.blendMode ??
          (stroke.mode === "highlight" ? "multiply" : "normal"),
      })
    }

    for (const shape of annotationShapes) {
      next.push({
        key: `annotation:${shape.id}`,
        id: shape.id,
        type: "annotation",
        source: "annotation-shape",
        name: annotationName(shape.kind),
        meta: shape.kind === "blur" ? "Redaction" : "Annotation",
        zIndex: shape.zIndex,
        hidden: Boolean(shape.hidden),
        opacity: shape.opacity ?? 100,
        blendMode: shape.blendMode ?? "normal",
      })
    }

    return next.sort((a, b) => b.zIndex - a.zIndex)
  }, [
    assets,
    annotations,
    annotationShapes,
    frame.id,
    screenshot,
    screenshotLayer,
    screenshotSlots,
    texts,
    tweet,
  ])

  const mainContentLayerKey = tweet ? "tweet:main" : "screenshot:main"
  const activeKey =
    selectedLayerKey ??
    (selectedAssetId
      ? `asset:${selectedAssetId}`
      : selectedTextId
        ? `text:${selectedTextId}`
        : selectedAnnotationShapeId
          ? `annotation:${selectedAnnotationShapeId}`
          : selectedScreenshotSlotId
            ? `slot:${selectedScreenshotSlotId}`
            : isScreenshotSelected
              ? mainContentLayerKey
              : (layers[0]?.key ?? null))

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function updateLayer(layer: EditorLayer, patch: Partial<EditorLayer>) {
    const layerPatch = {
      ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : {}),
      ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
      ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
      ...(patch.blendMode !== undefined ? { blendMode: patch.blendMode } : {}),
    }

    if (layer.type === "screenshot" || layer.type === "tweet")
      updateScreenshotLayer(layerPatch)
    if (layer.type === "slot") {
      // Slot rows show the canvas-shared opacity/blendMode; edits to those
      // route to the canvas layer. zIndex/hidden remain per-slot.
      const sharedPatch = {
        ...(layerPatch.opacity !== undefined
          ? { opacity: layerPatch.opacity }
          : {}),
        ...(layerPatch.blendMode !== undefined
          ? { blendMode: layerPatch.blendMode }
          : {}),
      }
      if (Object.keys(sharedPatch).length > 0)
        updateScreenshotLayer(sharedPatch)
      const slotPatch = {
        ...(layerPatch.zIndex !== undefined
          ? { zIndex: layerPatch.zIndex }
          : {}),
        ...(layerPatch.hidden !== undefined
          ? { hidden: layerPatch.hidden }
          : {}),
      }
      if (Object.keys(slotPatch).length > 0)
        updateScreenshotSlot(layer.id, slotPatch)
    }
    if (layer.type === "asset") updateAsset(layer.id, layerPatch)
    if (layer.type === "text") updateText(layer.id, layerPatch)
    if (layer.source === "annotation-stroke")
      updateAnnotationStrokeLayer(layer.id, layerPatch)
    if (layer.source === "annotation-shape")
      updateAnnotationShape(layer.id, layerPatch)
  }

  function deleteLayer(layer: EditorLayer) {
    setSelectedLayerKey(null)
    if (layer.type === "slot") deleteScreenshotSlot(layer.id)
    if (layer.type === "asset") deleteAsset(layer.id)
    if (layer.type === "text") deleteText(layer.id)
    if (layer.source === "annotation-stroke") deleteAnnotationStroke(layer.id)
    if (layer.source === "annotation-shape") deleteAnnotationShape(layer.id)
  }

  function applyLayerOrder(nextTopFirst: EditorLayer[]) {
    const total = nextTopFirst.length
    nextTopFirst.forEach((layer, index) => {
      const zIndex = total - index
      if (layer.zIndex !== zIndex) updateLayer(layer, { zIndex })
    })
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = layers.findIndex((layer) => layer.key === active.id)
    const to = layers.findIndex((layer) => layer.key === over.id)
    if (from < 0 || to < 0) return
    applyLayerOrder(arrayMove(layers, from, to))
  }

  function moveLayer(layer: EditorLayer, direction: "up" | "down") {
    const from = layers.findIndex((item) => item.key === layer.key)
    const to = direction === "up" ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= layers.length) return
    applyLayerOrder(arrayMove(layers, from, to))
    setSelectedLayerKey(layer.key)
  }

  function selectLayer(layer: EditorLayer) {
    setSelectedLayerKey(layer.key)
    setActiveTool("pointer")
    setIsScreenshotSelected(
      layer.type === "screenshot" || layer.type === "tweet"
    )
    setSelectedScreenshotSlotId(layer.type === "slot" ? layer.id : null)
    setSelectedAssetId(layer.type === "asset" ? layer.id : null)
    setSelectedTextId(layer.type === "text" ? layer.id : null)
    setSelectedAnnotationShapeId(
      layer.source === "annotation-shape" ? layer.id : null
    )
  }

  return (
    <div className={cn(flat ? "w-full p-2" : "w-[300px] p-2")}>
      {canvasIds.length > 1 ? (
        <div className="mb-2 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-md border border-border/60 bg-secondary/20 p-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {canvasIds.map((canvasId, index) => {
            const isActive = canvasId === activeCanvasId
            return (
              <button
                key={canvasId}
                type="button"
                onClick={() => {
                  if (canvasId !== activeCanvasId) {
                    setActiveCanvasId(canvasId)
                    setSelectedLayerKey(null)
                  }
                }}
                className={cn(
                  "shrink-0 cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Canvas {index + 1}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="mb-1 flex items-baseline justify-between px-1.5">
        <span className="label-eyebrow">Layers</span>
        <span className="tabular font-mono text-[10px] text-muted-foreground">
          {(layers.length + 1 + (frame.id !== "none" ? 1 : 0))
            .toString()
            .padStart(2, "0")}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictLayerDrag]}
        onDragStart={() => {
          document.body.style.userSelect = "none"
        }}
        onDragEnd={(e) => {
          document.body.style.userSelect = ""
          onDragEnd(e)
        }}
        onDragCancel={() => {
          document.body.style.userSelect = ""
        }}
      >
        <SortableContext
          items={layers.map((layer) => layer.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className={cn(
              "flex flex-col gap-0.5 pr-1",
              !flat && "max-h-[300px] overflow-y-auto"
            )}
          >
            {layers.map((layer, index) => (
              <LayerRow
                key={layer.key}
                layer={layer}
                selected={activeKey === layer.key}
                isFirst={index === 0}
                isLast={index === layers.length - 1}
                onSelect={() => selectLayer(layer)}
                onToggleVisibility={() =>
                  updateLayer(layer, { hidden: !layer.hidden })
                }
                onMoveUp={() => moveLayer(layer, "up")}
                onMoveDown={() => moveLayer(layer, "down")}
                onOpacityChange={(opacity) => updateLayer(layer, { opacity })}
                onBlendChange={(blendMode) => updateLayer(layer, { blendMode })}
                onDelete={
                  layer.type !== "screenshot" && layer.type !== "tweet"
                    ? () => deleteLayer(layer)
                    : undefined
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {frame.id !== "none" ? (
        <FrameLockedLayer
          frame={frame}
          onReplace={(f) => setFrame(f)}
          onRemove={() =>
            setFrame({ id: "none", color: "black", orientation: "vertical" })
          }
        />
      ) : null}

      <div className="mt-1 rounded-md border border-border/60 bg-secondary/20 px-1.5 py-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BackgroundLayerPreview background={background} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] leading-tight text-foreground">
              Background
            </div>
            <div className="text-[10px] leading-tight">Background · locked</div>
          </div>
          <RiLock2Line className="size-3.5 shrink-0 text-muted-foreground/60" />
        </div>
      </div>
    </div>
  )
}

function LayerRow({
  layer,
  selected,
  isFirst,
  isLast,
  onSelect,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onOpacityChange,
  onBlendChange,
  onDelete,
}: {
  layer: EditorLayer
  selected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onOpacityChange: (opacity: number) => void
  onBlendChange: (blendMode: AssetBlendMode) => void
  onDelete?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.key })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
      role="button"
      tabIndex={0}
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1.5",
        selected ? "border-foreground/25 bg-accent" : "hover:bg-accent/60",
        layer.hidden && "opacity-55",
        isDragging && "z-10 shadow-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag layer"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: "none" }}
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/0 transition-colors select-none group-hover:text-muted-foreground active:cursor-grabbing [@media(hover:none)]:text-muted-foreground"
      >
        <RiDraggable className="size-3.5" />
      </button>
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-background/60 text-muted-foreground">
        {layer.thumbnail ? (
          <ShimmerImage
            src={layer.thumbnail}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <LayerIcon type={layer.type} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] leading-tight">{layer.name}</div>
        <div className="tabular truncate font-mono text-[10px] leading-tight text-muted-foreground">
          {layer.meta} · z{layer.zIndex}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={isFirst}
          aria-label="Move layer up"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <RiArrowUpSLine className="size-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={isLast}
          aria-label="Move layer down"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <RiArrowDownSLine className="size-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisibility()
          }}
          aria-label={layer.hidden ? "Show layer" : "Hide layer"}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {layer.hidden ? (
            <RiEyeCloseLine className="size-3" />
          ) : (
            <RiEyeLine className="size-3" />
          )}
        </button>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Delete layer"
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-red-500/15 hover:text-red-500"
          >
            <RiDeleteBinLine className="size-3" />
          </button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label="Layer style"
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RiMoreFill className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            sideOffset={8}
            onClick={(e) => e.stopPropagation()}
            className="w-64 border-border/60 bg-popover/95 p-2 backdrop-blur-md"
          >
            <LayerEffects
              layer={layer}
              onOpacityChange={onOpacityChange}
              onBlendChange={onBlendChange}
            />
          </PopoverContent>
        </Popover>
      </div>
    </li>
  )
}

function LayerEffects({
  layer,
  onOpacityChange,
  onBlendChange,
}: {
  layer: EditorLayer
  onOpacityChange: (opacity: number) => void
  onBlendChange: (blendMode: AssetBlendMode) => void
}) {
  const [blendOpen, setBlendOpen] = React.useState(false)
  const activeLabel =
    ASSET_BLEND_MODES.find((m) => m.id === layer.blendMode)?.label ?? "Normal"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Layer style</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {layer.opacity}%
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <RiBlurOffLine className="size-3.5" />
          Blend
        </div>
        <Popover open={blendOpen} onOpenChange={setBlendOpen}>
          <PopoverTrigger asChild>
            <button className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md border border-border/60 bg-background px-2 text-[12px] transition-colors outline-none hover:border-foreground/30 focus:border-primary/60">
              <span>{activeLabel}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={4}
            className="w-56 border-border/60 bg-popover/95 p-1 backdrop-blur-md"
          >
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {ASSET_BLEND_MODES.map((mode) => {
                const active = layer.blendMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      onBlendChange(mode.id)
                      setBlendOpen(false)
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {active && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {!active && <span className="inline-block w-[14px]" />}
                    {mode.label}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Opacity</span>
          <span className="font-mono">{layer.opacity}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[layer.opacity]}
          onValueChange={([value]) => onOpacityChange(value)}
          className="cursor-pointer"
        />
      </div>
    </div>
  )
}

function BackgroundLayerPreview({
  background,
}: {
  background: ReturnType<typeof useEditor>["background"]
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block size-7 shrink-0 overflow-hidden rounded border border-border/60 bg-background/60",
        background.type === "none" && "bg-transparency-checker"
      )}
      style={backgroundCss(background)}
    />
  )
}

function LayerIcon({ type }: { type: EditableLayerType }) {
  if (type === "text") return <RiText className="size-3.5" />
  if (type === "annotation") return <RiPencilRulerLine className="size-3.5" />
  if (type === "slot") return <RiGalleryLine className="size-3.5" />
  if (type === "tweet") return <RiTwitterXLine className="size-3.5" />
  return <RiImage2Line className="size-3.5" />
}

function annotationName(kind: string) {
  if (kind === "rect") return "Rectangle"
  if (kind === "ellipse") return "Ellipse"
  if (kind === "blur") return "Blur layer"
  if (kind === "step") return "Step marker"
  return "Arrow"
}

function annotationStrokeName(mode: string) {
  if (mode === "highlight") return "Highlighter"
  return "Pen stroke"
}

function FrameLockedLayer({
  frame,
  onReplace,
  onRemove,
}: {
  frame: DeviceFrame
  onReplace: (f: DeviceFrame) => void
  onRemove: () => void
}) {
  const browserFrame = BROWSER_FRAMES.find((f) => f.id === frame.id)
  const deviceMockup = getDeviceMockup(frame.id)

  let name = "Frame"
  let meta = "Locked frame"

  if (browserFrame) {
    name = browserFrame.name
    meta = "Browser frame · locked"
  } else if (deviceMockup) {
    name = deviceMockup.name
    meta = "Device frame · locked"
  }

  // Get available colors for this frame
  const availableColors: string[] = browserFrame
    ? [...browserFrame.colors]
    : deviceMockup
      ? deviceMockup.colors
      : []

  return (
    <div className="mt-1 rounded-md border border-border/60 bg-secondary/20 px-1.5 py-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="flex size-7 shrink-0 items-center justify-center rounded border border-border/60 bg-background/60">
          <RiSmartphoneLine className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-tight text-foreground">
            {name}
          </div>
          <div className="text-[10px] leading-tight">{meta}</div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Frame options"
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <RiMoreFill className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={8}
            className="w-48 p-2"
          >
            {availableColors.length > 1 ? (
              <div className="mb-2">
                <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Color
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableColors.map((color) => {
                    const isActive = frame.color === color
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={formatColorName(color)}
                        title={formatColorName(color)}
                        onClick={() =>
                          onReplace({
                            ...frame,
                            color,
                          })
                        }
                        className={cn(
                          "size-6 rounded-full border-2 transition-all",
                          isActive
                            ? "scale-110 border-foreground shadow-md"
                            : "border-transparent hover:scale-105 hover:border-foreground/30"
                        )}
                        style={frameColorSwatch(color)}
                      />
                    )
                  })}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onRemove}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-red-500 transition-colors hover:bg-accent"
            >
              <RiDeleteBinLine className="size-3.5" />
              Remove frame
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function formatColorName(color: string) {
  return color
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

const FRAME_COLOR_MAP: Record<string, string> = {
  black: "#111111",
  blue: "#8fc5e8",
  cosmic_orange: "#ff8a3d",
  dark: "#262626",
  dark_green: "#264133",
  deep_blue: "#1d314d",
  gray: "#8a8a86",
  green: "#86a877",
  grey: "#777b82",
  hazel: "#6e7463",
  lavender: "#c9b7df",
  light: "#f7f7f4",
  light_blush: "#efc7c5",
  midnight: "#202637",
  mist_blue: "#bdd4e8",
  natural: "#b7aaa0",
  navy: "#182740",
  obsidian: "#1b1b1d",
  orange: "#f28a45",
  purple: "#9a85c7",
  red: "#d4544d",
  sage: "#a6b9a1",
  silver: "#d6d6d2",
  snow: "#f1f0ea",
  space_gray: "#72716d",
  starlight: "#eee4d6",
  tan: "#b39069",
  white: "#f7f7f4",
  yellow: "#f2d66d",
}

function frameColorSwatch(color: string): React.CSSProperties {
  return {
    background:
      FRAME_COLOR_MAP[color] ??
      "linear-gradient(135deg, #2d2d2d 0 25%, #525252 25% 50%, #2d2d2d 50% 75%, #525252 75%)",
  }
}
