/**
 * GIF encode worker. Owns the palette build, the ordered dither, the palette
 * mapping and the gifenc stream — all of which are pure typed-array maths that
 * used to block the main thread for seconds at a time.
 *
 * The main thread still rasterizes each frame (that needs the DOM) and hands the
 * pixels over as a transferred buffer, so the two threads pipeline: frame N+1 is
 * captured while frame N is being encoded here.
 */

import { GifStreamEncoder } from "../gif-codec"
import type {
  GifWorkerRequest,
  GifWorkerResponse,
} from "./gif-encoder-protocol"

let encoder: GifStreamEncoder | null = null

function reply(message: GifWorkerResponse, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(message, transfer)
}

self.onmessage = (event: MessageEvent<GifWorkerRequest>) => {
  const request = event.data
  try {
    switch (request.type) {
      case "reset": {
        encoder = new GifStreamEncoder()
        reply({ id: request.id, ok: true })
        return
      }
      case "sample": {
        if (!encoder) throw new Error("GIF worker was not initialized")
        encoder.addSample(new Uint8ClampedArray(request.data))
        reply({ id: request.id, ok: true })
        return
      }
      case "palette": {
        if (!encoder) throw new Error("GIF worker was not initialized")
        encoder.buildPalette()
        reply({ id: request.id, ok: true })
        return
      }
      case "frame": {
        if (!encoder) throw new Error("GIF worker was not initialized")
        encoder.writeFrame(
          new Uint8ClampedArray(request.data),
          request.width,
          request.height,
          request.elapsedMs
        )
        reply({ id: request.id, ok: true })
        return
      }
      case "finish": {
        if (!encoder) throw new Error("GIF worker was not initialized")
        const bytes = encoder.finish()
        encoder = null
        reply({ id: request.id, ok: true, bytes: bytes.buffer }, [bytes.buffer])
        return
      }
    }
  } catch (err) {
    encoder = null
    reply({
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
