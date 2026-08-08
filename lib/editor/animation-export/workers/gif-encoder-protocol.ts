/**
 * Message shapes exchanged with the GIF encode worker. Kept in its own module so
 * the worker and its main-thread client can share types without either pulling
 * in the other's runtime.
 */

export type GifWorkerRequest =
  | { id: number; type: "reset" }
  | { id: number; type: "sample"; data: ArrayBuffer }
  | { id: number; type: "palette" }
  | {
      id: number
      type: "frame"
      data: ArrayBuffer
      width: number
      height: number
      elapsedMs: number
    }
  | { id: number; type: "finish" }

export type GifWorkerResponse =
  | { id: number; ok: true; bytes?: ArrayBuffer }
  | { id: number; ok: false; error: string }
