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
