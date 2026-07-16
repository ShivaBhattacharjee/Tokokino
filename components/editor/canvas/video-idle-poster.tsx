"use client"

import * as React from "react"
import { RiPlayFill } from "@remixicon/react"

import { supportsObjectViewBox } from "@/lib/editor/crop-utils"
import { useCanvasPreviewMode } from "@/lib/editor/store"
import {
  isVideoSrcRevealed,
  markVideoSrcRevealed,
  paintVideoFrame,
  requestVideoFrameReveal,
  subscribeVideoSrcReveal,
} from "@/lib/editor/video-frame-reveal"
import { getVideoMutedPreferenceSync } from "@/lib/editor/video-mute-preference"
import { cn } from "@/lib/utils"

/**
 * Chromium paints a `<video>` frame at rest; Safari/Firefox often leave it
 * blank until a seek or play. We:
 *  1. Decode one idle first-frame on the main (non-preview) video so the canvas
 *     and every preset thumb can show real pixels without waiting for Play.
 *  2. Keep a play affordance on the main canvas until playback actually starts.
 *  3. Hide the solid black fallback on preset thumbs as soon as a frame exists.
 */
function useNeedsVideoIdlePoster() {
  return React.useSyncExternalStore(
    () => () => {},
    () => !supportsObjectViewBox(),
    () => false
  )
}

function useVideoSrcRevealed(src: string | null | undefined) {
  return React.useSyncExternalStore(
    subscribeVideoSrcReveal,
    () => isVideoSrcRevealed(src),
    () => false
  )
}

function findSiblingVideo(from: HTMLElement | null): HTMLVideoElement | null {
  const parent = from?.parentElement
  if (!parent) return null
  return parent.querySelector("video")
}

export function VideoIdlePoster({
  src,
  className,
  /** When true, click starts playback. Preset thumbs can set false. */
  interactive = true,
}: {
  /** Screenshot/video src — used to sync reveal across main canvas + presets. */
  src?: string | null
  className?: string
  interactive?: boolean
}) {
  const needsPoster = useNeedsVideoIdlePoster()
  const isPreview = useCanvasPreviewMode()
  const frameRevealed = useVideoSrcRevealed(src)
  const rootRef = React.useRef<HTMLSpanElement | null>(null)
  const [playbackStarted, setPlaybackStarted] = React.useState(false)

  // Preset / thumbnail canvases never need a clickable play overlay.
  const effectiveInteractive = interactive && !isPreview

  // Main canvas leads: decode one first frame without requiring Play so iPad
  // Safari preset thumbs aren't stuck on the solid black fallback.
  React.useLayoutEffect(() => {
    if (!needsPoster || frameRevealed || isPreview) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return
    requestVideoFrameReveal(
      video,
      src ?? (video.currentSrc || video.getAttribute("src"))
    )
  }, [needsPoster, frameRevealed, isPreview, src])

  // When this video plays, mark the src revealed for every other instance.
  React.useEffect(() => {
    if (!needsPoster) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return

    const onPlay = () => {
      setPlaybackStarted(true)
      markVideoSrcRevealed(
        src ?? (video.currentSrc || video.getAttribute("src"))
      )
    }
    video.addEventListener("playing", onPlay)
    video.addEventListener("play", onPlay)
    // If the element is already mid-playback (e.g. remount), drop the poster.
    if (!video.paused && !video.ended) onPlay()
    return () => {
      video.removeEventListener("playing", onPlay)
      video.removeEventListener("play", onPlay)
    }
  }, [needsPoster, src])

  // A frame is known for this src — paint this sibling so the thumb isn't an
  // empty black box under a removed poster. useLayoutEffect so we still have
  // the sentinel ref before paint.
  React.useLayoutEffect(() => {
    if (!needsPoster || !frameRevealed) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return
    const paint = () => {
      if (!video.paused || video.currentTime > 0.001) return
      paintVideoFrame(video)
    }
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      paint()
      return
    }
    video.addEventListener("loadedmetadata", paint, { once: true })
    if (video.preload === "none") {
      video.preload = "metadata"
      video.load()
    }
    return () => video.removeEventListener("loadedmetadata", paint)
  }, [needsPoster, frameRevealed])

  // Always keep a sentinel in the DOM so we can find the sibling <video>
  // after the visible poster is removed (preset thumbs need a seek to paint).
  const sentinel = (
    <span
      ref={rootRef}
      aria-hidden
      data-export-hidden="true"
      className="pointer-events-none absolute size-0 overflow-hidden"
    />
  )

  // Preview thumbs: hide as soon as a frame exists (no play chrome).
  if (isPreview || !effectiveInteractive) {
    if (!needsPoster || frameRevealed) return sentinel
    return (
      <>
        {sentinel}
        <div
          aria-hidden
          data-export-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-[1] bg-black",
            className
          )}
        />
      </>
    )
  }

  // Main canvas: keep play affordance until playback starts. Once a first
  // frame is decoded, drop the solid black cover so the frame shows through.
  if (!needsPoster || playbackStarted) return sentinel

  const content = (
    <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition hover:brightness-110">
      <RiPlayFill className="size-6 translate-x-px" />
    </span>
  )

  return (
    <>
      {sentinel}
      <button
        type="button"
        data-export-hidden="true"
        aria-label="Play video"
        className={cn(
          "absolute inset-0 z-[1] flex cursor-pointer items-center justify-center",
          frameRevealed ? "bg-black/35" : "bg-black",
          className
        )}
        onClick={(e) => {
          e.stopPropagation()
          const video = findSiblingVideo(rootRef.current)
          if (!video) return
          // Honor the saved mute preference (default muted for autoplay safety).
          video.muted = getVideoMutedPreferenceSync()
          void video.play().catch(() => undefined)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {content}
      </button>
    </>
  )
}
