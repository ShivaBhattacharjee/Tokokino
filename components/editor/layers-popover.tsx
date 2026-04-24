"use client"

import * as React from "react"
import {
  DndContext,
  type DragEndEvent,
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
  RiDraggable,
  RiEyeCloseLine,
  RiEyeLine,
  RiImage2Line,
  RiPaletteLine,
  RiText,
} from "@remixicon/react"

import { SAMPLE_LAYERS } from "@/lib/editor/mock-data"
import type { Layer, LayerKind } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

const KIND_ICON: Partial<
  Record<LayerKind, React.ComponentType<{ className?: string }>>
> = {
  screenshot: RiImage2Line,
  background: RiPaletteLine,
  text: RiText,
}

const KIND_LABEL: Partial<Record<LayerKind, string>> = {
  screenshot: "Screenshot",
  background: "Background",
  text: "Text",
}

export function LayersPanelContent() {
  const [layers, setLayers] = React.useState<Layer[]>(SAMPLE_LAYERS)
  const [selected, setSelected] = React.useState<string | null>("shot")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLayers((prev) => {
      const from = prev.findIndex((l) => l.id === active.id)
      const to = prev.findIndex((l) => l.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  function toggleVisibility(id: string) {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    )
  }

  return (
    <div className="w-[260px] p-2">
      <div className="mb-1 flex items-baseline justify-between px-1.5">
        <span className="label-eyebrow">Layers</span>
        <span className="tabular font-mono text-[10px] text-muted-foreground">
          {layers.length.toString().padStart(2, "0")}
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={layers.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-0.5">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                selected={selected === layer.id}
                onSelect={() => setSelected(layer.id)}
                onToggleVisibility={() => toggleVisibility(layer.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function LayerRow({
  layer,
  selected,
  onSelect,
  onToggleVisibility,
}: {
  layer: Layer
  selected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id })
  const Icon = KIND_ICON[layer.kind] ?? RiImage2Line
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1.5",
        selected ? "border-foreground/25 bg-accent" : "hover:bg-accent/60",
        isDragging && "z-10 shadow-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag"
        className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/0 transition-colors group-hover:text-muted-foreground active:cursor-grabbing"
      >
        <RiDraggable className="size-3.5" />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded border border-border/60 bg-background/60 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] leading-tight">{layer.name}</span>
        <span className="tabular flex items-center gap-1 font-mono text-[10px] leading-tight text-muted-foreground">
          <span>{KIND_LABEL[layer.kind] ?? layer.kind}</span>
          {layer.meta ? (
            <>
              <span className="opacity-40">·</span>
              <span>{layer.meta}</span>
            </>
          ) : null}
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        aria-label={layer.visible ? "Hide" : "Show"}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground"
      >
        {layer.visible ? (
          <RiEyeLine className="size-3" />
        ) : (
          <RiEyeCloseLine className="size-3" />
        )}
      </button>
    </li>
  )
}
