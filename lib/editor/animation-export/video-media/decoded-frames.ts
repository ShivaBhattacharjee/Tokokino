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

import { exportDebugLog } from "../export-debug"
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
 * Returns null when decoding isn't possible (no WebCodecs, or the container's
 * codec isn't decodable here — e.g. VP9 on Safari); the caller then falls back
 * to the DOM-video path.
 */
export async function createDecodedFrameSource(
  src: string,
  signal?: AbortSignal
): Promise<DecodedFrameSource | null> {
  if (typeof VideoDecoder === "undefined") {
    exportDebugLog(
      "warn",
      "decode",
      "VideoDecoder undefined — no WebCodecs decode"
    )
    return null
  }
  let input: Input | null = null
  try {
    throwIfAborted(signal)
    const t0 = performance.now()
    exportDebugLog("info", "decode", "fetching source for WebCodecs decode", {
      srcKind: src.startsWith("blob:")
        ? "blob"
        : src.startsWith("data:")
          ? "data"
          : "url",
    })
    const res = await fetch(src)
    if (!res.ok) {
      exportDebugLog("warn", "decode", "source fetch failed", {
        status: res.status,
      })
      return null
    }
    const blob = await res.blob()
    exportDebugLog("info", "decode", "source fetched", {
      byteLength: blob.size,
      type: blob.type,
      durationMs: Math.round(performance.now() - t0),
    })
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryVideoTrack()
    const canDecode = track ? await track.canDecode() : false
    if (!track || !canDecode) {
      // Report exactly why this clip won't decode: the codec, its full parameter
      // string, whether mediabunny could build a decoder config at all, and what
      // the browser's own VideoDecoder.isConfigSupported says about it. This is
      // the difference between "unknown codec" and "WebKit refuses this profile",
      // and it decides whether the flickery DOM-seek fallback was avoidable.
      let codec: string | null = null
      let codecString: string | null = null
      let decoderConfig: VideoDecoderConfig | null = null
      let isConfigSupported: boolean | null = null
      try {
        codec = track ? await track.getCodec() : null
        codecString = track ? await track.getCodecParameterString() : null
        decoderConfig = track ? await track.getDecoderConfig() : null
        if (decoderConfig && typeof VideoDecoder !== "undefined") {
          isConfigSupported =
            (await VideoDecoder.isConfigSupported(decoderConfig)).supported ??
            null
        }
      } catch (probeErr) {
        exportDebugLog("warn", "decode", "decodability probe threw", {
          error:
            probeErr instanceof Error ? probeErr.message : String(probeErr),
        })
      }
      exportDebugLog(
        "warn",
        "decode",
        "primary track missing or not decodable",
        {
          hasTrack: !!track,
          canDecode,
          codec,
          codecString,
          hasDecoderConfig: !!decoderConfig,
          decoderConfig: decoderConfig
            ? {
                codec: decoderConfig.codec,
                codedWidth: decoderConfig.codedWidth,
                codedHeight: decoderConfig.codedHeight,
                hasDescription: !!decoderConfig.description,
              }
            : null,
          isConfigSupported,
        }
      )
      input.dispose()
      return null
    }
    exportDebugLog("info", "decode", "WebCodecs track ready", {
      durationMs: Math.round(performance.now() - t0),
    })
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
  } catch (err) {
    exportDebugLog("warn", "decode", "createDecodedFrameSource failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    input?.dispose()
    return null
  }
}
