/**
 * Projection & quad-warp geometry for the frame renderer.
 *
 * WebKit bakes a CSS 3D transform flat inside an SVG foreignObject (no
 * perspective divide), so any tilted box comes back the wrong shape. These
 * helpers re-derive a box's true projected quad from its CSS matrix and warp a
 * texture onto it — the maths the composite renderer applies by hand. Extracted
 * from frame-renderer.ts to keep that module focused on compositing.
 */

import { drawImageToQuadGL, type QuadCornerH } from "./warp-gl"

export type Point = { x: number; y: number }

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
export function resolveTransformCarrier(
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
 * The corner radius (in `localW`-box px) that clips the video's box.
 *
 * The rounding lives on whichever ancestor actually clips the media — for a
 * device frame the square-cornered outer shell has none and the rounded screen
 * glass carries it a couple levels down. Walk from the video up to the shell,
 * take the first rounded ancestor and rescale its authored radius from that
 * element's own layout width to the projected box, so the rounded corners land
 * exactly where the bezel expects them.
 */
export function resolveVideoClipRadius(
  video: HTMLElement,
  shell: HTMLElement,
  localW: number
): number {
  let node: HTMLElement | null = video
  while (node) {
    const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
    const w = node.offsetWidth
    if (r > 0 && w > 0) return r * (localW / w)
    if (node === shell) break
    node = node.parentElement
  }
  return 0
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
export const IDENTITY_TRANSFORM = "matrix(1, 0, 0, 1, 0, 0)"

/** A planar box projected into capture-root CSS px, perspective included. */
export type QuadProjection = {
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
export function projectElementQuad(
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
export type ProjectedLayer = {
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
export function projectionFor(
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
export function collectProjectedLayers(root: HTMLElement): ProjectedLayer[] {
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
export function drawImageToQuadWarp(
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
