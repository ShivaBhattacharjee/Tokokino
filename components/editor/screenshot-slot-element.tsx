"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { RiFullscreenLine, RiSmartphoneLine } from "@remixicon/react"
import { toast } from "sonner"

import {
  frameSelectionRadius,
  lightingOverlayCss,
  snapBoxToTarget,
} from "@/components/editor/canvas/helpers"
import {
  ScreenshotEditMenu,
  ScreenshotFrameSettings,
} from "@/components/editor/canvas/screenshot-edit-menu"
import { ScreenshotFrameContent } from "@/components/editor/canvas/screenshot-frame-content"
import type {
  CaptureDevice,
  CaptureSettings,
} from "@/components/editor/canvas/upload-card"
import { defaultCaptureDeviceForFrame } from "@/lib/mockups"
import { ImageFitPicker } from "@/components/editor/toolbar/image-fit-picker"
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
import { slotBoxAspectRatio } from "@/lib/editor/screenshot-layout"
import { computeCropTarget, type CropTarget } from "@/lib/editor/crop-utils"
import {
  shadowBoxShadowCss,
  shadowCss,
  shadowDropFilterCss,
} from "@/lib/editor/css-utils"
import {
  assetFilterCss,
  type AssetBlendMode,
  type BackdropLighting,
  type Border,
  type DeviceFrame,
  type EditorTool,
  type EnhancePreset,
  enhanceFilterCss,
  MAX_SCREENSHOT_SLOTS,
  type ScreenshotSlot,
  type Shadow,
  useActiveCanvasField,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { cn } from "@/lib/utils"

/**
 * Pure presentational core for a screenshot slot. Used by:
 *  - the interactive {@link ScreenshotSlotView} (with full callbacks)
 *  - the preset preview (with `previewMode` and no-op callbacks)
 *
 * Keeping a single render path means visual changes — selection outline,
 * frame fitting, hover edit menu — show up consistently in both places.
 */
type ScreenshotSlotRenderProps = {
  slot: ScreenshotSlot
  canvasAspectRatio: number
  rowLayout?: { widthPct: number; xPct: number } | null
  containerRef?: React.Ref<HTMLDivElement>
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  isSelected: boolean
  isDragOver: boolean
  isBeingDragged: boolean
  activeTool: EditorTool
  editOpen: boolean
  onEditOpenChange: (open: boolean) => void
  bulkCanvasDragging: boolean
  canDeleteSlot: boolean
  onSelect: (e: { stopPropagation: () => void }) => void
  onBrowse: () => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDeleteFromMenu: () => void
  onAddressChange: (value: string) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  previewMode?: boolean
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
}

type CanvasSharedStyle = {
  frame: DeviceFrame
  frameAddress: string
  padding: number
  borderRadius: number
  shadow: Shadow
  border: Border
  enhance: EnhancePreset
  opacity: number
  blendMode: AssetBlendMode
  lighting: BackdropLighting
}

function useCanvasSharedStyle(): CanvasSharedStyle {
  return useActiveCanvasField((canvas) => ({
    frame: canvas.frame,
    frameAddress: canvas.frameAddress,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    shadow: canvas.shadow,
    border: canvas.border,
    enhance: canvas.enhance,
    opacity: canvas.screenshotLayer.opacity,
    blendMode: canvas.screenshotLayer.blendMode,
    lighting: canvas.backdrop.lighting,
  }))
}

export function ScreenshotSlotRender({
  slot,
  canvasAspectRatio,
  rowLayout,
  containerRef,
  stageRef,
  imageRef,
  isSelected,
  isDragOver,
  isBeingDragged,
  activeTool,
  editOpen,
  onEditOpenChange,
  bulkCanvasDragging,
  onSelect,
  onBrowse,
  onCropClick,
  onReplaceFile,
  onDeleteFromMenu,
  onAddressChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDragOver,
  onDragLeave,
  onDrop,
  previewMode = false,
  onCapture,
  captureDefaultDevice,
  captureStateKey,
}: ScreenshotSlotRenderProps) {
  const shared = useCanvasSharedStyle()
  const effectiveShadow = slot.shadow ?? shared.shadow
  const effectiveBorder = slot.border ?? shared.border
  const effectiveBorderRadius = slot.borderRadius ?? shared.borderRadius
  const effectivePadding = slot.padding ?? shared.padding
  const effectiveLighting = slot.lighting ?? shared.lighting
  const computedShadowFilter = shadowDropFilterCss(effectiveShadow)
  const enhanceFilter = enhanceFilterCss(shared.enhance)
  const innerLightingStyle =
    effectiveLighting.target === "inner"
      ? lightingOverlayCss(effectiveLighting, { inner: true })
      : null
  const filterChain = [enhanceFilter, assetFilterCss(slot.filter)]
    .filter(Boolean)
    .join(" ")
    .trim()
  const contentTransform = [
    "perspective(1400px)",
    `rotateX(var(--slot-ts-rx, ${slot.tilt.rx}deg))`,
    `rotateY(var(--slot-ts-ry, ${slot.tilt.ry}deg))`,
    `rotateZ(var(--slot-ts-rz, ${slot.tilt.rz}deg))`,
    `scale(var(--slot-ts-scale, ${slot.scale / 100}))`,
  ].join(" ")
  const boxAspectRatio = slotBoxAspectRatio(shared.frame, canvasAspectRatio)
  const effectiveWidthPct = rowLayout?.widthPct ?? slot.widthPct

  const containerStyle: React.CSSProperties = {
    left: `var(--editor-position-x, ${slot.xPct}%)`,
    top: `var(--editor-position-y, ${slot.yPct}%)`,
    width: `${effectiveWidthPct}%`,
    aspectRatio: boxAspectRatio,
    transform: `translate(-50%, -50%) rotate(var(--slot-ts-rot, ${slot.rotation}deg))`,
    zIndex: 60 + slot.zIndex,
    display: slot.hidden ? "none" : undefined,
    transition:
      previewMode || isBeingDragged
        ? undefined
        : "left 300ms ease-out, top 300ms ease-out",
  }
  if (shared.blendMode && shared.blendMode !== "normal") {
    containerStyle.mixBlendMode = shared.blendMode
  }

  const contentStyle: React.CSSProperties = {
    padding: `var(--editor-padding-preview, ${Math.max(0, Math.min(240, effectivePadding)) / 12}%)`,
  }

  const imageBoxOutline = effectiveBorder
  const bareBorderRadius = effectiveBorderRadius
  const selectionRadius = frameSelectionRadius(
    shared.frame.id,
    bareBorderRadius
  )
  const transformedStyle: React.CSSProperties = {
    opacity: shared.opacity / 100,
    borderRadius: selectionRadius,
  }
  const bareImgStyle: React.CSSProperties = {
    borderRadius: bareBorderRadius,
    boxShadow: shadowBoxShadowCss(shadowCss(effectiveShadow)),
    filter: filterChain || undefined,
    transform: contentTransform,
    transformStyle: "preserve-3d" as const,
  }
  if (imageBoxOutline?.color && imageBoxOutline.width > 0) {
    bareImgStyle.outline = `${imageBoxOutline.width}px ${imageBoxOutline.style || "solid"} ${imageBoxOutline.color}`
    bareImgStyle.outlineOffset = `${imageBoxOutline.padding || 0}px`
  }

  const showEditMenu = !previewMode && Boolean(slot.src)

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={containerRef}
      data-box-hover-target={previewMode ? undefined : ""}
      data-screenshot-slot-id={previewMode ? undefined : slot.id}
      data-editor-shadow-preview-scope={previewMode ? undefined : slot.id}
      onPointerDown={previewMode ? undefined : onPointerDown}
      onPointerMove={previewMode ? undefined : onPointerMove}
      onPointerUp={previewMode ? undefined : onPointerUp}
      onPointerCancel={
        previewMode ? undefined : (onPointerCancel ?? onPointerUp)
      }
      onClick={previewMode ? undefined : onSelect}
      onDragOver={previewMode ? undefined : onDragOver}
      onDragLeave={previewMode ? undefined : onDragLeave}
      onDrop={previewMode ? undefined : onDrop}
      className={cn(
        "group/slot nodrag nopan absolute select-none",
        previewMode
          ? "pointer-events-none"
          : isSelected
            ? "cursor-grabbing"
            : "cursor-grab"
      )}
      style={containerStyle}
    >
      <motion.div
        className="absolute inset-0"
        initial={previewMode ? false : { opacity: 0, scale: 0.82 }}
        animate={previewMode ? undefined : { opacity: 1, scale: 1 }}
        exit={previewMode ? undefined : { opacity: 0, scale: 0.82 }}
        transition={
          previewMode
            ? undefined
            : { type: "spring", stiffness: 420, damping: 28, mass: 0.75 }
        }
      >
        <div className="absolute inset-0" style={contentStyle}>
          <div className="relative h-full w-full" style={transformedStyle}>
            {isSelected && !previewMode ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
                style={{
                  transform: contentTransform,
                  transformStyle: "preserve-3d",
                  borderRadius: selectionRadius,
                }}
              />
            ) : null}
            <ScreenshotFrameContent
              src={slot.src}
              frame={shared.frame}
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              imageFilter={filterChain || undefined}
              shadowFilter={computedShadowFilter}
              contentTransform={contentTransform}
              bareStyle={bareImgStyle}
              applyTransformWhenEmpty
              suppressEmptyTransition
              emptyCompact={Boolean(rowLayout)}
              objectFit={slot.objectFit ?? "contain"}
              activeTool={activeTool}
              isDragging={false}
              stageRef={stageRef}
              imageRef={imageRef}
              addressValue={shared.frameAddress}
              onAddressChange={onAddressChange}
              onSelect={onSelect}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onCrop={onCropClick}
              onReplaceFile={onReplaceFile}
              onDelete={onDeleteFromMenu}
              innerLightingStyle={innerLightingStyle}
              onCapture={onCapture}
              captureDefaultDevice={captureDefaultDevice}
              captureStateKey={captureStateKey}
            />

            {showEditMenu ? (
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 left-1/2 z-20 transition-opacity duration-200",
                  editOpen || isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover/slot:opacity-100",
                  bulkCanvasDragging && !editOpen && "!opacity-0"
                )}
                style={{
                  transform: `translate(-50%, -50%) ${contentTransform}`,
                  transformOrigin: "center",
                  transformStyle: "preserve-3d",
                }}
              >
                <ScreenshotEditMenu
                  open={editOpen}
                  onOpenChange={(open) => {
                    if (bulkCanvasDragging) {
                      onEditOpenChange(false)
                      return
                    }
                    onEditOpenChange(open)
                  }}
                  onCrop={onCropClick}
                  onReplaceFile={onReplaceFile}
                  onDelete={onDeleteFromMenu}
                  onCaptureWebsite={onCapture}
                  captureDefaultDevice={captureDefaultDevice}
                  captureDefaultOrientation={shared.frame.orientation}
                  captureStateKey={captureStateKey}
                />
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  )
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
  readImageFileAsDataUrl(file, {
    downscaleAbove: 10 * 1024 * 1024,
    maxDimension: 2400,
  })

export function ScreenshotSlotView({
  slot,
  canvasRef,
  canvasAspectRatio,
  rowLayout,
  onCropRequest,
  onCenterGuideChange,
  previewMode = false,
}: {
  slot: ScreenshotSlot
  canvasRef: React.RefObject<HTMLDivElement | null>
  canvasAspectRatio: number
  rowLayout?: { widthPct: number; xPct: number } | null
  onCropRequest: (request: CropTarget & { slotId: string }) => void
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
  previewMode?: boolean
}) {
  const {
    activeTool,
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
    setFrame,
    setFrameAddress,
    frame: canvasFrame,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
  } = useEditor()
  const presetTab = useEditorStore((s) => s.presetTab)
  const isSelected = selectedScreenshotSlotId === slot.id
  const canDeleteSlot = presetTab !== "multi" && presetTab !== "triple"
  const [slotEditOpen, setSlotEditOpen] = React.useState(false)

  const elRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [isBeingDragged, setIsBeingDragged] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const { toolbarRect, hideFloatingToolbar, measureRect, setToolbarRect } =
    useFloatingToolbarRect({
      elRef,
      isSelected,
      bulkCanvasDragging,
      kind: "slot",
      elementId: slot.id,
    })

  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected) return
    measureRect()
  }, [
    bulkCanvasDragging,
    isSelected,
    measureRect,
    slot.xPct,
    slot.yPct,
    slot.widthPct,
    slot.heightPct,
    slot.rotation,
    canvasAspectRatio,
    rowLayout?.widthPct,
    rowLayout?.xPct,
  ])

  const select = (e: { stopPropagation: () => void }) => {
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
      if (canDeleteSlot && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault()
        deleteScreenshotSlot(slot.id)
        setSelectedScreenshotSlotId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    slot.id,
    canDeleteSlot,
    deleteScreenshotSlot,
    isSelected,
    setSelectedScreenshotSlotId,
  ])

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

  const captureDefaultDevice = defaultCaptureDeviceForFrame(canvasFrame)
  const captureStateKey = `slot:${slot.id}`
  const handleSlotCapture = React.useCallback(
    async (rawUrl: string, settings: CaptureSettings) => {
      let target: URL
      try {
        target = new URL(rawUrl)
      } catch {
        toast.error("Enter a valid URL")
        return
      }
      try {
        const res = await fetch("/api/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: target.toString(),
            device: settings.device,
            width: settings.width,
            aspectRatio: settings.aspectRatio,
            delay: settings.delay,
          }),
        })
        if (!res.ok) {
          const { error } = (await res
            .json()
            .catch(() => ({ error: "Capture failed" }))) as { error?: string }
          throw new Error(error ?? "Capture failed")
        }
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () =>
            resolve(typeof fr.result === "string" ? fr.result : "")
          fr.onerror = () => reject(fr.error ?? new Error("FileReader error"))
          fr.readAsDataURL(blob)
        })
        setScreenshotSlotImage(slot.id, dataUrl)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not capture screenshot"
        )
      }
    },
    [setScreenshotSlotImage, slot.id]
  )

  const requestCrop = React.useCallback(() => {
    const target = computeCropTarget({
      frame: canvasFrame,
      objectFit: slot.objectFit ?? "contain",
      stageElement: stageRef.current,
      imageElement: imageRef.current,
      fallbackAspect: canvasAspectRatio,
    })
    onCropRequest({
      slotId: slot.id,
      ...target,
      initialRegion: slot.lastCropRegion ?? target.initialRegion,
    })
  }, [
    canvasAspectRatio,
    canvasFrame,
    imageRef,
    onCropRequest,
    slot.id,
    slot.lastCropRegion,
    slot.objectFit,
    stageRef,
  ])

  const startDrag = (e: React.PointerEvent<Element>) => {
    if (!canvasRef.current) return
    e.stopPropagation()
    e.preventDefault()
    select(e)
    setIsBeingDragged(true)
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
    e.currentTarget.setPointerCapture(e.pointerId)
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
    setIsBeingDragged(false)
    onCenterGuideChange?.({ x: false, y: false })
  }

  const onBrowse = () => {
    setSelectedScreenshotSlotId(slot.id)
    setSelectedAssetId(null)
    setSelectedTextId(null)
    setSelectedAnnotationShapeId(null)
    setIsScreenshotSelected(false)
    fileInputRef.current?.click()
  }

  const handleDeleteFromMenu = () => {
    setScreenshotSlotImage(slot.id, null)
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

      <ScreenshotSlotRender
        slot={slot}
        canvasAspectRatio={canvasAspectRatio}
        rowLayout={rowLayout}
        containerRef={elRef}
        stageRef={stageRef}
        imageRef={imageRef}
        previewMode={previewMode}
        isSelected={isSelected && !previewMode}
        isDragOver={isDragOver}
        isBeingDragged={isBeingDragged}
        activeTool={activeTool}
        editOpen={slotEditOpen}
        onEditOpenChange={setSlotEditOpen}
        bulkCanvasDragging={bulkCanvasDragging}
        canDeleteSlot={canDeleteSlot}
        onSelect={select}
        onBrowse={onBrowse}
        onCropClick={requestCrop}
        onReplaceFile={(file) => void handleFiles([file])}
        onDeleteFromMenu={handleDeleteFromMenu}
        onAddressChange={(value) => setFrameAddress(value)}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
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
        onCapture={handleSlotCapture}
        captureDefaultDevice={captureDefaultDevice}
        captureStateKey={captureStateKey}
      />

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
                  data-editor-floating-toolbar-target={`slot:${slot.id}`}
                  className="pointer-events-none fixed z-40"
                  style={{
                    top,
                    left,
                    transform: floatingToolbarTransform(flipBelow, scale),
                    transformOrigin: flipBelow ? "top center" : "bottom center",
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
                      {canDeleteSlot && (
                        <>
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
                        </>
                      )}
                      <ToolbarPopover
                        tooltip="Frame"
                        contentClassName="w-64 p-2"
                        trigger={({ open }) => (
                          <ToolbarButton aria-label="Frame" active={open}>
                            <RiSmartphoneLine className="size-4" />
                          </ToolbarButton>
                        )}
                      >
                        <ScreenshotFrameSettings
                          frame={canvasFrame}
                          onFrameChange={(frame) => setFrame(frame)}
                        />
                      </ToolbarPopover>
                      {slot.src && (
                        <>
                          <ToolbarDivider />
                          <ToolbarPopover
                            tooltip="Image fit"
                            contentClassName="w-44 p-2"
                            trigger={({ open }) => (
                              <ToolbarButton
                                aria-label="Image fit"
                                active={open}
                              >
                                <RiFullscreenLine className="size-4" />
                              </ToolbarButton>
                            )}
                          >
                            <ImageFitPicker
                              value={slot.objectFit ?? "cover"}
                              onChange={(fit) =>
                                updateScreenshotSlot(slot.id, {
                                  objectFit: fit,
                                })
                              }
                            />
                          </ToolbarPopover>
                        </>
                      )}
                      {canDeleteSlot ? (
                        <ToolbarDeleteButton
                          ariaLabel="Delete screenshot box"
                          onDelete={() => {
                            deleteScreenshotSlot(slot.id)
                            setSelectedScreenshotSlotId(null)
                          }}
                        />
                      ) : null}
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
