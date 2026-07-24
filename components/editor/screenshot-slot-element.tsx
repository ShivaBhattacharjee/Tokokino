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
import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import { ScreenshotFrameContent } from "@/components/editor/canvas/screenshot-frame-content"
import { ScreenshotStage } from "@/components/editor/canvas/screenshot-stage"
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
import { resolveSlotScreenshotStyle } from "@/lib/editor/store/canvas-helpers"
import { buildScreenshotImageStyle } from "@/lib/editor/screenshot-visual"
import { computeCropTarget, type CropTarget } from "@/lib/editor/crop-utils"
import { clipAffectsSlot, clipOwns } from "@/lib/editor/animation-playback"
import {
  type AssetBlendMode,
  type DeviceFrame,
  type EditorTool,
  type EnhancePreset,
  MAX_SCREENSHOT_SLOTS,
  type ScreenshotSlot,
  useActiveCanvasField,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import {
  fullPageCaptureMediaStyle,
  fullPageCaptureObjectFit,
  nextFullPageCaptureScrollPosition,
} from "@/lib/editor/full-page-capture"
import {
  afterPositionPreviewCleared,
  clearPositionPreviewVarsAfterPaint,
  setElementPositionPreview,
} from "@/lib/editor/live-preview-vars"
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
  onFullPageScroll: (scrollPosition: number) => void
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  previewMode?: boolean
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  /** Full-page demo screenshot (same semantics as API capture). */
  onDemo?: (src: string) => void | Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
}

type CanvasSharedStyle = {
  frame: DeviceFrame
  frameAddress: string
  enhance: EnhancePreset
  opacity: number
  blendMode: AssetBlendMode
}

// Canvas-level values a slot cannot override (frame, enhance, layer opacity /
// blend). Per-item style that DOES inherit lives in resolveSlotScreenshotStyle.
function useCanvasSharedStyle(): CanvasSharedStyle {
  return useActiveCanvasField((canvas) => ({
    frame: canvas.frame,
    frameAddress: canvas.frameAddress,
    enhance: canvas.enhance,
    opacity: canvas.screenshotLayer.opacity,
    blendMode: canvas.screenshotLayer.blendMode,
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
  onFullPageScroll,
  onPointerCancel,
  onDragOver,
  onDragLeave,
  onDrop,
  previewMode = false,
  onCapture,
  onDemo,
  captureDefaultDevice,
  captureStateKey,
}: ScreenshotSlotRenderProps) {
  const shared = useCanvasSharedStyle()
  // The slot→canvas inheritance rule lives once in resolveSlotScreenshotStyle.
  const resolved = useActiveCanvasField((canvas) =>
    resolveSlotScreenshotStyle(slot, canvas)
  )
  const effectivePadding = resolved.padding
  const effectiveLighting = resolved.lighting
  const effectiveBorderRadius = resolved.borderRadius

  // Whether an Animate-mode keyframe animates THIS slot's border / lighting.
  // Like the main screenshot (canvas-view), those overlays must always mount
  // when animated — even when the committed look is invisible — so the player
  // has a node to ease in from 0 / recolour via the preview vars. Suppressed in
  // preset previews (previewMode has no live animation).
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
  // A position-pad / group drag drives this slot via the live-preview vars while
  // it still carries its left/top easing, so it would ease ~300ms behind the pad
  // (preview appears offset from the committed spot). Drop the easing during that
  // drag, exactly like the slot's own on-canvas drag (isBeingDragged).
  const positionDragging = useEditorStore((s) => s.screenshotPositionDragging)
  const canvasClips = useActiveCanvasField((c) => c.animation?.clips ?? [])
  const slotOwns = React.useCallback(
    (effect: Parameters<typeof clipOwns>[1]) =>
      !previewMode &&
      isAnimateMode &&
      canvasClips.some(
        (c) => clipAffectsSlot(c, slot.id) && clipOwns(c, effect)
      ),
    [canvasClips, isAnimateMode, previewMode, slot.id]
  )
  const borderAnimated = slotOwns("border")
  const lightingAnimated = slotOwns("lighting")

  const innerLightingStyle =
    effectiveLighting.target === "inner" || lightingAnimated
      ? lightingOverlayCss(effectiveLighting, {
          inner: true,
          active: effectiveLighting.target === "inner",
          forceMount: lightingAnimated,
        })
      : null

  const fullPageMediaStyle = fullPageCaptureMediaStyle(slot.fullPageCapture)
  const effectiveObjectFit = fullPageCaptureObjectFit(
    slot.fullPageCapture,
    slot.objectFit ?? "contain"
  )

  // Shared image-box math — identical to the main screenshot's, only the live
  // tilt/scale var namespace and the per-item asset filter differ.
  const {
    transform: contentTransform,
    imgStyle: bareImgStyle,
    shadowFilter: computedShadowFilter,
    filterChain,
  } = buildScreenshotImageStyle({
    style: resolved,
    enhance: shared.enhance,
    assetFilter: slot.filter,
    transformVarPrefix: "slot-ts",
    borderAnimated,
    fullPageMediaStyle,
  })

  // A slot can override the canvas frame; everything geometry/frame-related
  // reads this, not the canvas frame.
  const effectiveFrame = slot.frame ?? shared.frame
  const boxAspectRatio = slotBoxAspectRatio(effectiveFrame, canvasAspectRatio)
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
      previewMode || isBeingDragged || positionDragging
        ? undefined
        : "left 300ms ease-out, top 300ms ease-out",
  }
  if (shared.blendMode && shared.blendMode !== "normal") {
    containerStyle.mixBlendMode = shared.blendMode
  }

  const selectionRadius = frameSelectionRadius(
    effectiveFrame.id,
    effectiveBorderRadius
  )
  const transformedStyle: React.CSSProperties = {
    opacity: shared.opacity / 100,
    borderRadius: selectionRadius,
  }

  const animationPlayer = useAnimationPlayerOptional()
  const isAnimationPlaying = animationPlayer?.isPlaying ?? false
  const showEditMenu = !previewMode && !isAnimationPlaying && Boolean(slot.src)
  const editMenu = showEditMenu ? (
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
        allowVideo={false}
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
        captureDefaultOrientation={effectiveFrame.orientation}
        captureStateKey={captureStateKey}
      />
    </div>
  ) : null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={containerRef}
      data-box-hover-target={previewMode ? undefined : ""}
      data-screenshot-slot-id={previewMode ? undefined : slot.id}
      data-editor-shadow-preview-scope={previewMode ? undefined : slot.id}
      data-export-stack="foreground"
      onPointerDown={previewMode ? undefined : onPointerDown}
      onPointerMove={previewMode ? undefined : onPointerMove}
      onPointerUp={previewMode ? undefined : onPointerUp}
      onPointerCancel={
        previewMode ? undefined : (onPointerCancel ?? onPointerUp)
      }
      onWheel={
        previewMode || !slot.fullPageCapture
          ? undefined
          : (event) => {
              const next = nextFullPageCaptureScrollPosition(
                event.deltaY,
                slot.fullPageCapture!.scrollPosition
              )
              if (next === slot.fullPageCapture!.scrollPosition) return
              event.preventDefault()
              event.stopPropagation()
              onFullPageScroll(next)
            }
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
        <ScreenshotStage
          padding={effectivePadding}
          transformedBoxStyle={transformedStyle}
          selectionRadius={selectionRadius}
          contentTransform={contentTransform}
          showSelectionBorder={
            isSelected &&
            !previewMode &&
            (effectiveFrame.id !== "none" || !slot.src)
          }
          editMenu={editMenu}
        >
          <ScreenshotFrameContent
            src={slot.src}
            frame={effectiveFrame}
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            // Extra slots are never the sole screenshot, so no video here.
            allowVideo={false}
            imageFilter={filterChain || undefined}
            shadowFilter={computedShadowFilter}
            contentTransform={contentTransform}
            bareStyle={bareImgStyle}
            applyTransformWhenEmpty
            suppressEmptyTransition
            // Slots position via their own container; never inherit the main
            // screenshot's live-drag vars, or dragging the main moves the slot.
            readMainPreviewVars={false}
            emptyCompact={Boolean(rowLayout)}
            objectFit={effectiveObjectFit}
            mediaStyle={fullPageMediaStyle}
            isScreenshotSelected={isSelected && !previewMode}
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
            onDemo={onDemo}
            captureDefaultDevice={captureDefaultDevice}
            captureStateKey={captureStateKey}
          />
        </ScreenshotStage>
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
    setFullPageScreenshotSlot,
    setFullPageScreenshotSlotScrollPosition,
    deleteScreenshotSlot,
    duplicateScreenshotSlot,
    bringScreenshotSlotToFront,
    sendScreenshotSlotToBack,
    setIsScreenshotSelected,
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

  const captureDefaultDevice = defaultCaptureDeviceForFrame(
    slot.frame ?? canvasFrame
  )
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
        // API captures are always full-page (screenshotOptions.fullPage).
        setFullPageScreenshotSlot(slot.id, dataUrl)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not capture screenshot"
        )
      }
    },
    [setFullPageScreenshotSlot, slot.id]
  )

  /** Pre-captured R2 demos are full-page PNGs — same path as /api/screenshot. */
  const handleSlotDemo = React.useCallback(
    (src: string) => {
      setFullPageScreenshotSlot(slot.id, src)
    },
    [setFullPageScreenshotSlot, slot.id]
  )

  const handleFullPageScroll = React.useCallback(
    (scrollPosition: number) =>
      setFullPageScreenshotSlotScrollPosition(slot.id, scrollPosition),
    [setFullPageScreenshotSlotScrollPosition, slot.id]
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

  const setScreenshotPositionDragging = useEditorStore(
    (s) => s.setScreenshotPositionDragging
  )

  const startDrag = (e: React.PointerEvent<Element>) => {
    if (!canvasRef.current) return
    e.stopPropagation()
    e.preventDefault()
    select(e)
    setIsBeingDragged(true)
    // Stop AnimationLayer from overwriting --editor-position-* while we drag.
    setScreenshotPositionDragging(true)
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
      // Drive the same CSS vars the slot's left/top read (and AnimationLayer
      // would write). Survives React re-renders from toolbar measure; direct
      // style.left would get clobbered by the style prop on the next paint.
      setElementPositionPreview(el, { xPct: nextX, yPct: nextY })
      setToolbarRect(el.getBoundingClientRect())
    }
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const el = elRef.current
    if (drag.moved) {
      try {
        updateScreenshotSlot(slot.id, {
          xPct: drag.lastXPct,
          yPct: drag.lastYPct,
        })
      } finally {
        clearPositionPreviewVarsAfterPaint([el])
      }
    }
    dragRef.current = null
    setIsBeingDragged(false)
    onCenterGuideChange?.({ x: false, y: false })
    // Hold the flag until after the preview-var clear paints so AnimationLayer
    // doesn't re-apply the pre-drag sampled pose for a frame.
    afterPositionPreviewCleared(() => setScreenshotPositionDragging(false))
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
        onFullPageScroll={handleFullPageScroll}
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
        onDemo={handleSlotDemo}
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
                          frame={slot.frame ?? canvasFrame}
                          onFrameChange={(frame) =>
                            updateScreenshotSlot(slot.id, { frame })
                          }
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
