/**
 * Video pixels for the keyframe (Animate-mode) export.
 *
 * `exportAnimation` rasterizes the offscreen clone through a serialized
 * `<foreignObject>`, and a `<video>` never renders there: its `blob:` source
 * can't load in the isolated SVG, so the clip's box comes out empty (WebKit
 * paints its default media controls into the gap). Nothing in that pipeline ever
 * seeks or decodes the clone's video either, so even a loadable source would
 * stay frozen.
 *
 * The video-media export dodges this by rasterizing the scene once and compositing
 * decoded frames onto a fixed rect — which keyframes rule out, since they move
 * and tilt the video box every frame. So instead swap the clone's `<video>` for
 * an `<img>` that inherits its classes and inline styles (crop, object-fit,
 * radius and frame layout keep working, and the frame's natural size still
 * drives them), then repoint `src` at each decoded frame before capture. A data
 * URI `<img>` rasterizes in every engine, on both capture paths.
 */

import type { VideoTimelineClip } from "../state-types"
import { createDecodedFrameSource } from "./video-media/decoded-frames"
import { waitForVideoReady } from "./video-media/dom-video"

/** Matches the store's implicit "whole clip" default when `videoClips` is unset. */
const DEFAULT_VIDEO_CLIP: VideoTimelineClip = {
  id: "video-main",
  timelineStartMs: 0,
  startMs: 0,
  endMs: null,
}

/** Attributes that only mean something on a `<video>`, or that we drive ourselves. */
const DROPPED_VIDEO_ATTRIBUTES = new Set([
  "src",
  "poster",
  "preload",
  "controls",
  "autoplay",
  "loop",
  "muted",
  "playsinline",
])

/** A slice of the source clip, and where it sits on the animation timeline. */
export type VideoSegment = {
  sourceStartMs: number
  sourceEndMs: number
  timelineStartMs: number
}

/**
 * Normalize `videoClips` into segments, clamped to the source's real length —
 * the trim model `use-animate-timeline` resolves for the timeline UI. Frames and
 * audio both derive their timing from this, so they can't drift apart.
 */
export function resolveVideoSegments(
  clips: readonly VideoTimelineClip[],
  sourceDurationMs: number
): VideoSegment[] {
  const source = clips.length > 0 ? clips : [DEFAULT_VIDEO_CLIP]
  return source.map((clip) => {
    const sourceStartMs = Math.max(0, Math.min(clip.startMs, sourceDurationMs))
    return {
      sourceStartMs,
      sourceEndMs: Math.max(
        sourceStartMs,
        Math.min(clip.endMs ?? sourceDurationMs, sourceDurationMs)
      ),
      timelineStartMs: Math.max(0, clip.timelineStartMs ?? clip.startMs),
    }
  })
}

/**
 * Map a timeline position onto a time in the source clip. Returns null when no
 * segment covers `timelineMs` (before the clip starts, or past its end) — the
 * caller holds the last painted frame rather than blanking the video.
 */
export function resolveVideoSourceTimeMs(
  clips: readonly VideoTimelineClip[],
  timelineMs: number,
  sourceDurationMs: number
): number | null {
  for (const segment of resolveVideoSegments(clips, sourceDurationMs)) {
    const offset = timelineMs - segment.timelineStartMs
    if (offset >= 0 && offset < segment.sourceEndMs - segment.sourceStartMs) {
      return segment.sourceStartMs + offset
    }
  }
  return null
}

export type CloneVideoLayer = {
  /** Paint the frame the timeline shows at `timelineMs`. Call before capture. */
  paint: (timelineMs: number) => Promise<void>
  /** The source clip's real length — what the trim model is clamped against. */
  sourceDurationMs: number
  cleanup: () => void
}

function setImageSource(img: HTMLImageElement, url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    img.onload = () => resolve()
    // Keep whatever the img already showed rather than failing the whole export.
    img.onerror = () => resolve()
    img.src = url
  })
}

/**
 * Replace the clone's `<video>` with an `<img>` we repaint per frame. Returns
 * null when the clip can't be decoded here (no WebCodecs, or a codec this engine
 * won't take) — the export then renders as it did before rather than failing.
 */
export async function prepareCloneVideoLayer({
  node,
  src,
  videoClips,
  signal,
}: {
  node: HTMLElement
  src: string
  videoClips: readonly VideoTimelineClip[]
  signal?: AbortSignal
}): Promise<CloneVideoLayer | null> {
  const video = node.querySelector("video")
  if (!video) return null

  const decoded = await createDecodedFrameSource(src, signal)
  if (!decoded) return null

  // The clone's <video> is loaded only for its duration, which anchors the trim
  // math the same way the filmstrip's does on the timeline.
  let sourceDurationMs: number
  try {
    video.muted = true
    video.preload = "auto"
    await waitForVideoReady(video)
    sourceDurationMs = video.duration * 1000
  } catch {
    decoded.cleanup()
    return null
  }
  if (!Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0) {
    decoded.cleanup()
    return null
  }

  const img = document.createElement("img")
  for (const attribute of Array.from(video.attributes)) {
    if (DROPPED_VIDEO_ATTRIBUTES.has(attribute.name)) continue
    img.setAttribute(attribute.name, attribute.value)
  }
  video.replaceWith(img)

  const scratch = document.createElement("canvas")
  // A GPU-backed 2D context can read back black for decoded video on WebKit
  // (bug #237424); the CPU path this forces returns the real pixels.
  const ctx = scratch.getContext("2d", { willReadFrequently: true })
  if (!ctx) {
    decoded.cleanup()
    return null
  }

  let lastFrame: CanvasImageSource | null = null

  const paintSourceMs = async (sourceMs: number) => {
    const frame = await decoded.getFrameAt(sourceMs / 1000)
    // The decoder hands back the same canvas until the next frame starts, so
    // exporting above the source's fps re-encodes identical pixels without this.
    if (!frame || frame === lastFrame) return

    const w = Number((frame as { width?: unknown }).width) || 0
    const h = Number((frame as { height?: unknown }).height) || 0
    if (w <= 0 || h <= 0) return
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w
      scratch.height = h
    } else {
      ctx.clearRect(0, 0, w, h)
    }
    try {
      ctx.drawImage(frame, 0, 0, w, h)
    } catch {
      return
    }
    // JPEG, not PNG: frames are photographic and always opaque, and a PNG encode
    // per frame would dominate the per-frame cost of the export.
    await setImageSource(img, scratch.toDataURL("image/jpeg", 0.92))
    lastFrame = frame
  }

  // Seed a frame before any capture: a src-less <img> has no intrinsic size, and
  // the layout around it (contain shells, crop) is measured against that box.
  const firstClip = videoClips.length > 0 ? videoClips : [DEFAULT_VIDEO_CLIP]
  await paintSourceMs(
    Math.max(0, Math.min(...firstClip.map((clip) => clip.startMs)))
  )

  return {
    paint: async (timelineMs) => {
      const sourceMs = resolveVideoSourceTimeMs(
        videoClips,
        timelineMs,
        sourceDurationMs
      )
      // Outside every clip — hold whatever frame is already painted.
      if (sourceMs === null) return
      await paintSourceMs(sourceMs)
    },
    sourceDurationMs,
    cleanup: () => decoded.cleanup(),
  }
}
