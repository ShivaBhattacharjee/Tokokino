"use client"

import * as React from "react"
import { toast } from "sonner"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import { cn } from "@/lib/utils"
import {
  CROP_FIT_ORIGIN_VAR,
  CROP_FIT_SX_VAR,
  CROP_FIT_SY_VAR,
  CROP_SHELL_H_VAR,
  CROP_SHELL_W_VAR,
  cropMediaObjectStyle,
  cropOriginCss,
  isActiveCropRegion,
} from "@/lib/editor/crop-utils"
import { isVideoSrc } from "@/lib/editor/media-type"
import type {
  CropRegion,
  EditorTool,
  ScreenshotLayer,
} from "@/lib/editor/store"
import { ScreenshotEditMenu } from "./screenshot-edit-menu"
import { VideoIdlePoster } from "./video-idle-poster"
import { useVideoPreload } from "./use-video-preload"
import { coverContainerBox, fitContainBox, parseAspectRatio } from "./helpers"
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
  captureStateKey?: string
  shadowBoxTarget?: boolean
  objectFit?: "contain" | "cover" | "fill"
  /** Non-destructive video crop (percent region). Applied via overflow frame. */
  cropRegion?: CropRegion | null
  /** Cropped media aspect (`w / h`) so the bare frame shrink-wraps correctly. */
  cropAspectRatio?: string
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
  onWheel,
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
  cropRegion = null,
  cropAspectRatio,
  innerLightingStyle,
  onMediaElement,
}: ScreenshotBareProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const animationPlayer = useAnimationPlayerOptional()
  const isAnimationPlaying = animationPlayer?.isPlaying ?? false
  const videoPreload = useVideoPreload()
  const isVideo = isVideoSrc(screenshot)
  const activeCrop =
    isVideo && isActiveCropRegion(cropRegion) ? cropRegion : null
  // Safari/Firefox report 0×0 until metadata — without a fallback the contain
  // shell collapses to a speck then jumps to full size. Fill the stage until
  // we know the real aspect, then shrink-wrap.
  const [videoAspectState, setVideoAspectState] = React.useState<{
    src: string
    aspect: string | null
  }>({ src: screenshot, aspect: null })
  const videoIntrinsicAspect =
    videoAspectState.src === screenshot ? videoAspectState.aspect : null

  // Feed the same element the parent measures (imageRef) and the video registry
  // (which the docked control bar reads) off a single node, so placement
  // measurement keeps working and the bar can drive playback.
  // When cropped, imageRef must point at the overflow frame (laid-out crop box),
  // while onMediaElement still receives the real <video>.
  const setMediaRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      onMediaElement?.(node)
    },
    [onMediaElement]
  )
  const setVideoShellRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      imageRef.current = node as unknown as HTMLImageElement | null
    },
    [imageRef]
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
  const resolvedVideoAspect = cropAspectRatio ?? videoIntrinsicAspect

  // A bare contain video still has a screen-sized shell so it can be positioned
  // and tilted, but the visible 16:9 pixels occupy only part of that shell.
  // Keep lighting and the selection ring on the visible pixels, not on the
  // transparent letterbox around them. The export compositor measures this same
  // node, so it now receives identical geometry to the editor.
  /** Visible contain-video rect inside the free-placed shell, or null. */
  const containVideoContent = (() => {
    if (
      !isVideo ||
      activeCrop ||
      objectFit !== "contain" ||
      !isFreePlaced ||
      !placementDims ||
      !resolvedVideoAspect
    ) {
      return null
    }
    const aspect = parseAspectRatio(resolvedVideoAspect)
    if (!aspect) return null
    const { width, height } = fitContainBox(
      placementDims.imgW,
      placementDims.imgH,
      aspect
    )
    return {
      width,
      height,
      x: (placementDims.imgW - width) / 2,
      y: (placementDims.imgH - height) / 2,
    }
  })()

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
      : containVideoContent
        ? {
            left: `calc(${leftStyle} + ${containVideoContent.x}px)`,
            top: `calc(${topStyle} + ${containVideoContent.y}px)`,
            width: containVideoContent.width,
            height: containVideoContent.height,
          }
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

  const wantsContain = isNestedContain || (!isNested && objectFit === "contain")

  const mediaClassName = cn(
    "pointer-events-auto absolute select-none",
    // Nested cover/fill fills the parent slot/row box.
    isNested && !isNestedContain && "inset-0 h-full w-full",
    !isNested && objectFit === "cover" && "h-full w-full object-cover",
    !isNested && objectFit === "fill" && "h-full w-full object-fill",
    // contain: shrink-wrap to the image's aspect (max bounds = stage/parent).
    // Outline/radius/shadow then hug the image; lighting uses measured size.
    wantsContain && "max-h-full max-w-full object-contain",
    isNested && objectFit === "cover" && "object-cover",
    isNested && objectFit === "fill" && "object-fill",
    screenshotLayer.hidden && "pointer-events-none",
    isScreenshotDragging || suppressTransition || activeTool === "position"
      ? "cursor-grabbing transition-none"
      : // Bare media must follow tilt previews immediately. A transform transition
        // makes the bitmap and its lighting gradient settle on different frames
        // in WebKit, producing a visible trailing glow.
        "transition-none",
    activeTool === "pointer" && "cursor-grab",
    isScreenshotSelected && activeTool === "pointer" && "outline-none"
  )

  /**
   * Contain box for a CROPPED video, in stage pixels.
   *
   * The crop polyfill scales the `<video>` by percentages of this shell, so the
   * shell's rendered ratio has to equal the crop's ratio exactly or the picture
   * shears. `width:100% + height:auto + aspect-ratio` does NOT guarantee that:
   * when the crop is taller than the stage, `max-height:100%` clamps the height
   * while the explicit width stays at 100%, and the box silently ends up wider
   * than its own aspect ratio. Solve it the same way the uncropped contain path
   * does — fit the ratio into the measured stage and hand back definite pixels.
   */
  const cropContainBox = (() => {
    if (!activeCrop || !wantsContain || !placementDims) return null
    const ratio = cropAspectRatio ? parseAspectRatio(cropAspectRatio) : null
    if (!ratio) return null
    const box = fitContainBox(placementDims.stageW, placementDims.stageH, ratio)
    return box.width > 0 ? box : null
  })()

  /**
   * Cover + crop. The shell keeps the stage box (`h-full w-full`), so its inline
   * `aspect-ratio` is ignored — both dimensions are definite — and the polyfill
   * maps the crop region straight onto the stage's ratio, shearing it. Contain
   * fixes this by resizing the shell; cover can't, because the picture has to end
   * up LARGER than its clip box. Scale the video about the crop's own centre
   * instead: the mapped region regains its ratio and grows to cover, and the
   * shell's overflow:hidden clips the excess.
   *
   * Not applied while a clip animates the crop — the `--crop-*` vars move the
   * region every frame, but this scale is computed once from the committed one.
   */
  const cropCoverTransform = (() => {
    if (!activeCrop || objectFit !== "cover") return null
    const ratio = cropAspectRatio ? parseAspectRatio(cropAspectRatio) : null
    // Always emit the vars, even with no static value to compute: an animated
    // crop needs something to drive, and a neutral 1 is a no-op otherwise.
    let sx = 1
    let sy = 1
    if (ratio && placementDims) {
      const { imgW, imgH } = placementDims
      if (imgW > 0 && imgH > 0) {
        const cover = coverContainerBox(imgW, imgH, ratio)
        sx = cover.width / imgW
        sy = cover.height / imgH
      }
    }
    return {
      transformOrigin: `var(${CROP_FIT_ORIGIN_VAR}, ${cropOriginCss(activeCrop)})`,
      transform: `scale(var(${CROP_FIT_SX_VAR}, ${sx}), var(${CROP_FIT_SY_VAR}, ${sy}))`,
    } satisfies React.CSSProperties
  })()

  const cropFrameStyle: React.CSSProperties | undefined = activeCrop
    ? {
        ...imagePositionStyle,
        overflow: "hidden",
        objectFit: undefined,
        ...(cropAspectRatio ? { aspectRatio: cropAspectRatio } : null),
        ...(cropContainBox
          ? {
              // Vars let an animated crop resize the shell per frame; the
              // measured box is the committed fallback.
              width: `var(${CROP_SHELL_W_VAR}, ${cropContainBox.width}px)`,
              height: `var(${CROP_SHELL_H_VAR}, ${cropContainBox.height}px)`,
              maxWidth: "100%",
              maxHeight: "100%",
            }
          : wantsContain && cropAspectRatio
            ? {
                // Pre-measurement only: definite width so aspect-ratio can
                // resolve a height at all (auto/auto stays 0 in Safari).
                width: "100%",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "100%",
              }
            : null),
      }
    : undefined

  // Video contain shells must never rely on the <video> intrinsic box — Safari
  // reports 0×0 until metadata, and width/height:auto + aspect-ratio alone can
  // stay 0×0 after metadata too. Always give a definite width (or fill stage).
  const videoShellStyle: React.CSSProperties = (() => {
    if (activeCrop) return cropFrameStyle ?? imagePositionStyle
    if (objectFit !== "contain") return imagePositionStyle

    // After placement is measured, pin to that box (same as images).
    if (placementDims && isFreePlaced) {
      return {
        ...imagePositionStyle,
        width: placementDims.imgW,
        height: placementDims.imgH,
      }
    }

    if (!resolvedVideoAspect) {
      return {
        ...imagePositionStyle,
        inset: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        transform: contentTransform || imagePositionStyle.transform,
      }
    }

    return {
      ...imagePositionStyle,
      aspectRatio: resolvedVideoAspect,
      // Definite width so aspect-ratio can resolve height (auto/auto → 0 in Safari).
      width: "100%",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "100%",
      left: "50%",
      top: "50%",
      transform:
        `translate(-50%, -50%) ${contentTransform || transform}`.trim(),
    }
  })()

  const videoInner = (
    <video
      ref={setMediaRef}
      src={screenshot}
      muted
      loop
      playsInline
      preload={videoPreload}
      draggable={false}
      onLoadedMetadata={(e) => {
        const el = e.currentTarget
        if (el.videoWidth > 0 && el.videoHeight > 0) {
          setVideoAspectState({
            src: screenshot,
            aspect: `${el.videoWidth} / ${el.videoHeight}`,
          })
        }
        onImageLoad(e as unknown as React.SyntheticEvent<HTMLImageElement>)
      }}
      onError={() =>
        toast.error(
          "Couldn't load this video — the file may be corrupted or use an unsupported codec.",
          {
            id: "video-load-error",
          }
        )
      }
      {...(activeCrop
        ? {
            style: {
              ...cropMediaObjectStyle(activeCrop),
              ...cropCoverTransform,
            },
            className: "pointer-events-none absolute max-h-none max-w-none",
          }
        : {
            className: cn(
              "pointer-events-none absolute inset-0 h-full w-full",
              objectFit === "contain" && "object-contain",
              objectFit === "cover" && "object-cover",
              objectFit === "fill" && "object-fill"
            ),
          })}
    />
  )

  return (
    <div
      ref={stageRef}
      className="group/screenshot pointer-events-none relative h-full w-full overflow-visible"
      onPointerDown={onContainerPointerDown}
      onWheel={onWheel}
    >
      {isVideo ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          ref={setVideoShellRef}
          data-box-hover-target
          data-editor-shadow-box-target={shadowBoxTarget ? "" : undefined}
          data-export-stack="media"
          style={videoShellStyle}
          className={cn(
            mediaClassName,
            "overflow-hidden",
            // Letterbox space belongs to the canvas backdrop, not an invented
            // black bezel. Cover/fill still need their opaque video plate.
            objectFit !== "contain" && "bg-black",
            !resolvedVideoAspect && "transition-none"
          )}
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
        >
          {videoInner}
          <VideoIdlePoster src={screenshot} />
        </div>
      ) : (
        <ShimmerImage
          ref={imageRef}
          shimmer
          data-box-hover-target
          data-editor-shadow-box-target={shadowBoxTarget ? "" : undefined}
          data-export-stack="media"
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
          // Foreground stack: video-media export captures this above the
          // decoded frame so lighting (and siblings) sit on top of the video.
          data-export-stack="foreground"
          data-export-inner-lighting=""
          className="pointer-events-none absolute z-10 transition-none"
          style={{
            ...innerLightingStyle,
            ...lightSizeStyle,
            ...lightTransform,
            borderRadius: imgStyle.borderRadius,
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
          className="pointer-events-none absolute z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 transition-none outline-dashed"
          style={{
            ...lightSizeStyle,
            ...lightTransform,
            borderRadius: imgStyle.borderRadius,
          }}
        />
      ) : null}

      {activeTool === "pointer" &&
        placementDims &&
        !selectedTextId &&
        !isAnimationPlaying && (
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
