"use client"

import * as React from "react"
import Plyr from "plyr"
import "plyr/dist/plyr.css"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import "./share-plyr.css"

/**
 * Themed Plyr player for public / library animate shares.
 * Keeps a fixed aspect box + skeleton until media metadata is ready so the
 * layout doesn't collapse to a weird zero-height strip while the file loads.
 */
export function SharePlyrPlayer({
  src,
  contentType,
  className,
  poster,
}: {
  src: string
  contentType: string
  className?: string
  poster?: string | null
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const playerRef = React.useRef<Plyr | null>(null)
  const [ready, setReady] = React.useState(false)
  const [activeSrc, setActiveSrc] = React.useState(src)

  if (src !== activeSrc) {
    setActiveSrc(src)
    setReady(false)
  }

  React.useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const markReady = () => setReady(true)

    const player = new Plyr(el, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
      settings: ["speed"],
      hideControls: true,
      resetOnEnd: false,
      // Reserve space before intrinsic size is known.
      ratio: "16:9",
      keyboard: { focused: true, global: false },
    })
    playerRef.current = player

    player.on("loadedmetadata", markReady)
    player.on("ready", markReady)
    player.on("canplay", markReady)
    // Already buffered (cached share).
    if (el.readyState >= 1) markReady()

    return () => {
      player.off("loadedmetadata", markReady)
      player.off("ready", markReady)
      player.off("canplay", markReady)
      player.destroy()
      playerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.source = {
      type: "video",
      sources: [{ src, type: contentType }],
      poster: poster ?? undefined,
    }
  }, [src, contentType, poster])

  return (
    <div
      className={cn(
        "share-plyr relative w-full overflow-hidden",
        // Stable box so the page doesn't jump while Plyr mounts / video loads.
        "aspect-video min-h-[220px] sm:min-h-[320px]",
        className
      )}
    >
      {!ready ? (
        <div
          className="absolute inset-0 z-[2] flex flex-col justify-end gap-3 bg-secondary/40 p-4"
          aria-busy="true"
          aria-label="Loading video"
        >
          <Skeleton className="absolute inset-0 size-full rounded-none bg-muted/80" />
          <div className="relative z-[1] flex w-full items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      ) : null}

      {/* User-generated animate shares have no caption track. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={cn("plyr-react plyr size-full", !ready && "opacity-0")}
        playsInline
        controls
        crossOrigin="anonymous"
        poster={poster ?? undefined}
        preload="metadata"
      >
        <source src={src} type={contentType} />
      </video>
    </div>
  )
}
