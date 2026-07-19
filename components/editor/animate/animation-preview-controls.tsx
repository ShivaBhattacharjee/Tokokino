"use client"

import * as React from "react"
import {
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiRestartLine,
} from "@remixicon/react"

import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import { cn } from "@/lib/utils"

/**
 * Play/pause + restart for an ANIMATION preview (single animated canvas). Replaces
 * the slideshow controls, which only make sense when preview cycles through
 * multiple screenshots. Drives the shared animation player, so pressing play
 * animates the on-canvas AnimationLayer exactly like the timeline's play button.
 *
 * Owns Space while mounted — AnimateBar (and its Space handler) is hidden in
 * preview, so without this shortcut play/pause would only work via the button.
 */
export function AnimationPreviewControls() {
  const player = useAnimationPlayerOptional()
  const toggle = player?.toggle
  const reset = player?.reset
  const isPlaying = player?.isPlaying ?? false

  React.useEffect(() => {
    if (!toggle) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.tagName === "BUTTON" ||
          t.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  if (!player || !toggle || !reset) return null

  return (
    <div className="flex h-10 items-center overflow-hidden rounded-md border border-foreground/15 bg-background/80 shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={toggle}
        title={isPlaying ? "Pause" : "Play"}
        className="flex h-full cursor-pointer items-center px-3 text-foreground transition-colors hover:bg-foreground/6"
      >
        {isPlaying ? (
          <RiPauseCircleLine className="size-4" />
        ) : (
          <RiPlayCircleLine className="size-4" />
        )}
      </button>
      <div className="h-5 w-px bg-foreground/12" />
      <button
        type="button"
        onClick={reset}
        title="Restart"
        className={cn(
          "flex h-full cursor-pointer items-center px-3 text-foreground transition-colors hover:bg-foreground/6"
        )}
      >
        <RiRestartLine className="size-4" />
      </button>
    </div>
  )
}
