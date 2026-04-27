"use client"

import * as React from "react"
import { RiDeleteBinLine, RiDragMove2Line } from "@remixicon/react"

import { type AssetElement, useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
}

type ResizeState = {
  pointerId: number
  startX: number
  startWidthPct: number
  canvasW: number
}

export function AssetElementView({
  asset,
  canvasRef,
}: {
  asset: AssetElement
  canvasRef: React.RefObject<HTMLDivElement | null>
}) {
  const {
    selectedAssetId,
    setSelectedAssetId,
    setSelectedTextId,
    updateAsset,
    deleteAsset,
  } = useEditor()
  const isSelected = selectedAssetId === asset.id

  const dragRef = React.useRef<DragState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)

  const select = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAssetId(asset.id)
    setSelectedTextId(null)
  }

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
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100
    updateAsset(asset.id, {
      xPct: Math.max(0, Math.min(100, drag.startXPct + dxPct)),
      yPct: Math.max(0, Math.min(100, drag.startYPct + dyPct)),
    })
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
  }

  const startResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canvasRef.current) return
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidthPct: asset.widthPct,
      canvasW: rect.width,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - resize.startX) / resize.canvasW) * 100
    updateAsset(asset.id, {
      widthPct: Math.max(5, Math.min(100, resize.startWidthPct + dxPct)),
    })
  }

  const endResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null
    }
  }

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={select}
      className={cn(
        "absolute select-none",
        isSelected ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: `${asset.xPct}%`,
        top: `${asset.yPct}%`,
        width: `${asset.widthPct}%`,
        transform: `translate(-50%, -50%) rotate(${asset.rotation}deg)`,
        zIndex: isSelected
          ? 60
          : asset.zIndex < 0
            ? 10 + asset.zIndex
            : 40 + asset.zIndex,
      }}
    >
      <img
        src={asset.src}
        alt=""
        draggable={false}
        className={cn(
          "block w-full select-none",
          isSelected && "outline-2 outline-[#9BCD64]/95 outline-dashed outline-offset-2"
        )}
      />
      {isSelected ? (
        <>
          {/* Toolbar */}
          <div
            className="pointer-events-auto absolute bottom-full left-1/2 z-10 mb-3 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Drag asset"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <RiDragMove2Line className="size-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              aria-label="Delete asset"
              onClick={() => {
                deleteAsset(asset.id)
                setSelectedAssetId(null)
              }}
              className="inline-flex size-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-500/10 cursor-pointer"
            >
              <RiDeleteBinLine className="size-4" />
            </button>
          </div>

          {/* Resize handle (bottom-right) */}
          <button
            aria-label="Resize asset"
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className="absolute -bottom-1.5 -right-1.5 z-10 size-3.5 rounded-sm border border-[#9BCD64] bg-background cursor-se-resize"
          />
        </>
      ) : null}
    </div>
  )
}
