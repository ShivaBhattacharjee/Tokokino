"use client"

import * as React from "react"
import { RiPlayFill } from "@remixicon/react"

import { supportsObjectViewBox } from "@/lib/editor/crop-utils"
import { cn } from "@/lib/utils"

/**
 * Chromium paints a `<video>` frame at rest; Safari/Firefox often leave it
 * blank until play. Rather than seeking/decoding on mount (slow), show a black
 * play affordance until playback starts on browsers that need it.
 */
export function useNeedsVideoIdlePoster() {
  return React.useSyncExternalStore(
    () => () => {},
    () => !supportsObjectViewBox(),
    () => false
  )
}

function findSiblingVideo(from: HTMLElement | null): HTMLVideoElement | null {
  const parent = from?.parentElement
  if (!parent) return null
  return parent.querySelector("video")
}

export function VideoIdlePoster({
  className,
  /** When true, click starts playback. Preset thumbs can set false. */
  interactive = true,
}: {
  className?: string
  interactive?: boolean
}) {
  const needsPoster = useNeedsVideoIdlePoster()
  const [hasPlayed, setHasPlayed] = React.useState(false)
  const rootRef = React.useRef<HTMLElement | null>(null)
  const visible = needsPoster && !hasPlayed

  React.useEffect(() => {
    if (!needsPoster || hasPlayed) return
    const video = findSiblingVideo(rootRef.current)
    if (!video) return

    const hide = () => setHasPlayed(true)
    video.addEventListener("playing", hide)
    video.addEventListener("play", hide)
    return () => {
      video.removeEventListener("playing", hide)
      video.removeEventListener("play", hide)
    }
  }, [needsPoster, hasPlayed])

  if (!visible) return null

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
      <div
        ref={rootRef as React.RefObject<HTMLDivElement>}
        aria-hidden
        data-export-hidden="true"
        className={cn(sharedClassName, "pointer-events-none")}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      ref={rootRef as React.RefObject<HTMLButtonElement>}
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
  )
}
