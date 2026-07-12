"use client"

import * as React from "react"
import { RiPlayFill } from "@remixicon/react"

import { supportsObjectViewBox } from "@/lib/editor/crop-utils"
import {
  isVideoSrcRevealed,
  markVideoSrcRevealed,
  paintVideoFrame,
  subscribeVideoSrcReveal,
} from "@/lib/editor/video-frame-reveal"
import { cn } from "@/lib/utils"

/**
 * Chromium paints a `<video>` frame at rest; Safari/Firefox often leave it
 * blank until play. Rather than seeking/decoding on mount (slow), show a black
 * play affordance until playback starts — then share that reveal across every
 * element with the same src (preset thumbs, etc.).
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
  const revealed = useVideoSrcRevealed(src)
  const rootRef = React.useRef<HTMLSpanElement | null>(null)
  const visible = needsPoster && !revealed

  // When this video plays, mark the src revealed for every other instance.
  React.useEffect(() => {
    if (!needsPoster || revealed) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return

    const reveal = () => {
      markVideoSrcRevealed(
        src ?? (video.currentSrc || video.getAttribute("src"))
      )
    }
    video.addEventListener("playing", reveal)
    video.addEventListener("play", reveal)
    return () => {
      video.removeEventListener("playing", reveal)
      video.removeEventListener("play", reveal)
    }
  }, [needsPoster, revealed, src])

  // Main canvas already revealed this src — paint this sibling so the thumb
  // isn't an empty black box under a removed poster. useLayoutEffect so we
  // still have the sentinel ref before paint.
  React.useLayoutEffect(() => {
    if (!needsPoster || !revealed) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return
    const paint = () => paintVideoFrame(video)
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) paint()
    else video.addEventListener("loadedmetadata", paint, { once: true })
  }, [needsPoster, revealed])

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

  if (!visible) return sentinel

  const content = (
    <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition hover:brightness-110">
      <RiPlayFill className="size-6 translate-x-px" />
    </span>
  )

  const sharedClassName = cn(
    "absolute inset-0 z-[1] flex items-center justify-center bg-black",
    className
  )

  if (!interactive) {
    return (
      <>
        {sentinel}
        <div
          aria-hidden
          data-export-hidden="true"
          className={cn(sharedClassName, "pointer-events-none")}
        >
          {content}
        </div>
      </>
    )
  }

  return (
    <>
      {sentinel}
      <button
        type="button"
        data-export-hidden="true"
        aria-label="Play video"
        className={cn(sharedClassName, "cursor-pointer")}
        onClick={(e) => {
          e.stopPropagation()
          const video = findSiblingVideo(rootRef.current)
          if (!video) return
          video.muted = true
          void video.play().catch(() => undefined)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {content}
      </button>
    </>
  )
}
