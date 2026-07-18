/**
 * Video pixels for the keyframe (Animate-mode) export.
 *
 * `exportAnimation` rasterizes the offscreen clone through a serialized
 * `<foreignObject>`, and a `<video>` never renders there: its `blob:` source
 * can't load in the isolated SVG, so the clip's box comes out empty. Nothing in
 * that pipeline seeks or decodes the clone's video either, so even a loadable
 * source would stay frozen.
 *
 * The video-media export dodges this by rasterizing the scene once and compositing
 * decoded frames onto a fixed rect — which keyframes rule out, since they move
 * and tilt the video box every frame. Replace the clone's video with a normal
 * `<img>` and update its data URL per frame instead: Safari serializes the image
 * reliably while the surrounding DOM keeps every animated transform, effect,
 * crop and frame.
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

/** A slice of the source clip, and where it sits on the animation timeline. */
export type VideoSegment = {
  sourceStartMs: number
  sourceEndMs: number
  timelineStartMs: number
}

/**
 * Normalize `videoClips` into segments, clamped to the source's real length —
 * the trim model `use-animate-timeline` resolves for the timeline UI. Frames and
 * audio both derive their timing from this, so they cannot drift apart.
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

const VIDEO_ONLY_ATTRIBUTES = new Set([
  "src",
  "poster",
  "preload",
  "autoplay",
  "loop",
  "muted",
  "playsinline",
  "controls",
])

/**
 * Replace the serialized media element with an image shell that has exactly the
 * same layout classes and inline styles. Data-URI images are the dynamic source
 * WebKit reliably resolves inside an SVG `<foreignObject>`.
 */
function replaceVideoWithFrameImage(video: HTMLVideoElement): {
  paint: (frame: CanvasImageSource) => Promise<boolean>
} | null {
  const image = document.createElement("img")
  image.alt = ""
  image.decoding = "sync"
  image.draggable = false

  for (const attribute of Array.from(video.attributes)) {
    if (VIDEO_ONLY_ATTRIBUTES.has(attribute.name.toLowerCase())) continue
    image.setAttribute(attribute.name, attribute.value)
  }

  const raster = document.createElement("canvas")
  const context = raster.getContext("2d", { willReadFrequently: true })
  if (!context) return null

  video.replaceWith(image)

  return {
    paint: async (frame) => {
      const width = "width" in frame ? Number(frame.width) : 0
      const height = "height" in frame ? Number(frame.height) : 0
      if (!width || !height) return false
      if (raster.width !== width || raster.height !== height) {
        raster.width = width
        raster.height = height
      } else {
        context.clearRect(0, 0, width, height)
      }

      try {
        context.drawImage(frame, 0, 0, width, height)
        // JPEG, not PNG: frames are photographic and always opaque, and a PNG
        // encode per frame would dominate the per-frame cost of the export.
        // html-to-image decodes this URL back into pixels before encoding, so
        // using PNG here does not remove a lossy encoding step.
        image.src = raster.toDataURL("image/jpeg", 0.92)
        await image.decode().catch(() => undefined)
        return image.naturalWidth > 0 && image.naturalHeight > 0
      } catch {
        // Preserve the previous valid image rather than replacing it with black.
        return false
      }
    },
  }
}

/**
 * Replace the serialized clone video with per-frame static image data. Returns
 * null when the clip cannot be decoded here — the export then uses its existing
 * fallback path.
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

  // The clone's video is loaded only for its duration, which anchors the trim
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

  const frameImage = replaceVideoWithFrameImage(video)
  if (!frameImage) {
    decoded.cleanup()
    return null
  }

  let lastFrame: CanvasImageSource | null = null
  const paintSourceMs = async (sourceMs: number) => {
    const frame = await decoded.getFrameAt(sourceMs / 1000)
    // The decoder hands back the same canvas until the next frame starts, so
    // exporting above the source's fps re-encodes identical pixels without this.
    if (!frame || frame === lastFrame) return

    if (!(await frameImage.paint(frame))) return
    lastFrame = frame
  }

  // Seed a frame before any capture so the image has intrinsic pixels before
  // the clone's layout is serialized.
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
      if (sourceMs !== null) await paintSourceMs(sourceMs)
    },
    sourceDurationMs,
    cleanup: () => decoded.cleanup(),
  }
}
