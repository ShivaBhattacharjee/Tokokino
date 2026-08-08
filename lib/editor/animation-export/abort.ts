/**
 * Abort primitives shared by the export pipeline.
 *
 * Split out of `utils.ts` because the encode workers need these and `utils.ts`
 * reaches into `../export` and `@/lib/download` — pulling html-to-image and the
 * whole DOM capture path into a worker bundle that has no `document`.
 */

export class AnimationExportAbortedError extends Error {
  constructor(message = "Export cancelled") {
    super(message)
    this.name = "AnimationExportAbortedError"
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AnimationExportAbortedError()
}

/**
 * Whether `err` is an export cancellation.
 *
 * The name check is not redundant: the error can cross a worker boundary, where
 * it is rebuilt from the wire and is no longer an instance of the class here.
 * Callers use this to decide between rethrowing and falling back to another
 * encoder — getting it wrong restarts a whole export the user just cancelled.
 */
export function isAnimationExportAborted(err: unknown): boolean {
  return (
    err instanceof AnimationExportAbortedError ||
    (err instanceof Error && err.name === "AnimationExportAbortedError")
  )
}
