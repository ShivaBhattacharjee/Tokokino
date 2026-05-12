"use client"

import * as React from "react"
import { toast } from "sonner"

import { BoxHoverActions } from "@/components/editor/canvas/box-hover-actions"
import { FramedScreenshotVisual } from "@/components/editor/canvas/framed-screenshot-visual"
import {
  assetFilterCss,
  enhanceFilterCss,
  type ScreenshotSlot,
  shadowDropFilterCss,
  useEditor,
} from "@/lib/editor/store"
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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Could not read file"))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export function ScreenshotSlotView({
  slot,
  canvasRef,
  canvasAspectRatio,
  onCropRequest,
}: {
  slot: ScreenshotSlot
  canvasRef: React.RefObject<HTMLDivElement | null>
  canvasAspectRatio: number
  onCropRequest: (slotId: string) => void
}) {
  const {
    selectedScreenshotSlotId,
    setSelectedScreenshotSlotId,
    setSelectedAssetId,
    setSelectedTextId,
    setSelectedAnnotationShapeId,
    updateScreenshotSlot,
    setScreenshotSlotImage,
    deleteScreenshotSlot,
    setIsScreenshotSelected,
  } = useEditor()
  const isSelected = selectedScreenshotSlotId === slot.id

  const elRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const select = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation()
    setSelectedScreenshotSlotId(slot.id)
    setSelectedAssetId(null)
    setSelectedTextId(null)
    setSelectedAnnotationShapeId(null)
    setIsScreenshotSelected(false)
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
        deleteScreenshotSlot(slot.id)
        setSelectedScreenshotSlotId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slot.id, deleteScreenshotSlot, isSelected, setSelectedScreenshotSlotId])

  const handleFiles = React.useCallback(
    async (files: FileList | File[] | null) => {
      const list = files ? Array.from(files) : []
      const imageFile = list.find((f) => f.type.startsWith("image/"))
      if (!imageFile) {
        toast.error("Please drop an image")
        return
      }
      try {
        const src = await readFileAsDataUrl(imageFile)
        setScreenshotSlotImage(slot.id, src)
      } catch {
        toast.error("Could not read image")
      }
    },
    [setScreenshotSlotImage, slot.id]
  )

  const startDrag = (e: React.PointerEvent<Element>) => {
    if (!canvasRef.current) return
    e.stopPropagation()
    select(e)
    const rect = canvasRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startXPct: slot.xPct,
      startYPct: slot.yPct,
      canvasW: rect.width,
      canvasH: rect.height,
      lastXPct: slot.xPct,
      lastYPct: slot.yPct,
      moved: false,
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100
    const nextX = Math.max(-20, Math.min(120, drag.startXPct + dxPct))
    const nextY = Math.max(-20, Math.min(120, drag.startYPct + dyPct))
    drag.lastXPct = nextX
    drag.lastYPct = nextY
    drag.moved = true
    const el = elRef.current
    if (el) {
      el.style.left = `${nextX}%`
      el.style.top = `${nextY}%`
    }
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (drag.moved) {
      updateScreenshotSlot(slot.id, {
        xPct: drag.lastXPct,
        yPct: drag.lastYPct,
      })
    }
    dragRef.current = null
  }

  const computedShadowFilter = shadowDropFilterCss(slot.shadow)
  const enhanceFilter = enhanceFilterCss(slot.enhance)
  const filterChain = [enhanceFilter, assetFilterCss(slot.filter)]
    .filter(Boolean)
    .join(" ")
    .trim()
  const contentTransform = [
    "perspective(1400px)",
    `rotateX(${slot.tilt.rx}deg)`,
    `rotateY(${slot.tilt.ry}deg)`,
    `rotateZ(${slot.tilt.rz}deg)`,
    `scale(${slot.scale / 100})`,
  ].join(" ")
  const boxAspectRatio = canvasAspectRatio < 0.85 ? "10 / 14" : "16 / 10"

  const containerStyle: React.CSSProperties = {
    left: `${slot.xPct}%`,
    top: `${slot.yPct}%`,
    width: `${slot.widthPct}%`,
    aspectRatio: boxAspectRatio,
    transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
    zIndex: 60 + slot.zIndex,
    display: slot.hidden ? "none" : undefined,
  }
  if (slot.blendMode && slot.blendMode !== "normal") {
    containerStyle.mixBlendMode = slot.blendMode
  }

  const contentStyle: React.CSSProperties = {
    padding: `${Math.max(0, Math.min(240, slot.padding)) / 12}%`,
  }

  const transformedStyle: React.CSSProperties = {
    transform: contentTransform,
    transformStyle: "preserve-3d",
    opacity: slot.opacity / 100,
  }

  const imageBoxOutline = slot.border
  const bareBorderRadius = slot.borderRadius

  const onBrowse = () => {
    setSelectedScreenshotSlotId(slot.id)
    setSelectedAssetId(null)
    setSelectedTextId(null)
    setSelectedAnnotationShapeId(null)
    setIsScreenshotSelected(false)
    fileInputRef.current?.click()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) void handleFiles(files)
          e.target.value = ""
        }}
      />

      <div
        ref={elRef}
        data-screenshot-slot-id={slot.id}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={select}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "group/slot absolute select-none",
          isSelected ? "cursor-grabbing" : "cursor-grab"
        )}
        style={containerStyle}
      >
        <div className="absolute inset-0" style={contentStyle}>
          <div
            className={cn(
              "relative h-full w-full",
              isSelected &&
                "outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
            )}
            style={transformedStyle}
          >
            <FramedScreenshotVisual
              src={slot.src}
              frame={slot.frame}
              onBrowse={onBrowse}
              isDragOver={isDragOver}
              imageFilter={filterChain || undefined}
              shadowFilter={computedShadowFilter}
              borderRadius={bareBorderRadius}
              outline={imageBoxOutline}
              addressValue={slot.frameAddress}
              onAddressChange={(value) =>
                updateScreenshotSlot(slot.id, { frameAddress: value })
              }
            />

            {slot.src ? (
              <BoxHoverActions
                hoverGroupClass="group-hover/slot:opacity-100"
                onCrop={() => onCropRequest(slot.id)}
                onReplaceFile={(file) => void handleFiles([file])}
                onDelete={() => {
                  deleteScreenshotSlot(slot.id)
                  setSelectedScreenshotSlotId(null)
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}


