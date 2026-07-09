/**
 * Fully local animation export (user device only — no server).
 *
 * Pipeline:
 *  1. Sample Tokokino keyframes onto an offscreen DOM clone (html-to-image)
 *  2. GIF  → gifenc (pure JS palette encode)
 *  3. Video → Mediabunny + WebCodecs (hardware-accelerated, faster than real-time)
 *             with MediaRecorder fallback when WebCodecs is unavailable
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc"
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from "mediabunny"

import {
  applyAnimationFrameAtTime,
  clearAnimationFrameVars,
  measureBareStageDims,
} from "./apply-animation-frame"
import { prepareAnimationCapture } from "./export"
import { captureClipPose, useEditorStore } from "./store"
import type { AnimationClip, CanvasState } from "./state-types"

export type AnimationExportFormat = "webm" | "mp4" | "gif"

export type AnimationExportPhase =
  | "preparing"
  | "capturing"
  | "encoding"
  | "finishing"

export type AnimationExportProgress = {
  phase: AnimationExportPhase
  current: number
  total: number
  etaMs: number | null
}

export type AnimationExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
  onProgress?: (progress: AnimationExportProgress) => void
  signal?: AbortSignal
}

const MAX_FRAMES = 600

export class AnimationExportAbortedError extends Error {
  constructor(message = "Export cancelled") {
    super(message)
    this.name = "AnimationExportAbortedError"
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AnimationExportAbortedError()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function even(n: number) {
  const r = Math.max(2, Math.round(n))
  return r % 2 === 0 ? r : r + 1
}

function pickWebmMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }
  return "video/webm"
}

function suppressCloneTransitions(node: HTMLElement) {
  const targets = Array.from(
    node.querySelectorAll<HTMLElement>(
      "[data-editor-shadow-filter-target], [data-editor-shadow-box-target], [data-screenshot-slot-id], [data-editor-shadow-preview-scope]"
    )
  )
  for (const el of [node, ...targets]) {
    el.style.transition = "none"
  }
}

function applyExportFrame(
  node: HTMLElement,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number
) {
  applyAnimationFrameAtTime({
    canvasEl: node,
    canvas,
    globalAspect,
    clips,
    timeMs,
    selectedClipId: null,
    screenshotPositionDragging: false,
    bareDims: measureBareStageDims(node),
  })
}

type ProgressReporter = {
  report: (phase: AnimationExportPhase, current: number, total: number) => void
}

/**
 * Always report progress; the UI layer throttles React updates so we can show
 * Frame X/Y without re-rendering on every single frame.
 */
function createProgressReporter(
  onProgress?: (p: AnimationExportProgress) => void
): ProgressReporter {
  let phaseStartedAt = performance.now()
  let lastPhase: AnimationExportPhase | null = null

  return {
    report(phase, current, total) {
      if (!onProgress) return
      if (phase !== lastPhase) {
        lastPhase = phase
        phaseStartedAt = performance.now()
      }
      let etaMs: number | null = null
      if (current > 0 && current < total) {
        const elapsed = performance.now() - phaseStartedAt
        etaMs = Math.max(0, Math.round((elapsed / current) * (total - current)))
      } else if (current >= total && total > 0) {
        etaMs = 0
      }
      onProgress({ phase, current, total, etaMs })
    },
  }
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/** Sources `CanvasRenderingContext2D.drawImage` accepts in practice. */
type DrawImageSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | OffscreenCanvas
  | SVGImageElement

function isDrawImageSource(value: unknown): value is DrawImageSource {
  if (value == null || typeof value !== "object") return false
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    value instanceof HTMLCanvasElement
  ) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    value instanceof OffscreenCanvas
  ) {
    return value.width > 0 && value.height > 0
  }
  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    value instanceof HTMLImageElement
  ) {
    return value.naturalWidth > 0 && value.naturalHeight > 0
  }
  if (
    typeof HTMLVideoElement !== "undefined" &&
    value instanceof HTMLVideoElement
  ) {
    return value.videoWidth > 0 && value.videoHeight > 0
  }
  if (
    typeof SVGImageElement !== "undefined" &&
    value instanceof SVGImageElement
  ) {
    return true
  }
  return false
}

/**
 * Safe drawImage — Safari/Firefox (and flaky html-to-image captures) can hand
 * back a non-canvas / zero-size value that throws a TypeError in drawImage.
 * Returns false when the source is unusable so callers can skip/retry.
 */
function safeDrawImage(
  ctx: CanvasRenderingContext2D,
  source: unknown,
  dx = 0,
  dy = 0,
  dw?: number,
  dh?: number
): boolean {
  if (!isDrawImageSource(source)) return false
  try {
    if (dw != null && dh != null) ctx.drawImage(source, dx, dy, dw, dh)
    else ctx.drawImage(source, dx, dy)
    return true
  } catch {
    return false
  }
}

function blankFrame(width: number, height: number): HTMLCanvasElement {
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, width)
  copy.height = Math.max(1, height)
  const ctx = copy.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, copy.width, copy.height)
  }
  return copy
}

function snapshotFrame(
  source: unknown,
  fallbackWidth: number,
  fallbackHeight: number
): HTMLCanvasElement {
  if (!isDrawImageSource(source)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  const w =
    "width" in source && typeof source.width === "number" && source.width > 0
      ? source.width
      : fallbackWidth
  const h =
    "height" in source && typeof source.height === "number" && source.height > 0
      ? source.height
      : fallbackHeight
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, w)
  copy.height = Math.max(1, h)
  const ctx = copy.getContext("2d")
  if (!ctx) return blankFrame(fallbackWidth, fallbackHeight)
  if (!safeDrawImage(ctx, source, 0, 0)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  return copy
}

async function captureStableFrame(
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number
): Promise<HTMLCanvasElement> {
  applyExportFrame(capture.node, canvas, globalAspect, clips, timeMs)
  await waitForPaint()
  let raw: unknown
  try {
    raw = await capture.captureFrame()
  } catch {
    return blankFrame(capture.width, capture.height)
  }
  // html-to-image is flaky on some browsers — one retry after another paint.
  if (!isDrawImageSource(raw)) {
    await waitForPaint()
    try {
      raw = await capture.captureFrame()
    } catch {
      return blankFrame(capture.width, capture.height)
    }
  }
  return snapshotFrame(raw, capture.width, capture.height)
}

type CaptureCtx = {
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>
  canvas: CanvasState
  globalAspect: { id: string; w: number; h: number }
  clips: AnimationClip[]
  frameCount: number
  frameDurationMs: number
  fps: number
  progress: ProgressReporter
  signal?: AbortSignal
}

/**
 * Render the active canvas's animation timeline to a downloadable file.
 * 100% on-device — no upload, no server round-trip.
 */
export async function exportAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<void> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)

  throwIfAborted(signal)
  progress.report("preparing", 0, 1)

  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  const animation = canvas?.animation
  if (!canvas || !animation) throw new Error("Nothing to export")

  const { durationMs, audio } = animation
  const clips =
    state.isAnimateMode && state.selectedAnimationClipId
      ? animation.clips.map((clip) =>
          clip.id === state.selectedAnimationClipId
            ? { ...clip, pose: captureClipPose(canvas) }
            : clip
        )
      : animation.clips
  if (!clips.length) throw new Error("Nothing to export")

  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const frameCount = Math.min(
    MAX_FRAMES,
    Math.max(1, Math.round((durationMs / 1000) * fps))
  )
  const frameDurationMs = 1000 / fps
  const targetWidth =
    options.targetWidth ??
    (options.format === "gif" ? 720 : options.format === "mp4" ? 1080 : 1080)

  throwIfAborted(signal)
  const capture = await prepareAnimationCapture(canvasId, targetWidth)
  suppressCloneTransitions(capture.node)
  progress.report("preparing", 1, 1)

  const ctx: CaptureCtx = {
    capture,
    canvas,
    globalAspect: state.present.aspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
  }

  try {
    if (options.format === "gif") {
      await encodeGif(ctx)
    } else {
      const usedWebCodecs = await tryEncodeWithMediabunny(ctx, options.format)
      if (!usedWebCodecs) {
        if (options.format === "mp4") {
          throw new Error(
            "MP4 export needs WebCodecs (Chrome, Edge, or Safari 17+). Try WebM or update your browser."
          )
        }
        // WebM fallback — MediaRecorder (also fully local)
        await encodeWebmMediaRecorder({
          ...ctx,
          durationMs,
          audio: audio && !audio.muted && audio.src ? audio : null,
        })
      }
    }
    progress.report("finishing", 1, 1)
  } finally {
    clearAnimationFrameVars(capture.node, clips)
    capture.cleanup()
  }
}

async function encodeGif(ctx: CaptureCtx) {
  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    progress,
    signal,
  } = ctx
  const gif = GIFEncoder()
  let wrote = 0
  progress.report("capturing", 0, frameCount)

  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    const frameCanvas = await captureStableFrame(
      capture,
      canvas,
      globalAspect,
      clips,
      f * frameDurationMs
    )
    const gctx = frameCanvas.getContext("2d")
    if (!gctx) {
      progress.report("capturing", f + 1, frameCount)
      continue
    }
    const { data, width, height } = gctx.getImageData(
      0,
      0,
      frameCanvas.width,
      frameCanvas.height
    )
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.max(1, Math.round(frameDurationMs)),
    })
    wrote++
    progress.report("capturing", f + 1, frameCount)
  }

  if (wrote === 0) throw new Error("No frames captured for GIF export")
  throwIfAborted(signal)
  progress.report("encoding", 0, 1)
  gif.finish()
  progress.report("encoding", 1, 1)
  triggerDownload(
    new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" }),
    `tokokino-animation-${Date.now()}.gif`
  )
}

async function tryEncodeWithMediabunny(
  ctx: CaptureCtx,
  format: "webm" | "mp4"
): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false

  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])

  const width = even(ctx.capture.width)
  const height = even(ctx.capture.height)
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width,
    height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) return false

  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
  } = ctx

  // Working canvas we redraw each frame into (CanvasSource samples this).
  const encodeCanvas = document.createElement("canvas")
  encodeCanvas.width = width
  encodeCanvas.height = height
  const ectx = encodeCanvas.getContext("2d")
  if (!ectx) return false

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
  output.addVideoTrack(videoSource, { frameRate: fps })

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    void output.cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    throwIfAborted(signal)
    progress.report("capturing", 0, frameCount)
    await output.start()

    const durationSec = 1 / fps
    for (let f = 0; f < frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()

      const frameCanvas = await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs
      )
      // Letterbox into even-sized encode canvas if needed.
      ectx.fillStyle = "#000"
      ectx.fillRect(0, 0, width, height)
      if (!safeDrawImage(ectx, frameCanvas, 0, 0, width, height)) {
        // Keep the black letterbox frame rather than aborting the whole export.
      }

      const timestamp = f / fps
      await videoSource.add(timestamp, durationSec)
      progress.report("capturing", f + 1, frameCount)
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
    const ext = format === "mp4" ? "mp4" : "webm"
    triggerDownload(
      new Blob([buffer], { type: mime }),
      `tokokino-animation-${Date.now()}.${ext}`
    )
    return true
  } catch (err) {
    if (!cancelled && output.state !== "canceled") {
      try {
        await output.cancel()
      } catch {
        /* ignore */
      }
    }
    if (
      err instanceof AnimationExportAbortedError ||
      (err instanceof Error && err.name === "AnimationExportAbortedError")
    ) {
      throw err
    }
    // Fall through to MediaRecorder for WebM only.
    console.warn("[export] WebCodecs encode failed, trying fallback:", err)
    return false
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}

async function encodeWebmMediaRecorder({
  capture,
  canvas,
  globalAspect,
  clips,
  frameCount,
  frameDurationMs,
  progress,
  signal,
  durationMs,
  fps,
  audio,
}: CaptureCtx & {
  durationMs: number
  audio: { src: string; volume: number } | null
}) {
  const frames: HTMLCanvasElement[] = []
  progress.report("capturing", 0, frameCount)

  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    frames.push(
      await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs
      )
    )
    progress.report("capturing", f + 1, frameCount)
  }

  if (frames.length === 0) throw new Error("No frames captured for WebM export")
  throwIfAborted(signal)
  progress.report("encoding", 0, frames.length)

  const out = document.createElement("canvas")
  out.width = frames[0]?.width || capture.width
  out.height = frames[0]?.height || capture.height
  const octx = out.getContext("2d")
  if (!octx) throw new Error("Could not get 2d context for export")
  if (!safeDrawImage(octx, frames[0], 0, 0)) {
    octx.fillStyle = "#000"
    octx.fillRect(0, 0, out.width, out.height)
  }

  const stream = out.captureStream(fps)
  let audioEl: HTMLAudioElement | null = null
  let audioCtx: AudioContext | null = null
  if (audio) {
    try {
      audioEl = new Audio(audio.src)
      audioEl.volume = audio.volume
      audioCtx = new AudioContext()
      const srcNode = audioCtx.createMediaElementSource(audioEl)
      const dest = audioCtx.createMediaStreamDestination()
      srcNode.connect(dest)
      const track = dest.stream.getAudioTracks()[0]
      if (track) stream.addTrack(track)
    } catch {
      audioEl = null
    }
  }

  const mimeType = pickWebmMimeType()
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const drawFrame = (idx: number) => {
    const frame = frames[Math.max(0, Math.min(frames.length - 1, idx))]
    octx.clearRect(0, 0, out.width, out.height)
    if (!safeDrawImage(octx, frame, 0, 0)) {
      octx.fillStyle = "#000"
      octx.fillRect(0, 0, out.width, out.height)
    }
  }

  await new Promise<void>((resolve, reject) => {
    let rafId = 0
    let finished = false
    let lastReportedIdx = -1

    const cleanupMedia = () => {
      audioEl?.pause()
      stream.getTracks().forEach((t) => t.stop())
      void audioCtx?.close()
    }

    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(rafId)
      try {
        if (recorder.state !== "inactive") recorder.stop()
        else {
          cleanupMedia()
          resolve()
        }
      } catch (err) {
        cleanupMedia()
        reject(
          err instanceof Error ? err : new Error("Failed to stop MediaRecorder")
        )
      }
    }

    const onAbort = () => {
      finish()
      reject(new AnimationExportAbortedError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    recorder.onstop = () => {
      signal?.removeEventListener("abort", onAbort)
      cleanupMedia()
      resolve()
    }
    recorder.onerror = () => {
      signal?.removeEventListener("abort", onAbort)
      finish()
      reject(new Error("MediaRecorder failed during WebM export"))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    try {
      recorder.start(100)
    } catch (err) {
      signal?.removeEventListener("abort", onAbort)
      reject(
        err instanceof Error ? err : new Error("Failed to start MediaRecorder")
      )
      return
    }
    if (audioEl) void audioEl.play().catch(() => {})

    const start = performance.now()
    const safeDuration = Math.max(frameDurationMs, durationMs)
    const tick = (now: number) => {
      if (finished) return
      if (signal?.aborted) {
        onAbort()
        return
      }
      const elapsed = now - start
      if (elapsed >= safeDuration) {
        drawFrame(frames.length - 1)
        progress.report("encoding", frames.length, frames.length)
        setTimeout(finish, Math.max(frameDurationMs, 50))
        return
      }
      const idx = Math.min(
        frames.length - 1,
        Math.max(0, Math.floor((elapsed / 1000) * fps))
      )
      drawFrame(idx)
      if (idx !== lastReportedIdx) {
        lastReportedIdx = idx
        progress.report("encoding", idx + 1, frames.length)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  throwIfAborted(signal)
  if (chunks.length === 0) throw new Error("WebM export produced an empty file")

  triggerDownload(
    new Blob(chunks, { type: mimeType }),
    `tokokino-animation-${Date.now()}.webm`
  )
}
