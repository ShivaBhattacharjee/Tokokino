/**
 * Builds the per-frame renderer: given the styled clone and (optionally) a
 * WebCodecs frame source, returns a function that produces the fully styled
 * canvas for output frame `i`.
 *
 * Preference order:
 * 1. Composite — rasterize the scene ONCE with the video hidden and draw each
 *    decoded frame onto that template with 2D drawImage. Handles tilt by
 *    projecting the video's CSS transform quad (Safari cannot reliably re-raster
 *    a changing `<img>`/`<canvas>` inside html-to-image's foreignObject — most
 *    frames come back background-only, which looks like intense flicker).
 *
 *    Because the video is painted *over* that raster, anything the editor
 *    stacks above the media would end up behind it. So the scene is captured as
 *    two layers — underlay and foreground — and each frame is sandwiched
 *    between them. Components declare which side they belong to via
 *    data-export-stack; see `export-stack.ts`.
 * 2. Overlay — paint decoded frames into an `<img>` layered over the clone's
 *    hidden `<video>` and rasterize per frame (fallback when composite can't
 *    measure geometry). Includes WebKit settle/retries.
 * 3. DOM seek + rVFC wait — no WebCodecs decode available; best-effort quality.
 */

import { supportsObjectViewBox } from "../../crop-utils"
import { enhanceFilterCss } from "../../css-utils"
import type { AnimationCapture } from "../../export"
import { drawPortraitDepthOfField } from "../capture"
import { waitForPaint } from "../utils"
import {
  copyCanvas,
  nonBlackPct,
  opaquePct,
  setImageSource,
  shadowExtentPx,
  sleep,
} from "./frame-canvas-utils"
import type { DecodedFrameSource } from "./decoded-frames"
import { seekTo, waitForVideoFrame } from "./dom-video"
import { applyExportStackVisibility, queryForeground } from "./export-stack"
import {
  chooseQuadSubdivision,
  collectProjectedLayers,
  drawImageToQuadWarp,
  IDENTITY_TRANSFORM,
  projectElementQuad,
  projectionFor,
  resolveTransformCarrier,
  resolveVideoClipRadius,
  type ProjectedLayer,
  type UvProjectorH,
} from "./frame-geometry"
import { buildNativeInnerLightingLayer } from "./frame-inner-lighting"
import type { VideoMediaFx } from "./frame-inner-lighting"
import type { FramePlan, RenderFrame } from "./frames"
import { measureVideoRegion } from "./region"

// The split kept the module's public surface here: geometry helpers exercised
// by tests and the media Fx type re-export.
export { chooseQuadSubdivision, quadAffineError } from "./frame-geometry"
export type { UvProjector, UvProjectorH } from "./frame-geometry"
export type { VideoMediaFx } from "./frame-inner-lighting"

/**
 * Paint a decoded frame into a local buffer the size of the shell's layout box,
 * honoring object-fit/object-position and the media's own enhance filter.
 * `media` is the element whose computed styles govern fit/position — the
 * `<video>` here, or the `<img>` standing in for it in the Animate clone.
 */
export function paintFrameToLocalBox(
  frame: CanvasImageSource,
  localW: number,
  localH: number,
  media: HTMLElement,
  fw: number,
  fh: number,
  borderRadius = 0,
  mediaFx?: VideoMediaFx | null
): HTMLCanvasElement | null {
  const buf = document.createElement("canvas")
  buf.width = Math.max(1, Math.round(localW))
  buf.height = Math.max(1, Math.round(localH))
  const ctx = buf.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  const style = getComputedStyle(media)
  const fit = style.objectFit || "contain"
  const radius =
    borderRadius > 0
      ? borderRadius
      : Math.max(0, parseFloat(style.borderRadius) || 0)
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(0, 0, buf.width, buf.height, radius)
    ctx.clip()
  }

  let dw = buf.width
  let dh = buf.height
  let dx = 0
  let dy = 0
  if (fit === "contain" || fit === "cover") {
    const s =
      fit === "contain"
        ? Math.min(buf.width / fw, buf.height / fh)
        : Math.max(buf.width / fw, buf.height / fh)
    dw = fw * s
    dh = fh * s
    const pos = style.objectPosition.split(" ")
    /** Parse one object-position token (px or %) into an offset along `slack`. */
    const parsePos = (raw: string | undefined, slack: number) => {
      if (!raw) return slack / 2
      const n = parseFloat(raw)
      if (!Number.isFinite(n)) return slack / 2
      return raw.trim().endsWith("%") ? (n / 100) * slack : n
    }
    dx = parsePos(pos[0], buf.width - dw)
    dy = parsePos(pos[1], buf.height - dh)
  }

  try {
    const enhance = mediaFx?.enhance
      ? enhanceFilterCss(mediaFx.enhance)
      : undefined
    if (enhance) ctx.filter = enhance
    ctx.drawImage(frame, 0, 0, fw, fh, dx, dy, dw, dh)
    ctx.filter = "none"
  } catch {
    return null
  }

  return buf
}

/**
 * True when `layer`'s layout box overlaps the video box by ≥90% of the smaller
 * area — used to decide which overlays ride with the media shell.
 */
function overlapsVideoBox(layer: HTMLElement, video: HTMLVideoElement) {
  const a = layer.getBoundingClientRect()
  const b = video.getBoundingClientRect()
  const overlap =
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const smaller = Math.min(a.width * a.height, b.width * b.height)
  return smaller > 0 && overlap / smaller >= 0.9
}

/**
 * Capture a scene template, retrying on Safari when html-to-image returns an
 * empty/near-empty raster (common on the first few foreignObject paints).
 */
async function captureSceneTemplate(
  capture: AnimationCapture
): Promise<HTMLCanvasElement> {
  const isWebKit = !supportsObjectViewBox()
  const maxAttempts = isWebKit ? 8 : 2
  let best: HTMLCanvasElement | null = null
  let bestScore = -1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(20 + attempt * 15)
    else if (capture.needsPaint) await waitForPaint()

    let frame: HTMLCanvasElement
    try {
      frame = await capture.captureFrame()
    } catch {
      continue
    }
    const score = nonBlackPct(frame)
    if (score > bestScore) {
      bestScore = score
      best = frame
    }
    // Background-only scenes can legitimately be dark; accept anything that
    // produced a non-zero canvas. For video-hidden templates, mesh backgrounds
    // typically land around 10–20% non-black.
    if (frame.width > 0 && frame.height > 0 && score >= 1) {
      return frame
    }
  }
  if (best) return best
  return capture.captureFrame()
}

/**
 * Capture the foreground pass: everything above the media on a transparent
 * field. Unlike the scene template this is legitimately empty when the canvas
 * has no foreground layers, so emptiness is judged on alpha, not luminance —
 * and WebKit only gets retries when we know something *should* be there.
 */
async function captureForegroundLayer(
  capture: AnimationCapture
): Promise<HTMLCanvasElement | null> {
  const isWebKit = !supportsObjectViewBox()
  const maxAttempts = isWebKit ? 6 : 1
  let best: HTMLCanvasElement | null = null
  let bestScore = -1

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
    const score = opaquePct(frame)
    if (score > bestScore) {
      bestScore = score
      best = copyCanvas(frame)
    }
    if (score > 0.05) {
      return best
    }
  }

  return best
}

/**
 * Overlay an `<img>` we repaint from decoded frames (fallback path only).
 * Prefer composite — Safari foreignObject drops changing images most frames.
 */
function overlayVideoFrameImage(
  video: HTMLVideoElement
): ((frame: CanvasImageSource) => Promise<void>) | null {
  const parent = video.parentElement
  if (!parent) return null

  const scratch = document.createElement("canvas")
  const ctx = scratch.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  const img = document.createElement("img")
  img.className = video.className
  img.setAttribute("style", video.getAttribute("style") ?? "")
  const position = getComputedStyle(video).position
  if (position === "static" || position === "relative") {
    img.style.position = "absolute"
    img.style.inset = "0"
  }
  img.style.pointerEvents = "none"
  parent.insertBefore(img, video.nextSibling)
  video.style.visibility = "hidden"

  let lastFrame: CanvasImageSource | null = null
  let lastBlobUrl: string | null = null

  return async (frame: CanvasImageSource) => {
    if (frame === lastFrame) return

    const w = "width" in frame ? Number(frame.width) : video.videoWidth
    const h = "height" in frame ? Number(frame.height) : video.videoHeight
    if (!w || !h) return
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w
      scratch.height = h
    } else {
      ctx.clearRect(0, 0, w, h)
    }
    try {
      ctx.drawImage(frame, 0, 0, w, h)
    } catch {
      return
    }

    // Blob URLs (not data URLs): html-to-image re-embeds them fresh each capture
    // instead of trusting a giant inline data URI that Safari often skips.
    const blob = await new Promise<Blob | null>((resolve) =>
      scratch.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    )
    if (!blob) return
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl)
    const url = URL.createObjectURL(blob)
    lastBlobUrl = url
    await setImageSource(img, url)
    if (typeof img.decode === "function") {
      try {
        await img.decode()
      } catch {
        // decode() can reject on transient state — onload already fired.
      }
    }
    lastFrame = frame
  }
}

/** Untransformed padded raster of a projected element, plus its geometry. */
export type ProjectedElementTexture = {
  texture: HTMLCanvasElement
  /** Shadow margin baked around the border box, in root CSS px. */
  pad: number
  /** Padded box size, in root CSS px. */
  boxW: number
  boxH: number
  /** The hidden media element's box relative to the padded box, root CSS px. */
  mediaBox: { x: number; y: number; w: number; h: number } | null
}

/**
 * Rasterize one element with its transform removed, as a reusable texture.
 *
 * WebKit bakes a perspective transform flat inside foreignObject, so a tilted
 * box comes back the wrong shape. Capturing it untransformed gives the raster
 * nothing to flatten; the projection is then ours to do (warpProjectedTexture).
 * Splitting texture from warp lets a caller whose tilt *changes* per frame
 * (Animate export) capture once and re-project cheaply.
 *
 * `hideMedia` keeps a per-frame media element (the Animate clone's video
 * `<img>`) out of the texture and reports where its box sits, so the caller
 * can paint decoded frames straight into the texture instead.
 */
export async function captureProjectedElementTexture(
  capture: AnimationCapture,
  layer: ProjectedLayer,
  scale: number,
  /** Foreground nodes inside `el` — they composite above the video, not here. */
  excludeForeground: HTMLElement[] = [],
  hideMedia: HTMLElement | null = null
): Promise<ProjectedElementTexture | null> {
  const { el, carrier, quad } = layer

  // box-shadow / drop-shadow paint outside the border box and are transformed
  // with the element, so the texture has to include them or a tilted shadow gets
  // sheared off at the box edge.
  const pad = shadowExtentPx(el)

  const restoreVisibility = applyExportStackVisibility(
    capture.node,
    "foreground",
    { only: [el] }
  )
  // Nested foreground nodes inherit `el`'s visibility, so re-hide them.
  const restoreHidden = excludeForeground
    .filter((f) => f !== el && el.contains(f))
    .map((f) => {
      const prev = f.style.visibility
      f.style.visibility = "hidden"
      return () => {
        f.style.visibility = prev
      }
    })
  const prevMediaVisibility = hideMedia?.style.visibility
  if (hideMedia) hideMedia.style.visibility = "hidden"
  // Neutralize the transform on the *carrier*: `el` may merely inherit it, and
  // clearing a child that reports transform:none would change nothing.
  const prevTransform = carrier.style.transform

  // The carrier's transform is not only the tilt — it also carries the layout's
  // own translate(-50%, -50%) centering. Neutralizing it outright drops the
  // centering, dumping the element's top-left on its 50%/50% anchor where it
  // hangs off the capture canvas and rasterizes clipped: a full-size layer that
  // survives only as its top-left corner. So place the box at a known spot and
  // crop where it actually lands, rather than trusting it to stay put.
  carrier.style.transform = IDENTITY_TRANSFORM
  const rootRect = capture.node.getBoundingClientRect()
  const loose = el.getBoundingClientRect()
  const dx = -(loose.left - rootRect.left) + pad
  const dy = -(loose.top - rootRect.top) + pad
  carrier.style.transform = `matrix(1, 0, 0, 1, ${dx}, ${dy})`
  const placed = el.getBoundingClientRect()
  const cropX = Math.round((placed.left - rootRect.left - pad) * scale)
  const cropY = Math.round((placed.top - rootRect.top - pad) * scale)
  const mediaBox = hideMedia
    ? (() => {
        const rect = hideMedia.getBoundingClientRect()
        return {
          x: rect.left - placed.left + pad,
          y: rect.top - placed.top + pad,
          w: rect.width,
          h: rect.height,
        }
      })()
    : null

  let raster: HTMLCanvasElement | null = null
  try {
    raster = await captureForegroundLayer(capture)
  } finally {
    carrier.style.transform = prevTransform
    if (hideMedia) hideMedia.style.visibility = prevMediaVisibility ?? ""
    for (const restore of restoreHidden) restore()
    restoreVisibility()
  }
  if (!raster) return null
  // Lift the placed box (plus the shadow margin) out as the quad texture.
  const boxW = quad.localW + pad * 2
  const boxH = quad.localH + pad * 2
  const cropW = Math.max(1, Math.round(boxW * scale))
  const cropH = Math.max(1, Math.round(boxH * scale))
  const local = document.createElement("canvas")
  local.width = cropW
  local.height = cropH
  const lctx = local.getContext("2d")
  if (!lctx) return null
  lctx.drawImage(raster, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return { texture: local, pad, boxW, boxH, mediaBox }
}

/** Project a captured texture onto `quad`, into a fresh width×height canvas. */
export function warpProjectedTexture(
  tex: Pick<ProjectedElementTexture, "texture" | "pad" | "boxW" | "boxH">,
  quad: ProjectedLayer["quad"],
  scale: number,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const octx = out.getContext("2d")
  if (!octx) return null
  // The padded box maps through the same matrix — it is linear, so points
  // outside the border box project just as correctly as the corners.
  const projectUV: UvProjectorH = (u, v) => {
    const p = quad.projectH(u * tex.boxW - tex.pad, v * tex.boxH - tex.pad)
    return { x: p.x * scale, y: p.y * scale, w: p.w }
  }
  const subdivisions = chooseQuadSubdivision(projectUV)
  drawImageToQuadWarp(
    octx,
    tex.texture,
    tex.texture.width,
    tex.texture.height,
    projectUV,
    subdivisions
  )
  return out
}

/**
 * Rasterize one foreground element with its transform removed, then project it
 * ourselves onto its own quad. Texture capture + warp in one step, for callers
 * whose geometry is stable across frames.
 */
export async function captureProjectedElement(
  capture: AnimationCapture,
  layer: ProjectedLayer,
  scale: number,
  width: number,
  height: number,
  /** Foreground nodes inside `el` — they composite above the video, not here. */
  excludeForeground: HTMLElement[] = []
): Promise<HTMLCanvasElement | null> {
  const tex = await captureProjectedElementTexture(
    capture,
    layer,
    scale,
    excludeForeground
  )
  if (!tex) return null
  return warpProjectedTexture(tex, layer.quad, scale, width, height)
}

/**
 * Whether `el` paints above `video` in the live DOM's stacking order.
 *
 * The two-pass split must honor this: a foreground-tagged layer (annotation,
 * asset, text) shares the screenshot's `z-index: 60 + n` scale and can be ordered
 * *behind* the screenshot, where it belongs under the video, not over it. CSS
 * stacks the two at their nearest common ancestor — the child on each branch is
 * what actually competes — by z-index, then document order.
 */
export function paintsAboveVideo(
  el: HTMLElement,
  video: HTMLElement,
  root: HTMLElement
): boolean {
  const chainOf = (node: HTMLElement): HTMLElement[] => {
    const chain: HTMLElement[] = []
    let n: HTMLElement | null = node
    while (n) {
      chain.push(n)
      if (n === root) break
      n = n.parentElement
    }
    return chain
  }
  const elChain = chainOf(el)
  const vChain = chainOf(video)
  const vIndex = new Map(vChain.map((n, i) => [n, i]))
  const commonAt = elChain.findIndex((n) => vIndex.has(n))
  if (commonAt < 0) return true // disjoint trees — keep on top
  const common = elChain[commonAt]
  const elBranch = elChain[commonAt - 1]
  const vBranch = vChain[(vIndex.get(common) ?? 0) - 1]
  // One is an ancestor of the other: a descendant always paints over its box.
  if (!elBranch) return false
  if (!vBranch) return true
  /** Numeric z-index, treating `auto` as 0. */
  const z = (n: HTMLElement) => {
    const v = parseInt(getComputedStyle(n).zIndex, 10)
    return Number.isNaN(v) ? 0 : v
  }
  const ze = z(elBranch)
  const zv = z(vBranch)
  if (ze !== zv) return ze > zv
  return Boolean(
    vBranch.compareDocumentPosition(elBranch) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

/**
 * Build a raster layer from a set of nodes, projecting each perspective-carrying
 * one individually (the flat raster would flatten it) and capturing the rest in
 * one pass. Projected ones are painted first: they are locked to the media box
 * and sit at the bottom (inner lighting is z-10, below text/overlays).
 *
 * `els` is passed explicitly so the caller can split the foreground by z-order —
 * layers ordered behind the screenshot are composited under the video instead.
 */
export async function buildForegroundLayer(
  capture: AnimationCapture,
  els: HTMLElement[],
  scale: number,
  width: number,
  height: number,
  _label = "foreground groups"
): Promise<HTMLCanvasElement | null> {
  const all = els
  if (all.length === 0) return null
  // Each foreground node is projected on its own if anything bends it — whether
  // it carries the transform or inherits one from a tilted wrapper.
  const perspective: ProjectedLayer[] = []
  const flat: HTMLElement[] = []
  for (const el of all) {
    const layer = projectionFor(capture.node, el)
    if (layer) perspective.push(layer)
    else flat.push(el)
  }

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const ctx = out.getContext("2d")
  if (!ctx) return null
  let painted = false

  for (const layer of perspective) {
    const canvas = await captureProjectedElement(
      capture,
      layer,
      scale,
      width,
      height
    )
    if (canvas) {
      ctx.drawImage(canvas, 0, 0)
      painted = true
    }
  }

  if (flat.length > 0) {
    const restore = applyExportStackVisibility(capture.node, "foreground", {
      only: flat,
    })
    try {
      const layer = await captureForegroundLayer(capture)
      if (layer) {
        ctx.drawImage(layer, 0, 0)
        painted = true
      }
    } finally {
      restore()
    }
  }

  return painted ? out : null
}

/**
 * Re-project a device frame's chrome (bezel + notch) so it composites *over* the
 * decoded video, matching its real z-10 order in the DOM.
 *
 * The chrome is left untagged so it stays baked into the underlay shell, where it
 * casts the frame's drop-shadow. That copy is buried by an opaque cover/fill
 * video, so this pass paints the bezel back on top. The shadow filter lives on an
 * ancestor (`data-editor-shadow-filter-target`); it is neutralized here so the
 * on-top copy carries only the bezel, not a second phone-shaped shadow.
 */
export async function buildFrameChromeLayer(
  capture: AnimationCapture,
  shell: HTMLElement,
  scale: number,
  width: number,
  height: number
): Promise<HTMLCanvasElement | null> {
  const chromes = Array.from(
    shell.querySelectorAll<HTMLElement>("[data-export-frame-chrome]")
  )
  if (chromes.length === 0) return null

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const ctx = out.getContext("2d")
  if (!ctx) return null
  let painted = false

  for (const chrome of chromes) {
    const shadowHost = chrome.closest<HTMLElement>(
      "[data-editor-shadow-filter-target]"
    )
    const prevFilter = shadowHost?.style.filter
    if (shadowHost) shadowHost.style.filter = "none"
    try {
      const layer = projectionFor(capture.node, chrome)
      if (layer) {
        const canvas = await captureProjectedElement(
          capture,
          layer,
          scale,
          width,
          height
        )
        if (canvas) {
          ctx.drawImage(canvas, 0, 0)
          painted = true
        }
      } else {
        // Untilted frame: no perspective to undo — capture it in place.
        const restore = applyExportStackVisibility(capture.node, "foreground", {
          only: [chrome],
        })
        try {
          const raster = await captureForegroundLayer(capture)
          if (raster) {
            ctx.drawImage(raster, 0, 0)
            painted = true
          }
        } finally {
          restore()
        }
      }
    } finally {
      if (shadowHost) shadowHost.style.filter = prevFilter ?? ""
    }
  }

  return painted ? out : null
}

/**
 * Composite path: one scene raster reused for every frame, with each decoded
 * frame drawn into the shell's projected quad (includes CSS 3D tilt).
 */
async function createCompositeRenderer(
  capture: AnimationCapture,
  video: HTMLVideoElement,
  decoded: DecodedFrameSource,
  plan: FramePlan,
  mediaFx?: VideoMediaFx | null
): Promise<RenderFrame | null> {
  // Seed natural size from the DOM video; fall back to the first decoded frame
  // when Safari reports 0×0 on an unplayed clone.
  let naturalW = video.videoWidth
  let naturalH = video.videoHeight
  if (!naturalW || !naturalH) {
    const seed = await decoded.getFrameAt(0)
    naturalW = seed ? Number((seed as { width?: unknown }).width) || 0 : 0
    naturalH = seed ? Number((seed as { height?: unknown }).height) || 0 : 0
  }
  if (!naturalW || !naturalH) {
    return null
  }

  // Tilt/scale/position live on some wrapper around the <video>. Find the one
  // that actually carries the 3D matrix and project the *video's own box*
  // through it — the carrier's box is often a larger, untilted wrapper.
  const carrier = resolveTransformCarrier(video, capture.node)
  const shell = carrier ?? video

  // Measure geometry while everything is still laid out and visible.
  const quad = carrier
    ? projectElementQuad(capture.node, carrier, video)
    : projectElementQuad(capture.node, video)
  const region = measureVideoRegion(capture.node, video)

  if (!quad && !region) {
    return null
  }

  // Every element whose box the raster would flatten — the media shell (with its
  // plate, radius, border, frame chrome and shadow) and any tilted overlay. These
  // are kept out of the flat passes and projected individually below, so nothing
  // depends on WebKit getting perspective right.
  const projected = collectProjectedLayers(capture.node)

  // Pass 1 — underlay: backdrop only. Anything bent by perspective is excluded
  // and re-projected; without perspective the raster is faithful and stays put.
  const restoreUnderlay = applyExportStackVisibility(capture.node, "underlay", {
    alsoHide: projected.map(({ el }) => el),
  })
  if (capture.needsPaint) await waitForPaint()

  const template = await captureSceneTemplate(capture)
  const templateCopy = copyCanvas(template)
  restoreUnderlay()

  // Capture-root CSS px → template px. Every quad is measured in root CSS px,
  // so the video and each projected layer share this scale.
  const rootW = region?.rootW ?? capture.node.getBoundingClientRect().width
  const scale = rootW > 0 ? templateCopy.width / rootW : 1

  // Project the non-foreground bent layers (the media shell) straight onto the
  // underlay: this is what puts the plate, border, radius, frame chrome and
  // shadow back — in the right shape — under the video drawn into the same quad.
  const foregroundEls = queryForeground(capture.node)
  // Inner lighting has a matching canvas implementation in
  // `paintFrameToLocalBox`. Keeping it in the SVG foreground pass on Safari
  // produces the horizontal grey wash shown in the exported video, so omit
  // only the layer that actually covers this main video. Other screenshot-slot
  // lights remain normal foreground elements.
  const nativeInnerLighting = mediaFx?.innerLighting
    ? foregroundEls.filter(
        (el) =>
          el.hasAttribute("data-export-inner-lighting") &&
          overlapsVideoBox(el, video)
      )
    : []
  const compositedForegroundEls = foregroundEls.filter(
    (el) => !nativeInnerLighting.includes(el)
  )
  const nativeInnerLightingLayer = mediaFx?.innerLighting
    ? buildNativeInnerLightingLayer(
        capture.node,
        nativeInnerLighting,
        mediaFx.innerLighting,
        scale,
        templateCopy.width,
        templateCopy.height
      )
    : null
  const underlayProjected = projected.filter(
    ({ el }) => !foregroundEls.some((f) => f === el || f.contains(el))
  )

  // Split the foreground by real stacking order: layers the user sent behind the
  // screenshot must composite under the video, not over it. Only meaningful when
  // the shell is projected (drawn separately, below) — otherwise it is baked into
  // the backdrop template and there is no seam to slip a layer beneath.
  const canOrderBelow = underlayProjected.length > 0
  const aboveEls: HTMLElement[] = []
  const belowEls: HTMLElement[] = []
  for (const el of compositedForegroundEls) {
    if (canOrderBelow && !paintsAboveVideo(el, video, capture.node)) {
      belowEls.push(el)
    } else {
      aboveEls.push(el)
    }
  }
  const tctx = templateCopy.getContext("2d")

  // Behind-the-screenshot layers first, so the projected shell paints over them.
  if (belowEls.length > 0) {
    const belowLayer = await buildForegroundLayer(
      capture,
      belowEls,
      scale,
      templateCopy.width,
      templateCopy.height,
      "underlay foreground groups"
    )
    if (belowLayer && tctx) {
      tctx.drawImage(belowLayer, 0, 0)
    }
  }

  for (const layer of underlayProjected) {
    const canvas = await captureProjectedElement(
      capture,
      layer,
      scale,
      templateCopy.width,
      templateCopy.height,
      compositedForegroundEls
    )
    if (canvas && tctx) tctx.drawImage(canvas, 0, 0)
  }
  // Pass 2 — foreground: inner lighting, overlay textures, text, assets,
  // annotations and slots, built once and drawn over every composited frame.
  // This is what makes the stacking general: the editor decides what's above the
  // media via data-export-stack, not this renderer.
  let foregroundLayer: HTMLCanvasElement | null = null
  if (aboveEls.length > 0) {
    foregroundLayer = await buildForegroundLayer(
      capture,
      aboveEls,
      scale,
      templateCopy.width,
      templateCopy.height
    )
  }

  // Device-frame chrome (bezel + notch), re-drawn over the video since its
  // underlay copy is buried by an opaque cover/fill fit.
  const frameChromeLayer = await buildFrameChromeLayer(
    capture,
    shell,
    scale,
    templateCopy.width,
    templateCopy.height
  )
  const scratch = document.createElement("canvas")
  scratch.width = templateCopy.width
  scratch.height = templateCopy.height
  const sctx = scratch.getContext("2d", { willReadFrequently: true })
  if (!sctx) throw new Error("Could not get 2d context for compositing")

  const localW = quad?.localW ?? region?.destW ?? naturalW
  const localH = quad?.localH ?? region?.destH ?? naturalH

  // Normalized media box → template px, perspective-correct.
  const projectUV: UvProjectorH | null = quad
    ? (u, v) => {
        const p = quad.projectH(u * quad.localW, v * quad.localH)
        return { x: p.x * scale, y: p.y * scale, w: p.w }
      }
    : null

  const useQuad = !!projectUV
  const subdivisions = projectUV ? chooseQuadSubdivision(projectUV) : 1

  // Corner rounding that clips the video's own box. It is NOT on the tilt shell:
  // for a device frame that outer div is square-cornered and the rounded screen
  // glass sits a couple levels down. Without it the video keeps sharp corners
  // that poke out past the bezel's rounded silhouette (cover/fill especially).
  const shellRadius = resolveVideoClipRadius(video, shell, localW)

  return async (i: number) => {
    const t = plan.timeForFrame(i)
    const frame = await decoded.getFrameAt(t)
    sctx.clearRect(0, 0, scratch.width, scratch.height)
    sctx.drawImage(templateCopy, 0, 0)

    if (frame) {
      const fw = Number((frame as { width?: unknown }).width) || naturalW
      const fh = Number((frame as { height?: unknown }).height) || naturalH
      if (fw > 0 && fh > 0) {
        if (useQuad && projectUV) {
          // Paint object-fit into the shell's local box, using the <video>'s
          // object-fit but the shell's border-radius.
          const local = paintFrameToLocalBox(
            frame,
            localW,
            localH,
            video,
            fw,
            fh,
            shellRadius,
            mediaFx
          )
          if (local) {
            drawImageToQuadWarp(
              sctx,
              local,
              local.width,
              local.height,
              projectUV,
              subdivisions
            )
          }
        } else if (region) {
          // AABB path: paint into a local box (with fx) then drawImage that.
          const local = paintFrameToLocalBox(
            frame,
            region.destW,
            region.destH,
            video,
            fw,
            fh,
            shellRadius,
            mediaFx
          )
          const dx = region.destX * scale
          const dy = region.destY * scale
          const dw = region.destW * scale
          const dh = region.destH * scale
          const clip = region.clip
          sctx.save()
          if (clip && typeof sctx.roundRect === "function") {
            sctx.beginPath()
            sctx.roundRect(
              clip.x * scale,
              clip.y * scale,
              clip.w * scale,
              clip.h * scale,
              clip.radii.map((r) => r * scale)
            )
            sctx.clip()
          }
          if (local) {
            sctx.drawImage(local, dx, dy, dw, dh)
          } else {
            sctx.drawImage(
              frame,
              region.srcXFrac * fw,
              region.srcYFrac * fh,
              region.srcWFrac * fw,
              region.srcHFrac * fh,
              dx,
              dy,
              dw,
              dh
            )
          }
          sctx.restore()
        }
      }
    }

    // The device bezel/notch masks the video edges before the editor's own
    // foreground (text, annotations) is stacked above the whole device.
    if (nativeInnerLightingLayer) sctx.drawImage(nativeInnerLightingLayer, 0, 0)
    if (frameChromeLayer) sctx.drawImage(frameChromeLayer, 0, 0)

    // Everything the editor stacks above the media, back on top of the video.
    if (foregroundLayer) sctx.drawImage(foregroundLayer, 0, 0)

    return scratch
  }
}

/**
 * Per-frame rasterization of the clone — fallback when composite can't run.
 * On WebKit, retries captures that come back background-only (foreignObject
 * nested-image race).
 */
function createRasterRenderer(
  capture: AnimationCapture,
  video: HTMLVideoElement,
  decoded: DecodedFrameSource | null,
  plan: FramePlan,
  signal?: AbortSignal
): RenderFrame {
  const paintOverlay = decoded ? overlayVideoFrameImage(video) : null
  const isWebKit = !supportsObjectViewBox()

  // Background-only captures sit ~13% non-black; with video ~70%.
  const minNonBlack = 25

  return async (i: number) => {
    const t = plan.timeForFrame(i)
    let drewDecoded = false
    if (decoded && paintOverlay) {
      const frame = await decoded.getFrameAt(t)
      if (frame) {
        await paintOverlay(frame)
        drewDecoded = true
      }
    } else {
      await seekTo(video, t, signal)
      if (!supportsObjectViewBox()) await waitForVideoFrame(video)
    }
    if (capture.needsPaint) await waitForPaint()

    let out: HTMLCanvasElement
    out = await capture.captureFrame()
    if (isWebKit && drewDecoded) {
      // Nested images inside SVG foreignObject load async on WebKit — most
      // first paints miss the video (background-only). Retry until the video
      // area shows up or we exhaust attempts.
      for (let attempt = 0; attempt < 10; attempt++) {
        if (nonBlackPct(out) >= minNonBlack) break
        await sleep(16 + attempt * 12)
        out = await capture.captureFrame()
      }
    }
    return out
  }
}

/**
 * Portrait blur/stage fake depth-of-field with `backdrop-filter`, which cannot
 * rasterize inside a foreignObject — the overlay is neutralized during capture
 * and reconstructed in 2D instead. The Animate paths get this via
 * `captureStableFrame`; video-media builds its frames here, so without this wrap
 * the effect is silently dropped from every video export.
 *
 * Runs last, on the finished frame, because the overlay sits above the media and
 * is meant to blur the video too. No-ops when no portrait overlay is tagged.
 */
function withPortraitDepthOfField(
  render: RenderFrame,
  node: HTMLElement
): RenderFrame {
  const count = node.querySelectorAll("[data-export-portrait-fx]").length
  if (count === 0) return render
  return async (i: number) => {
    const frame = await render(i)
    drawPortraitDepthOfField(frame, node)
    return frame
  }
}

/**
 * Pick and build the frame renderer for this export.
 *
 * Always prefers composite when WebCodecs frames are available — including
 * tilted videos (projected quad). Per-frame foreignObject raster of a changing
 * video overlay flickers hard on Safari.
 */
export async function createFrameRenderer({
  capture,
  video,
  decoded,
  tilted: _tilted,
  plan,
  signal,
  mediaFx,
  cropAnimated = false,
}: {
  capture: AnimationCapture
  video: HTMLVideoElement
  decoded: DecodedFrameSource | null
  tilted: boolean
  plan: FramePlan
  signal?: AbortSignal
  /** Media-pixel effects (enhance) re-applied to the decoded frame. */
  mediaFx?: VideoMediaFx | null
  /**
   * A clip animates the crop. The composite renderer measures the video's
   * visible sub-rect ONCE at setup, so it would freeze the crop on its first
   * frame; the raster path re-captures the DOM every frame and follows it.
   */
  cropAnimated?: boolean
}): Promise<RenderFrame> {
  if (decoded && !cropAnimated) {
    const composite = await createCompositeRenderer(
      capture,
      video,
      decoded,
      plan,
      mediaFx
    )
    if (composite) {
      return withPortraitDepthOfField(composite, capture.node)
    }
  }
  return withPortraitDepthOfField(
    createRasterRenderer(capture, video, decoded, plan, signal),
    capture.node
  )
}
