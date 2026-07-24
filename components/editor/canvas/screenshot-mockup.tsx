"use client"

import * as React from "react"
import { toast } from "sonner"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"
import { isVideoSrc } from "@/lib/editor/media-type"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import {
  framePositionedStyle,
  isDesktopMockup,
  mockupScreenClipStyle,
  mockupScreenTransform,
  parseAspectRatio,
} from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"
import { ScreenshotEditMenu } from "./screenshot-edit-menu"
import { VideoIdlePoster } from "./video-idle-poster"
import { useVideoPreload } from "./use-video-preload"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import type { CaptureDevice, CaptureSettings } from "./upload-card"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type PlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

type ImageFit = "contain" | "cover" | "fill"

type ScreenshotMockupProps = {
  screenshot: string
  mockupAsset: DeviceMockupAsset
  mockupSpec: DeviceMockupSpec
  screenshotLayer: ScreenshotLayer
  transform: string
  mockupRotation: number
  shadowFilter: string | undefined
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  enhanceFilter: string | undefined
  objectFit?: ImageFit
  isScreenshotSelected: boolean
  isScreenshotDragging: boolean
  activeTool: EditorTool
  placementDims: PlacementDims | null
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onSelect: (e: React.MouseEvent) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onWheel?: React.WheelEventHandler<HTMLDivElement>
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onCaptureWebsite?: (
    url: string,
    settings: CaptureSettings
  ) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureDefaultOrientation?: "vertical" | "horizontal"
  captureStateKey?: string
  showHoverActions?: boolean
  /** Cap the frame to min(cqw, cqh) so it doesn't fill tall canvases. */
  scopeToMinSide?: boolean
  /** False for slots so the mockup ignores the main screenshot's live-drag vars
   * (it sits in its own positioned container). */
  readMainPreviewVars?: boolean
  innerLightingStyle?: React.CSSProperties | null
  /** Register the framed <video> with the docked control bar. */
  onMediaElement?: (el: HTMLVideoElement | null) => void
  /** Crop / overflow styles applied to the media element (video crop polyfill). */
  mediaStyle?: React.CSSProperties
}

export function ScreenshotMockup({
  screenshot,
  mockupAsset,
  mockupSpec,
  screenshotLayer,
  transform,
  mockupRotation,
  shadowFilter,
  screenshotOffset,
  screenshotAnchor,
  enhanceFilter,
  objectFit = "cover",
  isScreenshotSelected,
  isScreenshotDragging,
  activeTool,
  placementDims,
  stageRef,
  imageRef,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureDefaultOrientation,
  captureStateKey,
  showHoverActions = true,
  scopeToMinSide = false,
  readMainPreviewVars = true,
  innerLightingStyle,
  onMediaElement,
  mediaStyle,
}: ScreenshotMockupProps) {
  const videoPreload = useVideoPreload()
  const [editOpen, setEditOpen] = React.useState(false)
  const [measuredStageWidth, setMeasuredStageWidth] = React.useState<
    number | undefined
  >()
  // For device frames the shadow must follow the alpha silhouette of the
  // frame PNG (rounded corners, notch, etc). drop-shadow filters do that;
  // box-shadow would cast a rectangular shadow off the bounding box.
  const stageWidth = placementDims?.stageW ?? measuredStageWidth
  const desktopFrame = isDesktopMockup(mockupAsset.deviceId)
  const horizontalScreenStyle = mockupRotation
    ? rotatedScreenContentStyle(mockupSpec.screen.aspectRatio, -mockupRotation)
    : undefined
  const isVideo = isVideoSrc(screenshot)

  // Feed imageRef + the video registry from one node (same as ScreenshotBare).
  const setMediaRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      imageRef.current = node as unknown as HTMLImageElement | null
      onMediaElement?.(node)
    },
    [imageRef, onMediaElement]
  )

  const mediaClassName = cn(
    "pointer-events-none h-full w-full max-w-none object-center select-none",
    objectFit === "contain" && "relative z-10 object-contain",
    objectFit === "cover" && "object-cover",
    objectFit === "fill" && "object-fill",
    mockupRotation && "absolute top-1/2 left-1/2"
  )

  React.useLayoutEffect(() => {
    const node = stageRef.current
    if (!node || typeof ResizeObserver === "undefined") return

    const updateStageWidth = () => {
      const width =
        parseFloat(getComputedStyle(node).width) ||
        node.getBoundingClientRect().width ||
        node.clientWidth
      if (!width) return
      setMeasuredStageWidth((prev) => (prev === width ? prev : width))
    }

    updateStageWidth()
    const observer = new ResizeObserver(updateStageWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [mockupAsset.src, stageRef])

  return (
    <div
      className="group/mockup pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging || activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-[transform,opacity,filter,box-shadow] duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        style={framePositionedStyle({
          aspectRatio: mockupSpec.aspectRatio,
          rotation: mockupRotation,
          scopeToMinSide,
          anchor: screenshotAnchor,
          offset: screenshotOffset,
          transform,
          shadowFilter,
          enhanceFilter,
          layer: screenshotLayer,
          readPreviewVars: readMainPreviewVars,
        })}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div
            ref={stageRef}
            className="pointer-events-none relative w-full overflow-clip bg-black"
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
              transform: mockupScreenTransform(mockupSpec.screen),
            }}
          >
            {/* Blurred backdrop — fills letterbox/pillarbox areas in contain mode */}
            {objectFit === "contain" && !isVideo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={screenshot}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
                style={{
                  filter: "blur(18px) brightness(0.55) saturate(1.4)",
                  transform: "scale(1.12)",
                }}
              />
            )}
            {isVideo ? (
              <div className="absolute inset-0 bg-black">
                <video
                  ref={setMediaRef}
                  src={screenshot}
                  muted
                  loop
                  playsInline
                  preload={videoPreload}
                  draggable={false}
                  onLoadedMetadata={(e) =>
                    onImageLoad(
                      e as unknown as React.SyntheticEvent<HTMLImageElement>
                    )
                  }
                  onError={() =>
                    toast.error(
                      "Couldn't load this video — the file may be corrupted or use an unsupported codec.",
                      { id: "video-load-error" }
                    )
                  }
                  className={mediaClassName}
                  style={{ ...horizontalScreenStyle, ...mediaStyle }}
                />
                <VideoIdlePoster src={screenshot} />
              </div>
            ) : (
              <ShimmerImage
                ref={imageRef}
                shimmer
                src={screenshot}
                alt="Screenshot"
                draggable={false}
                onLoad={onImageLoad}
                className={mediaClassName}
                style={{ ...horizontalScreenStyle, ...mediaStyle }}
              />
            )}
            <InnerLightingOverlay style={innerLightingStyle} />
          </div>
        </div>
        <ShimmerImage
          shimmer={false}
          src={mockupAsset.src}
          alt=""
          draggable={false}
          data-editor-enhance-filter=""
          // Frame chrome (bezel + notch) sits above the media at z-10. The
          // video-media composite paints the decoded frame in 2D over the
          // underlay, so it must re-draw this on top or an opaque cover-fit video
          // would bury the bezel. It stays untagged (in the underlay too) so the
          // frame's drop-shadow keeps following the PNG silhouette.
          data-export-frame-chrome=""
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />

        {showHoverActions &&
        activeTool === "pointer" &&
        !screenshotLayer.hidden &&
        desktopFrame ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div
              className="relative w-full overflow-visible"
              style={{
                aspectRatio: mockupSpec.screen.aspectRatio,
                ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
                transform: mockupScreenTransform(mockupSpec.screen),
              }}
            >
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
                  editOpen || isScreenshotSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover/mockup:opacity-100",
                  isScreenshotDragging && !editOpen && "!opacity-0"
                )}
                style={{
                  transform: `translate(-50%, -50%) scale(${1 / mockupSpec.screen.scale})`,
                }}
              >
                <ScreenshotEditMenu
                  open={editOpen}
                  onOpenChange={setEditOpen}
                  onCrop={onCropClick}
                  onReplaceFile={onReplaceFile}
                  onDelete={onDelete}
                  onCaptureWebsite={onCaptureWebsite}
                  onLoadTweet={onLoadTweet}
                  captureDefaultDevice={captureDefaultDevice}
                  captureDefaultOrientation={captureDefaultOrientation}
                  captureStateKey={captureStateKey}
                />
              </div>
            </div>
          </div>
        ) : showHoverActions &&
          activeTool === "pointer" &&
          !screenshotLayer.hidden ? (
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
              editOpen || isScreenshotSelected
                ? "opacity-100"
                : "opacity-0 group-hover/mockup:opacity-100",
              isScreenshotDragging && !editOpen && "!opacity-0"
            )}
          >
            <ScreenshotEditMenu
              open={editOpen}
              onOpenChange={setEditOpen}
              onCrop={onCropClick}
              onReplaceFile={onReplaceFile}
              onDelete={onDelete}
              onCaptureWebsite={onCaptureWebsite}
              onLoadTweet={onLoadTweet}
              captureDefaultDevice={captureDefaultDevice}
              captureDefaultOrientation={captureDefaultOrientation}
              captureStateKey={captureStateKey}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function rotatedScreenContentStyle(
  aspectRatio: string,
  rotation: number
): React.CSSProperties | undefined {
  const ratio = parseAspectRatio(aspectRatio)
  if (!ratio)
    return { transform: `translate(-50%, -50%) rotate(${rotation}deg)` }

  return {
    width: `${100 / ratio}%`,
    height: `${ratio * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
}
