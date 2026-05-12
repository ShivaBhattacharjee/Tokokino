"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  RiDeleteBinLine,
  RiRefreshLine,
  RiSparkling2Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { DeviceFrameEmptyContent } from "@/components/editor/canvas/device-frame-empty-content"
import {
  deviceMockupSpec,
  frameFitStyle,
  mockupScreenClipStyle,
  mockupScreenTransform,
} from "@/components/editor/canvas/helpers"
import {
  ToolbarButton,
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarPopover,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import { Arc } from "@/components/ui/arc"
import { Chrome } from "@/components/ui/chrome"
import { Safari } from "@/components/ui/safari"
import { Slider } from "@/components/ui/slider"
import {
  ARC_BROWSER_FRAME_ID,
  CHROME_BROWSER_FRAME_ID,
  isBrowserFrame,
  resolveBrowserFrameColor,
} from "@/lib/browser-frame"
import {
  assetFilterCss,
  enhanceFilterCss,
  MAX_SCREENSHOT_SLOTS,
  type ScreenshotSlot,
  shadowCss,
  shadowDropFilterCss,
  useEditor,
} from "@/lib/editor/store"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"
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
}: {
  slot: ScreenshotSlot
  canvasRef: React.RefObject<HTMLDivElement | null>
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
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)

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
  ])

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
  }

  const computedShadow = shadowCss(slot.shadow)
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

  const containerStyle: React.CSSProperties = {
    left: `${slot.xPct}%`,
    top: `${slot.yPct}%`,
    width: `${slot.widthPct}%`,
    height: `${slot.heightPct}%`,
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

  const imageBoxStyle: React.CSSProperties = {
    borderRadius: slot.borderRadius,
    boxShadow: computedShadow,
  }
  if (slot.border.color && slot.border.width > 0) {
    imageBoxStyle.outline = `${slot.border.width}px ${slot.border.style || "solid"} ${slot.border.color}`
    imageBoxStyle.outlineOffset = `${slot.border.padding || 0}px`
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
            <ScreenshotSlotContent
              slot={slot}
              isDragOver={isDragOver}
              imageBoxStyle={imageBoxStyle}
              filterChain={filterChain}
              shadowFilter={computedShadowFilter}
              onBrowse={() => {
                setSelectedScreenshotSlotId(slot.id)
                setSelectedAssetId(null)
                setSelectedTextId(null)
                setSelectedAnnotationShapeId(null)
                setIsScreenshotSelected(false)
                fileInputRef.current?.click()
              }}
            />
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
                    <ScreenshotSlotToolbar
                      slot={slot}
                      onDragHandlePointerDown={startDrag}
                      onDragHandlePointerMove={moveDrag}
                      onDragHandlePointerUp={endDrag}
                      onReplaceClick={() => fileInputRef.current?.click()}
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

function ScreenshotSlotContent({
  slot,
  isDragOver,
  imageBoxStyle,
  filterChain,
  shadowFilter,
  onBrowse,
}: {
  slot: ScreenshotSlot
  isDragOver: boolean
  imageBoxStyle: React.CSSProperties
  filterChain: string
  shadowFilter: string | undefined
  onBrowse: () => void
}) {
  const browserFrame = isBrowserFrame(slot.frame.id)

  if (browserFrame) {
    return (
      <BrowserSlotFrame
        slot={slot}
        filterChain={filterChain}
        shadowFilter={shadowFilter}
        onBrowse={onBrowse}
      />
    )
  }

  if (slot.frame.id !== "none") {
    return (
      <DeviceSlotFrame
        slot={slot}
        filterChain={filterChain}
        shadowFilter={shadowFilter}
        onBrowse={onBrowse}
      />
    )
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black/40"
      style={imageBoxStyle}
    >
      {slot.src ? (
        <img
          src={slot.src}
          alt=""
          draggable={false}
          className="block h-full w-full object-cover select-none"
          style={{
            filter: filterChain || undefined,
          }}
        />
      ) : (
        <ScreenshotSlotEmpty isDragOver={isDragOver} onBrowse={onBrowse} />
      )}
    </div>
  )
}

function BrowserSlotFrame({
  slot,
  filterChain,
  shadowFilter,
  onBrowse,
}: {
  slot: ScreenshotSlot
  filterChain: string
  shadowFilter: string | undefined
  onBrowse: () => void
}) {
  const color = resolveBrowserFrameColor(slot.frame.color)
  const colorMode = color === "dark" ? "dark" : "light"
  const frameStyle: React.CSSProperties = {
    filter: [shadowFilter, filterChain].filter(Boolean).join(" ") || undefined,
  }

  if (slot.frame.id === ARC_BROWSER_FRAME_ID) {
    return (
      <Arc
        imageSrc={slot.src ?? undefined}
        colorMode={colorMode}
        className="h-full w-full"
        style={frameStyle}
      >
        {!slot.src ? <ScreenshotSlotEmpty onBrowse={onBrowse} /> : null}
      </Arc>
    )
  }

  if (slot.frame.id === CHROME_BROWSER_FRAME_ID) {
    return (
      <Chrome
        imageSrc={slot.src ?? undefined}
        colorMode={colorMode}
        className="h-full w-full"
        style={frameStyle}
      >
        {!slot.src ? <ScreenshotSlotEmpty onBrowse={onBrowse} /> : null}
      </Chrome>
    )
  }

  return (
    <Safari
      imageSrc={slot.src ?? undefined}
      colorMode={colorMode}
      className="h-full w-full"
      style={frameStyle}
    >
      {!slot.src ? <ScreenshotSlotEmpty onBrowse={onBrowse} /> : null}
    </Safari>
  )
}

function DeviceSlotFrame({
  slot,
  filterChain,
  shadowFilter,
  onBrowse,
}: {
  slot: ScreenshotSlot
  filterChain: string
  shadowFilter: string | undefined
  onBrowse: () => void
}) {
  const mockupDevice = getDeviceMockup(slot.frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const mockupRotation =
    slot.frame.orientation === "horizontal" && mockupOrientation === "portrait"
      ? -90
      : 0
  const mockupAsset = getDeviceMockupAsset(
    slot.frame.id,
    slot.frame.color,
    mockupOrientation
  )
  const mockupSpec = mockupAsset ? deviceMockupSpec(slot.frame.id) : null
  const horizontalScreenStyle = mockupRotation
    ? rotatedScreenContentStyle(mockupSpec?.screen.aspectRatio, -mockupRotation)
    : undefined

  if (!mockupAsset || !mockupSpec) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black/40">
        {slot.src ? (
          <img
            src={slot.src}
            alt=""
            draggable={false}
            className="block h-full w-full object-cover select-none"
            style={{ filter: filterChain || undefined }}
          />
        ) : (
          <ScreenshotSlotEmpty onBrowse={onBrowse} />
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full" style={{ containerType: "size" }}>
      <div
        className="absolute top-1/2 left-1/2 max-h-full max-w-full"
        style={{
          ...frameFitStyle(mockupSpec.aspectRatio),
          transform: `translate(-50%, -50%)${
            mockupRotation ? ` rotate(${mockupRotation}deg)` : ""
          }`,
          filter:
            [shadowFilter, filterChain].filter(Boolean).join(" ") || undefined,
        }}
      >
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen),
              transform: mockupScreenTransform(mockupSpec.screen),
            }}
          >
            {slot.src ? (
              <img
                src={slot.src}
                alt=""
                draggable={false}
                className={cn(
                  "pointer-events-none max-w-none object-cover object-center select-none",
                  mockupRotation ? "absolute top-1/2 left-1/2" : "h-full w-full"
                )}
                style={horizontalScreenStyle}
              />
            ) : (
              <ScreenshotSlotEmpty onBrowse={onBrowse} />
            )}
          </div>
        </div>
        <img
          src={mockupAsset.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />
      </div>
    </div>
  )
}

function ScreenshotSlotEmpty({
  isDragOver = false,
  onBrowse,
}: {
  isDragOver?: boolean
  onBrowse: () => void
}) {
  return (
    <div
      data-drag-over={isDragOver}
      className="absolute inset-0 bg-black/35 data-[drag-over=true]:bg-primary/15"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
        backgroundSize: "16px 16px",
        containerType: "inline-size",
      }}
    >
      <DeviceFrameEmptyContent onBrowse={onBrowse} className="text-white" />
    </div>
  )
}

function rotatedScreenContentStyle(
  aspectRatio: string | undefined,
  rotation: number
): React.CSSProperties | undefined {
  if (!aspectRatio) return undefined
  const [w, h] = aspectRatio.split("/").map((part) => Number(part.trim()))
  if (!w || !h) return undefined
  const scale = Math.max(w / h, h / w)
  return {
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
}

type DragHandlers = {
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void
  onDragHandlePointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void
}

function ScreenshotSlotToolbar({
  slot,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
  onReplaceClick,
}: {
  slot: ScreenshotSlot
  onReplaceClick: () => void
} & DragHandlers) {
  const {
    deleteScreenshotSlot,
    duplicateScreenshotSlot,
    setSelectedScreenshotSlotId,
    setScreenshotSlotImage,
    updateScreenshotSlot,
  } = useEditor()

  return (
    <ToolbarSurface>
      <ToolbarDragHandle
        ariaLabel="Drag screenshot"
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerUp}
      />

      <ToolbarDivider />

      <ToolbarDeleteButton
        ariaLabel="Delete screenshot"
        onDelete={() => {
          deleteScreenshotSlot(slot.id)
          setSelectedScreenshotSlotId(null)
        }}
      />

      <ToolbarDuplicateButton
        ariaLabel="Duplicate screenshot"
        onDuplicate={() => {
          const id = duplicateScreenshotSlot(slot.id)
          if (id) setSelectedScreenshotSlotId(id)
          else toast(`Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`)
        }}
      />

      {slot.src ? (
        <ToolbarButton
          aria-label="Replace screenshot"
          tooltip="Replace"
          onClick={onReplaceClick}
        >
          <RiRefreshLine className="size-4" />
        </ToolbarButton>
      ) : null}

      {slot.src ? (
        <ToolbarButton
          aria-label="Clear image"
          tooltip="Clear image"
          onClick={() => setScreenshotSlotImage(slot.id, null)}
        >
          <RiDeleteBinLine className="size-4" />
        </ToolbarButton>
      ) : null}

      <ToolbarDivider />

      <ToolbarPopover
        tooltip="Style"
        contentClassName="w-64 p-3"
        trigger={({ open }) => (
          <ToolbarButton aria-label="Style" active={open}>
            <RiSparkling2Line className="size-4" />
          </ToolbarButton>
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Radius
              </span>
              <span className="font-mono text-[11px] text-foreground">
                {slot.borderRadius}px
              </span>
            </div>
            <Slider
              min={0}
              max={40}
              step={1}
              value={[slot.borderRadius]}
              onValueChange={([v]) =>
                updateScreenshotSlot(slot.id, { borderRadius: v })
              }
              className="cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Shadow
              </span>
              <span className="font-mono text-[11px] text-foreground">
                {slot.shadow.intensity}
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[slot.shadow.intensity]}
              onValueChange={([v]) =>
                updateScreenshotSlot(slot.id, {
                  shadow: { ...slot.shadow, intensity: v },
                })
              }
              className="cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Opacity
              </span>
              <span className="font-mono text-[11px] text-foreground">
                {slot.opacity}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[slot.opacity]}
              onValueChange={([v]) =>
                updateScreenshotSlot(slot.id, { opacity: v })
              }
              className="cursor-pointer"
            />
          </div>
        </div>
      </ToolbarPopover>
    </ToolbarSurface>
  )
}
