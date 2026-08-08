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
