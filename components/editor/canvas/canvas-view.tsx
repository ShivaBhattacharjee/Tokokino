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
  BORDER_OFFSET_PREVIEW_VAR,
  BORDER_OUTLINE_PREVIEW_VAR,
  borderOffsetCss,
  borderOutlineCss,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
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
import { useVideoRegistry } from "@/lib/editor/video-registry"
import { sourceTimeAt } from "@/lib/editor/video-timeline-map"
import {
  computeCropTarget,
  cropMediaObjectStyle,
  croppedNaturalSize,
  isActiveCropRegion,
  objectViewBoxCropStyle,
  supportsObjectViewBox,
  type CropTarget,
} from "@/lib/editor/crop-utils"
import {
  defaultCaptureDeviceForFrame,
  getDeviceMockup,
  getDeviceMockupAsset,
} from "@/lib/mockups"

import {
  clipOwns,
  FULL_CROP_REGION,
  lightingSidesUsed,
  overlayLayerOpacityVar,
  OVERLAY_BASE_OPACITY_VAR,
} from "@/lib/editor/animation-playback"
import { AnnotationLayer } from "./annotation-layer"
import { CanvasBackdrop } from "./canvas-backdrop"
import { CanvasEmptyState } from "./canvas-empty-state"
import { CenterGuides, useCenterGuides } from "./center-guides"
import { GifTranscodeDialog } from "./gif-transcode-dialog"
import { MediaPreparingState } from "./media-preparing-state"
import {
  computeRowLayout,
  slotBoxAspectRatio,
} from "@/lib/editor/screenshot-layout"
import { MockupEmptyState } from "./mockup-empty-state"
import {
  deviceMockupSpec,
  lightingOverlayCss,
  overlayLayerCss,
  screenshotPlacementStyle,
} from "./helpers"
import { mainScreenshotPositionPct } from "@/components/editor/mobile-controls/position-math"
import {
  setMainScreenshotBarePreviewPx,
  setMainScreenshotPositionPreview,
} from "@/components/editor/position-preview-vars"
import { livePreviewRoots } from "@/lib/editor/live-preview-roots"
import { MainScreenshotRowItem } from "./main-screenshot-row-item"
import { ScreenshotBare } from "./screenshot-bare"
import {
  BrowserFrameEmptyState,
  ScreenshotBrowserFrame,
} from "./screenshot-browser-frame"
import { ScreenshotMockup } from "./screenshot-mockup"
import { TweetCardView } from "./tweet-card"
import { isVideoSrc } from "@/lib/editor/media-type"
import {
  fullPageCaptureMediaStyle,
  fullPageCaptureObjectFit,
  nextFullPageCaptureScrollPosition,
} from "@/lib/editor/full-page-capture"
import { ScreenshotSlotView } from "../screenshot-slot-element"
import { useAnimateStacks } from "./use-animate-stacks"
import { useCanvasMediaIntake } from "./use-canvas-media-intake"
import { useAnnotationInteractions } from "./use-annotation-interactions"
import { useBackgroundDownscale } from "./use-background-downscale"
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
  /** Preview only: canvas to read store state from, when it differs from
   * `canvasId` (which stays synthetic to keep the preview DOM-isolated). */
  sourceCanvasId?: string | null
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
    fullPageCapture,
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
    setFullPageScreenshot,
    setFullPageScreenshotScrollPosition,
    applyCroppedScreenshot,
    setScreenshotCropRegion,
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
  // In Animate mode, the stacked background layers (one per background keyframe)
  // so multiple background swaps chain bg1 → bg2 → bg3. Empty (→ committed
  // background only) at rest or with no background keyframe.
  const isAnimateMode = useEditorStore((s) => s.isAnimateMode)
  const selectedAnimationClipId = useEditorStore(
    (s) => s.selectedAnimationClipId
  )
  const canvasAnimation = useEditorStore(
    (s) => s.present.canvases.find((c) => c.id === scopeId)?.animation
  )
  const canvasVideoClips = useEditorStore(
    (s) => s.present.canvases.find((c) => c.id === scopeId)?.videoClips
  )
  // The element only; its `currentTime` is read lazily in the crop-poster
  // getter below, never captured here.
  const canvasVideoEl = useVideoRegistry((s) =>
    scopeId ? (s.videos[scopeId] ?? null) : null
  )
  const {
    bg: animateBgStack,
    filterStack: animateFilterStack,
    portraitStack: animatePortraitStack,
    patternStack: animatePatternStack,
    overlayStack: animateOverlayStack,
  } = useAnimateStacks({
    isAnimateMode,
    canvasAnimation,
    selectedClipId: selectedAnimationClipId,
    background,
    filter: backdrop.filter ?? "none",
    portrait,
    pattern: backdrop.pattern,
    overlay,
  })
  // Previews share the live canvas' background, which the real canvas already
  // downscales — running it again per preview only duplicates the work against
  // a canvas id that doesn't exist in the store.
  useBackgroundDownscale(background, isCanvasPreview ? null : scopeId)

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
  // Chrome/Edge: native object-view-box. Firefox/Safari: overflow polyfill.
  // Server snapshot prefers native so SSR matches the working Chrome path.
  const nativeVideoCrop = React.useSyncExternalStore(
    () => () => {},
    supportsObjectViewBox,
    () => true
  )
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
  // First measure after media load — don't ease layout/centering in.
  const suppressTransitionMedia = useSuppressTransitionOnChange(screenshot)
  const inRowMode = screenshotSlots.length > 0
  const { placementDims, measurePlacement } = usePlacementMeasurement({
    enabled: Boolean(screenshot),
    stageRef,
    imageRef,
    // Include objectFit so contain↔cover remeasures imgW/imgH — inner lighting
    // sizes itself from those dims and would stay at the wrong box otherwise.
    // Natural dims cover a media swap: they reset to null and land again on
    // load, and without them a new image/video keeps the previous media's
    // measured box (the contain shell is sized from it, so it never resizes).
    layoutKey: `${inRowMode ? "row" : "single"}:${frame.id}:${frame.orientation}:${screenshotSlots.length}:${widthPx}:${heightPx}:${padding}:${objectFit ?? "cover"}:${naturalDims ? `${naturalDims.w}x${naturalDims.h}` : "none"}`,
  })
  const suppressTransitionPlacement = useSuppressTransitionOnChange(
    placementDims
      ? `${Math.round(placementDims.imgW)}x${Math.round(placementDims.imgH)}:${Math.round(placementDims.stageW)}x${Math.round(placementDims.stageH)}`
      : "pending"
  )
  const suppressTransition =
    suppressTransitionPadding ||
    suppressTransitionSlots ||
    suppressTransitionMedia ||
    suppressTransitionPlacement
  const resetNaturalDims = React.useCallback(() => setNaturalDims(null), [])
  const {
    fileInputRef,
    fileInputProps,
    isDragOver,
    readFile,
    dropHandlers,
    pendingGif,
    confirmGifTranscode,
    cancelGifTranscode,
    preparingMedia,
    handleMediaElement,
    handleCaptureWebsite,
    handleDemoScreenshot,
    handleLoadTweet,
    handleReplaceTweet,
  } = useCanvasMediaIntake({
    scopeId,
    isCanvasPreview,
    slotCount: screenshotSlots.length,
    tweet,
    setScreenshot,
    setFullPageScreenshot,
    setScreenshotSlotImage,
    setTweet,
    onNaturalDimsReset: resetNaturalDims,
  })

  // A clip animating the crop keeps the media box at FULL natural size and moves
  // the source rect inside it. Sizing the box from the crop would make the auto
  // aspect — and therefore the encoder's frame size — depend on which keyframe
  // happened to be selected at export time, and change mid-render.
  const cropAnimated =
    isAnimateMode && !!canvasAnimation?.clips.some((c) => clipOwns(c, "crop"))

  // Which video frame the crop dialog previews.
  //
  // A GETTER, deliberately: `video.currentTime` is not React state, so anything
  // that caches it (a memo, a value prop computed on an unrelated render) serves
  // whatever the playhead was when that render ran — which is 0, the frame the
  // element registered at. The dialog calls this when it decodes the poster.
  //
  // With a keyframe open for editing, the crop being authored belongs to THAT
  // clip, so preview the frame its pose lands on (the end of its window) — even
  // though selecting a clip doesn't move the playhead. With no clip open, the
  // playhead is what the user is looking at. Both go through the same
  // timeline→source mapping the player uses, or a trimmed clip would preview a
  // different frame than it plays.
  const getCropPosterTimeSec = React.useCallback((): number | null => {
    if (!canvasVideoEl) return null
    const duration = Number.isFinite(canvasVideoEl.duration)
      ? canvasVideoEl.duration
      : undefined
    const openClip =
      isAnimateMode && selectedAnimationClipId
        ? canvasAnimation?.clips.find((c) => c.id === selectedAnimationClipId)
        : null
    if (openClip) {
      const atMs = openClip.startMs + openClip.durationMs
      const sec = sourceTimeAt(canvasVideoClips, atMs, duration)
      // A keyframe over a gap in the video has no frame of its own; fall through
      // to the playhead rather than previewing one it never shows.
      if (sec != null) return sec
    }
    return canvasVideoEl.currentTime
  }, [
    canvasVideoEl,
    canvasVideoClips,
    isAnimateMode,
    selectedAnimationClipId,
    canvasAnimation,
  ])
  const isAuto = aspect.id === "auto" || aspect.w === 0 || aspect.h === 0
  const canUseNaturalCanvasAspect =
    isAuto && naturalDims && !inRowMode && frame.id === "none"
  // Visible media size after a non-destructive video crop (full size otherwise).
  const croppedDims =
    naturalDims &&
    lastCropRegion &&
    isVideoSrc(screenshot) &&
    isActiveCropRegion(lastCropRegion)
      ? croppedNaturalSize(naturalDims.w, naturalDims.h, lastCropRegion)
      : null
  // Drives the CANVAS box (and so the encoder's frame size), which must not move
  // while a crop animates — see `cropAnimated`.
  const visibleNaturalDims = cropAnimated
    ? naturalDims
    : (croppedDims ?? naturalDims)
  // Auto canvas aspect follows the visible video crop when one is set.
  const autoDims = canUseNaturalCanvasAspect ? visibleNaturalDims : null
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
    !inRowMode && frame.id === "none" ? visibleNaturalDims : null
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
  // Read the animated radius via a var so an Animate-mode clip can ease it,
  // falling back to the committed value at rest / outside Animate mode.
  const screenshotRadiusCss = `var(${SCREENSHOT_RADIUS_PREVIEW_VAR}, ${borderRadius}px)`
  const imgStyle: React.CSSProperties = {
    borderRadius: screenshotRadiusCss,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: shadowBoxShadowCss(computedShadow),
    filter: enhanceFilter,
    opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
  }
  if (screenshotLayer.blendMode && screenshotLayer.blendMode !== "normal") {
    imgStyle.mixBlendMode = screenshotLayer.blendMode
  }
  const fullPageMediaStyle = fullPageCaptureMediaStyle(fullPageCapture)
  const effectiveObjectFit = fullPageCaptureObjectFit(
    fullPageCapture,
    objectFit ?? "cover"
  )
  if (fullPageMediaStyle) Object.assign(imgStyle, fullPageMediaStyle)
  const handleFullPageWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!fullPageCapture || isCanvasPreview) return
      const next = nextFullPageCaptureScrollPosition(
        event.deltaY,
        fullPageCapture.scrollPosition
      )
      if (next === fullPageCapture.scrollPosition) return
      event.preventDefault()
      event.stopPropagation()
      setFullPageScreenshotScrollPosition(next)
    },
    [fullPageCapture, isCanvasPreview, setFullPageScreenshotScrollPosition]
  )
  // Video crop is non-destructive: the src stays the full clip and we crop at
  // render time. Chrome/Edge use object-view-box; Firefox/Safari use an
  // overflow + positioned-media polyfill. Images are cropped destructively
  // (the src is already the cropped bitmap), so they never get it.
  // When a clip animates the crop the shell is ALWAYS mounted (even with a
  // neutral committed region) so the player has a source rect to drive via the
  // preview vars — the same rule the border outline below follows.
  const videoCropRegion = !isVideoSrc(screenshot)
    ? null
    : lastCropRegion && isActiveCropRegion(lastCropRegion)
      ? lastCropRegion
      : cropAnimated
        ? FULL_CROP_REGION
        : null
  const videoMediaStyle = videoCropRegion
    ? nativeVideoCrop
      ? objectViewBoxCropStyle(videoCropRegion)
      : cropMediaObjectStyle(videoCropRegion)
    : undefined
  // The bare frame always crops via the overflow polyfill (its <video> carries
  // the crop, not the shell that holds imgStyle — object-view-box can't reach a
  // div), so it needs the shrink-wrap aspect on every browser, not just Safari.
  // The MEDIA shell's ratio, which decides whether the picture is letterboxed or
  // stretched — so it must always be the crop's own ratio, even while animating.
  // Using the canvas dims here made an animated crop render its window blown up
  // to the full video's ratio, i.e. contain looked like cover.
  const cropShellDims = croppedDims ?? visibleNaturalDims
  const videoCropAspectRatio =
    videoCropRegion && cropShellDims
      ? cropShellDims.w > 0 && cropShellDims.h > 0
        ? `${cropShellDims.w} / ${cropShellDims.h}`
        : undefined
      : undefined
  // When a clip animates the border, the outline is ALWAYS mounted (even when
  // the committed border is invisible) so the player can ease it in from 0 /
  // recolour it via the preview vars. Otherwise it renders only when committed.
  const borderAnimated =
    isAnimateMode && !!canvasAnimation?.clips.some((c) => clipOwns(c, "border"))
  const borderVisible = Boolean(border.color) && border.width > 0
  if (borderAnimated || borderVisible) {
    const committedOutline = borderVisible
      ? borderOutlineCss(border)
      : "0px solid transparent"
    imgStyle.outline = `var(${BORDER_OUTLINE_PREVIEW_VAR}, ${committedOutline})`
    imgStyle.outlineOffset = `var(${BORDER_OFFSET_PREVIEW_VAR}, ${borderOffsetCss(border)})`
  }
  const emptyStateBoxStyle: React.CSSProperties = {
    borderRadius: screenshotRadiusCss,
  }
  if (borderAnimated || borderVisible) {
    emptyStateBoxStyle.outline = imgStyle.outline
    emptyStateBoxStyle.outlineOffset = imgStyle.outlineOffset
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  // When a clip animates lighting, mount only the side(s) the timeline actually
  // uses. Pure-inner never mounts the canvas-level (outer) overlay — that was
  // the "light starts on the canvas then settles on the image" bug. Both sides
  // still mount for a real inner↔outer depth-shift crossfade.
  const lightingAnimated =
    isAnimateMode &&
    !!canvasAnimation?.clips.some((c) => clipOwns(c, "lighting"))
  const lightingSides = React.useMemo(
    () =>
      lightingAnimated && canvasAnimation
        ? lightingSidesUsed(canvasAnimation.clips, backdrop.lighting)
        : {
            inner: backdrop.lighting.target === "inner",
            outer: backdrop.lighting.target === "outer",
          },
    [lightingAnimated, canvasAnimation, backdrop.lighting]
  )
  const innerLightingStyle =
    backdrop.lighting.target === "inner" ||
    (lightingAnimated && lightingSides.inner)
      ? lightingOverlayCss(backdrop.lighting, {
          inner: true,
          active: backdrop.lighting.target === "inner",
          forceMount: lightingAnimated && lightingSides.inner,
        })
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

  const setScreenshotPositionDragging = useEditorStore(
    (s) => s.setScreenshotPositionDragging
  )

  // Keep Animate-mode position CSS vars in sync with the live drag so the box
  // tracks the pointer instead of staying on AnimationLayer's last sample until
  // mouse-up. Uses the same preview helpers the position pad / player write.
  const previewLiveMainOffset = React.useCallback(
    (offset: { x: number; y: number }) => {
      // Every live-preview root, so dragging the screenshot moves it in the
      // preset thumbnails too. In a preview subtree this resolves to nothing,
      // but previews are inert so the handler never runs there anyway.
      const canvasEl = livePreviewRoots(scopeId)
      if (canvasEl.length === 0) return

      // Multi-row / framed / tweet: container is % positioned. Bare single: px.
      if (inRowMode || frame.id !== "none" || tweet) {
        const point = mainScreenshotPositionPct({
          aspect: { id: aspect.id, w: aw, h: ah },
          frame,
          position: screenshotPosition,
          offset,
          slots: screenshotSlots,
        })
        setMainScreenshotPositionPreview(canvasEl, point)
        return
      }

      if (
        positionedStyle &&
        typeof positionedStyle.left === "number" &&
        typeof positionedStyle.top === "number"
      ) {
        setMainScreenshotBarePreviewPx(
          canvasEl,
          positionedStyle.left + offset.x,
          positionedStyle.top + offset.y
        )
      }
    },
    [
      ah,
      aspect.id,
      aw,
      frame,
      inRowMode,
      positionedStyle,
      screenshotPosition,
      screenshotSlots,
      tweet,
    ]
  )

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
    setScreenshotPositionDragging,
    onLiveOffsetPreview: previewLiveMainOffset,
    getPreviewCanvasElement: () => livePreviewRoots(scopeId),
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
    // Also fires from a <video>'s onLoadedMetadata for video screenshots, where
    // intrinsic size lives on videoWidth/videoHeight instead of naturalWidth.
    const el = e.currentTarget as HTMLImageElement & Partial<HTMLVideoElement>
    const w = el.naturalWidth || el.videoWidth || 0
    const h = el.naturalHeight || el.videoHeight || 0
    if (!inRowMode && w > 0 && h > 0) {
      // Always store the full intrinsic size — crop aspect is derived at use sites
      // so applying/clearing a crop doesn't require reloading the media.
      setNaturalDims({ w, h })
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
      <GifTranscodeDialog
        open={pendingGif !== null}
        onConfirm={confirmGifTranscode}
        onCancel={cancelGifTranscode}
      />

      <div
        className="flex items-center justify-center"
        style={{ width: widthPx, height: heightPx }}
      >
        <motion.div
          ref={canvasRef}
          data-canvas-id={scopeId ?? undefined}
          initial={false}
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
            animateBgStack={animateBgStack}
            animateFilterStack={animateFilterStack}
            animatePortraitStack={animatePortraitStack}
            animatePatternStack={animatePatternStack}
            animateOverlayStack={animateOverlayStack}
            lightingAnimated={lightingAnimated && lightingSides.outer}
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
              objectFit={effectiveObjectFit}
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
              onWheel={handleFullPageWheel}
              previewMode={isCanvasPreview}
              emptyCompact={inRowMode}
              onCapture={handleCaptureWebsite}
              onDemo={handleDemoScreenshot}
              captureDefaultDevice={captureDefaultDevice}
              captureStateKey={mainCaptureStateKey}
              mediaStyle={fullPageMediaStyle}
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
                  borderRadius={screenshotRadiusCss}
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
                    objectFit={effectiveObjectFit}
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
                    onWheel={handleFullPageWheel}
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
                    onMediaElement={handleMediaElement}
                    mediaStyle={fullPageMediaStyle ?? videoMediaStyle}
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
                    objectFit={effectiveObjectFit}
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
                    onWheel={handleFullPageWheel}
                    onImageLoad={handleImageLoad}
                    onCropClick={openMainCropModal}
                    onReplaceFile={readFile}
                    onDelete={() => {
                      setIsScreenshotSelected(false)
                      setScreenshot(null)
                    }}
                    innerLightingStyle={innerLightingStyle}
                    onMediaElement={handleMediaElement}
                    mediaStyle={fullPageMediaStyle ?? videoMediaStyle}
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
                    objectFit={effectiveObjectFit}
                    cropRegion={videoCropRegion}
                    cropAspectRatio={videoCropAspectRatio}
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
                    onWheel={handleFullPageWheel}
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
                    onMediaElement={handleMediaElement}
                  />
                )
              ) : preparingMedia ? (
                <MediaPreparingState
                  label="Preparing GIF…"
                  screenshotAnchor={screenshotAnchor}
                  screenshotOffset={effectiveOffset}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  boxStyle={emptyStateBoxStyle}
                  innerLightingStyle={innerLightingStyle}
                />
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
                  onDemo={handleDemoScreenshot}
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
                  onDemo={handleDemoScreenshot}
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
                  onDemo={handleDemoScreenshot}
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

          {animateOverlayStack.layers.length > 0 ? (
            // Animate mode with animated overlay: render the `overlay`-positioned
            // layers (base + one per keyframe), crossfade-chained by AnimationLayer
            // so the additive textures transition instead of accumulating. The
            // `underlay`-positioned ones render inside CanvasBackdrop.
            <>
              {animateOverlayStack.base.position === "overlay"
                ? (() => {
                    const style = overlayLayerCss(
                      animateOverlayStack.base,
                      OVERLAY_BASE_OPACITY_VAR,
                      0
                    )
                    return style ? (
                      <div
                        aria-hidden
                        data-export-stack="foreground"
                        className="pointer-events-none absolute inset-0 bg-cover bg-center"
                        style={{ ...style, zIndex: 200 }}
                      />
                    ) : null
                  })()
                : null}
              {animateOverlayStack.layers.map((layer) => {
                if (layer.overlay.position !== "overlay") return null
                const style = overlayLayerCss(
                  layer.overlay,
                  overlayLayerOpacityVar(layer.id),
                  layer.restOpaque ? 1 : 0
                )
                return style ? (
                  <div
                    key={layer.id}
                    aria-hidden
                    data-export-stack="foreground"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{ ...style, zIndex: 200 }}
                  />
                ) : null
              })}
            </>
          ) : overlay.id !== null && overlay.position === "overlay" ? (
            <div
              aria-hidden
              data-export-stack="foreground"
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
            eraserBrushSize={
              isAnnotating && annotation.mode === "eraser"
                ? annotation.strokeWidth
                : null
            }
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
          getPosterTimeSec={getCropPosterTimeSec}
          onCrop={(cropped, region) => {
            // Video can't be re-encoded client-side — store a non-destructive
            // render-time crop region instead of a baked bitmap.
            if (isVideoSrc(screenshot)) setScreenshotCropRegion(region)
            else applyCroppedScreenshot(cropped, region)
          }}
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
        <CanvasPreviewScope
          override={props.canvasOverride ?? null}
          sourceCanvasId={props.sourceCanvasId ?? null}
        >
          {inner}
        </CanvasPreviewScope>
      ) : (
        inner
      )}
    </CanvasScope>
  )
}
