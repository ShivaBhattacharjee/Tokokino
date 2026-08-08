/**
 * Main-thread handle on the video mux worker.
 *
 * Unlike the GIF client there is no in-process fallback here: both call sites
 * already own a complete main-thread Mediabunny path, so `createVideoMuxSession`
 * returns null whenever the worker can't be used and the caller just keeps doing
 * what it did before.
 *
 * `addFrame` snapshots the encode canvas into a `VideoFrame` and transfers it,
 * blocking only once more than {@link MAX_FRAMES_IN_FLIGHT} frames are
 * outstanding — so the next frame rasterizes while the worker encodes this one.
 */

import { AnimationExportAbortedError, throwIfAborted } from "../abort"
import type { WithoutId } from "./message"
import type {
  VideoMuxerConfig,
  VideoMuxerRequest,
  VideoMuxerResponse,
} from "./video-muxer-protocol"

const MAX_FRAMES_IN_FLIGHT = 2

/** See the GIF client — a worker that neither answers nor errors must not hang
 *  the export, which is the very failure this change exists to remove. */
const INIT_TIMEOUT_MS = 30_000

export type VideoMuxSession = {
  addFrame(
    canvas: HTMLCanvasElement,
    timestampSec: number,
    durationSec: number
  ): Promise<void>
  finalize(): Promise<ArrayBuffer>
  cancel(): void
  dispose(): void
}

function canUseVideoMuxWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof VideoEncoder !== "undefined"
  )
}

/**
 * Start a mux session in the worker. Returns null when workers or WebCodecs are
 * unavailable, when the worker fails to boot, or when no codec can encode this
 * format/size — in every case the caller should run its own encode path.
 */
export async function createVideoMuxSession(
  config: VideoMuxerConfig,
  signal?: AbortSignal
): Promise<VideoMuxSession | null> {
  // An abort that has already fired will never fire again, so the listener
  // registered below would never run: the worker would go on to decode and
  // re-encode the whole audio track and start the muxer, and the cancellation
  // would not surface until init finished or the startup timeout expired.
  throwIfAborted(signal)
  if (!canUseVideoMuxWorker()) return null

  let worker: Worker
  try {
    worker = new Worker(new URL("./video-muxer.worker.ts", import.meta.url), {
      type: "module",
    })
  } catch {
    return null
  }

  let nextId = 1
  let failure: Error | null = null
  const pending = new Map<
    number,
    {
      resolve: (message: VideoMuxerResponse & { ok: true }) => void
      reject: (err: Error) => void
    }
  >()
  const inFlight: Promise<unknown>[] = []

  const failAll = (err: Error) => {
    failure ??= err
    for (const entry of pending.values()) entry.reject(err)
    pending.clear()
  }

  worker.onmessage = (event: MessageEvent<VideoMuxerResponse>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.ok) entry.resolve(message)
    else {
      entry.reject(
        message.aborted
          ? new AnimationExportAbortedError()
          : new Error(message.error)
      )
    }
  }
  worker.onerror = () => failAll(new Error("Video mux worker failed"))
  worker.onmessageerror = () =>
    failAll(new Error("Video mux worker received an uncloneable message"))

  const send = (
    request: WithoutId<VideoMuxerRequest>,
    transfer: Transferable[] = []
  ) => {
    if (failure) return Promise.reject(failure)
    const id = nextId++
    return new Promise<VideoMuxerResponse & { ok: true }>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...request, id }, transfer)
    })
  }

  const track = (promise: Promise<unknown>) => {
    inFlight.push(
      promise.catch((err: Error) => {
        failure ??= err
      })
    )
  }

  const drain = async (keep: number) => {
    while (inFlight.length > keep) await inFlight.shift()
    if (failure) throw failure
  }

  const dispose = () => {
    pending.clear()
    worker.terminate()
  }

  const onAbort = () => {
    void send({ type: "cancel" }).catch(() => {})
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  let ready: VideoMuxerResponse & { ok: true }
  try {
    ready = await Promise.race([
      send({ type: "init", config }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Video mux worker did not start")),
          INIT_TIMEOUT_MS
        )
      ),
    ])
  } catch (err) {
    signal?.removeEventListener("abort", onAbort)
    dispose()
    // A real cancellation must not be papered over by falling back to the
    // main-thread encoder — it would just start the whole export again.
    if (err instanceof AnimationExportAbortedError || signal?.aborted) throw err
    return null
  }

  if (ready.type !== "init" || !ready.supported) {
    signal?.removeEventListener("abort", onAbort)
    dispose()
    return null
  }

  return {
    async addFrame(canvas, timestampSec, durationSec) {
      if (failure) throw failure
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(timestampSec * 1_000_000),
        duration: Math.round(durationSec * 1_000_000),
      })
      track(send({ type: "frame", frame, timestampSec, durationSec }, [frame]))
      await drain(MAX_FRAMES_IN_FLIGHT)
    },
    async finalize() {
      await drain(0)
      const done = await send({ type: "finalize" })
      if (done.type !== "finalize") {
        throw new Error("Video mux worker returned no data")
      }
      return done.buffer
    },
    cancel() {
      onAbort()
    },
    dispose() {
      signal?.removeEventListener("abort", onAbort)
      dispose()
    },
  }
}
