"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { CropModal } from "@/components/editor/crop-modal"
import { AnnotationShapeElement } from "@/components/editor/annotation-shape-element"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import { bulkToolbarScale } from "@/components/editor/toolbar/primitives"
import { cn } from "@/lib/utils"
import { isBrowserFrame, resolveBrowserFrameColor } from "@/lib/browser-frame"
import {
  shadowBoxShadowCss,
  shadowCss,
  shadowDropFilterCss,
} from "@/lib/editor/css-utils"
import {
  CanvasPreviewScope,
  CanvasScope,
  type CanvasState,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  screenshotPositionAnchor,
  useCanvasPreviewMode,
  useCanvasScopeId,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import type { CaptureSettings } from "./canvas/upload-card"
import {
  defaultCaptureDeviceForFrame,
  getDeviceMockup,
  getDeviceMockupAsset,
} from "@/lib/mockups"

import { AnnotationLayer } from "./canvas/annotation-layer"
import { CanvasBackdrop } from "./canvas/canvas-backdrop"
import { CanvasEmptyState } from "./canvas/canvas-empty-state"
import { CenterGuides, useCenterGuides } from "./canvas/center-guides"
import { BASE_CANVAS_WIDTH } from "./canvas/constants"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import { MockupEmptyState } from "./canvas/mockup-empty-state"
import {
  deviceMockupSpec,
  lightingOverlayCss,
  screenshotPlacementStyle,
} from "./canvas/helpers"
import { MainScreenshotRowItem } from "./canvas/main-screenshot-row-item"
import { ScreenshotBare } from "./canvas/screenshot-bare"
import {
  BrowserFrameEmptyState,
  ScreenshotBrowserFrame,
} from "./canvas/screenshot-browser-frame"
import { ScreenshotMockup } from "./canvas/screenshot-mockup"
import { BulkCanvasFlow } from "./bulk-canvas-flow"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { ScreenshotSlotView } from "./screenshot-slot-element"
import { useAnnotationInteractions } from "./canvas/use-annotation-interactions"
import { useImageFileIntake } from "./canvas/use-image-file-intake"
import { usePlacementMeasurement } from "./canvas/use-placement-measurement"
import { useScreenshotDrag } from "./canvas/use-screenshot-drag"
import { useSuppressTransitionOnChange } from "./canvas/use-suppress-transition-on-change"

type CanvasViewProps = {
  canvasId: string
  isActive: boolean
  widthPx: number
  heightPx: number
  effectiveScale: number
  onActivate: () => void
  previewMode?: boolean
  canvasOverride?: Partial<CanvasState> | null
}

function CanvasViewInner({
  isActive,
  widthPx,
  heightPx,
  effectiveScale,
  onActivate,
}: Omit<CanvasViewProps, "canvasId">) {
  const {
    activeTool,
    screenshot,
    originalScreenshot,
    lastCropRegion,
    aspect,
    background,
    padding,
    borderRadius,
    border,
    backdrop,
    tilt,
    scale,
    screenshotPosition,
    screenshotOffset,
    screenshotLayer,
    shadow,
    overlay,
    frame,
    setFrame,
    frameAddress,
    setFrameAddress,
    portrait,
    enhance,
    annotation,
    annotations,
    annotationShapes,
    canvasBorderRadius,
    setScreenshot,
    applyCroppedScreenshot,
    setScreenshotOffset,
    setScreenshotPlacement,
    texts,
    selectedTextId,
    setSelectedTextId,
    updateText,
    assets,
    updateAsset,
    setSelectedAssetId,
    screenshotSlots,
    setSelectedScreenshotSlotId,
    setScreenshotSlotImage,
    addScreenshotSlot,
    bringScreenshotToFront,
    sendScreenshotToBack,
    addAnnotationStroke,
    updateAnnotationStroke,
    addAnnotationShape,
    updateAnnotationShape,
    deleteAnnotationShape,
    setSelectedAnnotationShapeId,
    isScreenshotSelected,
    setIsScreenshotSelected,
    objectFit,
    setObjectFit,
  } = useEditor()
  const scopeId = useCanvasScopeId()
  const isCanvasPreview = useCanvasPreviewMode()
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const bulkCanvasDragging = useEditorStore((s) => s.bulkCanvasDragging)
  const bulkViewportZoom = useEditorStore((s) => s.bulkViewportZoom)
  const presetTab = useEditorStore((s) => s.presetTab)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const generatedAnnotationMaskId = React.useId()
  const annotationMaskId = `annotation-mask-${generatedAnnotationMaskId.replace(/:/g, "")}`
  const sortedAnnotationShapes = React.useMemo(
    () => [...annotationShapes].sort((a, b) => a.zIndex - b.zIndex),
    [annotationShapes]
  )

  React.useEffect(() => {
    if (isCanvasPreview) return
    if (!selectedTextId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTextId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isCanvasPreview, selectedTextId, setSelectedTextId])

  const [naturalDims, setNaturalDims] = React.useState<{
    w: number
    h: number
  } | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false)
  const [croppingSlotId, setCroppingSlotId] = React.useState<string | null>(
    null
  )
  const [centerGuides, updateCenterGuides] = useCenterGuides()
  const [textCenterGuides, updateTextCenterGuides] = useCenterGuides()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const annotationLayerRef = React.useRef<SVGSVGElement>(null)
  const suppressTransitionPadding = useSuppressTransitionOnChange(padding)
  const suppressTransitionSlots = useSuppressTransitionOnChange(
    screenshotSlots.length
  )
  const suppressTransition =
    suppressTransitionPadding || suppressTransitionSlots
  const inRowMode = screenshotSlots.length > 0
  const { placementDims, measurePlacement } = usePlacementMeasurement({
    enabled: Boolean(screenshot),
    stageRef,
    imageRef,
    layoutKey: `${inRowMode ? "row" : "single"}:${frame.id}:${frame.orientation}:${screenshotSlots.length}:${widthPx}:${heightPx}:${padding}`,
  })
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const setMainScreenshotImage = React.useCallback(
    (src: string) => {
      setScreenshot(src)
      setNaturalDims(null)
    },
    [setScreenshot]
  )
  const handleImageFile = React.useCallback(
    (src: string) => {
      if (selectedScreenshotSlotId) {
        setScreenshotSlotImage(selectedScreenshotSlotId, src)
        return
      }
      setMainScreenshotImage(src)
    },
    [selectedScreenshotSlotId, setMainScreenshotImage, setScreenshotSlotImage]
  )
  const { fileInputRef, fileInputProps, isDragOver, readFile, dropHandlers } =
    useImageFileIntake(handleImageFile)

  const handleCaptureWebsite = React.useCallback(
    async (
      rawUrl: string,
      settings: CaptureSettings
    ) => {
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
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : "")
          fr.onerror = () => reject(fr.error ?? new Error("FileReader error"))
          fr.readAsDataURL(blob)
        })
        setMainScreenshotImage(dataUrl)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not capture screenshot"
        )
      }
    },
    [setMainScreenshotImage]
  )

  const isAuto = aspect.id === "auto" || aspect.w === 0 || aspect.h === 0
  const canUseNaturalCanvasAspect =
    isAuto && naturalDims && !inRowMode && frame.id === "none"
  const autoDims = canUseNaturalCanvasAspect ? naturalDims : null
  const aw = autoDims ? autoDims.w : aspect.w || 16
  const ah = autoDims ? autoDims.h : aspect.h || 10
  const aspectRatio = `${aw} / ${ah}`
  const canvasAspectRatio = aw / ah
  const isPortraitOrSquareCanvas = ah >= aw
  const browserFrame = isBrowserFrame(frame.id)
  const browserFrameColor = resolveBrowserFrameColor(frame.color)
  const mockupDevice =
    frame.id === "none" || browserFrame ? null : getDeviceMockup(frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const isVerticalPortraitDevice =
    frame.orientation === "vertical" &&
    mockupDevice?.orientations.includes("portrait") === true
  const isRotatedPortraitDevice =
    frame.orientation === "horizontal" &&
    mockupDevice?.orientations.includes("portrait") === true
  const captureDefaultDevice = defaultCaptureDeviceForFrame(frame)
  const mainCaptureStateKey = scopeId ? `canvas:${scopeId}:main` : undefined
  // Keep portrait mockups visually balanced when they are either shown on a
  // portrait/square canvas or rotated into landscape.
  const shouldScopeFrame =
    ((isPortraitOrSquareCanvas && isVerticalPortraitDevice) ||
      isRotatedPortraitDevice) &&
    screenshotSlots.length === 0
  const screenshotBoxAspect = slotBoxAspectRatio(
    frame,
    canvasAspectRatio,
    !inRowMode && frame.id === "none" ? naturalDims : null
  )
  const rowLayoutItems = React.useMemo(
    () =>
      inRowMode
        ? computeRowLayout(
            [
              { id: "__main__", frame },
              ...screenshotSlots.map((slot) => ({
                id: slot.id,
                frame,
              })),
            ],
            canvasAspectRatio
          )
        : null,
    [inRowMode, frame, screenshotSlots, canvasAspectRatio]
  )
  const mainRowLayout = rowLayoutItems ? rowLayoutItems[0] : null
  const slotRowLayoutById = React.useMemo(() => {
    if (!rowLayoutItems) return null
    const map = new Map<string, { widthPct: number; xPct: number }>()
    for (const item of rowLayoutItems.slice(1)) {
      map.set(item.id, { widthPct: item.widthPct, xPct: item.xPct })
    }
    return map
  }, [rowLayoutItems])
  const hoverActionsScale = bulkEditMode
    ? Math.max(0.45, Math.min(1, bulkViewportZoom))
    : 1
  const hoverActionsLayoutKey = `${inRowMode ? "row" : "single"}:${screenshotSlots.length}:${effectiveScale}:${bulkViewportZoom}:${hoverActionsScale}:${widthPx}:${heightPx}`
  const screenshotAnchor = screenshotPositionAnchor(screenshotPosition)
  const mainScreenshotRowStyle: React.CSSProperties | null = mainRowLayout
    ? {
        position: "absolute",
        left:
          screenshotPosition === "center"
            ? `${mainRowLayout.xPct}%`
            : `${screenshotAnchor.x}%`,
        top: screenshotPosition === "center" ? "50%" : `${screenshotAnchor.y}%`,
        width: `${mainRowLayout.widthPct}%`,
        aspectRatio: screenshotBoxAspect,
        transform: "translate(-50%, -50%)",
        zIndex: 60 + screenshotLayer.zIndex,
      }
    : null

  const transform = [
    `perspective(1400px)`,
    `rotateX(var(--canvas-ts-rx, ${tilt.rx}deg))`,
    `rotateY(var(--canvas-ts-ry, ${tilt.ry}deg))`,
    `rotateZ(var(--canvas-ts-rz, ${tilt.rz}deg))`,
    `scale(var(--canvas-ts-scale, ${scale / 100}))`,
  ].join(" ")

  const computedShadow = shadowCss(shadow)
  const computedShadowFilter = shadowDropFilterCss(shadow)
  const scaleFactor = scale / 100
  const positionX = screenshotAnchor.x / 100
  const positionY = screenshotAnchor.y / 100
  const positionedStyle: React.CSSProperties | null = placementDims
    ? screenshotPlacementStyle(placementDims, scaleFactor, positionX, positionY)
    : null
  const enhanceFilter = enhanceFilterCss(enhance)
  const imgStyle: React.CSSProperties = {
    borderRadius,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: shadowBoxShadowCss(computedShadow),
    filter: enhanceFilter,
    opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
  }
  if (screenshotLayer.blendMode && screenshotLayer.blendMode !== "normal") {
    imgStyle.mixBlendMode = screenshotLayer.blendMode
  }
  if (border.color && border.width > 0) {
    imgStyle.outline = `${border.width}px ${border.style || "solid"} ${border.color}`
    imgStyle.outlineOffset = `${border.padding || 0}px`
  }
  const emptyStateBoxStyle: React.CSSProperties = {
    borderRadius,
  }
  if (border.color && border.width > 0) {
    emptyStateBoxStyle.outline = imgStyle.outline
    emptyStateBoxStyle.outlineOffset = imgStyle.outlineOffset
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  const innerLightingStyle =
    backdrop.lighting.target === "inner"
      ? lightingOverlayCss(backdrop.lighting, { inner: true })
      : null
  const canDragScreenshot = activeTool === "pointer" && positionedStyle
  const mockupRotation =
    frame.orientation === "horizontal" && mockupOrientation === "portrait"
      ? -90
      : 0
  const mockupAsset =
    frame.id === "none" || browserFrame
      ? null
      : getDeviceMockupAsset(frame.id, frame.color, mockupOrientation)
  const mockupSpec = mockupAsset ? deviceMockupSpec(frame.id) : null

  const clearElementSelection = React.useCallback(() => {
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
  }, [
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setSelectedScreenshotSlotId,
    setSelectedTextId,
  ])

  const {
    isScreenshotDragging,
    liveOffset,
    startScreenshotDrag,
    moveScreenshot,
    stopScreenshotDrag,
    startMockupDrag,
    moveMockup,
    stopMockupDrag,
  } = useScreenshotDrag({
    activeTool,
    canDragScreenshot: Boolean(canDragScreenshot),
    effectiveScale,
    screenshotScaleFactor: scaleFactor,
    placementDims,
    positionedStyle,
    screenshotOffset,
    setScreenshotOffset,
    setScreenshotPlacement,
    setIsScreenshotSelected,
    clearSelection: clearElementSelection,
    updateCenterGuides,
  })
  const effectiveOffset = liveOffset ?? screenshotOffset
  const screenshotLeft =
    typeof positionedStyle?.left === "number"
      ? positionedStyle.left + effectiveOffset.x
      : undefined
  const screenshotTop =
    typeof positionedStyle?.top === "number"
      ? positionedStyle.top + effectiveOffset.y
      : undefined

  const {
    isAnnotating,
    annotationCursor,
    getEditorElementAtPoint,
    startAnnotation,
    moveAnnotation,
    stopAnnotation,
  } = useAnnotationInteractions({
    activeTool,
    canvasRef,
    annotationLayerRef,
    annotation,
    annotationShapes,
    texts,
    assets,
    bulkEditMode,
    bulkViewportZoom,
    addAnnotationStroke,
    updateAnnotationStroke,
    addAnnotationShape,
    updateAnnotationShape,
    deleteAnnotationShape,
    updateText,
    updateAsset,
    setSelectedTextId,
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setIsScreenshotSelected,
    updateTextCenterGuides,
  })

  const handleScreenshotClickSelect = (e: { stopPropagation: () => void }) => {
    if (activeTool !== "pointer") return
    e.stopPropagation()
    setIsScreenshotSelected(true)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    if (!inRowMode) {
      setNaturalDims({ w: el.naturalWidth, h: el.naturalHeight })
    }
    measurePlacement()
  }

  return (
    <>
      <input {...fileInputProps} />

      <div
        className="flex items-center justify-center"
        style={{ width: widthPx, height: heightPx }}
      >
        <motion.div
          ref={canvasRef}
          data-canvas-id={scopeId ?? undefined}
          initial={isCanvasPreview ? false : { opacity: 0, scale: 0.985, y: 6 }}
          animate={isCanvasPreview ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            aspectRatio,
            borderRadius: `var(--canvas-bd-radius, ${canvasBorderRadius}px)`,
            width: widthPx,
            height: heightPx,
            touchAction: "none",
            overscrollBehavior: "none",
          }}
          className={cn(
            "relative flex items-center justify-center overflow-hidden transition-shadow",
            isCanvasPreview
              ? "ring-0"
              : isPreviewMode
                ? "ring-0"
                : bulkEditMode && isActive
                  ? "shadow-[0_0_0_4px_rgba(120,90,255,0.12)] ring-2 ring-primary/70"
                  : "ring-1 ring-border/40"
          )}
          onClick={() => {
            if (!isActive) {
              onActivate()
              return
            }
            setSelectedTextId(null)
            setSelectedAssetId(null)
            setSelectedAnnotationShapeId(null)
            setSelectedScreenshotSlotId(null)
            setIsScreenshotSelected(false)
          }}
          onPointerDownCapture={() => {
            if (!isActive) onActivate()
          }}
          {...dropHandlers}
        >
          <CenterGuides guides={centerGuides} />
          <CenterGuides guides={textCenterGuides} />

          <CanvasBackdrop
            background={background}
            backdrop={backdrop}
            effectsFilter={effectsFilter}
            noiseEnabled={noiseEnabled}
            noiseOpacity={noiseOpacity}
            portrait={portrait}
            overlay={overlay}
          />

          {mainScreenshotRowStyle ? (
            <MainScreenshotRowItem
              style={mainScreenshotRowStyle}
              offset={effectiveOffset}
              screenshot={screenshot}
              frame={frame}
              addressValue={frameAddress}
              onAddressChange={setFrameAddress}
              padding={padding}
              transform={transform}
              isDragOver={isDragOver}
              imgStyle={imgStyle}
              shadowFilter={computedShadowFilter}
              filterChain={enhanceFilter}
              isSelected={isScreenshotSelected && isActive}
              bulkCanvasDragging={bulkCanvasDragging}
              toolbarScale={
                bulkEditMode ? bulkToolbarScale(bulkViewportZoom) : 1
              }
              activeTool={activeTool}
              isScreenshotDragging={isScreenshotDragging}
              onSelect={handleScreenshotClickSelect}
              onBrowse={() => fileInputRef.current?.click()}
              onCropClick={() => setIsCropModalOpen(true)}
              onReplaceFile={readFile}
              onDelete={() => {
                setIsScreenshotSelected(false)
                setScreenshot(null)
              }}
              innerLightingStyle={innerLightingStyle}
              canDuplicate={presetTab !== "multi" && presetTab !== "triple"}
              onDuplicate={() => {
                const newId = addScreenshotSlot()
                if (!newId) {
                  toast(`Screenshot box limit reached`)
                  return
                }
                if (screenshot) setScreenshotSlotImage(newId, screenshot)
                setSelectedScreenshotSlotId(newId)
                setIsScreenshotSelected(false)
              }}
              onBringToFront={() => bringScreenshotToFront()}
              onSendToBack={() => sendScreenshotToBack()}
              onFrameChange={setFrame}
              objectFit={objectFit ?? "cover"}
              onObjectFitChange={setObjectFit}
              stageRef={stageRef}
              imageRef={imageRef}
              onImageLoad={handleImageLoad}
              onPointerDown={(e) => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur()
                }
                startMockupDrag(e)
              }}
              onPointerMove={moveMockup}
              onPointerUp={stopMockupDrag}
              previewMode={isCanvasPreview}
              emptyCompact={inRowMode}
              onCapture={handleCaptureWebsite}
              captureDefaultDevice={captureDefaultDevice}
              captureStateKey={mainCaptureStateKey}
            />
          ) : null}

          {!mainScreenshotRowStyle ? (
            <div
              data-editor-shadow-preview-scope="canvas"
              className="pointer-events-none relative flex h-full w-full items-center justify-center"
              style={{
                padding: `${(padding / 1200) * 100}%`,
                zIndex: 60 + screenshotLayer.zIndex,
              }}
            >
              {screenshot ? (
                browserFrame ? (
                  <ScreenshotBrowserFrame
                    screenshot={screenshot}
                    frameId={frame.id}
                    color={browserFrameColor}
                    screenshotLayer={screenshotLayer}
                    transform={transform}
                    shadowFilter={computedShadowFilter}
                    screenshotOffset={effectiveOffset}
                    screenshotAnchor={screenshotAnchor}
                    enhanceFilter={enhanceFilter}
                    objectFit={objectFit ?? "cover"}
                    isScreenshotDragging={isScreenshotDragging}
                    hoverActionsDisabled={
                      bulkCanvasDragging || isScreenshotDragging
                    }
                    hoverActionsInline={bulkEditMode}
                    hoverActionsLayoutKey={hoverActionsLayoutKey}
                    hoverActionsScale={hoverActionsScale}
                    activeTool={activeTool}
                    stageRef={stageRef}
                    imageRef={imageRef}
                    addressValue={frameAddress}
                    onAddressChange={setFrameAddress}
                    onSelect={handleScreenshotClickSelect}
                    onPointerDown={(e) => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      startMockupDrag(e)
                    }}
                    onPointerMove={moveMockup}
                    onPointerUp={stopMockupDrag}
                    onImageLoad={handleImageLoad}
                    onCropClick={() => setIsCropModalOpen(true)}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    innerLightingStyle={innerLightingStyle}
                  />
                ) : mockupAsset && mockupSpec ? (
                  <ScreenshotMockup
                    screenshot={screenshot}
                    mockupAsset={mockupAsset}
                    mockupSpec={mockupSpec}
                    screenshotLayer={screenshotLayer}
                    transform={transform}
                    mockupRotation={mockupRotation}
                    shadowFilter={computedShadowFilter}
                    screenshotOffset={effectiveOffset}
                    screenshotAnchor={screenshotAnchor}
                    enhanceFilter={enhanceFilter}
                    objectFit={objectFit ?? "cover"}
                    isScreenshotDragging={isScreenshotDragging}
                    activeTool={activeTool}
                    placementDims={placementDims}
                    stageRef={stageRef}
                    imageRef={imageRef}
                    scopeToMinSide={shouldScopeFrame}
                    onCaptureWebsite={handleCaptureWebsite}
                    captureDefaultDevice={captureDefaultDevice}
                    captureStateKey={mainCaptureStateKey}
                    onSelect={handleScreenshotClickSelect}
                    onPointerDown={(e) => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      startMockupDrag(e)
                    }}
                    onPointerMove={moveMockup}
                    onPointerUp={stopMockupDrag}
                    onImageLoad={handleImageLoad}
                    onCropClick={() => setIsCropModalOpen(true)}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    innerLightingStyle={innerLightingStyle}
                  />
                ) : (
                  <ScreenshotBare
                    screenshot={screenshot}
                    imgStyle={imgStyle}
                    positionedStyle={positionedStyle}
                    transform={transform}
                    screenshotLeft={screenshotLeft}
                    screenshotTop={screenshotTop}
                    placementDims={placementDims}
                    screenshotLayer={screenshotLayer}
                    isScreenshotSelected={isScreenshotSelected && isActive}
                    isScreenshotDragging={isScreenshotDragging}
                    suppressTransition={suppressTransition}
                    activeTool={activeTool}
                    selectedTextId={selectedTextId}
                    stageRef={stageRef}
                    imageRef={imageRef}
                    shadowBoxTarget={frame.id === "none"}
                    objectFit={objectFit ?? "cover"}
                    onContainerPointerDown={(e) => {
                      if (e.target === e.currentTarget) {
                        setIsScreenshotSelected(false)
                      }
                    }}
                    onSelect={handleScreenshotClickSelect}
                    onPointerDown={(e) => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      setSelectedTextId(null)
                      setSelectedAnnotationShapeId(null)
                      startScreenshotDrag(e)
                    }}
                    onPointerMove={moveScreenshot}
                    onPointerUp={stopScreenshotDrag}
                    onImageLoad={handleImageLoad}
                    onCropClick={() => setIsCropModalOpen(true)}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    onCaptureWebsite={handleCaptureWebsite}
                    captureDefaultDevice={captureDefaultDevice}
                    captureStateKey={mainCaptureStateKey}
                    innerLightingStyle={innerLightingStyle}
                  />
                )
              ) : browserFrame ? (
                <BrowserFrameEmptyState
                  frameId={frame.id}
                  color={browserFrameColor}
                  isDragOver={isDragOver}
                  onBrowse={() => fileInputRef.current?.click()}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  enhanceFilter={enhanceFilter}
                  screenshotOffset={effectiveOffset}
                  screenshotAnchor={screenshotAnchor}
                  isScreenshotDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  addressValue={frameAddress}
                  onAddressChange={setFrameAddress}
                  onCapture={handleCaptureWebsite}
                  defaultCaptureDevice={captureDefaultDevice}
                  captureStateKey={mainCaptureStateKey}
                  compact={
                    isPortraitOrSquareCanvas ||
                    tilt.rx !== 0 ||
                    tilt.ry !== 0 ||
                    tilt.rz !== 0 ||
                    scale !== 100 ||
                    screenshotSlots.length > 0
                  }
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                  innerLightingStyle={innerLightingStyle}
                />
              ) : mockupAsset && mockupSpec ? (
                <MockupEmptyState
                  mockupAsset={mockupAsset}
                  mockupSpec={mockupSpec}
                  isDragOver={isDragOver}
                  onBrowse={() => fileInputRef.current?.click()}
                  onCapture={handleCaptureWebsite}
                  defaultCaptureDevice={captureDefaultDevice}
                  captureStateKey={mainCaptureStateKey}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  enhanceFilter={enhanceFilter}
                  mockupRotation={mockupRotation}
                  screenshotOffset={effectiveOffset}
                  screenshotAnchor={screenshotAnchor}
                  isScreenshotDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  scopeToMinSide={shouldScopeFrame}
                  compact={
                    tilt.rx !== 0 ||
                    tilt.ry !== 0 ||
                    tilt.rz !== 0 ||
                    scale !== 100 ||
                    screenshotSlots.length > 0
                  }
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                  innerLightingStyle={innerLightingStyle}
                />
              ) : (
                <CanvasEmptyState
                  isDragOver={isDragOver}
                  onBrowse={() => fileInputRef.current?.click()}
                  onCapture={handleCaptureWebsite}
                  defaultCaptureDevice={captureDefaultDevice}
                  captureStateKey={mainCaptureStateKey}
                  innerLightingStyle={innerLightingStyle}
                  screenshotAnchor={screenshotAnchor}
                  screenshotOffset={effectiveOffset}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  boxStyle={emptyStateBoxStyle}
                  compact={
                    tilt.rx !== 0 ||
                    tilt.ry !== 0 ||
                    tilt.rz !== 0 ||
                    scale !== 100 ||
                    screenshotSlots.length > 0
                  }
                />
              )}
            </div>
          ) : null}

          {overlay.id !== null && overlay.position === "overlay" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url("${overlayUrl(overlay.id)}")`,
                opacity: `var(--bd-overlay-opacity, ${overlay.opacity / 100})`,
                zIndex: 200,
              }}
            />
          ) : null}

          {assets.map((a) => (
            <AssetElementView
              key={a.id}
              asset={a}
              canvasRef={canvasRef}
              previewMode={isCanvasPreview}
            />
          ))}

          <AnimatePresence>
            {screenshotSlots.map((slot) => (
              <ScreenshotSlotView
                key={slot.id}
                slot={slot}
                canvasRef={canvasRef}
                canvasAspectRatio={aw / ah}
                rowLayout={slotRowLayoutById?.get(slot.id) ?? null}
                onCropRequest={(id) => setCroppingSlotId(id)}
                onCenterGuideChange={updateCenterGuides}
                previewMode={isCanvasPreview}
              />
            ))}
          </AnimatePresence>

          {texts.map((t) => (
            <TextElementView
              key={t.id}
              text={t}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
              previewMode={isCanvasPreview}
            />
          ))}

          {sortedAnnotationShapes.map((shape) => (
            <AnnotationShapeElement
              key={shape.id}
              shape={shape}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
              previewMode={isCanvasPreview}
            />
          ))}

          <AnnotationLayer
            layerRef={annotationLayerRef}
            annotations={annotations}
            annotationMaskId={annotationMaskId}
            isAnnotating={isAnnotating}
            cursorClass={annotationCursor}
            onPointerDown={startAnnotation}
            onPointerMove={moveAnnotation}
            onPointerUp={stopAnnotation}
            onClick={(e) => {
              if (isAnnotating) e.stopPropagation()
            }}
            onDoubleClick={(e) => {
              if (!isAnnotating) return
              const editorElementAtPoint = getEditorElementAtPoint(
                e.clientX,
                e.clientY
              )
              if (
                editorElementAtPoint?.type !== "text" ||
                !editorElementAtPoint.id
              ) {
                return
              }

              e.preventDefault()
              e.stopPropagation()
              window.dispatchEvent(
                new CustomEvent("tokokino:edit-text", {
                  detail: { id: editorElementAtPoint.id },
                })
              )
            }}
          />
        </motion.div>
      </div>

      {!isCanvasPreview && (
        <CropModal
          open={isCropModalOpen}
          onOpenChange={setIsCropModalOpen}
          screenshotUrl={originalScreenshot ?? screenshot}
          initialRegion={lastCropRegion}
          onCrop={applyCroppedScreenshot}
        />
      )}

      {!isCanvasPreview && (
        <CropModal
          open={croppingSlotId !== null}
          onOpenChange={(open) => {
            if (!open) setCroppingSlotId(null)
          }}
          screenshotUrl={
            croppingSlotId
              ? (screenshotSlots.find((s) => s.id === croppingSlotId)?.src ??
                null)
              : null
          }
          onCrop={(cropped) => {
            if (croppingSlotId) {
              setScreenshotSlotImage(croppingSlotId, cropped)
              setCroppingSlotId(null)
            }
          }}
        />
      )}
    </>
  )
}

export function CanvasView(props: CanvasViewProps) {
  const inner = (
    <CanvasViewInner
      isActive={props.isActive}
      widthPx={props.widthPx}
      heightPx={props.heightPx}
      effectiveScale={props.effectiveScale}
      onActivate={props.onActivate}
    />
  )
  return (
    <CanvasScope id={props.canvasId}>
      {props.previewMode ? (
        <CanvasPreviewScope override={props.canvasOverride ?? null}>
          {inner}
        </CanvasPreviewScope>
      ) : (
        inner
      )}
    </CanvasScope>
  )
}

export function Canvas() {
  const canvasLayoutKeys = useEditorStore(
    useShallow((s) =>
      s.present.canvases.map(
        (canvas) =>
          `${canvas.id}\u0000${canvas.position.x}\u0000${canvas.position.y}`
      )
    )
  )
  const canvasLayouts = React.useMemo(
    () =>
      canvasLayoutKeys.map((key) => {
        const [id, x, y] = key.split("\u0000")
        return { id, position: { x: Number(x), y: Number(y) } }
      }),
    [canvasLayoutKeys]
  )
  const canvasIds = React.useMemo(
    () => canvasLayouts.map((canvas) => canvas.id),
    [canvasLayouts]
  )
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const aspect = useEditorStore((s) => s.present.aspect)
  const canvasZoom = useEditorStore((s) => s.present.canvasZoom)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const setActiveCanvasId = useEditorStore((s) => s.setActiveCanvasId)
  const setSelectedTextId = useEditorStore((s) => s.setSelectedTextId)
  const setSelectedAssetId = useEditorStore((s) => s.setSelectedAssetId)
  const setSelectedAnnotationShapeId = useEditorStore(
    (s) => s.setSelectedAnnotationShapeId
  )
  const setSelectedScreenshotSlotId = useEditorStore(
    (s) => s.setSelectedScreenshotSlotId
  )

  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const widthPx = BASE_CANVAS_WIDTH
  const heightPx = (BASE_CANVAS_WIDTH * ah) / aw

  const zoomScale = isPreviewMode ? 1 : canvasZoom / 100

  const sectionRef = React.useRef<HTMLElement | null>(null)
  const [autoFit, setAutoFit] = React.useState(0.6)
  const topGutter = isPreviewMode ? 24 : 24
  const bottomGutter = isPreviewMode ? 80 : 96
  const verticalOffset = isPreviewMode ? 0 : (topGutter - bottomGutter) / 2
  React.useLayoutEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const hGutter = 48
      const fitW = Math.max(0, rect.width - hGutter) / widthPx
      const fitH =
        Math.max(0, rect.height - topGutter - bottomGutter) / heightPx
      setAutoFit(Math.max(0.05, Math.min(1, Math.min(fitW, fitH))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [widthPx, heightPx, topGutter, bottomGutter])

  const effectiveScale = autoFit * zoomScale

  const isBulkScroll = bulkEditMode && !isPreviewMode
  const isPreviewCarousel = isPreviewMode && canvasIds.length > 1
  const isPreviewAutoScroll = useEditorStore((s) => s.isPreviewAutoScroll)
  const previewAutoScrollDelay = useEditorStore((s) => s.previewAutoScrollDelay)
  const previewAnimation = useEditorStore((s) => s.previewAnimation)
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>()
  const [animIndex, setAnimIndex] = React.useState(0)
  const [animDirection, setAnimDirection] = React.useState(1)

  const useCustomAnim = isPreviewCarousel && previewAnimation !== "slide"
  const boundedAnimIndex = canvasIds.length
    ? Math.min(animIndex, canvasIds.length - 1)
    : 0

  const goNext = React.useCallback(() => {
    if (canvasIds.length === 0) return
    setAnimDirection(1)
    setAnimIndex((i) => {
      const next = (i + 1) % canvasIds.length
      setActiveCanvasId(canvasIds[next])
      return next
    })
  }, [canvasIds, setActiveCanvasId])

  const goPrev = React.useCallback(() => {
    if (canvasIds.length === 0) return
    setAnimDirection(-1)
    setAnimIndex((i) => {
      const prev = (i - 1 + canvasIds.length) % canvasIds.length
      setActiveCanvasId(canvasIds[prev])
      return prev
    })
  }, [canvasIds, setActiveCanvasId])

  React.useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => {
      const idx = carouselApi.selectedScrollSnap()
      const canvasId = canvasIds[idx]
      if (canvasId) setActiveCanvasId(canvasId)
    }
    carouselApi.on("select", onSelect)
    return () => {
      carouselApi.off("select", onSelect)
    }
  }, [carouselApi, canvasIds, setActiveCanvasId])

  React.useEffect(() => {
    if (!isPreviewAutoScroll) return
    if (useCustomAnim) {
      const id = setInterval(() => goNext(), previewAutoScrollDelay)
      return () => clearInterval(id)
    }
    if (!carouselApi) return
    const id = setInterval(
      () => carouselApi.scrollNext(),
      previewAutoScrollDelay
    )
    return () => clearInterval(id)
  }, [
    isPreviewAutoScroll,
    carouselApi,
    previewAutoScrollDelay,
    useCustomAnim,
    goNext,
  ])

  const animVariants = React.useMemo(() => {
    if (previewAnimation === "fade") {
      return {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    }
    if (previewAnimation === "zoom") {
      return {
        enter: { opacity: 0, scale: 0.88 },
        center: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.1 },
      }
    }
    if (previewAnimation === "flip") {
      return {
        enter: (dir: number) => ({ opacity: 0, rotateY: dir > 0 ? -80 : 80 }),
        center: { opacity: 1, rotateY: 0 },
        exit: (dir: number) => ({ opacity: 0, rotateY: dir > 0 ? 80 : -80 }),
      }
    }
    return { enter: {}, center: {}, exit: {} }
  }, [previewAnimation])

  const handleClearSelection = React.useCallback(() => {
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
  }, [
    setSelectedTextId,
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setSelectedScreenshotSlotId,
  ])

  return (
    <section
      ref={sectionRef}
      data-editor-canvas-surface
      style={{
        containerType: "size",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      className={cn(
        "relative z-0 flex flex-1 touch-none overflow-hidden overscroll-none bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center justify-center p-0"
          : "border-b border-dashed border-border/70"
      )}
      role="presentation"
      onClick={handleClearSelection}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClearSelection()
      }}
    >
      <CornerMarkers className="text-border" size={12} />

      {isBulkScroll ? (
        <BulkCanvasFlow />
      ) : useCustomAnim ? (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden"
          style={{ perspective: 1400 }}
        >
          <AnimatePresence mode="wait" custom={animDirection}>
            {canvasIds[boundedAnimIndex] && (
              <motion.div
                key={canvasIds[boundedAnimIndex]}
                custom={animDirection}
                variants={animVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                className="absolute origin-center"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="origin-center"
                  style={{
                    transform: `scale(${effectiveScale})`,
                    width: widthPx,
                    height: heightPx,
                    ["--canvas-fit-scale" as string]: effectiveScale,
                  }}
                >
                  <CanvasView
                    canvasId={canvasIds[boundedAnimIndex]}
                    isActive={true}
                    widthPx={widthPx}
                    heightPx={heightPx}
                    effectiveScale={effectiveScale}
                    onActivate={() => {}}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 z-10 flex size-12 cursor-pointer items-center justify-center rounded-full border border-border/50 bg-background/80 shadow-lg backdrop-blur-sm transition-colors hover:bg-background"
            aria-label="Previous"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 z-10 flex size-12 cursor-pointer items-center justify-center rounded-full border border-border/50 bg-background/80 shadow-lg backdrop-blur-sm transition-colors hover:bg-background"
            aria-label="Next"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      ) : isPreviewCarousel ? (
        <Carousel
          className="h-full w-full"
          opts={{ align: "center", loop: true }}
          setApi={setCarouselApi}
        >
          <CarouselContent wrapperClassName="h-full" className="ml-0 h-full">
            {canvasIds.map((canvasId) => (
              <CarouselItem
                key={canvasId}
                className="flex h-full items-center justify-center pl-0"
              >
                <div
                  className="origin-center"
                  style={{
                    transform: `scale(${effectiveScale})`,
                    width: widthPx,
                    height: heightPx,
                    ["--canvas-fit-scale" as string]: effectiveScale,
                  }}
                >
                  <CanvasView
                    canvasId={canvasId}
                    isActive={canvasId === activeCanvasId}
                    widthPx={widthPx}
                    heightPx={heightPx}
                    effectiveScale={effectiveScale}
                    onActivate={() => setActiveCanvasId(canvasId)}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 size-12 [&_svg]:size-6" />
          <CarouselNext className="right-4 size-12 [&_svg]:size-6" />
        </Carousel>
      ) : (
        <div
          className="absolute top-1/2 left-1/2 origin-center transition-transform duration-200 ease-out"
          style={{
            transform: `translate(-50%, calc(-50% + ${verticalOffset}px)) scale(${effectiveScale})`,
            ["--canvas-fit-scale" as string]: effectiveScale,
          }}
        >
          <div className="relative">
            {canvasLayouts.map((canvas) => {
              const isActive = canvas.id === activeCanvasId
              return (
                <div
                  key={canvas.id}
                  className="absolute"
                  style={{
                    left: canvas.position.x,
                    top: canvas.position.y,
                    transform: "translate(-50%, -50%)",
                    zIndex: isActive ? 10 : 0,
                  }}
                >
                  <CanvasView
                    canvasId={canvas.id}
                    isActive={isActive}
                    widthPx={widthPx}
                    heightPx={heightPx}
                    effectiveScale={effectiveScale}
                    onActivate={() => setActiveCanvasId(canvas.id)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
