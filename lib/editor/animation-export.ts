import { GIFEncoder, quantize, applyPalette } from "gifenc"

import { composeTransformAtTime, transformToCss } from "./animation-motion"
import { prepareAnimationCapture } from "./export"
import { useEditorStore } from "./store"
import type { AnimationClip } from "./state-types"

export type AnimationExportFormat = "webm" | "gif"

export type AnimationExportOptions = {
  format: AnimationExportFormat
  fps?: number
  /** Output width in px. Defaults differ per format to balance size/quality. */
  targetWidth?: number
}

// Guard against runaway memory on very long timelines.
const MAX_FRAMES = 600

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

function applyFrameVars(
  node: HTMLElement,
  clips: AnimationClip[],
  timeMs: number
) {
  const css = transformToCss(composeTransformAtTime(clips, timeMs))
  node.style.setProperty("--anim-transform", css.transform)
  node.style.setProperty("--anim-opacity", css.opacity)
  node.style.setProperty("--anim-filter", css.filter)
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

/**
 * Render the active canvas's animation timeline to a downloadable video (WebM,
 * with audio if attached) or animated GIF. Frames are captured via the shared
 * html-to-image pipeline (`prepareAnimationCapture`) using the SAME transform
 * compositor as live playback, so the export matches the preview.
 */
export async function exportAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<void> {
  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  const animation = canvas?.animation
  if (!animation) throw new Error("Nothing to export")

  const { durationMs, clips, audio } = animation
  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const frameCount = Math.min(
    MAX_FRAMES,
    Math.max(1, Math.round((durationMs / 1000) * fps))
  )
  const frameDurationMs = 1000 / fps
  const targetWidth =
    options.targetWidth ?? (options.format === "gif" ? 720 : 1080)

  const capture = await prepareAnimationCapture(canvasId, targetWidth)

  try {
    if (options.format === "gif") {
      await encodeGif(capture, clips, frameCount, frameDurationMs)
    } else {
      await encodeWebm(
        capture,
        clips,
        frameCount,
        frameDurationMs,
        durationMs,
        fps,
        audio && !audio.muted && audio.src ? audio : null
      )
    }
  } finally {
    capture.cleanup()
  }
}

// ---------------------------------------------------------------------------
// GIF — streamed so we never hold every frame in memory at once.
// ---------------------------------------------------------------------------

async function encodeGif(
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>,
  clips: AnimationClip[],
  frameCount: number,
  frameDurationMs: number
) {
  const gif = GIFEncoder()

  for (let f = 0; f < frameCount; f++) {
    applyFrameVars(capture.node, clips, f * frameDurationMs)
    const frameCanvas = await capture.captureFrame()
    const ctx = frameCanvas.getContext("2d")
    if (!ctx) continue
    const { data, width, height } = ctx.getImageData(
      0,
      0,
      frameCanvas.width,
      frameCanvas.height
    )
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.round(frameDurationMs),
    })
  }

  gif.finish()
  // Copy into a fresh ArrayBuffer-backed view so it's a valid BlobPart.
  const bytes = new Uint8Array(gif.bytesView())
  triggerDownload(
    new Blob([bytes], { type: "image/gif" }),
    `tokokino-animation-${Date.now()}.gif`
  )
}

// ---------------------------------------------------------------------------
// WebM — pre-capture frames to bitmaps, then replay in real time into a
// MediaRecorder so we can mux the (real-time) audio track.
// ---------------------------------------------------------------------------

async function encodeWebm(
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>,
  clips: AnimationClip[],
  frameCount: number,
  frameDurationMs: number,
  durationMs: number,
  fps: number,
  audio: { src: string; volume: number } | null
) {
  const bitmaps: ImageBitmap[] = []
  for (let f = 0; f < frameCount; f++) {
    applyFrameVars(capture.node, clips, f * frameDurationMs)
    const frameCanvas = await capture.captureFrame()
    bitmaps.push(await createImageBitmap(frameCanvas))
  }

  const out = document.createElement("canvas")
  out.width = capture.width
  out.height = capture.height
  const octx = out.getContext("2d")
  if (!octx) throw new Error("Could not get 2d context for export")
  octx.drawImage(bitmaps[0], 0, 0)

  const stream = out.captureStream(fps)

  // Optional audio track.
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
      const audioTrack = dest.stream.getAudioTracks()[0]
      if (audioTrack) stream.addTrack(audioTrack)
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

  await new Promise<void>((resolve) => {
    let rafId = 0
    const finish = () => {
      cancelAnimationFrame(rafId)
      if (recorder.state !== "inactive") recorder.stop()
    }
    recorder.onstop = () => {
      audioEl?.pause()
      stream.getTracks().forEach((t) => t.stop())
      void audioCtx?.close()
      resolve()
    }

    recorder.start()
    if (audioEl) void audioEl.play().catch(() => {})

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed >= durationMs) {
        // Draw the final frame, then stop on the next macrotask so the
        // recorder captures it.
        octx.clearRect(0, 0, out.width, out.height)
        octx.drawImage(bitmaps[bitmaps.length - 1], 0, 0)
        setTimeout(finish, frameDurationMs)
        return
      }
      const idx = Math.min(
        bitmaps.length - 1,
        Math.floor((elapsed / 1000) * fps)
      )
      octx.clearRect(0, 0, out.width, out.height)
      octx.drawImage(bitmaps[idx], 0, 0)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  for (const bitmap of bitmaps) bitmap.close()

  triggerDownload(
    new Blob(chunks, { type: mimeType }),
    `tokokino-animation-${Date.now()}.webm`
  )
}
