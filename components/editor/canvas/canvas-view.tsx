"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"

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
import { computeCropTarget, type CropTarget } from "@/lib/editor/crop-utils"
import type { CaptureSettings } from "./upload-card"
import {
  defaultCaptureDeviceForFrame,
  getDeviceMockup,
  getDeviceMockupAsset,
} from "@/lib/mockups"

import { AnnotationLayer } from "./annotation-layer"
import { CanvasBackdrop } from "./canvas-backdrop"
import { CanvasEmptyState } from "./canvas-empty-state"
import { CenterGuides, useCenterGuides } from "./center-guides"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import { MockupEmptyState } from "./mockup-empty-state"
import {
  deviceMockupSpec,
  lightingOverlayCss,
  screenshotPlacementStyle,
} from "./helpers"
import { MainScreenshotRowItem } from "./main-screenshot-row-item"
import { ScreenshotBare } from "./screenshot-bare"
import {
  BrowserFrameEmptyState,
  ScreenshotBrowserFrame,
} from "./screenshot-browser-frame"
import { ScreenshotMockup } from "./screenshot-mockup"
import { TweetCardView } from "./tweet-card"
import { fetchTweetData } from "@/lib/editor/load-tweet"
import {
  DEFAULT_TWEET_SETTINGS,
  tweetSettingsFromCard,
  type TweetCardSettings,
} from "@/lib/editor/tweet-settings"
import {
  downscaleImageFromUrl,
  getOptimizedUrlSync,
} from "@/lib/editor/image-resize"
import { ScreenshotSlotView } from "../screenshot-slot-element"
import { useAnnotationInteractions } from "./use-annotation-interactions"
import { useImageFileIntake } from "./use-image-file-intake"
import { usePlacementMeasurement } from "./use-placement-measurement"
import { useScreenshotDrag } from "./use-screenshot-drag"
import { useSuppressTransitionOnChange } from "./use-suppress-transition-on-change"

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

type SlotCropRequest = CropTarget & {
  slotId: string
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
    tweet,
    setTweet,
    clearTweet,
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
    applyCroppedScreenshotSlot,
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
  // Downscale whenever the background sourceUrl changes (on mount/hydration,
  // and also when a custom preset applies a new image background mid-session).
  React.useEffect(() => {
    if (
      background.type !== "image" ||
      !background.sourceUrl ||
      background.value.startsWith("data:") ||
      !scopeId
    )
      return

    const sourceUrl = background.sourceUrl
    const thumbUrl = background.thumbUrl
    const canvasId = scopeId
    const opts = { maxDimension: 1600, jpegQuality: 0.9 }

    // If we already have a cached downscale for this URL, apply it synchronously
    // so we never show a stale or wrong image (e.g. after a preset re-apply).
    const cached = getOptimizedUrlSync(sourceUrl, opts)
    if (cached) {
      useEditorStore.getState().setBackground(
        {
          type: "image",
          value: cached,
          sourceUrl,
          thumbUrl: thumbUrl ?? undefined,
        },
        canvasId
      )
      return
    }

    void downscaleImageFromUrl(sourceUrl, opts)
      .then((downscaled) => {
        const state = useEditorStore.getState()
        const c = state.present.canvases.find((cv) => cv.id === canvasId)
        if (
          c?.background.type !== "image" ||
          c.background.sourceUrl !== sourceUrl
        )
          return
        state.setBackground(
          {
            type: "image",
            value: downscaled,
            sourceUrl,
            thumbUrl: thumbUrl ?? undefined,
          },
          canvasId
        )
      })
      .catch((err) => {
        console.log("[bg] downscale failed", err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background.sourceUrl])

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
  const [mainCropRequest, setMainCropRequest] =
    React.useState<CropTarget | null>(null)
  const [slotCropRequest, setSlotCropRequest] =
    React.useState<SlotCropRequest | null>(null)
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
        setMainScreenshotImage(dataUrl)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not capture screenshot"
        )
      }
    },
    [setMainScreenshotImage]
  )

  const handleLoadTweet = React.useCallback(
    async (
      url: string,
      settings: TweetCardSettings = DEFAULT_TWEET_SETTINGS
    ) => {
      // fetchTweetData throws a user-facing Error; let the caller surface it.
      const data = await fetchTweetData(url)
      setTweet({ data, ...settings })
    },
    [setTweet]
  )

  const handleReplaceTweet = React.useCallback(
    async (url: string, settings?: TweetCardSettings) => {
      await handleLoadTweet(
        url,
        settings ??
          (tweet ? tweetSettingsFromCard(tweet) : DEFAULT_TWEET_SETTINGS)
      )
    },
    [handleLoadTweet, tweet]
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
            ? `var(--editor-main-position-x, ${mainRowLayout.xPct}%)`
            : `var(--editor-main-position-x, ${screenshotAnchor.x}%)`,
        top:
          screenshotPosition === "center"
            ? "var(--editor-main-position-y, 50%)"
            : `var(--editor-main-position-y, ${screenshotAnchor.y}%)`,
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
  const mainContentLeftPct = 50 + (effectiveOffset.x / widthPx) * 100
  const mainContentTopPct = 50 + (effectiveOffset.y / heightPx) * 100

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

  const openMainCropModal = React.useCallback(() => {
    const imageElement = imageRef.current
    const target = computeCropTarget({
      frame,
      objectFit: objectFit ?? "cover",
      stageElement: stageRef.current,
      imageElement,
      fallbackAspect: canvasAspectRatio,
    })
    setMainCropRequest({
      ...target,
      initialRegion: lastCropRegion ?? target.initialRegion,
    })
  }, [canvasAspectRatio, frame, lastCropRegion, objectFit])

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
              onCropClick={openMainCropModal}
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
                padding: `var(--editor-padding-preview, ${(padding / 1200) * 100}%)`,
                zIndex: 60 + screenshotLayer.zIndex,
              }}
            >
              {tweet ? (
                <TweetCardView
                  tweet={tweet}
                  transform={transform}
                  borderRadius={borderRadius}
                  boxShadow={shadowBoxShadowCss(computedShadow)}
                  enhanceFilter={enhanceFilter}
                  screenshotLayer={screenshotLayer}
                  innerLightingStyle={innerLightingStyle}
                  leftPct={mainContentLeftPct}
                  topPct={mainContentTopPct}
                  isSelected={isScreenshotSelected && isActive}
                  isDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  onSelect={handleScreenshotClickSelect}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                  onReplace={handleReplaceTweet}
                  onReplaceFile={readFile}
                  onCaptureWebsite={handleCaptureWebsite}
                  captureDefaultDevice={captureDefaultDevice}
                  captureStateKey={mainCaptureStateKey}
                  onDelete={() => {
                    setIsScreenshotSelected(false)
                    clearTweet()
                  }}
                />
              ) : screenshot ? (
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
                    isScreenshotSelected={isScreenshotSelected && isActive}
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
                    onCropClick={openMainCropModal}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    onCaptureWebsite={handleCaptureWebsite}
                    onLoadTweet={handleLoadTweet}
                    captureDefaultDevice={captureDefaultDevice}
                    captureStateKey={mainCaptureStateKey}
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
                    isScreenshotSelected={isScreenshotSelected && isActive}
                    isScreenshotDragging={isScreenshotDragging}
                    activeTool={activeTool}
                    placementDims={placementDims}
                    stageRef={stageRef}
                    imageRef={imageRef}
                    scopeToMinSide={shouldScopeFrame}
                    onCaptureWebsite={handleCaptureWebsite}
                    onLoadTweet={handleLoadTweet}
                    captureDefaultDevice={captureDefaultDevice}
                    captureDefaultOrientation={frame.orientation}
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
                    onCropClick={openMainCropModal}
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
                    onCropClick={openMainCropModal}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    onCaptureWebsite={handleCaptureWebsite}
                    onLoadTweet={handleLoadTweet}
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
                  defaultCaptureOrientation={frame.orientation}
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
                  onLoadTweet={handleLoadTweet}
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
                  activeTool={activeTool}
                  isBeingDragged={isScreenshotDragging}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
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
                onCropRequest={setSlotCropRequest}
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
          open={mainCropRequest !== null}
          onOpenChange={(open) => {
            if (!open) setMainCropRequest(null)
          }}
          screenshotUrl={originalScreenshot ?? screenshot}
          initialRegion={mainCropRequest?.initialRegion}
          targetAspect={mainCropRequest?.aspect}
          onCrop={applyCroppedScreenshot}
        />
      )}

      {!isCanvasPreview && (
        <CropModal
          open={slotCropRequest !== null}
          onOpenChange={(open) => {
            if (!open) setSlotCropRequest(null)
          }}
          screenshotUrl={
            slotCropRequest
              ? (() => {
                  const slot = screenshotSlots.find(
                    (s) => s.id === slotCropRequest.slotId
                  )
                  return slot?.originalSrc ?? slot?.src ?? null
                })()
              : null
          }
          initialRegion={slotCropRequest?.initialRegion}
          targetAspect={slotCropRequest?.aspect}
          onCrop={(cropped, region) => {
            if (slotCropRequest) {
              applyCroppedScreenshotSlot(
                slotCropRequest.slotId,
                cropped,
                region
              )
              setSlotCropRequest(null)
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
