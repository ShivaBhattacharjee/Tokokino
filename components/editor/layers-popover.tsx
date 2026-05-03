"use client"

import * as React from "react"
import {
  DndContext,
  type DragEndEvent,
  type Modifier,
  KeyboardSensor,
  PointerSensor,
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
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiBlurOffLine,
  RiDraggable,
  RiEyeCloseLine,
  RiEyeLine,
  RiImage2Line,
  RiMoreFill,
  RiPencilRulerLine,
  RiText,
} from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  backgroundCss,
  type AssetBlendMode,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type EditableLayerType = "screenshot" | "asset" | "text" | "annotation"

type EditorLayer = {
  key: string
  id: string
  type: EditableLayerType
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

export function LayersPanelContent() {
  const {
    screenshot,
    background,
    screenshotLayer,
    updateScreenshotLayer,
    assets,
    updateAsset,
    texts,
    updateText,
    annotationShapes,
    updateAnnotationShape,
    selectedAssetId,
    setSelectedAssetId,
    selectedTextId,
    setSelectedTextId,
    selectedAnnotationShapeId,
    setSelectedAnnotationShapeId,
    setActiveTool,
  } = useEditor()
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

    for (const shape of annotationShapes) {
      next.push({
        key: `annotation:${shape.id}`,
        id: shape.id,
        type: "annotation",
        name: annotationName(shape.kind),
        meta: shape.kind === "blur" ? "Redaction" : "Annotation",
        zIndex: shape.zIndex,
        hidden: Boolean(shape.hidden),
        opacity: shape.opacity ?? 100,
        blendMode: shape.blendMode ?? "normal",
      })
    }

    return next.sort((a, b) => b.zIndex - a.zIndex)
  }, [assets, annotationShapes, screenshot, screenshotLayer, texts])

  const activeKey =
    selectedLayerKey ??
    (selectedAssetId
      ? `asset:${selectedAssetId}`
      : selectedTextId
        ? `text:${selectedTextId}`
        : selectedAnnotationShapeId
          ? `annotation:${selectedAnnotationShapeId}`
          : (layers[0]?.key ?? null))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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

    if (layer.type === "screenshot") updateScreenshotLayer(layerPatch)
    if (layer.type === "asset") updateAsset(layer.id, layerPatch)
    if (layer.type === "text") updateText(layer.id, layerPatch)
    if (layer.type === "annotation") updateAnnotationShape(layer.id, layerPatch)
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
    setSelectedAssetId(layer.type === "asset" ? layer.id : null)
    setSelectedTextId(layer.type === "text" ? layer.id : null)
    setSelectedAnnotationShapeId(layer.type === "annotation" ? layer.id : null)
  }

  return (
    <div className="w-[300px] p-2">
      <div className="mb-1 flex items-baseline justify-between px-1.5">
        <span className="label-eyebrow">Layers</span>
        <span className="tabular font-mono text-[10px] text-muted-foreground">
          {(layers.length + 1).toString().padStart(2, "0")}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictLayerDrag]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={layers.map((layer) => layer.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex max-h-[300px] flex-col gap-0.5 overflow-y-auto pr-1">
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
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-1 rounded-md border border-border/60 bg-secondary/20 px-1.5 py-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BackgroundLayerPreview background={background} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] leading-tight text-foreground">
              Background
            </div>
            <div className="text-[10px] leading-tight">Locked base layer</div>
          </div>
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
        className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/0 transition-colors group-hover:text-muted-foreground active:cursor-grabbing"
      >
        <RiDraggable className="size-3.5" />
      </button>
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-background/60 text-muted-foreground">
        {layer.thumbnail ? (
          <img
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
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
        <select
          value={layer.blendMode}
          onChange={(e) => onBlendChange(e.target.value as AssetBlendMode)}
          className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[12px] transition-colors outline-none hover:border-foreground/30 focus:border-primary/60"
        >
          {ASSET_BLEND_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
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
  return <RiImage2Line className="size-3.5" />
}

function annotationName(kind: string) {
  if (kind === "rect") return "Rectangle"
  if (kind === "ellipse") return "Ellipse"
  if (kind === "blur") return "Blur layer"
  return "Arrow"
}
