"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  RiBlurOffLine,
  RiContrastDropLine,
  RiFlipHorizontalLine,
  RiFlipVerticalLine,
  RiMagicLine,
  RiRefreshLine,
} from "@remixicon/react"

import {
  bulkToolbarScale,
  floatingToolbarTransform,
  ToolbarButton,
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  ToolbarPopover,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import { Slider } from "@/components/ui/slider"
import {
  type AssetBlendMode,
  type AssetElement,
  type AssetFilter,
  assetFilterCss,
  useEditor,
} from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { cn } from "@/lib/utils"

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
  lastXPct: number
  lastYPct: number
  moved: boolean
}

type ResizeHandleId = "ml" | "mr" | "mt" | "mb" | "tl" | "tr" | "bl" | "br"

type ResizeState = {
  pointerId: number
  handle: ResizeHandleId
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  startWidthPct: number
  startHeightPct: number
  aspect: number
  canvasW: number
  canvasH: number
}

export function AssetElementView({
  asset,
  canvasRef,
  previewMode,
}: {
  asset: AssetElement
  canvasRef: React.RefObject<HTMLDivElement | null>
  previewMode?: boolean
}) {
  const {
    selectedAssetId,
    setSelectedAssetId,
    setSelectedTextId,
    setSelectedAnnotationShapeId,
    updateAsset,
    deleteAsset,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
  } = useEditor()
  const isSelected = selectedAssetId === asset.id

  const elRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)

  const { toolbarRect, hideFloatingToolbar, shouldAnimatePositionMove, measureRect, setToolbarRect } =
    useFloatingToolbarRect({
      elRef,
      isSelected,
      bulkCanvasDragging,
      kind: "asset",
      elementId: asset.id,
      trackPositionAnimate: true,
    })

  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected) return
    measureRect()
  }, [
    bulkCanvasDragging,
    isSelected,
    measureRect,
    asset.xPct,
    asset.yPct,
    asset.widthPct,
    asset.heightPct,
    asset.rotation,
  ])

  const select = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAssetId(asset.id)
    setSelectedTextId(null)
    setSelectedAnnotationShapeId(null)
  }

  React.useEffect(() => {
    if (!isSelected) return

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true
      ) {
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteAsset(asset.id)
        setSelectedAssetId(null)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [asset.id, deleteAsset, isSelected, setSelectedAssetId])

  const startDrag = (e: React.PointerEvent<Element>) => {
    if (!canvasRef.current) return
    e.stopPropagation()
    setSelectedAssetId(asset.id)
    setSelectedTextId(null)
    const rect = canvasRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startXPct: asset.xPct,
      startYPct: asset.yPct,
      canvasW: rect.width,
      canvasH: rect.height,
      lastXPct: asset.xPct,
      lastYPct: asset.yPct,
      moved: false,
    }
    setIsDragging(true)
    ;(e.currentTarget).setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100
    const nextX = Math.max(0, Math.min(100, drag.startXPct + dxPct))
    const nextY = Math.max(0, Math.min(100, drag.startYPct + dyPct))
    drag.lastXPct = nextX
    drag.lastYPct = nextY
    drag.moved = true
    // Mutate DOM directly to avoid re-rendering the entire editor on every pointermove
    const el = elRef.current
    if (el) {
      el.style.left = `${nextX}%`
      el.style.top = `${nextY}%`
      setToolbarRect(el.getBoundingClientRect())
    }
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (drag.moved) {
      updateAsset(asset.id, {
        xPct: drag.lastXPct,
        yPct: drag.lastYPct,
      })
    }
    dragRef.current = null
    setIsDragging(false)
  }

  const startResize =
    (handle: ResizeHandleId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const canvas = canvasRef.current
      const el = elRef.current
      if (!canvas || !el) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = canvas.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const widthPx = elRect.width
      const heightPx = elRect.height
      const heightPct =
        asset.heightPct ?? (rect.height ? (heightPx / rect.height) * 100 : 0)
      resizeRef.current = {
        pointerId: e.pointerId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startXPct: asset.xPct,
        startYPct: asset.yPct,
        startWidthPct: asset.widthPct,
        startHeightPct: heightPct,
        aspect: heightPx > 0 ? widthPx / heightPx : 1,
        canvasW: rect.width,
        canvasH: rect.height,
      }
      setIsResizing(true)
    }

  const moveResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - rs.startX) / rs.canvasW) * 100
    const dyPct = ((e.clientY - rs.startY) / rs.canvasH) * 100

    const isCorner =
      rs.handle === "tl" ||
      rs.handle === "tr" ||
      rs.handle === "bl" ||
      rs.handle === "br"

    if (isCorner) {
      // Proportional scale based on dominant axis, anchor opposite corner
      const signX = rs.handle === "tr" || rs.handle === "br" ? 1 : -1
      const signY = rs.handle === "bl" || rs.handle === "br" ? 1 : -1
      const newWByX = Math.max(2, rs.startWidthPct + signX * dxPct)
      const newHByY = Math.max(2, rs.startHeightPct + signY * dyPct)
      const scaleX = newWByX / rs.startWidthPct
      const scaleY = newHByY / rs.startHeightPct
      const scale = Math.max(scaleX, scaleY)
      const newW = Math.max(2, rs.startWidthPct * scale)
      const newH = Math.max(2, rs.startHeightPct * scale)
      const xShift = (signX * (newW - rs.startWidthPct)) / 2
      const yShift = (signY * (newH - rs.startHeightPct)) / 2
      updateAsset(asset.id, {
        widthPct: Math.min(200, newW),
        heightPct: Math.min(200, newH),
        xPct: Math.max(-20, Math.min(120, rs.startXPct + xShift)),
        yPct: Math.max(-20, Math.min(120, rs.startYPct + yShift)),
      })
    } else {
      let newW = rs.startWidthPct
      let newH = rs.startHeightPct
      let xShift = 0
      let yShift = 0
      switch (rs.handle) {
        case "ml":
          newW = Math.max(2, rs.startWidthPct - dxPct)
          xShift = -(newW - rs.startWidthPct) / 2
          break
        case "mr":
          newW = Math.max(2, rs.startWidthPct + dxPct)
          xShift = (newW - rs.startWidthPct) / 2
          break
        case "mt":
          newH = Math.max(2, rs.startHeightPct - dyPct)
          yShift = -(newH - rs.startHeightPct) / 2
          break
        case "mb":
          newH = Math.max(2, rs.startHeightPct + dyPct)
          yShift = (newH - rs.startHeightPct) / 2
          break
      }
      updateAsset(asset.id, {
        widthPct: Math.min(200, newW),
        heightPct: Math.min(200, newH),
        xPct: Math.max(-20, Math.min(120, rs.startXPct + xShift)),
        yPct: Math.max(-20, Math.min(120, rs.startYPct + yShift)),
      })
    }
  }

  const endResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null
      setIsResizing(false)
    }
  }

  const heightStyle = asset.heightPct != null ? `${asset.heightPct}%` : "auto"

  return (
    <>
      <div
        ref={elRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={select}
        data-editor-asset-id={asset.id}
        className={cn(
          "absolute select-none",
          isSelected ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{
          left: `${asset.xPct}%`,
          top: `${asset.yPct}%`,
          width: `${asset.widthPct}%`,
          height: heightStyle,
          transform: `translate(-50%, -50%) rotate(${asset.rotation}deg) scaleX(${asset.flipX ? -1 : 1}) scaleY(${asset.flipY ? -1 : 1})`,
          transition:
            !isDragging && !isResizing && shouldAnimatePositionMove
              ? "left 300ms ease-out, top 300ms ease-out"
              : "none",
          zIndex: 60 + asset.zIndex,
          mixBlendMode:
            asset.blendMode && asset.blendMode !== "normal"
              ? asset.blendMode
              : undefined,
          display: asset.hidden ? "none" : undefined,
        }}
      >
        <img
          ref={imgRef}
          src={asset.src}
          alt=""
          draggable={false}
          style={{
            filter: assetFilterCss(asset.filter),
            opacity: asset.opacity / 100,
          }}
          className={cn(
            "block h-full w-full select-none",
            asset.heightPct != null ? "object-fill" : "object-contain",
            isSelected && !previewMode &&
              "outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
          )}
        />
        {isSelected && !previewMode ? (
          <>
            {/* Resize handles - 4 edges + 4 corners */}
            {(
              [
                [
                  "ml",
                  "top-1/2",
                  "left-0",
                  "-translate-x-1/2 -translate-y-1/2",
                  "ew-resize",
                ],
                [
                  "mr",
                  "top-1/2",
                  "right-0",
                  "translate-x-1/2 -translate-y-1/2",
                  "ew-resize",
                ],
                [
                  "mt",
                  "top-0",
                  "left-1/2",
                  "-translate-x-1/2 -translate-y-1/2",
                  "ns-resize",
                ],
                [
                  "mb",
                  "bottom-0",
                  "left-1/2",
                  "-translate-x-1/2 translate-y-1/2",
                  "ns-resize",
                ],
                [
                  "tl",
                  "top-0",
                  "left-0",
                  "-translate-x-1/2 -translate-y-1/2",
                  "nwse-resize",
                ],
                [
                  "tr",
                  "top-0",
                  "right-0",
                  "translate-x-1/2 -translate-y-1/2",
                  "nesw-resize",
                ],
                [
                  "bl",
                  "bottom-0",
                  "left-0",
                  "-translate-x-1/2 translate-y-1/2",
                  "nesw-resize",
                ],
                [
                  "br",
                  "bottom-0",
                  "right-0",
                  "translate-x-1/2 translate-y-1/2",
                  "nwse-resize",
                ],
              ] as const
            ).map(([id, vClass, hClass, transformClass, cursor]) => (
              <button
                key={id}
                aria-label={`Resize ${id}`}
                onPointerDown={startResize(id)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute z-10 size-2.5 rounded-full border border-[#92b97a] bg-background shadow",
                  vClass,
                  hClass,
                  transformClass
                )}
                style={{ cursor }}
              />
            ))}
          </>
        ) : null}
      </div>

      {!previewMode &&
      !bulkCanvasDragging &&
      isSelected &&
      !hideFloatingToolbar &&
      toolbarRect &&
      typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              const scale = bulkEditMode
                ? bulkToolbarScale(bulkViewportZoom)
                : 1
              return (
                <div
                  data-editor-floating-toolbar-target={`asset:${asset.id}`}
                  className="pointer-events-none fixed z-100"
                  style={{
                    top,
                    left,
                    transform: floatingToolbarTransform(flipBelow, scale),
                    transformOrigin: flipBelow
                      ? "top center"
                      : "bottom center",
                  }}
                >
                  <div className="pointer-events-auto">
                    <AssetToolbar
                      asset={asset}
                      onDragHandlePointerDown={startDrag}
                      onDragHandlePointerMove={moveDrag}
                      onDragHandlePointerUp={endDrag}
                    />
                  </div>
                </div>
              )
            })(),
            document.body
          )
        : null}
    </>
  )
}

type DragHandlers = {
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void
}

function AssetToolbar({
  asset,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
}: { asset: AssetElement } & DragHandlers) {
  const {
    deleteAsset,
    duplicateAsset,
    bringAssetToFront,
    sendAssetToBack,
    setSelectedAssetId,
    updateAsset,
  } = useEditor()
  const replaceInputRef = React.useRef<HTMLInputElement>(null)

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      if (src) updateAsset(asset.id, { src })
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  return (
    <ToolbarSurface>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplace}
      />
      <ToolbarDragHandle
        ariaLabel="Drag asset"
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerUp}
      />

      <ToolbarDivider />

      <ToolbarDeleteButton
        ariaLabel="Delete asset"
        onDelete={() => {
          deleteAsset(asset.id)
          setSelectedAssetId(null)
        }}
      />

      <ToolbarDuplicateButton
        ariaLabel="Duplicate asset"
        onDuplicate={() => {
          const id = duplicateAsset(asset.id)
          if (id) setSelectedAssetId(id)
        }}
      />

      <ToolbarButton
        aria-label="Replace asset"
        tooltip="Replace"
        onClick={() => replaceInputRef.current?.click()}
      >
        <RiRefreshLine className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        aria-label="Flip horizontal"
        tooltip="Flip horizontal"
        active={asset.flipX}
        onClick={() => updateAsset(asset.id, { flipX: !asset.flipX })}
      >
        <RiFlipHorizontalLine className="size-4" />
      </ToolbarButton>

      <ToolbarButton
        aria-label="Flip vertical"
        tooltip="Flip vertical"
        active={asset.flipY}
        onClick={() => updateAsset(asset.id, { flipY: !asset.flipY })}
      >
        <RiFlipVerticalLine className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarPopover
        tooltip="Filters"
        contentClassName="w-72 p-2"
        trigger={({ open }) => (
          <ToolbarButton
            aria-label="Filters"
            active={open || asset.filter !== "none"}
          >
            <RiMagicLine className="size-4" />
          </ToolbarButton>
        )}
      >
        <AssetFilterGrid asset={asset} />
      </ToolbarPopover>

      <ToolbarPopover
        tooltip="Blend mode"
        contentClassName="w-72 p-2"
        trigger={({ open }) => (
          <ToolbarButton
            aria-label="Blend mode"
            active={open || asset.blendMode !== "normal"}
          >
            <RiBlurOffLine className="size-4" />
          </ToolbarButton>
        )}
      >
        <AssetBlendGrid asset={asset} />
      </ToolbarPopover>

      <ToolbarPopover
        tooltip="Opacity"
        contentClassName="w-56 p-3"
        trigger={({ open }) => (
          <ToolbarButton
            aria-label="Opacity"
            active={open || asset.opacity < 100}
          >
            <RiContrastDropLine className="size-4" />
          </ToolbarButton>
        )}
      >
        <AssetOpacitySlider asset={asset} />
      </ToolbarPopover>

      <ToolbarLayerOrderMenu
        onBringToFront={() => bringAssetToFront(asset.id)}
        onSendToBack={() => sendAssetToBack(asset.id)}
      />
    </ToolbarSurface>
  )
}

const ASSET_FILTERS: { id: AssetFilter; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "bw", label: "B&W" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "fade", label: "Fade" },
  { id: "vivid", label: "Vivid" },
  { id: "noir", label: "Noir" },
  { id: "dream", label: "Dream" },
  { id: "mono", label: "Mono" },
  { id: "invert", label: "Invert" },
]

function AssetFilterGrid({ asset }: { asset: AssetElement }) {
  const { updateAsset } = useEditor()
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Filters
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {ASSET_FILTERS.map((f) => {
          const active = asset.filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => updateAsset(asset.id, { filter: f.id })}
              className={cn(
                "group flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1 transition-all",
                active
                  ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                  : "border-border/60 bg-secondary/20 hover:border-foreground/30"
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-muted/50">
                <img
                  src={asset.src}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  style={{ filter: assetFilterCss(f.id) }}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {f.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ASSET_BLEND_MODES: { id: AssetBlendMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "darken", label: "Darken" },
  { id: "lighten", label: "Lighten" },
  { id: "color-burn", label: "Burn" },
  { id: "color-dodge", label: "Dodge" },
  { id: "hard-light", label: "Hard Light" },
  { id: "soft-light", label: "Soft Light" },
  { id: "difference", label: "Difference" },
  { id: "exclusion", label: "Exclusion" },
  { id: "hue", label: "Hue" },
  { id: "saturation", label: "Saturation" },
  { id: "color", label: "Color" },
  { id: "luminosity", label: "Luminosity" },
]

function AssetBlendGrid({ asset }: { asset: AssetElement }) {
  const { updateAsset } = useEditor()
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Blend
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {ASSET_BLEND_MODES.map((m) => {
          const active = asset.blendMode === m.id
          return (
            <button
              key={m.id}
              onClick={() => updateAsset(asset.id, { blendMode: m.id })}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1 transition-all",
                active
                  ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                  : "border-border/60 bg-secondary/20 hover:border-foreground/30"
              )}
            >
              <div
                className="relative aspect-square w-full overflow-hidden rounded-sm"
                style={{
                  background:
                    "linear-gradient(135deg,#f59e0b 0%,#ef4444 50%,#3b82f6 100%)",
                }}
              >
                <img
                  src={asset.src}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  style={{ mixBlendMode: m.id }}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] leading-tight font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AssetOpacitySlider({ asset }: { asset: AssetElement }) {
  const { updateAsset } = useEditor()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Opacity
        </span>
        <span className="font-mono text-[11px] text-foreground">
          {asset.opacity}%
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[asset.opacity]}
        onValueChange={([v]) => updateAsset(asset.id, { opacity: v })}
        className="cursor-pointer"
      />
    </div>
  )
}
