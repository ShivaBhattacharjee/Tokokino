/**
 * Canvas-2D fallback for the media grade.
 *
 * WebKit accepts an assignment to `ctx.filter` and then ignores it, so on Safari
 * the screenshot/video grade silently vanished from every exported frame that
 * paints decoded pixels by hand — which, on that engine, is every frame of a
 * video export (the layered and composite renderers both draw the frame
 * themselves and re-apply what CSS would have done).
 *
 * Every leg of the chain except `blur()` is a per-pixel function from the Filter
 * Effects spec, and they all compose into one affine colour matrix, so a graded
 * frame costs a single pass. Blur is the only leg that has to run on its own.
 */

type ColorMatrix = {
  /** Row-major 3×3 linear part (RGB in, RGB out). */
  m: [number, number, number, number, number, number, number, number, number]
  /** Per-channel offset, in 0..1 units. */
  o: [number, number, number]
  /** Alpha multiplier (only `opacity()` moves it). */
  a: number
}

type GradeOp =
  | { kind: "matrix"; matrix: ColorMatrix }
  | { kind: "blur"; px: number }

const IDENTITY: ColorMatrix = {
  m: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  o: [0, 0, 0],
  a: 1,
}

const LUMA = [0.2126, 0.7152, 0.0722] as const

const isIdentity = (c: ColorMatrix) =>
  c.a === 1 &&
  c.o[0] === 0 &&
  c.o[1] === 0 &&
  c.o[2] === 0 &&
  c.m[0] === 1 &&
  c.m[1] === 0 &&
  c.m[2] === 0 &&
  c.m[3] === 0 &&
  c.m[4] === 1 &&
  c.m[5] === 0 &&
  c.m[6] === 0 &&
  c.m[7] === 0 &&
  c.m[8] === 1

/** `b` applied after `a`. */
function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const m = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3) * 3
    const col = i % 3
    return (
      b.m[row] * a.m[col] +
      b.m[row + 1] * a.m[3 + col] +
      b.m[row + 2] * a.m[6 + col]
    )
  }) as ColorMatrix["m"]
  const o = Array.from({ length: 3 }, (_, row) => {
    const r = row * 3
    return (
      b.m[r] * a.o[0] + b.m[r + 1] * a.o[1] + b.m[r + 2] * a.o[2] + b.o[row]
    )
  }) as ColorMatrix["o"]
  return { m, o, a: a.a * b.a }
}

/** Per-channel `c → c·scale + offset`. */
const linear = (scale: number, offset: number): ColorMatrix => ({
  m: [scale, 0, 0, 0, scale, 0, 0, 0, scale],
  o: [offset, offset, offset],
  a: 1,
})

/** Blend `matrix` toward identity, the shape every "amount" filter takes. */
const lerpToIdentity = (
  full: ColorMatrix["m"],
  amount: number
): ColorMatrix => {
  const k = 1 - amount
  return {
    m: [
      full[0] * amount + k,
      full[1] * amount,
      full[2] * amount,
      full[3] * amount,
      full[4] * amount + k,
      full[5] * amount,
      full[6] * amount,
      full[7] * amount,
      full[8] * amount + k,
    ],
    o: [0, 0, 0],
    a: 1,
  }
}

function saturateMatrix(s: number): ColorMatrix {
  const [lr, lg, lb] = LUMA
  return {
    m: [
      lr + (1 - lr) * s,
      lg - lg * s,
      lb - lb * s,
      lr - lr * s,
      lg + (1 - lg) * s,
      lb - lb * s,
      lr - lr * s,
      lg - lg * s,
      lb + (1 - lb) * s,
    ],
    o: [0, 0, 0],
    a: 1,
  }
}

function hueRotateMatrix(deg: number): ColorMatrix {
  const rad = (deg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return {
    m: [
      0.213 + c * 0.787 - s * 0.213,
      0.715 - c * 0.715 - s * 0.715,
      0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143,
      0.715 + c * 0.285 + s * 0.14,
      0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787,
      0.715 - c * 0.715 + s * 0.715,
      0.072 + c * 0.928 + s * 0.072,
    ],
    o: [0, 0, 0],
    a: 1,
  }
}

const GRAYSCALE_FULL: ColorMatrix["m"] = [
  LUMA[0],
  LUMA[1],
  LUMA[2],
  LUMA[0],
  LUMA[1],
  LUMA[2],
  LUMA[0],
  LUMA[1],
  LUMA[2],
]

const SEPIA_FULL: ColorMatrix["m"] = [
  0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131,
]

/** `120%` → 1.2, `1.2` → 1.2, `30deg` → 30, `0.5px` → 0.5. */
function filterAmount(raw: string): number {
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.trim().endsWith("%") ? value / 100 : value
}

/**
 * Split a filter chain into an ordered op list, collapsing every run of colour
 * functions into one matrix. Returns null when a leg isn't recognised, so the
 * caller can leave the frame alone rather than paint a half-applied grade.
 */
export function parseGradeChain(chain: string): GradeOp[] | null {
  const ops: GradeOp[] = []
  let pending = IDENTITY
  const flush = () => {
    if (isIdentity(pending)) return
    ops.push({ kind: "matrix", matrix: pending })
    pending = IDENTITY
  }

  const legs = chain.match(/[a-z-]+\([^)]*\)/gi)
  if (!legs) return chain.trim() === "" || chain.trim() === "none" ? [] : null

  for (const leg of legs) {
    const open = leg.indexOf("(")
    const name = leg.slice(0, open).trim().toLowerCase()
    const arg = leg.slice(open + 1, -1).trim()
    const amount = filterAmount(arg)
    switch (name) {
      case "blur":
        flush()
        if (amount > 0) ops.push({ kind: "blur", px: amount })
        break
      case "brightness":
        pending = compose(pending, linear(amount, 0))
        break
      case "contrast":
        pending = compose(pending, linear(amount, 0.5 - 0.5 * amount))
        break
      case "invert":
        pending = compose(pending, linear(1 - 2 * amount, amount))
        break
      case "opacity":
        pending = compose(pending, { ...IDENTITY, a: amount })
        break
      case "grayscale":
        pending = compose(pending, lerpToIdentity(GRAYSCALE_FULL, amount))
        break
      case "sepia":
        pending = compose(pending, lerpToIdentity(SEPIA_FULL, amount))
        break
      case "saturate":
        pending = compose(pending, saturateMatrix(amount))
        break
      case "hue-rotate":
        pending = compose(pending, hueRotateMatrix(amount))
        break
      default:
        return null
    }
  }
  flush()
  return ops
}

function applyMatrix(data: Uint8ClampedArray, c: ColorMatrix) {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = c.m
  const or = c.o[0] * 255
  const og = c.o[1] * 255
  const ob = c.o[2] * 255
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    data[i] = m0 * r + m1 * g + m2 * b + or
    data[i + 1] = m3 * r + m4 * g + m5 * b + og
    data[i + 2] = m6 * r + m7 * g + m8 * b + ob
    if (c.a !== 1) data[i + 3] = data[i + 3] * c.a
  }
}

/**
 * One separable box-blur pass, edge-clamped, reading `src` into `dst` (they must
 * differ — a sliding window can't blur in place). Three passes approximate a
 * gaussian closely enough for a grade's blur leg.
 */
function boxBlurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  lines: number,
  lineStride: number,
  count: number,
  stride: number,
  radius: number
) {
  const norm = 1 / (radius * 2 + 1)
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const i = k < 0 ? 0 : k >= count ? count - 1 : k
        sum += src[base + i * stride + ch]
      }
      for (let x = 0; x < count; x++) {
        dst[base + x * stride + ch] = sum * norm
        const addI = x + radius + 1
        const subI = x - radius
        const a = addI >= count ? count - 1 : addI
        const s = subI < 0 ? 0 : subI
        sum += src[base + a * stride + ch] - src[base + s * stride + ch]
      }
    }
  }
}

function applyBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  px: number
) {
  const radius = Math.round(px)
  if (radius < 1) return
  // Six passes total (3 gaussian approximations × horizontal + vertical), each
  // reading one buffer into the other, so the result lands back in `data`.
  const scratch = new Uint8ClampedArray(data.length)
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(data, scratch, height, width * 4, width, 4, radius)
    boxBlurPass(scratch, data, width, 4, height, width * 4, radius)
  }
}

let canvasFilterWorks: boolean | null = null

/**
 * Whether `ctx.filter` actually paints. WebKit accepts the assignment and
 * ignores it, so a chain set there silently no-ops. Probed once by drawing a
 * white pixel through `brightness(0)` and checking it came out black.
 */
export function supportsCanvas2dFilter(): boolean {
  if (canvasFilterWorks !== null) return canvasFilterWorks
  try {
    const c = document.createElement("canvas")
    c.width = 1
    c.height = 1
    const cx = c.getContext("2d", { willReadFrequently: true })
    if (!cx) return (canvasFilterWorks = false)
    cx.fillStyle = "#ffffff"
    cx.fillRect(0, 0, 1, 1)
    cx.filter = "brightness(0)"
    cx.fillStyle = "#ffffff"
    cx.fillRect(0, 0, 1, 1)
    cx.filter = "none"
    canvasFilterWorks = cx.getImageData(0, 0, 1, 1).data[0] < 20
  } catch {
    canvasFilterWorks = false
  }
  return canvasFilterWorks
}

/**
 * Apply `chain` to `canvas`'s pixels in place. No-op when the chain is empty or
 * has a leg this doesn't model — better an ungraded frame than a wrong one.
 *
 * The alpha channel is put back exactly as it was found. The native path sets
 * `ctx.filter` on a clipped draw, so its filter lands *inside* the rounded media
 * box; this one runs on the whole buffer after that clip has been popped, and
 * `blur()` spreads alpha — which would soften the rounded corners and bleed the
 * media into the transparent padding. Restoring alpha is the same mask the clip
 * already left behind, so it reproduces "filter, then clip" without a second
 * composite. Nothing is lost: `opacity()` is the only leg that means to move
 * alpha, and it cannot appear here (only `BackdropEffects` carries an opacity,
 * and the backdrop does not come through this path).
 *
 * Reads the buffer back, which the draw-only surfaces this runs on otherwise
 * avoid; that cost only lands on engines whose `ctx.filter` doesn't work, and
 * only when the user actually graded the media.
 */
export function applyGradeToCanvas(
  canvas: HTMLCanvasElement,
  chain: string
): void {
  const ops = parseGradeChain(chain)
  if (!ops || ops.length === 0) return
  // Plain `getContext("2d")` on purpose: the buffer already has a context, and
  // attributes passed after the first call are ignored, so asking for
  // `willReadFrequently` here would only misdescribe what we get back.
  const ctx = canvas.getContext("2d")
  if (!ctx || canvas.width === 0 || canvas.height === 0) return

  let image: ImageData
  try {
    image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return
  }
  const { data } = image
  const alpha = new Uint8ClampedArray(data.length / 4)
  for (let i = 0, a = 0; i < data.length; i += 4, a++) alpha[a] = data[i + 3]

  for (const op of ops) {
    if (op.kind === "matrix") applyMatrix(data, op.matrix)
    else applyBlur(data, canvas.width, canvas.height, op.px)
  }

  for (let i = 0, a = 0; i < data.length; i += 4, a++) data[i + 3] = alpha[a]
  ctx.putImageData(image, 0, 0)
}
