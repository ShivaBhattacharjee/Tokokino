import * as React from "react"
import { RiAddLine, RiLoader4Line, RiSubtractLine } from "@remixicon/react"
import type { PercentCrop } from "react-image-crop"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ImageCrop,
  ImageCropContent,
  ImageCropApply,
  ImageCropReset,
} from "@/components/kibo-ui/image-crop"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  createCropSource,
  cropSourceFromBlob,
  renderCroppedImage,
  type CropSource,
} from "@/lib/editor/crop-source"
import { useCropDragAutoScroll } from "@/hooks/use-crop-drag-autoscroll"
import { isVideoSrc } from "@/lib/editor/media-type"
import type { CropRegion } from "@/lib/editor/store"

/**
 * Where to seek for the crop dialog's still preview: the playhead the user is
 * cropping against, clamped inside the clip. Only when there is no usable
 * playhead does it fall back to a small nudge off zero — decoding at exactly 0
 * yields a black/empty frame on some codecs, which is why the original code
 * always seeked there, and why cropping six seconds in framed the wrong shot.
 */
export function posterSeekTime(atSec: number, duration: number): number {
  const fallback = Math.min(0.1, duration / 2)
  if (!Number.isFinite(atSec) || atSec <= 0) return fallback
  if (!(duration > 0)) return atSec
  // Never land ON the final boundary — seeking to exactly `duration` decodes
  // past the last frame and paints black.
  return Math.min(atSec, Math.max(0, duration - 0.01))
}

/**
 * Grab a still poster frame from a video src so react-image-crop (which is
 * image-only) has something to draw the crop handles over. The returned frame
 * is only used for handle placement — the video itself is never re-encoded; the
 * caller applies the resulting CropRegion at render time.
 *
 * `atSec` is the playhead the user is cropping against. It matters: framing a
 * crop on frame 0 while the canvas shows six seconds in means placing the
 * handles over content that isn't on screen.
 */
async function videoPosterBlob(url: string, atSec = 0): Promise<Blob> {
  const video = document.createElement("video")
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.crossOrigin = "anonymous"
  // Explicit load() — required for reliable metadata on Firefox/Safari when the
  // element is created off-DOM (setting src alone is not always enough).
  video.load()

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.onloadeddata = null
      video.onerror = null
      video.onseeked = null
    }
    const onError = () => {
      cleanup()
      reject(new Error("video load failed"))
    }
    const onLoaded = () => {
      const target = posterSeekTime(atSec, video.duration || 0)
      if (
        Number.isFinite(target) &&
        target > 0 &&
        video.currentTime !== target
      ) {
        video.onseeked = () => {
          cleanup()
          resolve()
        }
        video.currentTime = target
      } else {
        cleanup()
        resolve()
      }
    }
    video.onloadeddata = onLoaded
    video.onerror = onError
  })

  const w = video.videoWidth || 1280
  const h = video.videoHeight || 720
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no 2d context")
  ctx.drawImage(video, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  )
  if (!blob) throw new Error("poster encode failed")
  return blob
}

type Preset = {
  label: string
  aspect: number
  w: number
  h: number
}

/** Zoom is a multiple of the fitted size: 1 shows the whole image. */
const MIN_ZOOM = 1
const MAX_ZOOM = 16
const ZOOM_STEP = 1.5
/** `p-6` on both sides of the cropper viewport. */
const VIEWPORT_PADDING = 48
/** Cap for the one frame before the viewport has been measured. */
const FIT_FALLBACK_HEIGHT = 372
/** Long enough for the dialog's exit animation to finish. */
const CLOSE_ANIMATION_MS = 400

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

const PRESETS: Preset[] = [
  { label: "1:1", aspect: 1, w: 14, h: 14 },
  { label: "4:3", aspect: 4 / 3, w: 18, h: 13.5 },
  { label: "3:2", aspect: 3 / 2, w: 18, h: 12 },
  { label: "16:10", aspect: 16 / 10, w: 18, h: 11.25 },
  { label: "16:9", aspect: 16 / 9, w: 18, h: 10.125 },
  { label: "5:4", aspect: 5 / 4, w: 16, h: 12.8 },
  { label: "4:5", aspect: 4 / 5, w: 12.8, h: 16 },
]

export function CropModal({
  open,
  onOpenChange,
  screenshotUrl,
  initialRegion,
  targetAspect,
  getPosterTimeSec,
  onCrop,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenshotUrl: string | null
  initialRegion?: CropRegion | null
  targetAspect?: number | null
  /**
   * Video only: the source-media time the still preview should show, read when
   * the poster is decoded. A getter rather than a value because it comes from
   * `video.currentTime`, which React never re-renders on.
   */
  getPosterTimeSec?: () => number | null
  onCrop: (croppedBase64: string, region: CropRegion) => void
}) {
  const safeTargetAspect =
    targetAspect && Number.isFinite(targetAspect) && targetAspect > 0
      ? targetAspect
      : null
  const defaultAspect = safeTargetAspect ?? 16 / 10
  // `null` aspect means free-form: width/height drag independently.
  const [aspectOverride, setAspectOverride] = React.useState<{
    defaultAspect: number
    aspect: number | null
  } | null>(null)
  const [loadedSource, setLoadedSource] = React.useState<{
    url: string
    source: CropSource
  } | null>(null)
  // Default to free-form (null) until the user picks a ratio; `defaultAspect`
  // still backs the "Canvas" chip below.
  const aspect =
    aspectOverride?.defaultAspect === defaultAspect
      ? aspectOverride.aspect
      : null
  const isFree = aspect === null
  const setAspect = React.useCallback(
    (nextAspect: number | null) => {
      setAspectOverride({ defaultAspect, aspect: nextAspect })
    },
    [defaultAspect]
  )

  // Multiple of the fitted size. Always opens on the whole image: a long
  // capture is a sliver at that size, but auto-zooming it hides where the crop
  // sits in the page, which is the one thing the preview is for.
  const [zoom, setZoom] = React.useState(MIN_ZOOM)

  // Mirrors `loadedSource` so cleanup can revoke object URLs without going
  // through a state update that React skips once the dialog is unmounted.
  const sourceRef = React.useRef<CropSource | null>(null)
  const releaseSource = React.useCallback(() => {
    sourceRef.current?.release()
    sourceRef.current = null
  }, [])

  /**
   * Revoking on close races the dialog's exit animation: the <img> is still on
   * screen and re-requests a URL that no longer resolves, which shows up as a
   * failed `blob:` fetch. Let the animation finish first.
   */
  const releaseSourceAfterClose = React.useCallback(() => {
    const source = sourceRef.current
    sourceRef.current = null
    if (source) window.setTimeout(() => source.release(), CLOSE_ANIMATION_MS)
  }, [])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setAspectOverride(null)
        // Drop the decoded still too. It is keyed only by URL, so keeping it
        // would show the PREVIOUS open's frame the instant the dialog reopens —
        // for a video that is a different moment in the clip, not a cache hit.
        releaseSourceAfterClose()
        setLoadedSource(null)
        setZoom(MIN_ZOOM)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, releaseSourceAfterClose]
  )

  const isVideo = !!screenshotUrl && isVideoSrc(screenshotUrl)

  // Held in a ref so the poster effect can call it without listing it as a
  // dependency: it is read once per open, and re-running the decode as the
  // playhead moves would swap the still out from under a crop drag.
  const getPosterTimeRef = React.useRef(getPosterTimeSec)
  React.useEffect(() => {
    getPosterTimeRef.current = getPosterTimeSec
  })

  React.useEffect(() => {
    if (!open || !screenshotUrl) return

    let cancelled = false
    // Videos are never rendered by react-image-crop directly, so a still poster
    // stands in for the clip; everything else is fetched (through the proxy for
    // cross-origin hosts) and previewed at a size the dialog can actually show.
    const loader = isVideo
      ? videoPosterBlob(screenshotUrl, getPosterTimeRef.current?.() ?? 0).then(
          cropSourceFromBlob
        )
      : createCropSource(screenshotUrl)

    void loader
      .then((source) => {
        if (cancelled) {
          source.release()
          return
        }
        releaseSource()
        sourceRef.current = source
        setLoadedSource({ url: screenshotUrl, source })
      })
      .catch(() => {
        if (cancelled) return
        toast.error(
          isVideo ? "Could not load this video" : "Could not load this image"
        )
        handleOpenChange(false)
      })

    return () => {
      cancelled = true
    }
    // `handleOpenChange` is only used on the failure path and is stable per
    // `onOpenChange`; re-running the load because it changed identity would
    // decode the source again mid-crop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screenshotUrl, isVideo])

  // Release the decoded source if the dialog unmounts while still open.
  React.useEffect(() => releaseSource, [releaseSource])

  const source =
    open && loadedSource?.url === screenshotUrl ? loadedSource.source : null

  const [viewport, setViewport] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const dragAutoScroll = useCropDragAutoScroll(viewportRef)

  // A drag can outlive the dialog (Escape mid-drag) — drop its listeners.
  React.useEffect(() => dragAutoScroll.stop, [dragAutoScroll])

  const measureViewport = React.useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    if (!node) return
    const read = () => {
      const width = node.clientWidth
      const height = node.clientHeight
      setViewport((current) =>
        current?.width === width && current?.height === height
          ? current
          : { width, height }
      )
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  /**
   * Size the image is drawn at: fitted inside the viewport (never blown up past
   * its natural size) and then multiplied by the zoom. Null until the viewport
   * has been measured, which leaves the cropper on its own CSS fit.
   */
  const fitSize = React.useMemo(() => {
    if (!source || !viewport) return null
    const availWidth = viewport.width - VIEWPORT_PADDING
    const availHeight = viewport.height - VIEWPORT_PADDING
    if (availWidth <= 0 || availHeight <= 0) return null
    if (!source.width || !source.height) return null
    const scale = Math.min(
      1,
      availWidth / source.width,
      availHeight / source.height
    )
    return { width: source.width * scale, height: source.height * scale }
  }, [source, viewport])

  /**
   * Zooming keeps whatever is in the middle of the viewport in the middle,
   * rather than snapping back to the top-left of a now much larger image.
   * Captured as fractions before the resize, reapplied once it has laid out.
   */
  const scrollAnchor = React.useRef<{ x: number; y: number } | null>(null)
  const zoomTo = (next: number) => {
    const node = viewportRef.current
    if (node) {
      scrollAnchor.current = {
        x:
          (node.scrollLeft + node.clientWidth / 2) /
          Math.max(1, node.scrollWidth),
        y:
          (node.scrollTop + node.clientHeight / 2) /
          Math.max(1, node.scrollHeight),
      }
    }
    setZoom(clampZoom(next))
  }

  const displaySize = React.useMemo(() => {
    if (!fitSize) return null
    return { width: fitSize.width * zoom, height: fitSize.height * zoom }
  }, [fitSize, zoom])

  React.useLayoutEffect(() => {
    const anchor = scrollAnchor.current
    const node = viewportRef.current
    if (!anchor || !node) return
    scrollAnchor.current = null
    node.scrollLeft = anchor.x * node.scrollWidth - node.clientWidth / 2
    node.scrollTop = anchor.y * node.scrollHeight - node.clientHeight / 2
  }, [displaySize])

  // Nothing to zoom until we know what size the image is being drawn at.
  const canZoom = !!fitSize

  // A small screenshot is ready within a frame or two; showing the spinner
  // immediately would just flash. Only a genuinely heavy source waits.
  const [showLoader, setShowLoader] = React.useState(false)
  React.useEffect(() => {
    if (!open || source) return
    const timer = window.setTimeout(() => setShowLoader(true), 180)
    return () => {
      window.clearTimeout(timer)
      setShowLoader(false)
    }
  }, [open, source])

  const handleApply = React.useCallback(
    (region: PercentCrop) => {
      if (!source) return
      const cropRegion: CropRegion = {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      }
      // Close first: the render reads the ORIGINAL bytes, so it can take a
      // moment on a large screenshot and there is nothing left to look at.
      handleOpenChange(false)
      void renderCroppedImage(source, cropRegion)
        .then((cropped) => {
          if (cropped) onCrop(cropped, cropRegion)
        })
        .catch(() => {
          toast.error("Could not apply this crop")
        })
    },
    [source, handleOpenChange, onCrop]
  )

  const initialPercentCrop = React.useMemo<PercentCrop | undefined>(() => {
    if (!initialRegion) return undefined
    return { unit: "%", ...initialRegion }
  }, [initialRegion])

  const targetPreset = React.useMemo<Preset>(() => {
    const ratio = defaultAspect
    const longSide = 18
    const shortSide = longSide / ratio
    return ratio >= 1
      ? {
          label: "Canvas",
          aspect: ratio,
          w: longSide,
          h: Math.max(8, Math.min(18, shortSide)),
        }
      : {
          label: "Canvas",
          aspect: ratio,
          w: Math.max(8, Math.min(18, longSide * ratio)),
          h: longSide,
        }
  }, [defaultAspect])

  const presets = React.useMemo(() => {
    const rest = PRESETS.filter(
      (preset) => Math.abs(preset.aspect - targetPreset.aspect) > 0.01
    )
    return [targetPreset, ...rest]
  }, [targetPreset])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-2xl sm:max-w-[760px]"
      >
        <DialogTitle className="sr-only">
          {isVideo ? "Crop video" : "Crop screenshot"}
        </DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              {isVideo ? "Crop video" : "Crop screenshot"}
            </span>
            <DialogDescription className="text-[11px] text-muted-foreground">
              {isVideo
                ? "Preview shows a still frame — the crop applies to the whole clip"
                : "Drag the handles or pick a preset ratio"}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {!source ? (
          // The dialog opens straight away and fills in once the source is
          // decoded — a 20 MB screenshot takes a beat, and a modal that only
          // appears after that read as a frozen or dead crop button.
          <div
            className="flex h-[420px] items-center justify-center"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
              backgroundSize: "14px 14px",
            }}
          >
            {showLoader ? (
              <span className="flex items-center gap-2 rounded-lg border border-border/60 bg-popover px-3 py-2 text-[12px] text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Preparing {isVideo ? "frame" : "image"}…
              </span>
            ) : null}
          </div>
        ) : (
          <ImageCrop
            key={aspect ?? "free"}
            src={source.previewUrl}
            aspect={aspect ?? undefined}
            keepSelection
            initialCrop={
              aspect === null || Math.abs(aspect - targetPreset.aspect) < 0.01
                ? initialPercentCrop
                : undefined
            }
            onCrop={handleApply}
          >
            {/* Cropper Area */}
            <div className="relative">
              <div
                ref={measureViewport}
                onPointerDown={dragAutoScroll.onPointerDown}
                // A stable gutter keeps the fitted size from changing when the
                // zoomed image summons a scrollbar (which would resize it again).
                className="h-[420px] [scrollbar-gutter:stable] overflow-auto overscroll-contain"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
                  backgroundSize: "14px 14px",
                }}
              >
                {/* `w-max min-w-full` so the image centres while it fits and
                    the box still grows — and scrolls — once zoom outruns it. */}
                <div className="flex h-max min-h-full w-max min-w-full items-center justify-center p-6">
                  <ImageCropContent
                    className="rounded-lg"
                    // Both elements have to be uncapped: the cropper's child
                    // wrapper and its <img> inherit max-height from the root,
                    // and either cap would pin the image at the fitted size
                    // however far it is zoomed.
                    style={
                      displaySize
                        ? { maxWidth: "none", maxHeight: "none" }
                        : { maxWidth: "100%", maxHeight: FIT_FALLBACK_HEIGHT }
                    }
                    imageStyle={
                      displaySize
                        ? {
                            width: displaySize.width,
                            height: displaySize.height,
                            maxWidth: "none",
                            maxHeight: "none",
                          }
                        : undefined
                    }
                  />
                </div>
              </div>

              {canZoom ? (
                <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover/95 p-0.5 shadow-md backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => zoomTo(zoom / ZOOM_STEP)}
                    disabled={zoom <= MIN_ZOOM}
                    aria-label="Zoom out"
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RiSubtractLine className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomTo(MIN_ZOOM)}
                    title="Fit to view"
                    className="min-w-11 cursor-pointer rounded-md px-1 py-1 text-[11px] font-medium text-foreground tabular-nums transition-colors hover:bg-secondary"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomTo(zoom * ZOOM_STEP)}
                    disabled={zoom >= MAX_ZOOM}
                    aria-label="Zoom in"
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RiAddLine className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4 border-t border-border/50 bg-background/40 px-4 py-3">
              {/* Aspect chips */}
              <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <button
                  onClick={() => setAspect(null)}
                  className={cn(
                    "group flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium tracking-tight transition-all",
                    isFree
                      ? "border-foreground/80 bg-foreground text-background"
                      : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground"
                  )}
                  aria-pressed={isFree}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block size-3.5 shrink-0 rounded-[2px] border border-dashed transition-colors",
                      isFree
                        ? "border-background/70"
                        : "border-current opacity-70"
                    )}
                  />
                  <span className="leading-none">Free</span>
                </button>
                {presets.map((p) => {
                  const isActive =
                    aspect !== null && Math.abs(aspect - p.aspect) < 0.01
                  return (
                    <button
                      key={p.label}
                      onClick={() => setAspect(p.aspect)}
                      className={cn(
                        "group flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium tracking-tight transition-all",
                        isActive
                          ? "border-foreground/80 bg-foreground text-background"
                          : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground"
                      )}
                      aria-pressed={isActive}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "block shrink-0 rounded-[2px] border transition-colors",
                          isActive
                            ? "border-background/70"
                            : "border-current opacity-70"
                        )}
                        style={{ width: `${p.w}px`, height: `${p.h}px` }}
                      />
                      <span className="leading-none">{p.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Buttons */}
              <div className="flex shrink-0 items-center gap-2 border-l border-border/50 pl-3">
                <ImageCropReset asChild>
                  <Button
                    variant="ghost"
                    className="h-8 cursor-pointer rounded-md px-3 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    Reset
                  </Button>
                </ImageCropReset>
                <ImageCropApply asChild>
                  <Button className="h-8 cursor-pointer rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                    Apply crop
                  </Button>
                </ImageCropApply>
              </div>
            </div>
          </ImageCrop>
        )}
      </DialogContent>
    </Dialog>
  )
}
