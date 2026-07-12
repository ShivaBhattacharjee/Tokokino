/**
 * Video-media export — turns a canvas whose main content is a *video* into a
 * downloadable video (MP4/WebM) or GIF, with all styling applied.
 *
 * The styled scene (background, shadow, frame, border, tilt, crop…) always
 * comes from an offscreen clone rasterized with html-to-image; how the moving
 * video pixels get in depends on the engine:
 *
 * 1. Chromium: seek the clone's <video> to each output time and rasterize the
 *    whole scene per frame — its foreignObject rendering is reliable.
 * 2. Safari/Firefox: per-frame foreignObject rasterization is flaky (stale /
 *    first-frame captures) and a paused offscreen <video> doesn't decode on
 *    seek. Instead, decode frames with WebCodecs (mediabunny), rasterize the
 *    scene ONCE with the video hidden, and composite each decoded frame onto
 *    that template with 2D drawImage (`measureVideoRegion` supplies the
 *    geometry). Requires an untilted video whose box maps linearly to the
 *    frame.
 * 3. Fallbacks, in order: decoded frames painted into an overlay <canvas> in
 *    the clone + per-frame rasterization (3D-tilted videos), then DOM seek +
 *    rVFC wait (codec not WebCodecs-decodable) — best-effort quality.
 *
 * v1 caveat: no audio track.
 */

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
  type WrappedCanvas,
} from "mediabunny"
import { GIFEncoder, quantize, applyPalette } from "gifenc"

import { supportsObjectViewBox } from "../crop-utils"
import { prepareAnimationCapture } from "../export"
import { isVideoSrc } from "../media-type"
import { useEditorStore } from "../store"
import type {
  AnimationExportBlobResult,
  AnimationExportFormat,
  AnimationExportProgress,
  WatermarkAssets,
} from "./types"
import { safeDrawImage } from "./draw-utils"
import {
  AnimationExportAbortedError,
  animationMimeAndExt,
  createProgressReporter,
  even,
  throwIfAborted,
  triggerDownload,
  waitForPaint,
} from "./utils"
import {
  drawWatermark,
  loadWatermarkLogo,
  resolveWatermarkFontStack,
} from "./watermark"

export type VideoMediaExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
  watermark?: boolean
  onProgress?: (progress: AnimationExportProgress) => void
  signal?: AbortSignal
  asBlob?: boolean
}

/** True when the active canvas's main content is a video (export eligibility). */
export function canvasIsVideoMedia(canvasId: string): boolean {
  const canvas = useEditorStore
    .getState()
    .present.canvases.find((c) => c.id === canvasId)
  return !!canvas && isVideoSrc(canvas.screenshot)
}

/** Wait until a (cloned, offscreen) video has decoded data ready to draw. */
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && Number.isFinite(video.duration)) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Could not load video for export"))
    }
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("error", onError)
    video.load()
  })
}

/**
 * Seek the clone video and wait for the frame to be ready to draw. Rejects on a
 * decode error (surfaces to the outer catch) or when the export is aborted — a
 * `"seeked"` that never fires would otherwise hang the whole render loop, and
 * the between-frames abort check can't interrupt a stuck seek.
 */
export function seekTo(
  video: HTMLVideoElement,
  timeSec: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const clamped = Math.max(0, Math.min(timeSec, (video.duration || 0) - 1e-3))
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      signal?.removeEventListener("abort", onAbort)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Video decode failed during seek"))
    }
    const onAbort = () => {
      cleanup()
      reject(new AnimationExportAbortedError())
    }
    if (signal?.aborted) {
      reject(new AnimationExportAbortedError())
      return
    }
    if (Math.abs(video.currentTime - clamped) < 1e-3) {
      resolve()
      return
    }
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)
    signal?.addEventListener("abort", onAbort, { once: true })
    video.currentTime = clamped
  })
}

/**
 * Wait until the just-seeked frame is actually decoded and drawable to a canvas.
 *
 * Safari fires `seeked` *before* the new frame is presentable to `drawImage`, so
 * a capture taken right after the seek rasterizes a black/stale frame and only
 * occasionally catches the real one — the "black video, clip glitching through"
 * symptom. `requestVideoFrameCallback` resolves only once a frame has actually
 * been presented, closing that race. Falls back to a short delay where rVFC is
 * unavailable, and is bounded by a timeout so a build that never fires it for a
 * paused seek can't hang the export.
 */
function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }
  ).requestVideoFrameCallback
  if (typeof rvfc !== "function") {
    return new Promise((resolve) => setTimeout(resolve, 30))
  }
  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve()
    }
    // Safety net: rVFC isn't guaranteed to fire for a paused seek in every build.
    const timer = window.setTimeout(done, 100)
    rvfc.call(video, done)
  })
}

type DecodedFrameSource = {
  /** Decoded frame whose start timestamp is ≤ `t` seconds, or null if none. */
  getFrameAt: (t: number) => Promise<CanvasImageSource | null>
  cleanup: () => void
}

/**
 * Decode the source clip's frames with mediabunny (WebCodecs `VideoDecoder`)
 * instead of seeking a DOM `<video>`.
 *
 * Safari won't reliably decode a paused, offscreen `<video>` on seek: every
 * intermediate seek yields no new frame, so the export gets the first frame,
 * then black, then the last — the reported flicker. WebCodecs decodes any
 * timestamp deterministically, with no dependency on the element being on-screen
 * or played, killing the whole class of Safari video-capture bugs.
 *
 * Returns null when decoding isn't possible (no WebCodecs, or the container's
 * codec isn't decodable here — e.g. VP9 on Safari); the caller then falls back
 * to the DOM-video path.
 */
async function createDecodedFrameSource(
  src: string,
  signal?: AbortSignal
): Promise<DecodedFrameSource | null> {
  if (typeof VideoDecoder === "undefined") return null
  let input: Input | null = null
  try {
    throwIfAborted(signal)
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryVideoTrack()
    if (!track || !(await track.canDecode())) {
      input.dispose()
      return null
    }
    const boundInput = input
    // poolSize 0 → each yielded frame is its own canvas, so holding a reference
    // to the last one across calls is safe (a pooled canvas would be overwritten).
    const sink = new CanvasSink(track, { poolSize: 0 })

    // Walk the decoder's frames in presentation order (each packet decoded once)
    // and return, for each requested output time, the latest frame at or before
    // it. getCanvas() per-frame doesn't advance the decoder reliably for every
    // container — it froze on frame 0 — so drive the sequential iterator instead.
    const EPS = 1e-4
    let frames = sink.canvases()
    let buffered: WrappedCanvas | null = null
    let chosen: WrappedCanvas | null = null
    let lastT = -Infinity

    return {
      getFrameAt: async (t) => {
        // A backward jump (e.g. GIF's palette pass restarting at 0) can't be
        // served by the forward-only iterator, so restart it from that time —
        // closing the old one first to release its decoder.
        if (t + EPS < lastT) {
          void frames.return(undefined)
          frames = sink.canvases(Math.max(0, t))
          buffered = null
          chosen = null
        }
        lastT = t
        for (;;) {
          if (!buffered) {
            const next = await frames.next()
            if (next.done) break
            buffered = next.value
          }
          if (buffered.timestamp <= t + EPS) {
            chosen = buffered
            buffered = null
          } else break
        }
        return chosen?.canvas ?? null
      },
      cleanup: () => {
        void frames.return(undefined)
        boundInput.dispose()
      },
    }
  } catch {
    input?.dispose()
    return null
  }
}

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

type VideoRegion = {
  /** Destination rect on the styled scene, in the scene root's CSS-px space. */
  destX: number
  destY: number
  destW: number
  destH: number
  /** Source rect as fractions (0–1) of the decoded frame's own dimensions. */
  srcXFrac: number
  srcYFrac: number
  srcWFrac: number
  srcHFrac: number
  /** CSS-px width of the scene root, to scale dest into output pixels. */
  rootW: number
  /**
   * Rounded box of the overflow-clip ancestor (scene CSS-px + corner radii) so
   * the composite can reproduce the shell's border-radius; null when square.
   */
  clip: { x: number; y: number; w: number; h: number; radii: number[] } | null
}

/** Resolve one object-position component against the box − content slack. */
function resolvePositionComponent(component: string, slack: number): number {
  const value = parseFloat(component)
  if (!Number.isFinite(value)) return slack / 2
  return component.trim().endsWith("%") ? (value / 100) * slack : value
}

/**
 * Measure where the clone's `<video>` visibly renders inside the styled scene,
 * and which sub-rect of the decoded frame maps there. The content rect is
 * derived from object-fit/-position (fill/contain/cover are all linear maps of
 * the frame into a rect), then intersected with the `<video>` box and its
 * nearest overflow-clip ancestor (crop polyfill container or video shell), so
 * crop, letterboxing and cover-cropping are all reflected. Invalid for a
 * 3D-tilted/rotated video (bounding rects stop being the rendered quad) —
 * callers gate on tilt. Returns null when it can't be composited this way.
 */
export function measureVideoRegion(
  root: HTMLElement,
  video: HTMLVideoElement
): VideoRegion | null {
  const nw = video.videoWidth
  const nh = video.videoHeight
  if (!nw || !nh) return null
  const videoStyle = getComputedStyle(video)
  const fit = videoStyle.objectFit
  if (fit !== "fill" && fit !== "contain" && fit !== "cover") return null

  const rootRect = root.getBoundingClientRect()
  const videoRect = video.getBoundingClientRect()
  if (!rootRect.width || !videoRect.width || !videoRect.height) return null

  // Content rect: where the frame's pixels actually land inside the box.
  let contentW = videoRect.width
  let contentH = videoRect.height
  if (fit !== "fill") {
    const s =
      fit === "contain"
        ? Math.min(videoRect.width / nw, videoRect.height / nh)
        : Math.max(videoRect.width / nw, videoRect.height / nh)
    contentW = nw * s
    contentH = nh * s
  }
  const position = videoStyle.objectPosition.split(" ")
  const contentLeft =
    videoRect.left +
    resolvePositionComponent(position[0] ?? "50%", videoRect.width - contentW)
  const contentTop =
    videoRect.top +
    resolvePositionComponent(position[1] ?? "50%", videoRect.height - contentH)

  // Nearest overflow-clip ancestor within the scene bounds the visible region.
  let clipEl: HTMLElement | null = video.parentElement
  while (clipEl && clipEl !== root) {
    const overflow = getComputedStyle(clipEl).overflowX
    if (overflow === "hidden" || overflow === "clip") break
    clipEl = clipEl.parentElement
  }
  const clipRect = (clipEl ?? video).getBoundingClientRect()

  const left = Math.max(videoRect.left, clipRect.left, contentLeft)
  const top = Math.max(videoRect.top, clipRect.top, contentTop)
  const right = Math.min(
    videoRect.right,
    clipRect.right,
    contentLeft + contentW
  )
  const bottom = Math.min(
    videoRect.bottom,
    clipRect.bottom,
    contentTop + contentH
  )
  const visW = right - left
  const visH = bottom - top
  if (visW <= 0 || visH <= 0) return null

  let clip: VideoRegion["clip"] = null
  if (clipEl) {
    const clipStyle = getComputedStyle(clipEl)
    const radii = [
      clipStyle.borderTopLeftRadius,
      clipStyle.borderTopRightRadius,
      clipStyle.borderBottomRightRadius,
      clipStyle.borderBottomLeftRadius,
    ].map((r) => Math.max(0, parseFloat(r) || 0))
    if (radii.some((r) => r > 0)) {
      clip = {
        x: clipRect.left - rootRect.left,
        y: clipRect.top - rootRect.top,
        w: clipRect.width,
        h: clipRect.height,
        radii,
      }
    }
  }

  return {
    destX: left - rootRect.left,
    destY: top - rootRect.top,
    destW: visW,
    destH: visH,
    srcXFrac: (left - contentLeft) / contentW,
    srcYFrac: (top - contentTop) / contentH,
    srcWFrac: visW / contentW,
    srcHFrac: visH / contentH,
    rootW: rootRect.width,
    clip,
  }
}

type FramePlan = {
  frameCount: number
  frameDurationSec: number
  timeForFrame: (i: number) => number
}

/**
 * Frame plan for the export. Count is simply the clip's real length × fps — no
 * arbitrary ceiling, so a 20-minute clip exports all 20 minutes. It's inherently
 * bounded by the video's actual duration (both encoders stream frames, so a high
 * count doesn't blow up memory); the only guard is against a non-finite duration
 * so the loop can't run away. Cadence is a constant 1/fps → smooth, correct speed.
 */
export function planFrames(durationSec: number, fps: number): FramePlan {
  const safeDuration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0
  const frameCount = Math.max(1, Math.round(safeDuration * fps))
  return {
    frameCount,
    frameDurationSec: 1 / fps,
    timeForFrame: (i) => i / fps,
  }
}

/** Draw a captured frame canvas into the (even-sized) encode canvas + watermark. */
function blitFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  width: number,
  height: number,
  watermark: WatermarkAssets | null
) {
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, width, height)
  safeDrawImage(ctx, frame, 0, 0, width, height)
  if (watermark) drawWatermark(ctx, width, height, watermark)
}

async function encodeVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<AnimationExportBlobResult> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)

  throwIfAborted(signal)
  progress.report("preparing", 0, 1)

  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  if (!canvas || !canvas.screenshot || !isVideoSrc(canvas.screenshot)) {
    throw new Error("Canvas has no video to export")
  }

  const format = options.format
  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const targetWidth = even(options.targetWidth ?? 1080)

  const watermark: WatermarkAssets | null =
    options.watermark === false
      ? null
      : await (async () => {
          const [logo, fontStack] = await Promise.all([
            loadWatermarkLogo(),
            resolveWatermarkFontStack(),
          ])
          return { logo, fontStack }
        })()

  // Offscreen clone of the styled canvas, rasterized per frame (handles tilt,
  // crop, frames, shadow — everything the DOM renders).
  const capture = await prepareAnimationCapture(canvasId, targetWidth)
  try {
    const cloneVideo = capture.node.querySelector("video")
    if (!cloneVideo) throw new Error("Video element not found in export clone")
    cloneVideo.muted = true
    cloneVideo.preload = "auto"
    await waitForVideoReady(cloneVideo)

    const durationSec = cloneVideo.duration
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Video has no readable duration")
    }
    const plan = planFrames(durationSec, fps)

    const width = even(capture.width)
    const height = even(capture.height)
    const encodeCanvas = document.createElement("canvas")
    encodeCanvas.width = width
    encodeCanvas.height = height
    const ctx = encodeCanvas.getContext("2d")
    if (!ctx) throw new Error("Could not get 2d context")

    // Safari/Firefox render a live <video> unreliably inside html-to-image's
    // serialized SVG (foreignObject), and rasterizing it per frame flickers.
    // There we decode frames with WebCodecs (mediabunny). Chromium rasterizes the
    // <video> in SVG fine, so it keeps the DOM-seek path. If decode isn't possible
    // (codec not WebCodecs-decodable), fall back to the DOM path too.
    const decoded = supportsObjectViewBox()
      ? null
      : await createDecodedFrameSource(canvas.screenshot, signal)

    // Best path: rasterize the styled scene ONCE (foreignObject is only reliable
    // for a one-off on Safari) and composite each decoded frame straight onto it
    // with plain 2D drawImage — no per-frame html-to-image for the video region,
    // which is what flickered. Requires a linear (non-tilted, non-rotated) video
    // rect; tilted/rotated exports fall back to the per-frame overlay path.
    const tilt = canvas.tilt
    const tilted = !!tilt && (tilt.rx !== 0 || tilt.ry !== 0 || tilt.rz !== 0)
    const region =
      decoded && !tilted ? measureVideoRegion(capture.node, cloneVideo) : null

    let renderFrame: (i: number) => Promise<HTMLCanvasElement>

    if (decoded && region) {
      // Hide the <video> so the one-off scene raster has no baked-in frame to
      // bleed through; we paint every frame's video ourselves.
      cloneVideo.style.visibility = "hidden"
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
      renderFrame = async (i: number) => {
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
    } else {
      const paintOverlay = decoded ? overlayVideoFrameCanvas(cloneVideo) : null
      renderFrame = async (i: number) => {
        const t = plan.timeForFrame(i)
        if (decoded && paintOverlay) {
          const frame = await decoded.getFrameAt(t)
          if (frame) paintOverlay(frame)
        } else {
          await seekTo(cloneVideo, t, signal)
          // Only Safari/Firefox need the extra decode wait (and only reach here
          // when WebCodecs decode was unavailable); Chromium stays as before.
          if (!supportsObjectViewBox()) await waitForVideoFrame(cloneVideo)
        }
        if (capture.needsPaint) await waitForPaint()
        return capture.captureFrame()
      }
    }

    try {
      const blob =
        format === "gif"
          ? await encodeGif(
              ctx,
              encodeCanvas,
              renderFrame,
              watermark,
              plan,
              progress,
              signal
            )
          : await encodeMp4OrWebm(
              format,
              ctx,
              encodeCanvas,
              renderFrame,
              watermark,
              plan,
              progress,
              signal
            )

      progress.report("finishing", 1, 1)
      const { contentType, extension } = animationMimeAndExt(format)
      return { blob, contentType, extension }
    } finally {
      decoded?.cleanup()
    }
  } finally {
    capture.cleanup()
  }
}

async function encodeMp4OrWebm(
  format: "mp4" | "webm",
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: (i: number) => Promise<HTMLCanvasElement>,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  signal?: AbortSignal
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("Video encoding is not supported in this browser")
  }
  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width: encodeCanvas.width,
    height: encodeCanvas.height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) throw new Error("No supported video codec for this format")

  const target = new BufferTarget()
  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  })
  const videoSource = new CanvasSource(encodeCanvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, {
    frameRate: Math.round(1 / plan.frameDurationSec),
  })

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    void output.cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    throwIfAborted(signal)
    await output.start()
    progress.report("capturing", 0, plan.frameCount)
    for (let f = 0; f < plan.frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()
      const frame = await renderFrame(f)
      blitFrame(ctx, frame, encodeCanvas.width, encodeCanvas.height, watermark)
      await videoSource.add(plan.timeForFrame(f), plan.frameDurationSec)
      progress.report("capturing", f + 1, plan.frameCount)
    }
    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    await output.finalize()
    progress.report("encoding", 1, 1)
    const buffer = target.buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video encode produced an empty file")
    }
    const mime = format === "mp4" ? "video/mp4" : "video/webm"
    return new Blob([buffer], { type: mime })
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}

// Cap on GIF output volume = frames × pixels-per-frame. gifenc buffers the
// whole compressed stream in memory, so this bounds peak usage regardless of
// clip length or resolution. ~350M keeps the buffer comfortably under ~300 MB
// even for poorly-compressing footage, while still allowing ~20 s at 1080p or
// much longer at smaller sizes.
export const MAX_GIF_TOTAL_PIXELS = 350_000_000

/**
 * True when a GIF export of this many frames at this size would risk exhausting
 * memory (gifenc holds the entire compressed stream in RAM until finish()).
 * Callers should fail fast with a clear message rather than crash the tab.
 */
export function gifExportExceedsMemory(
  frameCount: number,
  width: number,
  height: number
): boolean {
  return frameCount * width * height > MAX_GIF_TOTAL_PIXELS
}

async function encodeGif(
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: (i: number) => Promise<HTMLCanvasElement>,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  signal?: AbortSignal
): Promise<Blob> {
  const w = encodeCanvas.width
  const h = encodeCanvas.height

  // gifenc keeps every compressed frame in one growing in-memory buffer until
  // finish() — nothing streams out. Videos can now be up to 60 min, so a long or
  // high-res clip would silently balloon that buffer (hundreds of MB → tab OOM).
  // Guard on total output volume (frames × area) and fail fast with a clear,
  // actionable message. MP4/WebM stream through the WebCodecs encoder and have
  // no such ceiling, so we point the user there.
  if (gifExportExceedsMemory(plan.frameCount, w, h)) {
    throw new Error(
      "This clip is too long or too large for GIF export. Trim it, lower the resolution, or export as MP4/WebM instead."
    )
  }

  // Pass 1 — build ONE shared 256-color palette (kills frame-to-frame color
  // shimmer) from a handful of evenly-spaced frames. We re-render for these
  // rather than buffering every frame, so memory stays flat regardless of length.
  const sampleCount = Math.min(16, plan.frameCount)
  const sampleData: Uint8ClampedArray[] = []
  let total = 0
  for (let s = 0; s < sampleCount; s++) {
    throwIfAborted(signal)
    const f = Math.floor((s / sampleCount) * plan.frameCount)
    blitFrame(ctx, await renderFrame(f), w, h, watermark)
    const data = ctx.getImageData(0, 0, w, h).data
    sampleData.push(data)
    total += data.length
    progress.report("preparing", s + 1, sampleCount)
  }
  const combined = new Uint8Array(total)
  let offset = 0
  for (const d of sampleData) {
    combined.set(d, offset)
    offset += d.length
  }
  const palette = quantize(combined, 256)
  sampleData.length = 0

  // Pass 2 — re-render each frame, map onto the shared palette, and write it
  // straight into the encoder. Only the current frame is ever in memory.
  const gif = GIFEncoder()
  const delayMs = plan.frameDurationSec * 1000
  let emittedCs = 0
  progress.report("capturing", 0, plan.frameCount)
  for (let f = 0; f < plan.frameCount; f++) {
    throwIfAborted(signal)
    blitFrame(ctx, await renderFrame(f), w, h, watermark)
    const index = applyPalette(ctx.getImageData(0, 0, w, h).data, palette)
    const targetCs = Math.round(((f + 1) * delayMs) / 10)
    const delayCs = Math.max(2, targetCs - emittedCs)
    emittedCs += delayCs
    gif.writeFrame(index, w, h, { palette, delay: delayCs * 10 })
    progress.report("capturing", f + 1, plan.frameCount)
  }
  gif.finish()
  return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" })
}

/** Export the active video canvas as a video/GIF — downloads by default. */
export async function exportVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<void | AnimationExportBlobResult> {
  const result = await encodeVideoMedia(canvasId, options)
  if (options.asBlob) return result
  triggerDownload(
    result.blob,
    `tokokino-video-${Date.now()}.${result.extension}`
  )
}
