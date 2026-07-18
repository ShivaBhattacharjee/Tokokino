/**
 * WebCodecs frame source — decodes the source clip's frames directly instead of
 * seeking a DOM `<video>`, which Safari/Firefox can't do reliably offscreen.
 */

import {
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
  Input,
  type WrappedCanvas,
} from "mediabunny"

import { registerDav1dAv1Decoder } from "./dav1d-av1-decoder"
import { throwIfAborted } from "../utils"

export type DecodedFrameSource = {
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
 * When WebCodecs rejects an 8-bit AV1 source, WebKit uses the lazy dav1d WASM
 * decoder registered with Mediabunny. Other unsupported codecs still return
 * null for the caller's DOM-video fallback.
 */
export async function createDecodedFrameSource(
  src: string,
  signal?: AbortSignal
): Promise<DecodedFrameSource | null> {
  let input: Input | null = null
  let usingDav1dFallback = false
  try {
    throwIfAborted(signal)
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryVideoTrack()
    if (!track) {
      input.dispose()
      return null
    }

    const [codec, config] = await Promise.all([
      track.getCodec(),
      track.getDecoderConfig(),
    ])
    let nativeCanDecode = false
    if (typeof VideoDecoder !== "undefined" && config) {
      try {
        nativeCanDecode =
          (await VideoDecoder.isConfigSupported(config)).supported === true
      } catch {
        // Some WebKit versions throw here instead of returning supported: false.
      }
    }

    // Mediabunny gives custom decoders precedence, so only register dav1d when
    // native AV1 support has been explicitly rejected.
    if (!nativeCanDecode && codec === "av1") {
      registerDav1dAv1Decoder()
      usingDav1dFallback = true
    }

    if (!(await track.canDecode())) {
      input.dispose()
      if (usingDav1dFallback) {
        throw new Error(
          "The bundled dav1d decoder does not support this AV1 source"
        )
      }
      return null
    }

    const boundInput = input
    // poolSize 0 → each yielded frame is its own canvas, so holding a reference
    // to the last one across calls is safe (a pooled canvas would be overwritten).
    const sink = new CanvasSink(track, { poolSize: 0 })
    const EPS = 1e-4
    // MP4 edit lists can provide negative-time pre-roll frames. Start from the
    // visible media timeline rather than yielding an invisible pre-roll frame.
    let frames = sink.canvases(0)
    let buffered: WrappedCanvas | null = null
    let chosen: WrappedCanvas | null = null
    let lastT = -Infinity

    return {
      getFrameAt: async (t) => {
        // A backward jump (e.g. GIF's palette pass restarting at 0) cannot be
        // served by the forward-only iterator, so restart it from that time.
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
  } catch (error) {
    input?.dispose()
    if (usingDav1dFallback) {
      throw new Error("The dav1d AV1 export fallback could not initialize", {
        cause: error,
      })
    }
    return null
  }
}
