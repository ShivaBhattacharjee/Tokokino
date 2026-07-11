"use client"

import * as React from "react"
import { toast } from "sonner"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"
import { isVideoSrc } from "@/lib/editor/media-type"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import { ScreenshotEditMenu } from "./screenshot-edit-menu"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import type { CaptureDevice, CaptureSettings } from "./upload-card"

type PlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

type ScreenshotBareProps = {
  screenshot: string
  imgStyle: React.CSSProperties
  positionedStyle: React.CSSProperties | null
  transform: string
  screenshotLeft: number | undefined
  screenshotTop: number | undefined
  placementDims: PlacementDims | null
  screenshotLayer: ScreenshotLayer
  isScreenshotSelected: boolean
  isScreenshotDragging: boolean
  suppressTransition: boolean
  activeTool: EditorTool
  selectedTextId: string | null
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onContainerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onSelect: (e: React.MouseEvent<HTMLImageElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLImageElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLImageElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLImageElement>) => void
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
  captureStateKey?: string
  shadowBoxTarget?: boolean
  objectFit?: "contain" | "cover" | "fill"
  innerLightingStyle?: React.CSSProperties | null
  /** Receives the <video> DOM node (or null) when the screenshot is a video. */
  onMediaElement?: (el: HTMLVideoElement | null) => void
}

/**
 * Bare (no device/browser frame) screenshot.
 *
 * Why contain broke Inner lighting
 * --------------------------------
 * The light layer is an empty absolutely-positioned div (only a CSS gradient).
 * With `object-fit: cover|fill` it got `width/height: 100%` → real size → glow.
 * With `object-fit: contain` it only got `max-width/max-height: 100%` and no
 * content → used to collapse to 0×0 → glow vanished. Outer lighting lives on
 * the canvas backdrop, so it was never affected.
 *
 * Fix: always give the light layer an explicit size matching the image box
 * (measured imgW×imgH when free-placed, otherwise 100% of the stage/parent —
 * or the measured shrink-wrapped box for nested contain).
 *
 * Why nested contain broke the border
 * -----------------------------------
 * Nested multi-row/slot used `inset:0; width/height:100%` + `object-fit:contain`.
 * The painted image letterboxed inside that full box, but CSS `outline` (our
 * border) traces the *element* box — so the border wrapped the container, not
 * the image. Nested contain now shrink-wraps the img to the image's aspect
 * (max bounds = parent), same as free-placed contain, so outline/radius/shadow
 * hug the image.
 */
export function ScreenshotBare({
  screenshot,
  imgStyle,
  positionedStyle,
  transform,
  screenshotLeft,
  screenshotTop,
  placementDims,
  screenshotLayer,
  isScreenshotSelected,
  isScreenshotDragging,
  suppressTransition,
  activeTool,
  selectedTextId,
  stageRef,
  imageRef,
  onContainerPointerDown,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureStateKey,
  shadowBoxTarget = false,
  objectFit = "cover",
  innerLightingStyle,
  onMediaElement,
}: ScreenshotBareProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const isVideo = isVideoSrc(screenshot)

  // Feed the same element the parent measures (imageRef) and the video registry
  // (which the docked control bar reads) off a single node, so placement
  // measurement keeps working and the bar can drive playback.
  const setMediaRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      imageRef.current = node as unknown as HTMLImageElement | null
      onMediaElement?.(node)
    },
    [imageRef, onMediaElement]
  )

  // Measured size of a nested-contain image so the empty lighting layer can
  // match the shrink-wrapped box (it has no intrinsic size of its own).
  const [nestedContainSize, setNestedContainSize] = React.useState<{
    w: number
    h: number
  } | null>(null)

  // Free-placed single main uses numeric left/top in stage px (+ live-preview
  // vars). Nested multi-row/slot content has no left/top — parent sizes it.
  const isFreePlaced = typeof screenshotLeft === "number"
  const leftStyle = isFreePlaced
    ? `var(--editor-main-bare-left, ${screenshotLeft}px)`
    : "50%"
  const topStyle =
    typeof screenshotTop === "number"
      ? `var(--editor-main-bare-top, ${screenshotTop}px)`
      : "50%"

  // Nested multi (no free placement, no stage measurement): parent sizes the stage.
  const isNested = !isFreePlaced && placementDims == null
  // Nested contain must shrink-wrap to the image (not fill the parent) so the
  // border outline / radius / shadow hug the painted pixels instead of the slot.
  const isNestedContain = isNested && objectFit === "contain"

  const contentTransform =
    (typeof imgStyle.transform === "string" && imgStyle.transform) ||
    transform ||
    ""

  React.useLayoutEffect(() => {
    if (!isNestedContain) return
    const el = imageRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w <= 0 || h <= 0) return
      setNestedContainSize((prev) =>
        prev && prev.w === w && prev.h === h ? prev : { w, h }
      )
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [imageRef, isNestedContain, objectFit, screenshot])

  // Ignore stale measurements after switching away from nested contain.
  const measuredContainSize = isNestedContain ? nestedContainSize : null

  // Image position/transform (mirrors historical bare layout).
  const imagePositionStyle: React.CSSProperties = isNestedContain
    ? {
        // Shrink-wrap to the image aspect within the parent — border/outline
        // then tracks the image, not the letterboxed container.
        left: "50%",
        top: "50%",
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        ...imgStyle,
        transform: `translate(-50%, -50%) ${contentTransform}`.trim(),
        transformStyle: imgStyle.transformStyle ?? "preserve-3d",
      }
    : isNested
      ? {
          inset: 0,
          width: "100%",
          height: "100%",
          ...imgStyle,
          // Nested parent already applied centering translate; only keep 3D here.
          transform: contentTransform || undefined,
        }
      : {
          ...imgStyle,
          left: leftStyle,
          top: topStyle,
          ...(positionedStyle
            ? null
            : {
                transform: `translate(-50%, -50%) ${transform}`,
              }),
        }

  // Explicit light size — NEVER rely on max-width/max-height alone (0×0 when
  // the layer has no in-flow content, which is exactly the contain bug).
  const lightSizeStyle: React.CSSProperties = isNestedContain
    ? measuredContainSize
      ? {
          left: "50%",
          top: "50%",
          width: measuredContainSize.w,
          height: measuredContainSize.h,
        }
      : {
          // Pre-measure fallback: cover parent until the image has a real size.
          inset: 0,
          width: "100%",
          height: "100%",
        }
    : isNested
      ? { inset: 0, width: "100%", height: "100%" }
      : isFreePlaced && placementDims
        ? {
            left: leftStyle,
            top: topStyle,
            width: placementDims.imgW,
            height: placementDims.imgH,
          }
        : {
            // Cover/fill-style full stage, or pre-measure fallback.
            left: leftStyle,
            top: topStyle,
            width: "100%",
            height: "100%",
          }

  // Free-placed / positioned: left/top already place the box — same 3D
  // transform as the image (no extra translate). Nested multi cover/fill: 3D
  // only. Nested contain + centered free: translate(-50%) + 3D like the image.
  const lightTransform: React.CSSProperties =
    isNestedContain && measuredContainSize
      ? {
          transform: `translate(-50%, -50%) ${contentTransform}`.trim(),
          transformStyle: "preserve-3d",
        }
      : isFreePlaced || positionedStyle
        ? {
            transform: imgStyle.transform,
            transformStyle: imgStyle.transformStyle,
          }
        : isNested
          ? {
              transform: contentTransform || undefined,
              transformStyle: "preserve-3d",
            }
          : {
              transform: `translate(-50%, -50%) ${transform}`,
              transformStyle: "preserve-3d",
            }

  const mediaClassName = cn(
    "pointer-events-auto absolute select-none",
    // Nested cover/fill fills the parent slot/row box.
    isNested && !isNestedContain && "inset-0 h-full w-full",
    !isNested && objectFit === "cover" && "h-full w-full object-cover",
    !isNested && objectFit === "fill" && "h-full w-full object-fill",
    // contain: shrink-wrap to the image's aspect (max bounds = stage/parent).
    // Outline/radius/shadow then hug the image; lighting uses measured size.
    (isNestedContain || (!isNested && objectFit === "contain")) &&
      "max-h-full max-w-full object-contain",
    isNested && objectFit === "cover" && "object-cover",
    isNested && objectFit === "fill" && "object-fill",
    screenshotLayer.hidden && "pointer-events-none",
    isScreenshotDragging || suppressTransition || activeTool === "position"
      ? "cursor-grabbing transition-none"
      : "transition-all duration-300 ease-out",
    activeTool === "pointer" && "cursor-grab",
    isScreenshotSelected && activeTool === "pointer" && "outline-none"
  )

  return (
    <div
      ref={stageRef}
      className="group/screenshot pointer-events-none relative h-full w-full overflow-visible"
      onPointerDown={onContainerPointerDown}
    >
      {isVideo ? (
        <video
          ref={setMediaRef}
          data-box-hover-target
          data-editor-shadow-box-target={shadowBoxTarget ? "" : undefined}
          src={screenshot}
          muted
          loop
          playsInline
          // Only fetch metadata + the poster frame up front; the browser streams
          // the rest on demand (range requests) once it plays. Avoids buffering
          // a whole multi-minute video just to show it sitting on the canvas.
          preload="metadata"
          draggable={false}
          onLoadedMetadata={(e) =>
            onImageLoad(e as unknown as React.SyntheticEvent<HTMLImageElement>)
          }
          onError={() =>
            toast.error(
              "Couldn't load this video — the file may be corrupted or use an unsupported codec.",
              {
                id: "video-load-error",
              }
            )
          }
          onClick={(e) =>
            onSelect(e as unknown as React.MouseEvent<HTMLImageElement>)
          }
          onPointerDown={(e) =>
            onPointerDown(e as unknown as React.PointerEvent<HTMLImageElement>)
          }
          onPointerMove={(e) =>
            onPointerMove(e as unknown as React.PointerEvent<HTMLImageElement>)
          }
          onPointerUp={(e) =>
            onPointerUp(e as unknown as React.PointerEvent<HTMLImageElement>)
          }
          onPointerCancel={(e) =>
            onPointerUp(e as unknown as React.PointerEvent<HTMLImageElement>)
          }
          style={imagePositionStyle}
          className={mediaClassName}
        />
      ) : (
        <ShimmerImage
          ref={imageRef}
          shimmer={false}
          data-box-hover-target
          data-editor-shadow-box-target={shadowBoxTarget ? "" : undefined}
          src={screenshot}
          alt="Screenshot"
          draggable={false}
          onLoad={onImageLoad}
          onClick={onSelect}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={imagePositionStyle}
          className={mediaClassName}
        />
      )}

      {innerLightingStyle && !screenshotLayer.hidden ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10",
            isScreenshotDragging ||
              suppressTransition ||
              activeTool === "position"
              ? "transition-none"
              : "transition-all duration-300 ease-out"
          )}
          style={{
            ...innerLightingStyle,
            ...lightSizeStyle,
            ...lightTransform,
            borderRadius: imgStyle.borderRadius,
            // Keep the light above the image stacking context
            zIndex: 10,
          }}
        />
      ) : null}

      {/* Active selection ring — sized to the image box (same as lighting), not
          the parent slot/stage. Critical for object-fit:contain where the image
          is smaller than the container; a parent inset-0 ring would frame empty
          letterbox space. Separate from the style-border outline on the img. */}
      {isScreenshotSelected && !screenshotLayer.hidden ? (
        <div
          aria-hidden
          data-selection-border="true"
          className={cn(
            "pointer-events-none absolute z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed",
            isScreenshotDragging ||
              suppressTransition ||
              activeTool === "position"
              ? "transition-none"
              : "transition-all duration-300 ease-out"
          )}
          style={{
            ...lightSizeStyle,
            ...lightTransform,
            borderRadius: imgStyle.borderRadius,
          }}
        />
      ) : null}

      {activeTool === "pointer" && placementDims && !selectedTextId && (
        <div
          className={cn(
            "pointer-events-none absolute z-50 flex items-center justify-center transition-opacity",
            editOpen || isScreenshotSelected
              ? "opacity-100"
              : "opacity-0 group-hover/screenshot:opacity-100",
            isScreenshotDragging || suppressTransition
              ? "transition-none"
              : "transition-[opacity,left,top] duration-300 ease-out"
          )}
          style={{
            left:
              (screenshotLeft ??
                placementDims.stageW / 2 - placementDims.imgW / 2) +
              placementDims.imgW / 2,
            top:
              (screenshotTop ??
                placementDims.stageH / 2 - placementDims.imgH / 2) +
              placementDims.imgH / 2,
            transform: `translate(-50%, -50%) ${transform}`,
            transformOrigin: "center",
            transformStyle: "preserve-3d",
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
            captureStateKey={captureStateKey}
          />
        </div>
      )}
    </div>
  )
}
