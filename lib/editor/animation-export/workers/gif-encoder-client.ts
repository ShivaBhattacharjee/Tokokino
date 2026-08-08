/**
 * Main-thread handle on the GIF encode worker, with an in-process fallback for
 * environments that have no `Worker` (SSR, jsdom under test) or where the worker
 * fails to boot.
 *
 * `writeFrame` only blocks once more than {@link MAX_FRAMES_IN_FLIGHT} frames are
 * outstanding, so the caller keeps rasterizing the next frame while the worker
 * dithers and palette-maps the previous one. Bounding the queue matters: the
 * capture side is usually slower, but on a small canvas it isn't, and an
 * unbounded queue would hold every frame's pixels at once.
 */

import { GifStreamEncoder } from "../gif-codec"
import type {
  GifWorkerRequest,
  GifWorkerResponse,
} from "./gif-encoder-protocol"
import type { WithoutId } from "./message"

const MAX_FRAMES_IN_FLIGHT = 2

/**
 * How long to wait for the worker's first reply before giving up on it. Covers
 * the case where the worker neither answers nor fires `onerror` — a hung
 * handshake would otherwise stall the export with no way to cancel, which is
 * exactly the failure this whole change exists to remove.
 */
const HANDSHAKE_TIMEOUT_MS = 10_000

export type GifEncoderSession = {
  /** True when the encode is actually running off the main thread. */
  readonly offMainThread: boolean
  addSample(data: Uint8ClampedArray): Promise<void>
  buildPalette(): Promise<void>
  writeFrame(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    elapsedMs: number
  ): Promise<void>
  finish(): Promise<Uint8Array<ArrayBuffer>>
  dispose(): void
}

/**
 * Detach `data`'s buffer for transfer. `getImageData().data` always owns its
 * buffer exactly, but a caller could hand us a view into a larger one — copy in
 * that case rather than transferring pixels that belong to someone else.
 */
function detachable(data: Uint8ClampedArray): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer
  }
  return data.slice().buffer
}

type WorkerHandle = {
  session: GifEncoderSession
  handshake: () => Promise<unknown>
}

function createWorkerSession(): WorkerHandle | null {
  if (typeof Worker === "undefined") return null

  let worker: Worker
  try {
    worker = new Worker(new URL("./gif-encoder.worker.ts", import.meta.url), {
      type: "module",
    })
  } catch {
    return null
  }

  let nextId = 1
  let failure: Error | null = null
  const pending = new Map<
    number,
    { resolve: (bytes?: ArrayBuffer) => void; reject: (err: Error) => void }
  >()
  const inFlight: Promise<unknown>[] = []

  const failAll = (err: Error) => {
    failure ??= err
    for (const entry of pending.values()) entry.reject(err)
    pending.clear()
  }

  worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.ok) entry.resolve(message.bytes)
    else entry.reject(new Error(message.error))
  }
  worker.onerror = () => failAll(new Error("GIF encode worker failed"))
  worker.onmessageerror = () =>
    failAll(new Error("GIF encode worker received an uncloneable message"))

  const send = (
    request: WithoutId<GifWorkerRequest>,
    transfer: Transferable[] = []
  ): Promise<ArrayBuffer | undefined> => {
    if (failure) return Promise.reject(failure)
    const id = nextId++
    return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...request, id }, transfer)
    })
  }

  // A queued frame is not awaited at the call site, so its rejection is caught
  // here (otherwise it surfaces as an unhandled rejection) and re-raised by the
  // next `drain`.
  const track = (promise: Promise<unknown>) => {
    inFlight.push(
      promise.catch((err: Error) => {
        failure ??= err
      })
    )
  }

  const drain = async (keep: number) => {
    while (inFlight.length > keep) {
      await inFlight.shift()
    }
    if (failure) throw failure
  }

  const session: GifEncoderSession = {
    offMainThread: true,
    async addSample(data) {
      const buffer = detachable(data)
      await send({ type: "sample", data: buffer }, [buffer])
    },
    async buildPalette() {
      await drain(0)
      await send({ type: "palette" })
    },
    async writeFrame(data, width, height, elapsedMs) {
      if (failure) throw failure
      const buffer = detachable(data)
      track(
        send({ type: "frame", data: buffer, width, height, elapsedMs }, [
          buffer,
        ])
      )
      await drain(MAX_FRAMES_IN_FLIGHT)
    },
    async finish() {
      await drain(0)
      const bytes = await send({ type: "finish" })
      if (!bytes) throw new Error("GIF encode worker returned no data")
      return new Uint8Array(bytes)
    },
    dispose() {
      pending.clear()
      worker.terminate()
    },
  }

  return { session, handshake: () => send({ type: "reset" }) }
}

/** Run `fn` now but report its failure as a rejection, matching the worker. */
function settled<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn())
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  }
}

function createInlineSession(): GifEncoderSession {
  const encoder = new GifStreamEncoder()
  return {
    offMainThread: false,
    addSample: (data) => settled(() => encoder.addSample(data)),
    buildPalette: () => settled(() => encoder.buildPalette()),
    writeFrame: (data, width, height, elapsedMs) =>
      settled(() => encoder.writeFrame(data, width, height, elapsedMs)),
    finish: () => settled(() => encoder.finish()),
    dispose: () => {},
  }
}

/**
 * Start a GIF encode session, preferring the worker. Callers must `dispose()`
 * it — including on the error path — so a cancelled export doesn't leave a
 * worker (and its buffered stream) alive.
 */
export async function createGifEncoderSession(): Promise<GifEncoderSession> {
  const handle = createWorkerSession()
  if (!handle) return createInlineSession()
  try {
    // Round-trips one message before any pixels are sent, so a worker that can't
    // load (blocked by CSP, missing chunk) falls back here rather than halfway
    // through an export.
    await Promise.race([
      handle.handshake(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("GIF encode worker did not start")),
          HANDSHAKE_TIMEOUT_MS
        )
      ),
    ])
    return handle.session
  } catch {
    handle.session.dispose()
    return createInlineSession()
  }
}
