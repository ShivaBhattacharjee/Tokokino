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
import {
  computeCropTarget,
  cropMediaObjectStyle,
  croppedNaturalSize,
  isActiveCropRegion,
  objectViewBoxCropStyle,
  supportsObjectViewBox,
  type CropTarget,
} from "@/lib/editor/crop-utils"
import type { CaptureSettings } from "./upload-card"
import {
  defaultCaptureDeviceForFrame,
  getDeviceMockup,
  getDeviceMockupAsset,
} from "@/lib/mockups"

import {
  clipOwns,
  EMPTY_BG_STACK,
  EMPTY_FILTER_STACK,
  EMPTY_OVERLAY_STACK,
  EMPTY_PATTERN_STACK,
  EMPTY_PORTRAIT_STACK,
  lightingSidesUsed,
  overlayLayerOpacityVar,
  OVERLAY_BASE_OPACITY_VAR,
  resolveAnimateBgStack,
  resolveAnimateFilterStack,
  resolveAnimateOverlayStack,
  resolveAnimatePatternStack,
  resolveAnimatePortraitStack,
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
import { isUnsplashImageUrl } from "@/lib/editor/unsplash"
import { isVideoSrc, revokeObjectUrl } from "@/lib/editor/media-type"
import { useVideoRegistry } from "@/lib/editor/video-registry"
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
  const animateBgStack = React.useMemo(
    () =>
      isAnimateMode && canvasAnimation
        ? resolveAnimateBgStack(
            canvasAnimation.clips,
            background,
            selectedAnimationClipId
          )
        : EMPTY_BG_STACK,
    [isAnimateMode, canvasAnimation, background, selectedAnimationClipId]
  )
  const animateFilterStack = React.useMemo(
    () =>
      isAnimateMode && canvasAnimation
        ? resolveAnimateFilterStack(
            canvasAnimation.clips,
            backdrop.filter ?? "none",
            selectedAnimationClipId
          )
        : EMPTY_FILTER_STACK,
    [isAnimateMode, canvasAnimation, backdrop.filter, selectedAnimationClipId]
  )
  const animatePortraitStack = React.useMemo(
    () =>
      isAnimateMode && canvasAnimation
        ? resolveAnimatePortraitStack(
            canvasAnimation.clips,
            portrait,
            selectedAnimationClipId
          )
        : EMPTY_PORTRAIT_STACK,
    [isAnimateMode, canvasAnimation, portrait, selectedAnimationClipId]
  )
  const animatePatternStack = React.useMemo(
    () =>
      isAnimateMode && canvasAnimation
        ? resolveAnimatePatternStack(
            canvasAnimation.clips,
            backdrop.pattern,
            selectedAnimationClipId
          )
        : EMPTY_PATTERN_STACK,
    [isAnimateMode, canvasAnimation, backdrop.pattern, selectedAnimationClipId]
  )
  const animateOverlayStack = React.useMemo(
    () =>
      isAnimateMode && canvasAnimation
        ? resolveAnimateOverlayStack(
            canvasAnimation.clips,
            overlay,
            selectedAnimationClipId
          )
        : EMPTY_OVERLAY_STACK,
    [isAnimateMode, canvasAnimation, overlay, selectedAnimationClipId]
  )
  // Downscale whenever the background sourceUrl changes (on mount/hydration,
  // and also when a custom preset applies a new image background mid-session).
  // Unsplash CDN URLs must stay hotlinked — never convert them to data URLs.
  React.useEffect(() => {
    if (background.type !== "image" || !background.sourceUrl || !scopeId) return

    const sourceUrl = background.sourceUrl
    if (isUnsplashImageUrl(sourceUrl)) {
      // Restore hotlink if a previous session stored a data-URL value.
      if (background.value !== sourceUrl) {
        useEditorStore.getState().setBackground(
          {
            type: "image",
            value: sourceUrl,
            sourceUrl,
            thumbUrl: background.thumbUrl ?? undefined,
          },
          scopeId
        )
      }
      return
    }

    if (background.value.startsWith("data:")) return

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
  const suppressTransition =
    suppressTransitionPadding || suppressTransitionSlots
  const inRowMode = screenshotSlots.length > 0
  const { placementDims, measurePlacement } = usePlacementMeasurement({
    enabled: Boolean(screenshot),
    stageRef,
    imageRef,
    // Include objectFit so contain↔cover remeasures imgW/imgH — inner lighting
    // sizes itself from those dims and would stay at the wrong box otherwise.
    layoutKey: `${inRowMode ? "row" : "single"}:${frame.id}:${frame.orientation}:${screenshotSlots.length}:${widthPx}:${heightPx}:${padding}:${objectFit ?? "cover"}`,
  })
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const setMainScreenshotImage = React.useCallback(
    (src: string) => {
      // Free the outgoing image/video object URL so replacements don't leak —
      // unless another canvas still references it (e.g. after duplicate).
      const canvases = useEditorStore.getState().present.canvases
      const prev = canvases.find((c) => c.id === scopeId)?.screenshot
      if (prev && prev !== src) {
        const stillUsed = canvases.some(
          (c) =>
            c.id !== scopeId &&
            (c.screenshot === prev || c.originalScreenshot === prev)
        )
        if (!stillUsed) revokeObjectUrl(prev)
      }
      setScreenshot(src)
      setNaturalDims(null)
    },
    [scopeId, setScreenshot]
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

  // Register the main <video> element so the docked control bar can drive it.
  // Preview/thumbnail scopes never register — only the real editable canvas.
  const registerVideo = useVideoRegistry((s) => s.registerVideo)
  const handleMediaElement = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (!scopeId || isCanvasPreview) return
      registerVideo(scopeId, el)
    },
    [isCanvasPreview, registerVideo, scopeId]
  )
  React.useEffect(() => {
    return () => {
      if (scopeId && !isCanvasPreview) registerVideo(scopeId, null)
    }
  }, [isCanvasPreview, registerVideo, scopeId])
  // True while an incoming GIF is transcoding to video — drives the canvas
  // skeleton so the user sees progress instead of a frozen empty box.
  const [preparingMedia, setPreparingMedia] = React.useState(false)
  const {
    fileInputRef,
    fileInputProps,
    isDragOver,
    readFile,
    dropHandlers,
    pendingGif,
    confirmGifTranscode,
    cancelGifTranscode,
  } = useImageFileIntake(handleImageFile, {
    // A video may only be the sole screenshot — once extra slots exist, block
    // dropping/pasting one into the main box (and route slots reject it too).
    allowVideo: screenshotSlots.length === 0,
    onPreparingChange: setPreparingMedia,
  })

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
  // Visible media size after a non-destructive video crop (full size otherwise).
  const visibleNaturalDims =
    naturalDims &&
    lastCropRegion &&
    isVideoSrc(screenshot) &&
    isActiveCropRegion(lastCropRegion)
      ? croppedNaturalSize(naturalDims.w, naturalDims.h, lastCropRegion)
      : naturalDims
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
  // Video crop is non-destructive: the src stays the full clip and we crop at
  // render time. Chrome/Edge use object-view-box; Firefox/Safari use an
  // overflow + positioned-media polyfill. Images are cropped destructively
  // (the src is already the cropped bitmap), so they never get it.
  const videoCropRegion =
    lastCropRegion &&
    isVideoSrc(screenshot) &&
    isActiveCropRegion(lastCropRegion)
      ? lastCropRegion
      : null
  const videoCropPolyfill = Boolean(videoCropRegion) && !nativeVideoCrop
  if (videoCropRegion && nativeVideoCrop) {
    Object.assign(imgStyle, objectViewBoxCropStyle(videoCropRegion))
  }
  const videoMediaStyle = videoCropRegion
    ? nativeVideoCrop
      ? objectViewBoxCropStyle(videoCropRegion)
      : cropMediaObjectStyle(videoCropRegion)
    : undefined
  const videoCropAspectRatio =
    videoCropPolyfill && visibleNaturalDims
      ? visibleNaturalDims.w > 0 && visibleNaturalDims.h > 0
        ? `${visibleNaturalDims.w} / ${visibleNaturalDims.h}`
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
  // When a clip animates backdrop effects, the backdrop must always carry the
  // `--bd-fx-preview` filter var — even when the committed effects are neutral
  // (no filter). Otherwise the player has nothing to drive when an effect eases
  // in from / out to neutral, so it silently wouldn't animate.
  const backdropAnimated =
    isAnimateMode &&
    !!canvasAnimation?.clips.some((c) => clipOwns(c, "backdrop"))
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
      const canvasEl = canvasRef.current
      if (!canvasEl) return

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
    getPreviewCanvasElement: () => canvasRef.current,
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
            animateBgStack={animateBgStack}
            animateFilterStack={animateFilterStack}
            animatePortraitStack={animatePortraitStack}
            animatePatternStack={animatePatternStack}
            animateOverlayStack={animateOverlayStack}
            lightingAnimated={lightingAnimated && lightingSides.outer}
            backdropAnimated={backdropAnimated}
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
                    onMediaElement={handleMediaElement}
                    mediaStyle={videoMediaStyle}
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
                    onMediaElement={handleMediaElement}
                    mediaStyle={videoMediaStyle}
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
                    cropRegion={videoCropPolyfill ? videoCropRegion : null}
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
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{ ...style, zIndex: 200 }}
                  />
                ) : null
              })}
            </>
          ) : overlay.id !== null && overlay.position === "overlay" ? (
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
        <CanvasPreviewScope override={props.canvasOverride ?? null}>
          {inner}
        </CanvasPreviewScope>
      ) : (
        inner
      )}
    </CanvasScope>
  )
}
