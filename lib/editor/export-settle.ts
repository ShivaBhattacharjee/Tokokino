import { supportsObjectViewBox } from "./crop-utils"
import {
  drawRasterImage,
  loadRasterImage,
  serializeExportSvg,
  type RasterOptions,
} from "./export-raster"

/** Mean alpha (0–255) below which a raster is treated as a failed capture. */
const EMPTY_RASTER_ALPHA = 4

/**
 * True when a raster is transparent enough that nothing of the composition can
 * have painted. WebKit's dropped-subresource failure leaves only the DOM-drawn
 * chrome (the watermark) behind, so a plain "all pixels transparent" test is not
 * enough — sample the whole frame and look at how much of it is covered.
 */
export function isRasterEssentiallyEmpty(canvas: HTMLCanvasElement): boolean {
  const size = 32
  const probe = document.createElement("canvas")
  probe.width = size
  probe.height = size
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(canvas, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let alpha = 0
  for (let i = 3; i < data.length; i += 4) alpha += data[i]
  return alpha / (size * size) < EMPTY_RASTER_ALPHA
}

/** Downsampled RGBA fingerprint, small enough to diff two rasters cheaply. */
const RASTER_SIGNATURE_SIZE = 32
/** Per-channel mean difference under which two rasters count as the same image. */
const SETTLED_SIGNATURE_DELTA = 1.5
const SETTLE_MAX_ATTEMPTS = 8
/**
 * Retry budget for the glass frost underlays. One runs per pane, and every
 * pixel of the result is read back through an 18px blur at 960px, so they do
 * not need the full budget the exported raster gets — without a lower cap a
 * four-pane frame could spend five settle loops on one export.
 */
export const UNDERLAY_SETTLE_MAX_ATTEMPTS = 4

function rasterSignature(source: CanvasImageSource): Uint8ClampedArray | null {
  const size = RASTER_SIGNATURE_SIZE
  const probe = document.createElement("canvas")
  probe.width = size
  probe.height = size
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size).data
}

export function rasterSignatureDelta(
  a: Uint8ClampedArray | null,
  b: Uint8ClampedArray | null
): number {
  if (!a || !b || a.length !== b.length) return 255
  let total = 0
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
  return total / a.length
}

/**
 * How much of a composition a signature says painted: the opaque fraction plus
 * the colour variety, both normalised. WebKit drops the largest data-URI
 * subresources first, so a raster missing the screenshot reads as flatter and
 * (over a transparent background) less covered than the complete one.
 */
export function signatureCoverage(signature: Uint8ClampedArray | null): number {
  if (!signature) return -1
  const colors = new Set<number>()
  let opaque = 0
  for (let i = 0; i < signature.length; i += 4) {
    if (signature[i + 3] > 250) opaque++
    colors.add(
      (signature[i] << 16) | (signature[i + 1] << 8) | signature[i + 2]
    )
  }
  const pixels = signature.length / 4
  return opaque / pixels + colors.size / pixels
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** Consecutive unchanged, no-better rasters before a plateau is trusted. */
const SETTLE_CONFIRM_ATTEMPTS = 2

export type SettleProgress = {
  bestCoverage: number
  /** Coverage has risen at least once, i.e. decodes were still landing. */
  improved: boolean
  confirmations: number
}

export const INITIAL_SETTLE_PROGRESS: SettleProgress = {
  bestCoverage: -1,
  improved: false,
  confirmations: 0,
}

/**
 * Decide what one sampled raster means: whether to keep it as the best so far,
 * and whether the sequence has settled.
 *
 * A raster that merely repeats is not evidence of anything — WebKit reproduces
 * an incomplete capture exactly, and three identical rasters missing the
 * screenshot is a shape this bug actually takes. What is evidence is coverage
 * having *risen* at some point: that means subresource decodes were landing,
 * so a plateau after it is the engine finishing rather than the engine not
 * having started. Until that happens the loop keeps sampling and simply keeps
 * the best it has seen.
 */
export function advanceSettle(
  progress: SettleProgress,
  sample: { coverage: number; unchanged: boolean }
): SettleProgress & { take: boolean; done: boolean } {
  if (sample.coverage > progress.bestCoverage) {
    return {
      bestCoverage: sample.coverage,
      // The first sample sets the baseline; it has improved on nothing.
      improved: progress.bestCoverage >= 0,
      confirmations: 0,
      take: true,
      done: false,
    }
  }

  const confirmations =
    sample.unchanged && progress.improved ? progress.confirmations + 1 : 0
  return {
    ...progress,
    confirmations,
    take: false,
    done: confirmations >= SETTLE_CONFIRM_ATTEMPTS,
  }
}

/**
 * Backoff before settle attempt `attempt`.
 *
 * The early waits stay short because a capture normally completes by the third
 * attempt, and the export is blocking a click. The tail grows steeply because
 * the only thing that fixes a still-incomplete raster is giving the decodes
 * more time — a flat schedule gave a slow one (an 8K export of a large
 * screenshot) the same two thirds of a second as a trivial canvas.
 */
export function settleDelayMs(attempt: number): number {
  return Math.min(400, 20 * 2 ** (attempt - 2))
}

/**
 * Rasterize the export SVG repeatedly and answer with the best canvas sampled —
 * never a fresh draw of it.
 *
 * WebKit paints an SVG image's `<foreignObject>` with whatever data-URI
 * subresources have decoded at that instant, and every `drawImage` of that
 * image re-rasterizes it, racing the decode again. The result oscillates: a
 * canvas can come back complete, then the very next draw of the same
 * `HTMLImageElement` drops the screenshot, the background, or both. The size
 * of the destination rect makes no difference — only which decodes happen to
 * have landed. The largest image loses most often, which is why Safari exported
 * this canvas as bare glass panes over a gradient, watermark logo and all.
 *
 * So the sampled pixels have to be *kept*: each attempt draws into its own
 * output canvas, and the one handed back is a canvas that was scored, not a
 * redraw of the image that produced it. {@link advanceSettle} owns when to stop.
 *
 * Running the budget out is not a failure signal: it is also what happens when
 * the very first raster was already complete, since nothing improves on it.
 * There is no oracle for "complete" — coverage ranks two rasters of the same
 * scene, it cannot judge one alone — so exhaustion returns the best sample
 * rather than throwing, and the defence against a genuinely stuck decode is the
 * length of the window (see {@link settleDelayMs}), not a verdict at the end.
 */
async function settleRasterCanvas(
  svgUrl: string,
  outputWidth: number,
  outputHeight: number,
  backgroundColor: string | undefined,
  maxAttempts: number
): Promise<HTMLCanvasElement | null> {
  let best: HTMLCanvasElement | null = null
  let progress = INITIAL_SETTLE_PROGRESS
  let previous: Uint8ClampedArray | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, settleDelayMs(attempt))
      )
    }
    let image: HTMLImageElement
    try {
      image = await loadRasterImage(svgUrl)
    } catch {
      continue
    }

    const canvas = drawRasterImage(
      image,
      outputWidth,
      outputHeight,
      backgroundColor
    )
    const signature = rasterSignature(canvas)
    const unchanged =
      previous !== null &&
      rasterSignatureDelta(signature, previous) <= SETTLED_SIGNATURE_DELTA
    previous = signature

    const next = advanceSettle(progress, {
      coverage: signatureCoverage(signature),
      // A raster with nothing painted in it is never the answer, however
      // faithfully the engine keeps reproducing it — refuse to confirm one and
      // spend the rest of the budget waiting for the decodes.
      unchanged: unchanged && !isRasterEssentiallyEmpty(canvas),
    })
    progress = {
      bestCoverage: next.bestCoverage,
      improved: next.improved,
      confirmations: next.confirmations,
    }

    if (next.take) {
      if (best) releaseCanvas(best)
      best = canvas
    } else {
      releaseCanvas(canvas)
    }
    if (next.done) return best
  }

  return best
}

/**
 * `rasterizeNodeToCanvas`, but on WebKit the output canvas is settled
 * first (see {@link settleRasterCanvas}) and returned as-is.
 */
export async function rasterizeExportNode(
  node: HTMLElement,
  options: RasterOptions,
  renderedWidth: number,
  renderedHeight: number,
  outputWidth: number,
  outputHeight: number,
  backgroundColor?: string,
  settleAttempts = SETTLE_MAX_ATTEMPTS
): Promise<HTMLCanvasElement> {
  const svgUrl = await serializeExportSvg(
    node,
    options,
    renderedWidth,
    renderedHeight,
    outputWidth,
    outputHeight
  )

  if (supportsObjectViewBox()) {
    const image = await loadRasterImage(svgUrl)
    const canvas = drawRasterImage(
      image,
      outputWidth,
      outputHeight,
      backgroundColor
    )
    return canvas
  }

  const settled = await settleRasterCanvas(
    svgUrl,
    outputWidth,
    outputHeight,
    backgroundColor,
    settleAttempts
  )
  // Every attempt failed to load; let the caller see the load error.
  if (!settled) {
    const image = await loadRasterImage(svgUrl)
    return drawRasterImage(image, outputWidth, outputHeight, backgroundColor)
  }
  return settled
}
