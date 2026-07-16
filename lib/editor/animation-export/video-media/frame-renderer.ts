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
import type { EnhancePreset } from "../../state-types"
import { drawPortraitDepthOfField } from "../capture"
import {
  exportDebugLog,
  getActiveExportDebug,
  sampleFrameStats,
} from "../export-debug"
import { waitForPaint } from "../utils"
import type { DecodedFrameSource } from "./decoded-frames"
import { seekTo, waitForVideoFrame } from "./dom-video"
import {
  applyExportStackVisibility,
  countExportStack,
  queryForeground,
} from "./export-stack"
import type { FramePlan, RenderFrame } from "./frames"
import { measureVideoRegion } from "./region"
import { drawImageToQuadGL, type QuadCornerH } from "./warp-gl"

type Point = { x: number; y: number }

/**
 * Effects that apply to the video's own pixels, so they cannot come from the
 * foreground pass — we draw the decoded frame ourselves and must re-apply them.
 * Everything that merely sits *above* the media (lighting, overlays, text,
 * annotations) is captured by the foreground pass instead — see export-stack.
 */
export type VideoMediaFx = {
  enhance?: EnhancePreset | null
}

/** Wait for an `<img>` to finish decoding a new `src` (or fail open). */
function setImageSource(img: HTMLImageElement, url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse CSS `transform-origin` into px relative to the element's border box.
 */
function parseTransformOrigin(
  origin: string,
  width: number,
  height: number
): Point {
  const parts = origin.trim().split(/\s+/)
  const parsePart = (
    raw: string | undefined,
    size: number,
    fallback: number
  ) => {
    if (!raw) return fallback
    if (raw.endsWith("%")) {
      const n = parseFloat(raw)
      return Number.isFinite(n) ? (n / 100) * size : fallback
    }
    if (raw === "left" || raw === "top") return 0
    if (raw === "right" || raw === "bottom") return size
    if (raw === "center") return size / 2
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    x: parsePart(parts[0], width, width / 2),
    y: parsePart(parts[1], height, height / 2),
  }
}

/**
 * The nearest ancestor-or-self carrying the 3D transform, or null.
 *
 * The tilt lives on some wrapper around the `<video>`, never on the video
 * itself, but *which* wrapper depends on the render path (bare / framed / row
 * item). Identify it by the property that actually matters — carrying a 3D
 * matrix — rather than guessing from a marker attribute: attribute guesses put
 * the video in an untransformed 1026×614 wrapper while the real tilt sat on a
 * 982×616 div inside it, and it exported flat.
 */
function resolveTransformCarrier(
  el: HTMLElement,
  root: HTMLElement
): HTMLElement | null {
  let node: HTMLElement | null = el
  while (node) {
    if (getComputedStyle(node).transform.startsWith("matrix3d(")) return node
    if (node === root) break
    node = node.parentElement
  }
  return null
}

/**
 * Neutralize a transform without removing it.
 *
 * A computed `transform` other than `none` makes an element the containing block
 * for its absolutely-positioned descendants, so `transform: none` silently
 * re-parents every abs-positioned child to a different ancestor and their
 * percentage sizes resolve against the wrong box. A device frame renders its
 * chrome that way: clearing the tilt on the carrier collapsed the frame to ~46%
 * inside a carrier whose own box never moved — a correctly placed, half-size
 * frame. Identity leaves layout alone and still paints untransformed.
 */
const IDENTITY_TRANSFORM = "matrix(1, 0, 0, 1, 0, 0)"

/** A planar box projected into capture-root CSS px, perspective included. */
type QuadProjection = {
  corners: [Point, Point, Point, Point]
  localW: number
  localH: number
  /** Border-box px within the element → capture-root CSS px. */
  project: (x: number, y: number) => Point
  /** Same, but keeping the homogeneous w the GPU warp needs to interpolate. */
  projectH: (x: number, y: number) => QuadCornerH
  /** True when the CSS matrix carries a perspective component (w varies). */
  hasPerspective: boolean
  /** Untransformed top-left of the box, in capture-root CSS px. */
  origin: Point
}

/**
 * Project `target`'s border box into the capture root's CSS-px space, through
 * the 3D transform carried by `carrier` (an ancestor-or-self of target).
 *
 * Splitting carrier from target matters: the element holding the tilt is often a
 * wrapper, while the box we need to paint into is the `<video>` (or an overlay)
 * nested inside it. Projecting the carrier's own box instead would paint the
 * video into the wrapper's rectangle.
 *
 * Clears the carrier's transform to read untransformed layout, then re-applies
 * the computed matrix around its transform-origin.
 */
function projectElementQuad(
  root: HTMLElement,
  carrier: HTMLElement,
  target: HTMLElement = carrier
): QuadProjection | null {
  const style = getComputedStyle(carrier)
  const cssTransform = style.transform

  // Untransformed layout — the transform MUST be neutralized on the carrier (the
  // element that actually has it), not on a child reporting transform:none.
  const prevInline = carrier.style.transform
  carrier.style.transform = IDENTITY_TRANSFORM
  void carrier.offsetWidth
  const rootRect = root.getBoundingClientRect()
  const carrierBox = carrier.getBoundingClientRect()
  const box = target === carrier ? carrierBox : target.getBoundingClientRect()
  carrier.style.transform = prevInline
  void carrier.offsetWidth

  // Prefer getBoundingClientRect size (after transform:none) over offsetWidth —
  // offset* can disagree under subpixel layout / export clones.
  const localW = box.width
  const localH = box.height
  if (!rootRect.width || !localW || !localH) return null

  const ox = box.left - rootRect.left
  const oy = box.top - rootRect.top

  const untransformed = (): QuadProjection => {
    const project = (x: number, y: number) => ({ x: ox + x, y: oy + y })
    return {
      projectH: (x, y) => ({ ...project(x, y), w: 1 }),
      corners: [
        { x: ox, y: oy },
        { x: ox + localW, y: oy },
        { x: ox + localW, y: oy + localH },
        { x: ox, y: oy + localH },
      ],
      localW,
      localH,
      project,
      hasPerspective: false,
      origin: { x: ox, y: oy },
    }
  }

  if (!cssTransform || cssTransform === "none") return untransformed()

  let matrix: DOMMatrix
  try {
    matrix = new DOMMatrix(cssTransform)
  } catch {
    return untransformed()
  }

  // The matrix acts around the carrier's transform-origin, in the carrier's
  // local space — so target coordinates are offset into that space first.
  const origin = parseTransformOrigin(
    style.transformOrigin,
    carrierBox.width,
    carrierBox.height
  )
  const localMatrix = new DOMMatrix()
    .translate(origin.x, origin.y)
    .multiply(matrix)
    .translate(-origin.x, -origin.y)

  const targetX = box.left - carrierBox.left
  const targetY = box.top - carrierBox.top
  const carrierOx = carrierBox.left - rootRect.left
  const carrierOy = carrierBox.top - rootRect.top

  /**
   * CSS flattens a 3D transform to 2D with a perspective divide. DOMPoint's
   * matrixTransform returns the raw homogeneous point and does NOT divide by w,
   * so reading `p.x`/`p.y` silently mis-sizes any perspective-tilted box (the
   * editor's tilt bakes perspective() into the matrix, giving w ≈ 0.82–1.18).
   */
  const projectH = (x: number, y: number): QuadCornerH => {
    const p = new DOMPoint(targetX + x, targetY + y, 0, 1).matrixTransform(
      localMatrix
    )
    // w <= 0 is behind the camera — no sane 2D image; fall back to no divide.
    const w = p.w > 1e-6 ? p.w : 1
    return { x: carrierOx + p.x / w, y: carrierOy + p.y / w, w }
  }
  const project = (x: number, y: number): Point => {
    const { x: px, y: py } = projectH(x, y)
    return { x: px, y: py }
  }

  const cornerPoints = (
    [
      [0, 0],
      [localW, 0],
      [localW, localH],
      [0, localH],
    ] as const
  ).map(([x, y]) => projectH(x, y))

  return {
    corners: cornerPoints.map(({ x, y }) => ({ x, y })) as [
      Point,
      Point,
      Point,
      Point,
    ],
    localW,
    localH,
    project,
    projectH,
    hasPerspective: cornerPoints.some((c) => Math.abs(c.w - 1) > 1e-4),
    origin: { x: ox, y: oy },
  }
}

/**
 * An element whose rasterized shape WebKit gets wrong: `el` is what we paint,
 * `carrier` is the ancestor-or-self holding the 3D matrix that bends it.
 */
type ProjectedLayer = {
  el: HTMLElement
  carrier: HTMLElement
  quad: QuadProjection
}

/**
 * The projection for one element, via whichever ancestor carries the tilt, or
 * null when nothing bends its box. Works for elements that inherit a transform
 * from a wrapper rather than carrying one themselves — inner lighting nested in
 * a tilted shell has no matrix3d of its own, but is bent all the same.
 */
function projectionFor(
  root: HTMLElement,
  el: HTMLElement
): ProjectedLayer | null {
  const carrier = resolveTransformCarrier(el, root)
  if (!carrier) return null
  const quad = projectElementQuad(root, carrier, el)
  return quad?.hasPerspective ? { el, carrier, quad } : null
}

/**
 * Every element whose box the raster will flatten, outermost first.
 *
 * `perspective()` alone is not enough to matter: the editor always emits
 * `perspective(1400px) rotateX(0) …`, and with no rotation every corner sits at
 * z=0, so w stays 1 and the flat and perspective projections are identical. The
 * test is whether w actually varies across the corners — `hasPerspective` —
 * which is what makes a box bend. `matrix3d` is a cheap pre-filter (2D
 * transforms serialize as `matrix`).
 *
 * Nested hits are dropped: projecting an ancestor already carries its subtree,
 * and projecting both would apply the transform twice.
 */
function collectProjectedLayers(root: HTMLElement): ProjectedLayer[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => getComputedStyle(el).transform.startsWith("matrix3d(")
  )
  const outermost = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el))
  )
  const layers: ProjectedLayer[] = []
  for (const el of outermost) {
    const quad = projectElementQuad(root, el)
    if (quad?.hasPerspective) layers.push({ el, carrier: el, quad })
  }
  return layers
}

/**
 * Draw `image` (source rect → full image if omitted) into a destination
 * triangle using an affine map. Used to approximate a projected quad.
 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point
) {
  // Cells share exact edges and must not overlap: drawing a translucent texture
  // twice composites it twice (2a - a²), which prints the grid straight onto any
  // semi-transparent layer like inner lighting.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(d0.x, d0.y)
  ctx.lineTo(d1.x, d1.y)
  ctx.lineTo(d2.x, d2.y)
  ctx.closePath()
  ctx.clip()

  // Solve the affine transform that maps source triangle → dest triangle.
  // | a c e |   | x |   | x' |
  // | b d f | * | y | = | y' |
  // | 0 0 1 |   | 1 |   | 1  |
  const denom =
    s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y)
  if (Math.abs(denom) < 1e-6) {
    ctx.restore()
    return
  }

  const a =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom
  const b =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom
  const c =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom
  const d =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom

  ctx.setTransform(a, b, c, d, e, f)
  ctx.drawImage(image, 0, 0)
  ctx.restore()
}

/** Maps normalized (u, v) in [0,1]² across the media box → destination px. */
export type UvProjector = (u: number, v: number) => Point

/** Same, carrying the homogeneous w so the GPU can do the divide exactly. */
export type UvProjectorH = (u: number, v: number) => QuadCornerH

/**
 * A canvas 2D transform is affine, so it cannot reproduce a perspective divide:
 * mapping the whole quad with two triangles bows the image badly (measured >100px
 * of interior error at the editor's default tilt). Subdividing into a grid keeps
 * each cell's affine error sub-pixel, since the error shrinks with cell size.
 *
 * Returns the coarsest grid whose worst probe stays under `tolerancePx`. Pure
 * rotateZ/scale/translate has no perspective and is exact at 1×1.
 */
export function chooseQuadSubdivision(
  project: UvProjector,
  tolerancePx = 0.5
): number {
  for (const n of [1, 2, 4, 8, 16, 24, 32]) {
    if (quadAffineError(project, n) <= tolerancePx) return n
  }
  return 32
}

/** Worst affine-vs-true deviation over a grid, probed per triangle. */
export function quadAffineError(project: UvProjector, n: number): number {
  let worst = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / n
      const u1 = (i + 1) / n
      const v0 = j / n
      const v1 = (j + 1) / n
      const tris: [Point, Point, Point][] = [
        [
          { x: u0, y: v0 },
          { x: u1, y: v0 },
          { x: u0, y: v1 },
        ],
        [
          { x: u1, y: v0 },
          { x: u1, y: v1 },
          { x: u0, y: v1 },
        ],
      ]
      for (const [a, b, c] of tris) {
        const da = project(a.x, a.y)
        const db = project(b.x, b.y)
        const dc = project(c.x, c.y)
        // Affine is exact at the vertices, so probe the interior + edges.
        const probes: [number, number, number][] = [
          [1 / 3, 1 / 3, 1 / 3],
          [0.5, 0.5, 0],
          [0, 0.5, 0.5],
          [0.5, 0, 0.5],
        ]
        for (const [wa, wb, wc] of probes) {
          const u = a.x * wa + b.x * wb + c.x * wc
          const v = a.y * wa + b.y * wb + c.y * wc
          const truePt = project(u, v)
          const approx = {
            x: da.x * wa + db.x * wb + dc.x * wc,
            y: da.y * wa + db.y * wb + dc.y * wc,
          }
          worst = Math.max(
            worst,
            Math.hypot(truePt.x - approx.x, truePt.y - approx.y)
          )
          if (worst > 1e4) return worst
        }
      }
    }
  }
  return worst
}

/**
 * Map a full image onto a projected quad, preferring the GPU.
 *
 * The subdivided 2D path is a fallback: its cells cannot share an edge cleanly
 * (see warp-gl.ts), so it trades a seam lattice for the perspective it can't
 * otherwise express. Returns which path ran, for the debug log.
 */
function drawImageToQuadWarp(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  project: UvProjectorH,
  subdivisions: number
): "gl" | "grid" {
  const corners: [QuadCornerH, QuadCornerH, QuadCornerH, QuadCornerH] = [
    project(0, 0),
    project(1, 0),
    project(1, 1),
    project(0, 1),
  ]
  if (drawImageToQuadGL(ctx, image, srcW, srcH, corners)) return "gl"
  drawImageToQuad(ctx, image, srcW, srcH, project, subdivisions)
  return "grid"
}

/**
 * Map a full image onto a projected quad via an `n × n` grid of affine cells.
 */
function drawImageToQuad(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  srcW: number,
  srcH: number,
  project: UvProjector,
  n: number
) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / n
      const u1 = (i + 1) / n
      const v0 = j / n
      const v1 = (j + 1) / n

      const s00 = { x: u0 * srcW, y: v0 * srcH }
      const s10 = { x: u1 * srcW, y: v0 * srcH }
      const s11 = { x: u1 * srcW, y: v1 * srcH }
      const s01 = { x: u0 * srcW, y: v1 * srcH }

      const d00 = project(u0, v0)
      const d10 = project(u1, v0)
      const d11 = project(u1, v1)
      const d01 = project(u0, v1)

      drawTexturedTriangle(ctx, image, s00, s10, s01, d00, d10, d01)
      drawTexturedTriangle(ctx, image, s10, s11, s01, d10, d11, d01)
    }
  }
}

/**
 * Paint a decoded frame into a local buffer the size of the shell's layout box,
 * honoring object-fit/object-position and the media's own enhance filter.
 * Overlays that sit above the media come from the foreground pass, not here.
 */
function paintFrameToLocalBox(
  frame: CanvasImageSource,
  localW: number,
  localH: number,
  video: HTMLVideoElement,
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

  const style = getComputedStyle(video)
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
 * Capture a scene template, retrying on Safari when html-to-image returns an
 * empty/near-empty raster (common on the first few foreignObject paints).
 */
async function captureSceneTemplate(
  capture: AnimationCapture,
  label: string
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
    } catch (err) {
      exportDebugLog(
        "warn",
        label,
        `template capture attempt ${attempt + 1} threw`,
        {
          error: err instanceof Error ? err.message : String(err),
        }
      )
      continue
    }
    const stats = sampleFrameStats(frame)
    const score = stats?.nonBlackPct ?? 0
    if (score > bestScore) {
      bestScore = score
      best = frame
    }
    // Background-only scenes can legitimately be dark; accept anything that
    // produced a non-zero canvas. For video-hidden templates, mesh backgrounds
    // typically land around 10–20% non-black.
    if (frame.width > 0 && frame.height > 0 && score >= 1) {
      if (attempt > 0) {
        exportDebugLog("info", label, `template ok on attempt ${attempt + 1}`, {
          score,
        })
      }
      return frame
    }
  }
  if (best) return best
  return capture.captureFrame()
}

/** Detached copy so a later capture can't alias the same canvas buffer. */
function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context for canvas copy")
  ctx.drawImage(src, 0, 0)
  return out
}

/** Fraction of sampled pixels with meaningful alpha (0–100). */
function opaquePct(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx || !canvas.width || !canvas.height) return 0
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return 0
  }
  // Stride the buffer — full scans of an 8K frame are needlessly slow here.
  const step = Math.max(1, Math.floor(data.length / 4 / 20000)) * 4
  let seen = 0
  let opaque = 0
  for (let i = 3; i < data.length; i += step) {
    seen++
    if (data[i] > 8) opaque++
  }
  return seen ? (opaque / seen) * 100 : 0
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
    } catch (err) {
      exportDebugLog(
        "warn",
        "renderer.composite",
        `foreground capture attempt ${attempt + 1} threw`,
        { error: err instanceof Error ? err.message : String(err) }
      )
      continue
    }
    if (!frame.width || !frame.height) continue
    const score = opaquePct(frame)
    if (score > bestScore) {
      bestScore = score
      best = copyCanvas(frame)
    }
    if (score > 0.05) {
      exportDebugLog(
        "info",
        "renderer.composite",
        "foreground layer captured",
        {
          attempt: attempt + 1,
          opaquePct: Number(score.toFixed(2)),
          width: frame.width,
          height: frame.height,
        }
      )
      return best
    }
  }

  exportDebugLog(
    "warn",
    "renderer.composite",
    "foreground layer came back empty — overlays may be missing",
    { opaquePct: Number(Math.max(0, bestScore).toFixed(2)) }
  )
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

/**
 * Rasterize one foreground element with its transform removed, then project it
 * ourselves onto its own quad.
 *
 * WebKit bakes a perspective transform flat inside foreignObject, so an overlay
 * that carries the media's tilt (inner lighting) comes back the wrong shape and
 * sits misaligned over the correctly-projected video. Capturing it untransformed
 * gives the raster nothing to flatten; the projection is then ours to do, with
 * the same maths the video goes through.
 */
/** Distinguishes snapshots when several layers share a stack tag (or none). */
let projectedSeq = 0

async function captureProjectedElement(
  capture: AnimationCapture,
  layer: ProjectedLayer,
  scale: number,
  width: number,
  height: number,
  /** Foreground nodes inside `el` — they composite above the video, not here. */
  excludeForeground: HTMLElement[] = []
): Promise<HTMLCanvasElement | null> {
  const { el, carrier, quad } = layer
  const seq = projectedSeq++
  const tag = `${seq}-${el.getAttribute("data-export-stack") ?? "untagged"}`

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

  let raster: HTMLCanvasElement | null = null
  try {
    raster = await captureForegroundLayer(capture)
  } finally {
    carrier.style.transform = prevTransform
    for (const restore of restoreHidden) restore()
    restoreVisibility()
  }
  if (!raster) return null
  getActiveExportDebug()?.addLayerSnapshot(`raster-${tag}`, raster)

  // Lift the placed box (plus the shadow margin) out as the quad texture.
  const boxW = quad.localW + pad * 2
  const boxH = quad.localH + pad * 2
  const cropW = Math.max(1, Math.round(boxW * scale))
  const cropH = Math.max(1, Math.round(boxH * scale))
  if (
    cropX < 0 ||
    cropY < 0 ||
    cropX + cropW > raster.width + 1 ||
    cropY + cropH > raster.height + 1
  ) {
    exportDebugLog(
      "warn",
      "renderer.composite",
      "layer texture is clipped by the capture canvas — it will warp in undersized",
      {
        tag: el.tagName,
        stack: el.getAttribute("data-export-stack"),
        crop: { x: cropX, y: cropY, w: cropW, h: cropH },
        raster: { w: raster.width, h: raster.height },
      }
    )
  }
  const local = document.createElement("canvas")
  local.width = cropW
  local.height = cropH
  const lctx = local.getContext("2d")
  if (!lctx) return null
  lctx.drawImage(raster, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

  getActiveExportDebug()?.addLayerSnapshot(`tex-${tag}`, local)

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const octx = out.getContext("2d")
  if (!octx) return null
  // The padded box maps through the same matrix — it is linear, so points
  // outside the border box project just as correctly as the corners.
  const projectUV: UvProjectorH = (u, v) => {
    const p = quad.projectH(u * boxW - pad, v * boxH - pad)
    return { x: p.x * scale, y: p.y * scale, w: p.w }
  }
  const subdivisions = chooseQuadSubdivision(projectUV)
  const warp = drawImageToQuadWarp(
    octx,
    local,
    local.width,
    local.height,
    projectUV,
    subdivisions
  )
  exportDebugLog("info", "renderer.composite", "projected layer", {
    tag: el.tagName,
    stack: el.getAttribute("data-export-stack"),
    warp,
    subdivisions,
    localW: quad.localW,
    localH: quad.localH,
    shadowPadPx: pad,
  })
  return out
}

/**
 * How far this element's shadows reach beyond its border box, in CSS px.
 *
 * Colour functions are stripped first so their commas don't break the
 * per-shadow split and their numbers aren't mistaken for lengths.
 */
function shadowExtentPx(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  let max = 0
  for (const source of [cs.boxShadow, cs.filter]) {
    if (!source || source === "none") continue
    const cleaned = source.replace(/(rgba?|hsla?|color)\([^)]*\)/g, " ")
    for (const part of cleaned.split(",")) {
      const nums = (part.match(/-?\d+(?:\.\d+)?(?=px)/g) ?? []).map(Number)
      if (nums.length === 0) continue
      const [dx = 0, dy = 0, blur = 0, spread = 0] = nums
      max = Math.max(
        max,
        Math.abs(dx) + Math.abs(dy) + Math.abs(blur) + Math.abs(spread)
      )
    }
  }
  return Math.ceil(max)
}

/**
 * Build the single foreground raster drawn over every composited frame.
 *
 * Perspective-carrying layers are projected individually (the raster would
 * flatten them); everything else comes from one flat capture. The projected ones
 * are painted first: they are locked to the media box and sit at the bottom of
 * the foreground (inner lighting is z-10, below text/overlays/annotations).
 */
async function buildForegroundLayer(
  capture: AnimationCapture,
  scale: number,
  width: number,
  height: number
): Promise<HTMLCanvasElement | null> {
  const all = queryForeground(capture.node)
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

  exportDebugLog("info", "renderer.composite", "foreground groups", {
    total: all.length,
    perspective: perspective.length,
    flat: flat.length,
  })
  getActiveExportDebug()?.setMeta("foregroundGroups", {
    total: all.length,
    perspective: perspective.length,
    flat: flat.length,
  })

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
    exportDebugLog(
      "warn",
      "renderer.composite",
      "no natural video size — cannot composite"
    )
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
    exportDebugLog(
      "warn",
      "renderer.composite",
      "no video geometry — cannot composite"
    )
    return null
  }

  exportDebugLog("info", "renderer.composite", "geometry measured", {
    hasQuad: !!quad,
    hasRegion: !!region,
    naturalW,
    naturalH,
    carrierTag: carrier?.tagName ?? null,
    carrierIsVideoParent: carrier === video.parentElement,
    carrierHasTransform: !!carrier,
    videoHasTransform:
      getComputedStyle(video).transform !== "none" &&
      !!getComputedStyle(video).transform,
    quad: quad
      ? { corners: quad.corners, localW: quad.localW, localH: quad.localH }
      : null,
    region,
  })

  const stackCounts = countExportStack(capture.node)
  const hasForeground = queryForeground(capture.node).length > 0
  exportDebugLog("info", "renderer.composite", "export stack", {
    ...stackCounts,
    enhance: mediaFx?.enhance ?? "off",
  })

  // Reference: the untouched scene as the browser itself composites it, before
  // any layer is hidden. The video usually won't rasterize here (that's the
  // whole reason for this pipeline), but the backdrop, shell and foreground do —
  // so this is the ground truth for *framing*, independent of our own maths.
  // Only when a debug session is listening: it costs a full extra capture.
  const dbgSession = getActiveExportDebug()
  if (dbgSession) {
    try {
      dbgSession.addLayerSnapshot("reference", await capture.captureFrame())
    } catch {
      // Diagnostic only — never fail an export over it.
    }
  }

  // Every element whose box the raster would flatten — the media shell (with its
  // plate, radius, border, frame chrome and shadow) and any tilted overlay. These
  // are kept out of the flat passes and projected individually below, so nothing
  // depends on WebKit getting perspective right.
  const projected = collectProjectedLayers(capture.node)
  exportDebugLog("info", "renderer.composite", "perspective audit", {
    projectedLayers: projected.map(({ el, quad: q }) => ({
      tag: el.tagName,
      stack: el.getAttribute("data-export-stack"),
      shadowPadPx: shadowExtentPx(el),
      localW: Math.round(q.localW),
      localH: Math.round(q.localH),
    })),
  })
  getActiveExportDebug()?.setMeta(
    "projectedLayers",
    projected.map(({ el }) => ({
      tag: el.tagName,
      stack: el.getAttribute("data-export-stack"),
    }))
  )

  // Pass 1 — underlay: backdrop only. Anything bent by perspective is excluded
  // and re-projected; without perspective the raster is faithful and stays put.
  const restoreUnderlay = applyExportStackVisibility(capture.node, "underlay", {
    alsoHide: projected.map(({ el }) => el),
  })
  if (capture.needsPaint) await waitForPaint()

  const templateStarted = performance.now()
  const template = await captureSceneTemplate(capture, "renderer.composite")
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
  const underlayProjected = projected.filter(
    ({ el }) => !foregroundEls.some((f) => f === el || f.contains(el))
  )
  const tctx = templateCopy.getContext("2d")
  for (const layer of underlayProjected) {
    const canvas = await captureProjectedElement(
      capture,
      layer,
      scale,
      templateCopy.width,
      templateCopy.height,
      foregroundEls
    )
    if (canvas && tctx) tctx.drawImage(canvas, 0, 0)
  }
  getActiveExportDebug()?.addLayerSnapshot("underlay", templateCopy)

  // Pass 2 — foreground: inner lighting, overlay textures, text, assets,
  // annotations and slots, built once and drawn over every composited frame.
  // This is what makes the stacking general: the editor decides what's above the
  // media via data-export-stack, not this renderer.
  let foregroundLayer: HTMLCanvasElement | null = null
  if (hasForeground) {
    foregroundLayer = await buildForegroundLayer(
      capture,
      scale,
      templateCopy.width,
      templateCopy.height
    )
    if (foregroundLayer) {
      getActiveExportDebug()?.addLayerSnapshot("foreground", foregroundLayer)
    }
  }

  const templateStats = sampleFrameStats(templateCopy)
  exportDebugLog("info", "renderer.composite", "scene template captured", {
    durationMs: Math.round(performance.now() - templateStarted),
    width: templateCopy.width,
    height: templateCopy.height,
    stats: templateStats,
  })
  getActiveExportDebug()?.setMeta("compositeTemplate", {
    width: templateCopy.width,
    height: templateCopy.height,
    stats: templateStats,
    region,
    quad: quad
      ? { corners: quad.corners, localW: quad.localW, localH: quad.localH }
      : null,
    shell: {
      tag: shell.tagName,
      localW: quad?.localW ?? null,
      localH: quad?.localH ?? null,
    },
    stack: {
      ...stackCounts,
      hasForegroundLayer: !!foregroundLayer,
      foregroundOpaquePct: foregroundLayer
        ? Number(opaquePct(foregroundLayer).toFixed(2))
        : 0,
    },
  })

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
  exportDebugLog(
    "info",
    "renderer.composite",
    useQuad ? "using projected-quad composite" : "using AABB region composite",
    {
      scale,
      localW,
      localH,
      hasPerspective: quad?.hasPerspective ?? false,
      subdivisions,
      affineErrorPx: projectUV
        ? Number(quadAffineError(projectUV, subdivisions).toFixed(3))
        : null,
    }
  )
  getActiveExportDebug()?.setMeta("compositeQuad", {
    hasPerspective: quad?.hasPerspective ?? false,
    subdivisions,
    corners: quad?.corners ?? null,
  })

  // Border-radius lives on the shell; pass a synthetic style source for local paint.
  const shellRadius = parseFloat(getComputedStyle(shell).borderRadius) || 0
  let warpUsed: "gl" | "grid" | null = null

  return async (i: number) => {
    const t0 = performance.now()
    const t = plan.timeForFrame(i)
    const frame = await decoded.getFrameAt(t)
    sctx.clearRect(0, 0, scratch.width, scratch.height)
    sctx.drawImage(templateCopy, 0, 0)

    let drewVideo = false
    let frameW = 0
    let frameH = 0
    if (frame) {
      const fw = Number((frame as { width?: unknown }).width) || naturalW
      const fh = Number((frame as { height?: unknown }).height) || naturalH
      frameW = fw
      frameH = fh
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
            warpUsed = drawImageToQuadWarp(
              sctx,
              local,
              local.width,
              local.height,
              projectUV,
              subdivisions
            )
            drewVideo = true
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
          drewVideo = true
        }
      }
    }

    // Everything the editor stacks above the media, back on top of the video.
    if (foregroundLayer) sctx.drawImage(foregroundLayer, 0, 0)

    // One fully composited frame, to compare against the layers that built it.
    if (i === 0) getActiveExportDebug()?.addLayerSnapshot("frame0", scratch)

    getActiveExportDebug()?.logFrameSample(
      "renderer.composite",
      i,
      plan.frameCount,
      scratch,
      {
        strategy: useQuad ? "composite-quad" : "composite-aabb",
        timeSec: t,
        drewVideo,
        warp: warpUsed,
        drewForeground: !!foregroundLayer,
        decodedFrameSize: { w: frameW, h: frameH },
        durationMs: Math.round(performance.now() - t0),
      }
    )
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
  const strategy =
    decoded && paintOverlay
      ? "raster-overlay-img"
      : decoded
        ? "raster-decoded-no-overlay"
        : "raster-dom-seek"
  const isWebKit = !supportsObjectViewBox()
  exportDebugLog("info", "renderer.raster", "using raster path", {
    strategy,
    hasDecoded: !!decoded,
    hasOverlay: !!paintOverlay,
    supportsObjectViewBox: supportsObjectViewBox(),
  })
  getActiveExportDebug()?.setMeta("rendererStrategy", strategy)

  // Background-only captures sit ~13% non-black; with video ~70%.
  const minNonBlack = 25

  return async (i: number) => {
    const t0 = performance.now()
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
    let attempts = 1
    try {
      out = await capture.captureFrame()
      if (isWebKit && drewDecoded) {
        // Nested images inside SVG foreignObject load async on WebKit — most
        // first paints miss the video (background-only). Retry until the video
        // area shows up or we exhaust attempts.
        for (let attempt = 0; attempt < 10; attempt++) {
          const stats = sampleFrameStats(out)
          if ((stats?.nonBlackPct ?? 0) >= minNonBlack) break
          await sleep(16 + attempt * 12)
          out = await capture.captureFrame()
          attempts++
        }
      }
    } catch (err) {
      exportDebugLog(
        "error",
        "renderer.raster",
        `captureFrame failed at ${i}`,
        {
          frameIndex: i,
          timeSec: t,
          error: err instanceof Error ? err.message : String(err),
        }
      )
      throw err
    }
    getActiveExportDebug()?.logFrameSample(
      "renderer.raster",
      i,
      plan.frameCount,
      out,
      {
        strategy,
        timeSec: t,
        drewDecoded,
        attempts,
        durationMs: Math.round(performance.now() - t0),
        videoReadyState: video.readyState,
        videoCurrentTime: video.currentTime,
      }
    )
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
  exportDebugLog("info", "renderer.portrait", "portrait depth-of-field", {
    overlays: count,
    applied: count > 0,
  })
  getActiveExportDebug()?.setMeta("portraitFx", { overlays: count })
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
 * video overlay flickers hard on Safari (debug logs: ~80% frames background-only).
 */
export async function createFrameRenderer({
  capture,
  video,
  decoded,
  tilted,
  plan,
  signal,
  mediaFx,
}: {
  capture: AnimationCapture
  video: HTMLVideoElement
  decoded: DecodedFrameSource | null
  tilted: boolean
  plan: FramePlan
  signal?: AbortSignal
  /** Media-pixel effects (enhance) re-applied to the decoded frame. */
  mediaFx?: VideoMediaFx | null
}): Promise<RenderFrame> {
  exportDebugLog("info", "renderer", "selecting strategy", {
    hasDecoded: !!decoded,
    tilted,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    frameCount: plan.frameCount,
    mediaFx: { enhance: mediaFx?.enhance ?? null },
  })
  if (decoded) {
    const composite = await createCompositeRenderer(
      capture,
      video,
      decoded,
      plan,
      mediaFx
    )
    if (composite) {
      exportDebugLog("info", "renderer", "selected composite strategy", {
        tilted,
      })
      getActiveExportDebug()?.setMeta("rendererStrategy", "composite")
      return withPortraitDepthOfField(composite, capture.node)
    }
    exportDebugLog(
      "warn",
      "renderer",
      "composite unavailable, falling back to raster"
    )
  }
  return withPortraitDepthOfField(
    createRasterRenderer(capture, video, decoded, plan, signal),
    capture.node
  )
}
