// Transcode an animated GIF into a real WebM video so it flows through the
// entire video pipeline — <video> playback, the play/pause/scrub control bar,
// non-destructive crop, and MP4/WebM/GIF export — instead of sitting on the
// canvas as a static <img> that can only loop. The GIF is decoded frame-by-frame
// with the native ImageDecoder (honoring each frame's delay so speed matches the
// source), drawn to a canvas, and re-encoded with mediabunny.
//
// Decode + encode stream one frame at a time, so peak memory stays flat
// regardless of length. Returns a `video/webm` Blob, or null when the browser
// can't decode/encode (older Safari, no WebCodecs) or the GIF isn't actually
// animated — the caller then falls back to the plain animated <img>.

import {
  BufferTarget,
  CanvasSource,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from "mediabunny"

// Clamp very large GIFs before re-encode — keeps the encoder fast and the output
// a sane size. Most codecs also require even dimensions.
const MAX_GIF_DIMENSION = 1600
// Guard against a pathological frame count hanging the encode; such a GIF just
// falls back to the animated <img>.
const MAX_GIF_FRAMES = 3000
// Browsers render 0-delay (and hair-thin) GIF frames at ~100ms; mirror that so
// transcoded playback speed matches what the user saw in their image viewer.
const MIN_FRAME_SEC = 0.02
const DEFAULT_FRAME_SEC = 0.1

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)

function supportsGifTranscode(): boolean {
  return (
    typeof ImageDecoder !== "undefined" && typeof VideoEncoder !== "undefined"
  )
}

/**
 * Transcode an animated GIF File to a WebM Blob, or return null to signal the
 * caller should keep the GIF as a plain animated <img>. Never throws.
 */
export async function transcodeGifToVideo(file: File): Promise<Blob | null> {
  if (!supportsGifTranscode()) return null

  let decoder: ImageDecoder | undefined
  try {
    const data = await file.arrayBuffer()
    decoder = new ImageDecoder({
      data,
      type: "image/gif",
      preferAnimation: true,
    })
    // `tracks.ready` populates the track list (frameCount, animated); `completed`
    // then guarantees every frame is buffered before we decode() them. Reading
    // selectedTrack before tracks.ready resolves would give null.
    await decoder.tracks.ready
    await decoder.completed
    const track = decoder.tracks.selectedTrack
    const frameCount = track?.frameCount ?? 0
    // A single-frame GIF is just a still image — leave it as one.
    if (!track?.animated || frameCount < 2 || frameCount > MAX_GIF_FRAMES) {
      return null
    }

    const { image: probe } = await decoder.decode({ frameIndex: 0 })
    const srcW = probe.displayWidth
    const srcH = probe.displayHeight
    probe.close()
    if (srcW < 2 || srcH < 2) return null

    const scale = Math.min(1, MAX_GIF_DIMENSION / Math.max(srcW, srcH))
    const width = even(srcW * scale)
    const height = even(srcH * scale)

    const codec = await getFirstEncodableVideoCodec(
      ["vp9", "vp8"] as VideoCodec[],
      { width, height, bitrate: QUALITY_HIGH }
    )
    if (!codec) return null

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const target = new BufferTarget()
    const output = new Output({ format: new WebMOutputFormat(), target })
    const source = new CanvasSource(canvas, {
      codec,
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 2,
    })
    output.addVideoTrack(source, { frameRate: 30 })
    await output.start()

    let t = 0
    for (let i = 0; i < frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      // VideoFrame.duration is microseconds (or null for a still).
      const durSec =
        image.duration && image.duration > 0
          ? Math.max(MIN_FRAME_SEC, image.duration / 1_000_000)
          : DEFAULT_FRAME_SEC
      // GIF frames can carry transparency; clear so we don't smear the previous
      // frame through transparent pixels (WebM has no alpha here — transparent
      // areas resolve to black, matching most GIF-on-dark viewers).
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0, width, height)
      image.close()
      await source.add(t, durSec)
      t += durSec
    }

    await output.finalize()
    const buffer = target.buffer
    if (!buffer || buffer.byteLength === 0) return null
    return new Blob([buffer], { type: "video/webm" })
  } catch (err) {
    // Any decode/encode failure → fall back to the animated <img>. Log it so a
    // missing video control bar is diagnosable instead of silently mysterious.
    console.warn("[gif→video] transcode failed, keeping GIF as image:", err)
    return null
  } finally {
    decoder?.close()
  }
}
