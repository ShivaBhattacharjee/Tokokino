/**
 * Builds the per-frame renderer: given the styled clone and (optionally) a
 * WebCodecs frame source, returns a function that produces the fully styled
 * canvas for output frame `i`.
 *
 * Three strategies, in preference order:
 * 1. Composite — rasterize the scene ONCE with the video hidden and draw each
 *    decoded frame onto that template with 2D drawImage. Needs an untilted
 *    video whose box maps linearly to the frame (`measureVideoRegion`).
 * 2. Overlay — paint decoded frames into a `<canvas>` layered over the clone's
 *    `<video>` and rasterize per frame (3D-tilted videos).
 * 3. DOM seek + rVFC wait — no WebCodecs decode available; best-effort quality.
 */

import type { AnimationCapture } from "../../export"
import { supportsObjectViewBox } from "../../crop-utils"
import { waitForPaint } from "../utils"
import type { DecodedFrameSource } from "./decoded-frames"
import { seekTo, waitForVideoFrame } from "./dom-video"
import type { FramePlan, RenderFrame } from "./frames"
import { measureVideoRegion } from "./region"

/**
 * Overlay a canvas we paint ourselves on top of the clone's `<video>` so the
 * pixels html-to-image rasterizes come from a static `<canvas>` (reliable in
 * every engine) instead of a live `<video>` — which Safari/Firefox render
 * blank/black inside a serialized `<foreignObject>`.
 *
 * The `<video>` stays in the clone only for its box + crop/radius/object-fit
 * styling and natural size; the overlay copies those and sits one layer above,
 * showing the frame we paint (from the WebCodecs decoder). Returns a `paint()`
 * that draws a decoded frame into the overlay, or null when it can't be created.
 */
function overlayVideoFrameCanvas(
  video: HTMLVideoElement
): ((frame: CanvasImageSource) => void) | null {
  const parent = video.parentElement
  const canvas = document.createElement("canvas")
  // willReadFrequently forces a CPU-backed canvas. On Safari a GPU-backed 2D
  // context can return a *black* draw of decoded video (WebKit GPU-process bug
  // #237424 / Apple dev thread 708348); the CPU path draws the real pixels.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!parent || !ctx) return null

  // Reuse the video's own box + crop/radius/object-fit styling so the overlay
  // lands exactly where the video renders. A cropped video is absolutely
  // positioned (overflow polyfill); an uncropped one fills its parent in flow,
  // so force absolute inset-0 in that case to actually overlay rather than stack.
  canvas.className = video.className
  canvas.setAttribute("style", video.getAttribute("style") ?? "")
  const position = getComputedStyle(video).position
  if (position === "static" || position === "relative") {
    canvas.style.position = "absolute"
    canvas.style.inset = "0"
  }
  canvas.style.pointerEvents = "none"
  parent.insertBefore(canvas, video.nextSibling)

  return (frame: CanvasImageSource) => {
    // Size the overlay to the decoded frame's own intrinsic dimensions so the
    // copied object-fit maps it to the display box exactly as it does for the
    // video (and so we don't depend on the DOM <video>.videoWidth, which is
    // unreliable on Safari for an unplayed clone).
    const w = "width" in frame ? Number(frame.width) : video.videoWidth
    const h = "height" in frame ? Number(frame.height) : video.videoHeight
    if (!w || !h) return
    // Setting width/height also clears the canvas; only clear explicitly when
    // the size is unchanged.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    } else {
      ctx.clearRect(0, 0, w, h)
    }
    try {
      ctx.drawImage(frame, 0, 0, w, h)
    } catch {
      // Frame not drawable — keep the previous paint rather than blanking.
    }
  }
}

/**
 * Composite path: one scene raster reused for every frame, with the decoded
 * frame drawn into the measured video region. Returns null when the video's
 * rect can't be measured (non-linear map), so the caller can fall back.
 */
async function createCompositeRenderer(
  capture: AnimationCapture,
  video: HTMLVideoElement,
  decoded: DecodedFrameSource,
  plan: FramePlan
): Promise<RenderFrame | null> {
  const region = measureVideoRegion(capture.node, video)
  if (!region) return null

  // Hide the <video> so the one-off scene raster has no baked-in frame to
  // bleed through; we paint every frame's video ourselves.
  video.style.visibility = "hidden"
  if (capture.needsPaint) await waitForPaint()
  // This single scene raster is reused for every frame, so make sure it
  // lands — html-to-image's first call can be flaky (fonts/images not yet
  // embedded in the clone).
  let template: HTMLCanvasElement
  try {
    template = await capture.captureFrame()
  } catch {
    template = await capture.captureFrame()
  }
  const scale = template.width / region.rootW
  const dx = region.destX * scale
  const dy = region.destY * scale
  const dw = region.destW * scale
  const dh = region.destH * scale
  const scratch = document.createElement("canvas")
  scratch.width = template.width
  scratch.height = template.height
  const sctx = scratch.getContext("2d", { willReadFrequently: true })
  if (!sctx) throw new Error("Could not get 2d context for compositing")
  const clip = region.clip

  return async (i: number) => {
    const frame = await decoded.getFrameAt(plan.timeForFrame(i))
    sctx.clearRect(0, 0, scratch.width, scratch.height)
    sctx.drawImage(template, 0, 0)
    if (frame) {
      // Source rect in the decoded frame's own pixel space — sized off the
      // frame, not <video>.videoWidth, which can disagree (e.g. rotation
      // metadata) and is unreliable on Safari for an unplayed clone.
      const fw = Number((frame as { width?: unknown }).width) || 0
      const fh = Number((frame as { height?: unknown }).height) || 0
      if (fw > 0 && fh > 0) {
        sctx.save()
        // Re-apply the shell's rounded corners: the raw frame rect would
        // otherwise paint square corners over the template's rounding.
        if (clip && typeof sctx.roundRect === "function") {
          sctx.beginPath()
          sctx.roundRect(
            clip.x * scale,
            clip.y * scale,
            clip.w * scale,
            clip.h * scale,
            clip.radii.map((r) => r * scale)
          )
          sctx.clip()
        }
        sctx.drawImage(
          frame,
          region.srcXFrac * fw,
          region.srcYFrac * fh,
          region.srcWFrac * fw,
          region.srcHFrac * fh,
          dx,
          dy,
          dw,
          dh
        )
        sctx.restore()
      }
    }
    return scratch
  }
}

/**
 * Per-frame rasterization of the clone: decoded frames go through an overlay
 * canvas when available, otherwise the DOM `<video>` is seeked.
 */
function createRasterRenderer(
  capture: AnimationCapture,
  video: HTMLVideoElement,
  decoded: DecodedFrameSource | null,
  plan: FramePlan,
  signal?: AbortSignal
): RenderFrame {
  const paintOverlay = decoded ? overlayVideoFrameCanvas(video) : null
  return async (i: number) => {
    const t = plan.timeForFrame(i)
    if (decoded && paintOverlay) {
      const frame = await decoded.getFrameAt(t)
      if (frame) paintOverlay(frame)
    } else {
      await seekTo(video, t, signal)
      // Only Safari/Firefox need the extra decode wait (and only reach here
      // when WebCodecs decode was unavailable); Chromium stays as before.
      if (!supportsObjectViewBox()) await waitForVideoFrame(video)
    }
    if (capture.needsPaint) await waitForPaint()
    return capture.captureFrame()
  }
}

/**
 * Pick and build the frame renderer for this export. `tilted` forces the
 * per-frame raster path: the composite maps the video with a plain rect, which
 * a 3D rotation invalidates.
 */
export async function createFrameRenderer({
  capture,
  video,
  decoded,
  tilted,
  plan,
  signal,
}: {
  capture: AnimationCapture
  video: HTMLVideoElement
  decoded: DecodedFrameSource | null
  tilted: boolean
  plan: FramePlan
  signal?: AbortSignal
}): Promise<RenderFrame> {
  if (decoded && !tilted) {
    const composite = await createCompositeRenderer(
      capture,
      video,
      decoded,
      plan
    )
    if (composite) return composite
  }
  return createRasterRenderer(capture, video, decoded, plan, signal)
}
