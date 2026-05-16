"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"

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
  CanvasScope,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  screenshotPositionAnchor,
  useCanvasScopeId,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"

import { AnnotationLayer } from "./canvas/annotation-layer"
import { CanvasBackdrop } from "./canvas/canvas-backdrop"
import { CanvasEmptyState } from "./canvas/canvas-empty-state"
import { CenterGuides, useCenterGuides } from "./canvas/center-guides"
import { BASE_CANVAS_WIDTH } from "./canvas/constants"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import { DeviceFrameEmptyState } from "./canvas/device-frame-empty-state"
import { deviceMockupSpec, screenshotPlacementStyle } from "./canvas/helpers"
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
  } = useEditor()
  const scopeId = useCanvasScopeId()
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const bulkCanvasDragging = useEditorStore((s) => s.bulkCanvasDragging)
  const bulkViewportZoom = useEditorStore((s) => s.bulkViewportZoom)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const generatedAnnotationMaskId = React.useId()
  const annotationMaskId = `annotation-mask-${generatedAnnotationMaskId.replace(/:/g, "")}`
  const sortedAnnotationShapes = React.useMemo(
    () => [...annotationShapes].sort((a, b) => a.zIndex - b.zIndex),
    [annotationShapes]
  )

  React.useEffect(() => {
    if (!selectedTextId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTextId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedTextId, setSelectedTextId])

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
  const suppressTransition = useSuppressTransitionOnChange(padding)
  const inRowMode = screenshotSlots.length > 0
  const { placementDims, measurePlacement } = usePlacementMeasurement({
    enabled: Boolean(screenshot),
    stageRef,
    imageRef,
    layoutKey: `${inRowMode ? "row" : "single"}:${frame.id}:${frame.orientation}:${screenshotSlots.length}:${widthPx}:${heightPx}:${padding}`,
  })
  const handleImageFile = React.useCallback(
    (src: string) => {
      setScreenshot(src)
      setNaturalDims(null)
    },
    [setScreenshot]
  )
  const { fileInputRef, fileInputProps, isDragOver, readFile, dropHandlers } =
    useImageFileIntake(handleImageFile)

  const isAuto = aspect.id === "auto" || aspect.w === 0 || aspect.h === 0
  const autoDims = isAuto && naturalDims ? naturalDims : null
  const aw = autoDims ? autoDims.w : aspect.w || 16
  const ah = autoDims ? autoDims.h : aspect.h || 10
  const aspectRatio = `${aw} / ${ah}`
  const canvasAspectRatio = aw / ah
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
                frame: slot.frame,
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

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  const canDragScreenshot = activeTool === "pointer" && positionedStyle
  const browserFrame = isBrowserFrame(frame.id)
  const browserFrameColor = resolveBrowserFrameColor(frame.color)
  const mockupDevice =
    frame.id === "none" || browserFrame ? null : getDeviceMockup(frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
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
    setNaturalDims({ w: el.naturalWidth, h: el.naturalHeight })
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
          initial={{ opacity: 0, scale: 0.985, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            aspectRatio,
            borderRadius: `var(--canvas-bd-radius, ${canvasBorderRadius}px)`,
            width: widthPx,
            height: heightPx,
          }}
          className={cn(
            "relative flex items-center justify-center overflow-hidden transition-shadow",
            isPreviewMode
              ? "ring-0"
              : bulkEditMode && isActive
                ? "ring-2 ring-primary/70 shadow-[0_0_0_4px_rgba(120,90,255,0.12)]"
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
              isSelected={isScreenshotSelected}
              bulkCanvasDragging={bulkCanvasDragging}
              hoverActionsInline={bulkEditMode}
              hoverActionsLayoutKey={hoverActionsLayoutKey}
              hoverActionsScale={hoverActionsScale}
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
                    isScreenshotDragging={isScreenshotDragging}
                    activeTool={activeTool}
                    placementDims={placementDims}
                    stageRef={stageRef}
                    imageRef={imageRef}
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
                    isScreenshotSelected={isScreenshotSelected}
                    isScreenshotDragging={isScreenshotDragging}
                    suppressTransition={suppressTransition}
                    activeTool={activeTool}
                    selectedTextId={selectedTextId}
                    stageRef={stageRef}
                    imageRef={imageRef}
                    shadowBoxTarget={frame.id === "none"}
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
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                />
              ) : mockupAsset && mockupSpec ? (
                <DeviceFrameEmptyState
                  mockupAsset={mockupAsset}
                  mockupSpec={mockupSpec}
                  isDragOver={isDragOver}
                  onBrowse={() => fileInputRef.current?.click()}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  enhanceFilter={enhanceFilter}
                  mockupRotation={mockupRotation}
                  screenshotOffset={effectiveOffset}
                  screenshotAnchor={screenshotAnchor}
                  isScreenshotDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                />
              ) : (
                <CanvasEmptyState
                  isDragOver={isDragOver}
                  onBrowse={() => fileInputRef.current?.click()}
                  previewStyle={imgStyle}
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
                zIndex: 30,
              }}
            />
          ) : null}

          {assets.map((a) => (
            <AssetElementView key={a.id} asset={a} canvasRef={canvasRef} />
          ))}

          {screenshotSlots.map((slot) => (
            <ScreenshotSlotView
              key={slot.id}
              slot={slot}
              canvasRef={canvasRef}
              canvasAspectRatio={aw / ah}
              rowLayout={slotRowLayoutById?.get(slot.id) ?? null}
              onCropRequest={(id) => setCroppingSlotId(id)}
              onCenterGuideChange={updateCenterGuides}
            />
          ))}

          {texts.map((t) => (
            <TextElementView
              key={t.id}
              text={t}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
            />
          ))}

          {sortedAnnotationShapes.map((shape) => (
            <AnnotationShapeElement
              key={shape.id}
              shape={shape}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
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
                new CustomEvent("beautiful-screenshots:edit-text", {
                  detail: { id: editorElementAtPoint.id },
                })
              )
            }}
          />
        </motion.div>
      </div>

      <CropModal
        open={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        screenshotUrl={originalScreenshot ?? screenshot}
        initialRegion={lastCropRegion}
        onCrop={applyCroppedScreenshot}
      />

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
    </>
  )
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <CanvasScope id={props.canvasId}>
      <CanvasViewInner
        isActive={props.isActive}
        widthPx={props.widthPx}
        heightPx={props.heightPx}
        effectiveScale={props.effectiveScale}
        onActivate={props.onActivate}
      />
    </CanvasScope>
  )
}

export function Canvas() {
  const canvases = useEditorStore((s) => s.present.canvases)
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
  const topGutter = 24
  const bottomGutter = 96
  const verticalOffset = (topGutter - bottomGutter) / 2
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
  const isPreviewCarousel = isPreviewMode && canvases.length > 1
  const isPreviewAutoScroll = useEditorStore((s) => s.isPreviewAutoScroll)
  const previewAutoScrollDelay = useEditorStore((s) => s.previewAutoScrollDelay)
  const previewAnimation = useEditorStore((s) => s.previewAnimation)
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>()
  const [animIndex, setAnimIndex] = React.useState(0)
  const [animDirection, setAnimDirection] = React.useState(1)

  const useCustomAnim = isPreviewCarousel && previewAnimation !== "slide"

  const goNext = React.useCallback(() => {
    setAnimDirection(1)
    setAnimIndex((i) => {
      const next = (i + 1) % canvases.length
      setActiveCanvasId(canvases[next].id)
      return next
    })
  }, [canvases, setActiveCanvasId])

  const goPrev = React.useCallback(() => {
    setAnimDirection(-1)
    setAnimIndex((i) => {
      const prev = (i - 1 + canvases.length) % canvases.length
      setActiveCanvasId(canvases[prev].id)
      return prev
    })
  }, [canvases, setActiveCanvasId])

  React.useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => {
      const idx = carouselApi.selectedScrollSnap()
      const canvas = canvases[idx]
      if (canvas) setActiveCanvasId(canvas.id)
    }
    carouselApi.on("select", onSelect)
    return () => { carouselApi.off("select", onSelect) }
  }, [carouselApi, canvases, setActiveCanvasId])

  React.useEffect(() => {
    if (!isPreviewAutoScroll) return
    if (useCustomAnim) {
      const id = setInterval(() => goNext(), previewAutoScrollDelay)
      return () => clearInterval(id)
    }
    if (!carouselApi) return
    const id = setInterval(() => carouselApi.scrollNext(), previewAutoScrollDelay)
    return () => clearInterval(id)
  }, [isPreviewAutoScroll, carouselApi, previewAutoScrollDelay, useCustomAnim, goNext])

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

  return (
    <section
      ref={sectionRef}
      style={{ containerType: "size" }}
      className={cn(
        "relative z-0 flex flex-1 overflow-hidden bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center justify-center p-0"
          : "border-b border-dashed border-border/70"
      )}
      onClick={() => {
        setSelectedTextId(null)
        setSelectedAssetId(null)
        setSelectedAnnotationShapeId(null)
        setSelectedScreenshotSlotId(null)
      }}
    >
      <CornerMarkers className="text-border" size={12} />

      {isBulkScroll ? (
        <BulkCanvasFlow widthPx={widthPx} heightPx={heightPx} />
      ) : useCustomAnim ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ perspective: 1400 }}>
          <AnimatePresence mode="wait" custom={animDirection}>
            {canvases[animIndex] && (
              <motion.div
                key={canvases[animIndex].id}
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
                  }}
                >
                  <CanvasView
                    canvasId={canvases[animIndex].id}
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
            className="absolute left-4 z-10 size-12 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors cursor-pointer shadow-lg"
            aria-label="Previous"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 z-10 size-12 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors cursor-pointer shadow-lg"
            aria-label="Next"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      ) : isPreviewCarousel ? (
        <Carousel
          className="w-full h-full"
          opts={{ align: "center", loop: true }}
          setApi={setCarouselApi}
        >
          <CarouselContent wrapperClassName="h-full" className="h-full ml-0">
            {canvases.map((canvas) => (
              <CarouselItem
                key={canvas.id}
                className="h-full flex items-center justify-center pl-0"
              >
                <div
                  className="origin-center"
                  style={{
                    transform: `scale(${effectiveScale})`,
                    width: widthPx,
                    height: heightPx,
                  }}
                >
                  <CanvasView
                    canvasId={canvas.id}
                    isActive={canvas.id === activeCanvasId}
                    widthPx={widthPx}
                    heightPx={heightPx}
                    effectiveScale={effectiveScale}
                    onActivate={() => setActiveCanvasId(canvas.id)}
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
          }}
        >
          <div className="relative">
            {canvases.map((canvas) => {
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
