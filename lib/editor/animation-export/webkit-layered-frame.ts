/**
 * WebKit-only layered frame capture for the Animate export.
 *
 * WebKit rasterizes a 3D transform inside an SVG foreignObject *without* the
 * perspective divide — it bakes the flat affine projection while the live
 * compositor (and Chromium's raster) apply the real one. The single-pass
 * Animate capture therefore lands every tilted box at the wrong shape on
 * Safari, even though the clone's DOM geometry is identical to Chrome's.
 *
 * The video-media (non-Animate) export already solved this with a layered
 * stack (`frame-renderer` + `frame-geometry` + `warp-gl`). This module runs
 * that recipe per animation frame, built around one observation that makes it
 * fast: the media shell's *untransformed* texture does not change with tilt —
 * only its projection does. So the expensive foreignObject work is captured
 * once and cached, and each frame is pure 2D/GPU compositing:
 *
 *   1. underlay — scene minus foreground and bent elements. Cached per
 *      backdrop-var state; captured with a settle check (WebKit can raster
 *      before its data-URI background subresources decode, and a missing
 *      layer above an opaque base is invisible to any alpha heuristic).
 *   2. shell texture — each bent shell rasterized untransformed, with the
 *      video `<img>` hidden. Cached per shell-var state. Per frame, the
 *      decoded video frame is drawn straight into its media box (object-fit /
 *      radius / enhance via `paintFrameToLocalBox`) — no JPEG round-trip into
 *      the clone, no re-raster — and the result is GPU-warped onto the
 *      frame's current quad.
 *   3. device-frame chrome re-projected over the media, then above-media
 *      foreground layers (per-frame captures; only present when used).
 *
 * Bent shells are collected with `includeFlat`, so a tilt animating through 0
 * stays on this one pipeline every frame — no flip-flopping against the plain
 * raster path, and a flat main over a tilted slot keeps its live video.
 */

import { supportsObjectViewBox } from "../crop-utils"
import type { AnimationCapture } from "../export"
import type { EnhancePreset } from "../state-types"
import { waitForPaint } from "./utils"
import type { CloneVideoLayer } from "./video-layer"
import {
  applyExportStackVisibility,
  queryForeground,
} from "./video-media/export-stack"
import { copyCanvas, sleep } from "./video-media/frame-canvas-utils"
import {
  collectProjectedLayers,
  type ProjectedLayer,
} from "./video-media/frame-geometry"
import {
  buildForegroundLayer,
  buildFrameChromeLayer,
  captureProjectedElementTexture,
  paintFrameToLocalBox,
  paintsAboveVideo,
  warpProjectedTexture,
  type ProjectedElementTexture,
} from "./video-media/frame-renderer"

export type LayeredFrameOptions = {
  /** Timeline position of this frame, for the decoded-video draw. */
  timelineMs: number
  /** Video pixels source — null/omitted for image canvases. */
  videoLayer?: CloneVideoLayer | null
  /** The canvas's enhance preset, re-applied to decoded frames like the DOM would. */
  enhance?: EnhancePreset
}

/**
 * Root-level animation vars that cannot change the underlay raster — they
 * drive the (hidden) media shell's transform/placement, or the inner-lighting
 * overlay, which is foreground-stacked and captured per frame anyway. Excluded
 * from the cache key so animating them keeps hitting one cached underlay.
 */
const UNDERLAY_IRRELEVANT_ROOT_VARS = new Set([
  "--canvas-ts-rx",
  "--canvas-ts-ry",
  "--canvas-ts-rz",
  "--canvas-ts-scale",
  "--editor-position-x",
  "--editor-position-y",
  "--editor-main-position-x",
  "--editor-main-position-y",
  "--editor-main-anchor-x",
  "--editor-main-anchor-y",
  "--editor-main-offset-x",
  "--editor-main-offset-y",
  "--editor-main-bare-left",
  "--editor-main-bare-top",
  "--bd-light-img-in",
  "--bd-light-op-in",
  // Crop drives the media's source rect — foreground, captured per frame.
  "--crop-view-box",
  "--crop-w",
  "--crop-h",
  "--crop-left",
  "--crop-top",
  // Same, for an animated crop: the fit correction is recomputed every frame
  // from the sampled region, so leaving these in would rebuild the underlay on
  // every frame of a crop animation. They only size/scale the media shell.
  "--crop-shell-w",
  "--crop-shell-h",
  "--crop-fit-sx",
  "--crop-fit-sy",
  "--crop-fit-origin",
])

/** Every underlay-affecting inline var on the clone root, as a stable key. */
function underlayCacheKey(node: HTMLElement): string {
  const style = node.style
  const parts: string[] = []
  for (let i = 0; i < style.length; i++) {
    const prop = style[i]
    if (!prop.startsWith("--") || UNDERLAY_IRRELEVANT_ROOT_VARS.has(prop)) {
      continue
    }
    parts.push(`${prop}:${style.getPropertyValue(prop)}`)
  }
  return parts.sort().join(";")
}

/**
 * Shell-texture cache key: the untransformed raster depends on the scope
 * element's animated vars (padding, shadow, border, radius — all written
 * there), the shell's own inline styles, and its layout size. Tilt and
 * position live in the excluded transform/placement, which the texture
 * capture neutralizes anyway.
 */
function shellTextureKey(node: HTMLElement, layer: ProjectedLayer): string {
  const scope = node.querySelector<HTMLElement>(
    '[data-editor-shadow-preview-scope="canvas"]'
  )
  return (
    `${scope?.style.cssText ?? ""}|${layer.el.style.cssText}` +
    `|${Math.round(layer.quad.localW)}x${Math.round(layer.quad.localH)}`
  )
}

/** Downsampled pixels for cheap raster-to-raster comparison. */
function sampleRaster(canvas: HTMLCanvasElement): Uint8ClampedArray | null {
  const w = Math.min(64, canvas.width)
  const h = Math.min(40, canvas.height)
  const sample = document.createElement("canvas")
  sample.width = w
  sample.height = h
  const ctx = sample.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(canvas, 0, 0, w, h)
  try {
    return ctx.getImageData(0, 0, w, h).data
  } catch {
    return null
  }
}

/** Mean absolute channel delta below this threshold means two samples match. */
function samplesMatch(
  a: Uint8ClampedArray | null,
  b: Uint8ClampedArray | null
): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i])
  return diff / a.length < 1.5
}

/**
 * Capture the underlay, recapturing until the raster settles. WebKit's SVG
 * image can fire load before its data-URI background subresources decode, so
 * an early raster may miss a whole background layer; a raster that matches
 * its predecessor has stopped changing and is safe to cache.
 */
async function captureUnderlayPass(
  capture: AnimationCapture
): Promise<HTMLCanvasElement | null> {
  const maxAttempts = 8
  let previousSample: Uint8ClampedArray | null = null
  let latest: HTMLCanvasElement | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(20 + attempt * 15)
    else if (capture.needsPaint) await waitForPaint()

    let frame: HTMLCanvasElement
    try {
      frame = await capture.captureFrame()
    } catch {
      continue
    }
    if (!frame.width || !frame.height) continue

    // The capture engine reuses one internal canvas — detach before the next
    // captureFrame() overwrites it.
    latest = copyCanvas(frame)
    const sample = sampleRaster(latest)
    if (sample && samplesMatch(previousSample, sample)) return latest
    previousSample = sample
  }
  return latest
}

type UnderlayCacheEntry = { key: string; canvas: HTMLCanvasElement }
const underlayCache = new WeakMap<AnimationCapture, UnderlayCacheEntry[]>()
// Crossfade segments produce a distinct key per frame; bound the kept rasters
// by bytes so a 4K/8K export can't retain hundreds of MB (a 4K frame is
// ~33 MB). At least one entry always stays so the common static-underlay
// export keeps its hit.
const UNDERLAY_CACHE_MAX_ENTRIES = 6
const UNDERLAY_CACHE_MAX_BYTES = 96 * 1024 * 1024

/** RGBA byte size of a canvas buffer (width × height × 4). */
const canvasBytes = (canvas: HTMLCanvasElement) =>
  canvas.width * canvas.height * 4

/** Look up a settled underlay raster for this capture + backdrop-var key. */
function cachedUnderlay(
  capture: AnimationCapture,
  key: string
): HTMLCanvasElement | null {
  const entries = underlayCache.get(capture)
  const hit = entries?.find((entry) => entry.key === key)
  return hit ? hit.canvas : null
}

/**
 * Store an underlay raster, evicting oldest entries when the per-capture
 * entry or byte budget is exceeded (always keeps at least one).
 */
function storeUnderlay(
  capture: AnimationCapture,
  key: string,
  canvas: HTMLCanvasElement
) {
  const entries = underlayCache.get(capture) ?? []
  entries.push({ key, canvas })
  let total = entries.reduce((sum, entry) => sum + canvasBytes(entry.canvas), 0)
  while (
    entries.length > 1 &&
    (entries.length > UNDERLAY_CACHE_MAX_ENTRIES ||
      total > UNDERLAY_CACHE_MAX_BYTES)
  ) {
    const evicted = entries.shift()
    if (evicted) total -= canvasBytes(evicted.canvas)
  }
  underlayCache.set(capture, entries)
}

type ShellTextureEntry = { key: string; tex: ProjectedElementTexture }
const shellTextureCache = new WeakMap<
  AnimationCapture,
  Map<HTMLElement, ShellTextureEntry>
>()

/**
 * Draw this frame's decoded video pixels into a copy of the shell texture, at
 * the media box the texture capture measured — the 2D twin of what the DOM
 * `<img>` swap would have rendered, minus the JPEG round-trip.
 */
async function composeShellWithVideo(
  tex: ProjectedElementTexture,
  videoLayer: CloneVideoLayer,
  timelineMs: number,
  enhance: EnhancePreset | undefined,
  scale: number
): Promise<HTMLCanvasElement> {
  if (!tex.mediaBox) return tex.texture
  const frame = await videoLayer.getFrame(timelineMs)
  if (!frame) return tex.texture
  const fw = "width" in frame ? Number(frame.width) : 0
  const fh = "height" in frame ? Number(frame.height) : 0
  if (!fw || !fh) return tex.texture

  const media = videoLayer.mediaElement
  const radius = (parseFloat(getComputedStyle(media).borderRadius) || 0) * scale
  const local = paintFrameToLocalBox(
    frame,
    tex.mediaBox.w * scale,
    tex.mediaBox.h * scale,
    media,
    fw,
    fh,
    radius,
    { enhance: enhance ?? "off", innerLighting: null }
  )
  if (!local) return tex.texture

  const composed = copyCanvas(tex.texture)
  const ctx = composed.getContext("2d")
  if (!ctx) return tex.texture
  ctx.drawImage(local, tex.mediaBox.x * scale, tex.mediaBox.y * scale)
  return composed
}

/**
 * Capture the clone's current state with perspective-carrying elements
 * projected by hand. Returns null when the layered path does not apply or a
 * pass failed — the caller then uses the plain single-pass capture.
 */
export async function captureLayeredAnimationFrame(
  capture: AnimationCapture,
  options: LayeredFrameOptions
): Promise<HTMLCanvasElement | null> {
  if (supportsObjectViewBox()) return null
  const node = capture.node
  const { timelineMs, videoLayer, enhance } = options

  // Flat hits included: their projection is exact, and staying on one pipeline
  // across a tilt's zero-crossings keeps every frame consistent (and fast).
  const layers = collectProjectedLayers(node, { includeFlat: true })
  if (layers.length === 0) return null

  const foregroundEls = queryForeground(node)
  // Bent foreground elements (tilted slots, inner lighting) are projected by
  // buildForegroundLayer itself; only non-foreground shells are drawn here.
  const underlayProjected = layers.filter(
    ({ el }) => !foregroundEls.some((f) => f === el || f.contains(el))
  )
  if (underlayProjected.length === 0) return null
  // A transformed wrapper that contains the backdrop would smuggle animated
  // background state into a texture whose key can't see it — bail to the
  // plain path rather than freeze it.
  if (
    underlayProjected.some(({ el }) =>
      el.querySelector('[data-export-stack="underlay"]')
    )
  ) {
    return null
  }

  const rootRect = node.getBoundingClientRect()
  if (!rootRect.width) return null

  const key = underlayCacheKey(node)
  let underlay = cachedUnderlay(capture, key)
  if (!underlay) {
    const restoreUnderlay = applyExportStackVisibility(node, "underlay", {
      alsoHide: layers.map(({ el }) => el),
    })
    try {
      underlay = await captureUnderlayPass(capture)
    } finally {
      restoreUnderlay()
    }
    if (!underlay) return null
    storeUnderlay(capture, key, underlay)
  }

  // The cached raster must stay pristine — compose onto a copy.
  const base = copyCanvas(underlay)
  const scale = base.width / rootRect.width
  const ctx = base.getContext("2d")
  if (!ctx) return null

  // The main media shell — the reference box for z-ordering the foreground.
  // For elements outside it, comparing against the shell and against media
  // nested inside it gives identical stacking answers; for elements inside it
  // (inner lighting), the descendant rule correctly keeps them above.
  const shell = underlayProjected[0].el

  // Foreground layers the user ordered behind the media composite under it.
  const aboveEls: HTMLElement[] = []
  const belowEls: HTMLElement[] = []
  for (const el of foregroundEls) {
    if (paintsAboveVideo(el, shell, node)) aboveEls.push(el)
    else belowEls.push(el)
  }

  if (belowEls.length > 0) {
    const layer = await buildForegroundLayer(
      capture,
      belowEls,
      scale,
      base.width,
      base.height
    )
    if (layer) ctx.drawImage(layer, 0, 0)
  }

  let textures = shellTextureCache.get(capture)
  if (!textures) {
    textures = new Map()
    shellTextureCache.set(capture, textures)
  }

  for (const layer of underlayProjected) {
    const isMediaShell =
      !!videoLayer && layer.el.contains(videoLayer.mediaElement)
    const textureKey = shellTextureKey(node, layer)
    let entry = textures.get(layer.el)
    if (!entry || entry.key !== textureKey) {
      const tex = await captureProjectedElementTexture(
        capture,
        layer,
        scale,
        foregroundEls,
        isMediaShell ? videoLayer.mediaElement : null
      )
      // A shell that fails to rasterize would leave a frame with no media at
      // all; the flattened single-pass frame is the lesser artifact.
      if (!tex) return null
      entry = { key: textureKey, tex }
      textures.set(layer.el, entry)
    }

    const source =
      isMediaShell && videoLayer
        ? await composeShellWithVideo(
            entry.tex,
            videoLayer,
            timelineMs,
            enhance,
            scale
          )
        : entry.tex.texture
    const projected = warpProjectedTexture(
      { ...entry.tex, texture: source },
      layer.quad,
      scale,
      base.width,
      base.height
    )
    if (!projected) return null
    ctx.drawImage(projected, 0, 0)
  }

  const chrome = await buildFrameChromeLayer(
    capture,
    shell,
    scale,
    base.width,
    base.height
  )
  if (chrome) ctx.drawImage(chrome, 0, 0)

  if (aboveEls.length > 0) {
    const layer = await buildForegroundLayer(
      capture,
      aboveEls,
      scale,
      base.width,
      base.height
    )
    if (layer) ctx.drawImage(layer, 0, 0)
  }

  return base
}
