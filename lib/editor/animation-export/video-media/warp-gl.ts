/**
 * Perspective-correct quad warp on the GPU.
 *
 * The 2D fallback approximates the perspective divide with a grid of affine
 * cells, and both ways of stitching those cells are visibly wrong:
 *
 *   - cells drawn edge-to-edge antialias their clip boundary to ~50% alpha, and
 *     two touching 50% edges over transparency composite to 75% — a dark lattice
 *   - overlapping the cells to cover the gap composites translucent layers twice
 *     (2a − a² ≠ a) — a bright lattice
 *
 * There is no inflate that satisfies both, because Canvas2D cannot rasterize a
 * shared edge watertight. A GL rasterizer can: the quad is two triangles sharing
 * an exact edge, drawn once, with no interior seams to show.
 *
 * The perspective itself is exact rather than approximated. Each corner's
 * homogeneous w is fed to `gl_Position.w`, so the rasterizer's own
 * perspective-correct interpolation reproduces the CSS divide — the same thing
 * the subdivision was spending 24×24 cells to approximate.
 */

/** A destination corner: already-divided position plus its homogeneous w. */
export type QuadCornerH = { x: number; y: number; w: number }

const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute float a_q;
uniform vec2 u_res;
varying vec2 v_uv;
void main() {
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  // Scaling xy by q with w=q leaves x/w,y/w at the projected point, while
  // giving the rasterizer the w it needs to interpolate v_uv correctly.
  gl_Position = vec4(clip.x * a_q, -clip.y * a_q, 0.0, a_q);
  v_uv = a_uv;
}
`

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() {
  gl_FragColor = texture2D(u_tex, v_uv);
}
`

type GLWarper = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram
  buffer: WebGLBuffer
  texture: WebGLTexture
  loc: {
    pos: number
    uv: number
    q: number
    res: WebGLUniformLocation | null
    tex: WebGLUniformLocation | null
  }
}

/**
 * One context for the whole export: browsers cap live WebGL contexts (~16) and
 * silently kill the oldest, so a per-call context would break long exports.
 */
let warper: GLWarper | null = null
let unavailable = false

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createWarper(): GLWarper | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  const attrs: WebGLContextAttributes = {
    alpha: true,
    // MSAA on the quad's outer edge; the interior shared edge is watertight
    // regardless, which is the reason for coming to GL at all.
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  }
  const gl = (canvas.getContext("webgl", attrs) ??
    canvas.getContext(
      "experimental-webgl",
      attrs
    )) as WebGLRenderingContext | null
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null

  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  if (!buffer || !texture) return null

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault()
    warper = null
  })

  return {
    canvas,
    gl,
    program,
    buffer,
    texture,
    loc: {
      pos: gl.getAttribLocation(program, "a_pos"),
      uv: gl.getAttribLocation(program, "a_uv"),
      q: gl.getAttribLocation(program, "a_q"),
      res: gl.getUniformLocation(program, "u_res"),
      tex: gl.getUniformLocation(program, "u_tex"),
    },
  }
}

function getWarper(): GLWarper | null {
  if (unavailable) return null
  if (warper) return warper
  warper = createWarper()
  if (!warper) unavailable = true
  return warper
}

/** Test seam: reset the module singleton. */
export function resetQuadWarperForTest() {
  warper = null
  unavailable = false
}

/**
 * Warp `image` onto the quad `corners` (TL, TR, BR, BL, in `ctx` pixels) and
 * composite the result into `ctx`. Returns false when GL can't do it and the
 * caller should fall back to the subdivided 2D path.
 */
export function drawImageToQuadGL(
  ctx: CanvasRenderingContext2D,
  image: TexImageSource,
  srcW: number,
  srcH: number,
  corners: [QuadCornerH, QuadCornerH, QuadCornerH, QuadCornerH]
): boolean {
  // A non-positive w is a corner at or behind the eye plane; the divide has no
  // finite image and GL would rasterize garbage.
  if (
    corners.some(
      (c) => !(c.w > 1e-6) || !Number.isFinite(c.x) || !Number.isFinite(c.y)
    )
  ) {
    return false
  }

  const w = ctx.canvas.width
  const h = ctx.canvas.height
  if (!w || !h) return false

  const warp = getWarper()
  if (!warp) return false
  const { gl, program, buffer, texture, loc } = warp

  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  if (srcW > maxTex || srcH > maxTex) return false
  const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number
  if (w > maxRb || h > maxRb) return false

  if (warp.canvas.width !== w || warp.canvas.height !== h) {
    warp.canvas.width = w
    warp.canvas.height = h
  }

  gl.viewport(0, 0, w, h)
  gl.disable(gl.BLEND)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)

  gl.bindTexture(gl.TEXTURE_2D, texture)
  // NOT flipped: texImage2D already puts the image's top row at t=0, and our uv
  // comes from top-down CSS layout space, so t and v already agree. UNPACK_FLIP_Y
  // is for the y-up uv convention and would upload the video upside down. (The
  // shader's -clip.y is unrelated — that flips y-down px into y-up NDC.)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  // Premultiplied on upload + a premultiplied drawing buffer means the sampled
  // texel can go straight out, and drawImage into the 2D canvas composites right.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  } catch {
    return false
  }
  if (gl.getError() !== gl.NO_ERROR) return false

  const [tl, tr, br, bl] = corners
  // pos.xy, uv.xy, q — two triangles sharing the TL→BR diagonal.
  const v = (c: QuadCornerH, u: number, t: number) => [c.x, c.y, u, t, c.w]
  const data = new Float32Array([
    ...v(tl, 0, 0),
    ...v(tr, 1, 0),
    ...v(br, 1, 1),
    ...v(tl, 0, 0),
    ...v(br, 1, 1),
    ...v(bl, 0, 1),
  ])

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
  const stride = 5 * 4
  gl.enableVertexAttribArray(loc.pos)
  gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(loc.uv)
  gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 2 * 4)
  gl.enableVertexAttribArray(loc.q)
  gl.vertexAttribPointer(loc.q, 1, gl.FLOAT, false, stride, 4 * 4)

  if (loc.res) gl.uniform2f(loc.res, w, h)
  if (loc.tex) gl.uniform1i(loc.tex, 0)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
  if (gl.getError() !== gl.NO_ERROR) return false

  ctx.drawImage(warp.canvas, 0, 0)
  return true
}
