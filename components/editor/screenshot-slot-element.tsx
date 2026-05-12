"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

import { BoxHoverActions } from "@/components/editor/canvas/box-hover-actions"
import { FramedScreenshotVisual } from "@/components/editor/canvas/framed-screenshot-visual"
import { snapBoxToTarget } from "@/components/editor/canvas/helpers"
import {
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import {
  ARC_BROWSER_FRAME_ID,
  CHROME_BROWSER_FRAME_ID,
  isBrowserFrame,
  SAFARI_BROWSER_FRAME_ID,
} from "@/lib/browser-frame"
import {
  assetFilterCss,
  enhanceFilterCss,
  MAX_SCREENSHOT_SLOTS,
  type ScreenshotSlot,
  shadowDropFilterCss,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const frameSelectionRadius = (frameId: string, fallback: number) => {
  if (frameId === "none") return fallback
  if (frameId === CHROME_BROWSER_FRAME_ID) return 8
  if (frameId === SAFARI_BROWSER_FRAME_ID) return 14
  if (frameId === ARC_BROWSER_FRAME_ID) return 18
  if (isBrowserFrame(frameId)) return 12
  return 32
}

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
  onCenterGuideChange,
}: {
  slot: ScreenshotSlot
  canvasRef: React.RefObject<HTMLDivElement | null>
  canvasAspectRatio: number
  onCropRequest: (slotId: string) => void
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
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
    duplicateScreenshotSlot,
    bringScreenshotSlotToFront,
    sendScreenshotSlotToBack,
    setIsScreenshotSelected,
  } = useEditor()
  const isSelected = selectedScreenshotSlotId === slot.id

  const elRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)
  const [bareImageAspectRatio, setBareImageAspectRatio] = React.useState<
    string | null
  >(null)

  React.useEffect(() => {
    if (!isSelected || !elRef.current) {
      setToolbarRect(null)
      return
    }
    const el = elRef.current
    const update = () => setToolbarRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [isSelected])

  React.useEffect(() => {
    if (!isSelected || !elRef.current) return
    setToolbarRect(elRef.current.getBoundingClientRect())
  }, [
    isSelected,
    slot.xPct,
    slot.yPct,
    slot.widthPct,
    slot.heightPct,
    slot.rotation,
    canvasAspectRatio,
  ])

  React.useEffect(() => {
    if (!slot.src || slot.frame.id !== "none") {
      setBareImageAspectRatio(null)
      return
    }

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return
      setBareImageAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`)
    }
    image.onerror = () => {
      if (!cancelled) setBareImageAspectRatio(null)
    }
    image.src = slot.src

    return () => {
      cancelled = true
    }
  }, [slot.frame.id, slot.src])

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
    e.preventDefault()
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100
    let nextX = Math.max(-20, Math.min(120, drag.startXPct + dxPct))
    let nextY = Math.max(-20, Math.min(120, drag.startYPct + dyPct))
    const centerX = (nextX / 100) * drag.canvasW
    const centerY = (nextY / 100) * drag.canvasH
    const rect = elRef.current?.getBoundingClientRect()
    const snap = snapBoxToTarget({
      centerX,
      centerY,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      targetX: drag.canvasW / 2,
      targetY: drag.canvasH / 2,
    })
    nextX += (snap.deltaX / drag.canvasW) * 100
    nextY += (snap.deltaY / drag.canvasH) * 100
    drag.lastXPct = nextX
    drag.lastYPct = nextY
    drag.moved = true
    onCenterGuideChange?.(snap.guides)
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
      updateScreenshotSlot(slot.id, {
        xPct: drag.lastXPct,
        yPct: drag.lastYPct,
      })
    }
    dragRef.current = null
    onCenterGuideChange?.({ x: false, y: false })
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
  const boxAspectRatio =
    bareImageAspectRatio ?? (canvasAspectRatio < 0.85 ? "10 / 14" : "16 / 10")

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

  const imageBoxOutline = slot.border
  const bareBorderRadius = slot.borderRadius
  const selectionRadius = frameSelectionRadius(slot.frame.id, bareBorderRadius)
  const transformedStyle: React.CSSProperties = {
    transform: contentTransform,
    transformStyle: "preserve-3d",
    opacity: slot.opacity / 100,
    borderRadius: selectionRadius,
  }

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

      {isSelected && toolbarRect && typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              return (
                <div
                  data-editor-floating-toolbar-target={`slot:${slot.id}`}
                  className="pointer-events-none fixed z-100"
                  style={{
                    top,
                    left,
                    transform: flipBelow
                      ? "translate(-50%, 0)"
                      : "translate(-50%, -100%)",
                  }}
                >
                  <div className="pointer-events-auto">
                    <ToolbarSurface>
                      <ToolbarDragHandle
                        ariaLabel="Drag screenshot box"
                        onPointerDown={startDrag}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                      />
                      <ToolbarDivider />
                      <ToolbarDuplicateButton
                        ariaLabel="Duplicate screenshot box"
                        onDuplicate={() => {
                          const id = duplicateScreenshotSlot(slot.id)
                          if (id) setSelectedScreenshotSlotId(id)
                          else
                            toast(
                              `Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`
                            )
                        }}
                      />
                      <ToolbarDeleteButton
                        ariaLabel="Delete screenshot box"
                        onDelete={() => {
                          deleteScreenshotSlot(slot.id)
                          setSelectedScreenshotSlotId(null)
                        }}
                      />
                      <ToolbarLayerOrderMenu
                        onBringToFront={() =>
                          bringScreenshotSlotToFront(slot.id)
                        }
                        onSendToBack={() => sendScreenshotSlotToBack(slot.id)}
                      />
                    </ToolbarSurface>
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
