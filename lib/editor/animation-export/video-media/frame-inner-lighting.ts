/**
 * Inner-lighting painting for the frame renderer.
 *
 * Safari can mis-rasterize the inner-lighting CSS gradient through the SVG
 * foreground pass, so on WebKit we paint the same two-gradient treatment
 * directly onto a 2D canvas and project it through the layer's own quad.
 * Extracted from frame-renderer.ts.
 */

import { hexToRgb } from "../../color-utils"
import type { BackdropLighting, EnhancePreset } from "../../state-types"
import {
  chooseQuadSubdivision,
  drawImageToQuadWarp,
  projectionFor,
  type UvProjectorH,
} from "./frame-geometry"

/**
 * Effects that apply to the video's own pixels, so they cannot come from the
 * foreground pass — we draw the decoded frame ourselves and must re-apply them.
 * Everything that merely sits *above* the media (lighting, overlays, text,
 * annotations) is captured by the foreground pass instead — see export-stack.
 */
export type VideoMediaFx = {
  enhance?: EnhancePreset | null
  /**
   * Inner lighting is painted directly onto the decoded frame instead of being
   * rasterized from CSS in Safari's SVG foreignObject implementation.
   */
  innerLighting?: BackdropLighting | null
}

function lightingPoint(direction: string) {
  if (direction === "center") return { x: 50, y: 50 }
  const match = direction.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/)
  const row = Number(match?.[1])
  const col = Number(match?.[2])
  if (!Number.isFinite(row) || !Number.isFinite(col)) return { x: 50, y: 50 }
  return {
    x: Math.max(-4, Math.min(8, col)) * 25,
    y: Math.max(-4, Math.min(8, row)) * 25,
  }
}

function rgba(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color || "#ffffff")
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

/** Paint the same two-gradient treatment as `lightingOverlayCss` in canvas. */
export function paintInnerLighting(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lighting: BackdropLighting | null | undefined
) {
  if (!lighting || lighting.intensity <= 0 || !width || !height) return
  const intensity = Math.max(0, Math.min(100, lighting.intensity)) / 100
  const opacity = 0.15 + intensity * 0.85
  const { x, y } = lightingPoint(lighting.direction)
  const cx = (x / 100) * width
  const cy = (y / 100) * height
  const radius = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(width - cx, height - cy),
    Math.hypot(cx, height - cy)
  )

  ctx.save()
  ctx.globalAlpha = opacity
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  radial.addColorStop(0, rgba(lighting.color, 0.56))
  radial.addColorStop(0.22, rgba(lighting.color, 0.32))
  radial.addColorStop(0.58, rgba(lighting.color, 0))
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, width, height)

  const dx = x - 50
  const dy = y - 50
  const startX = dx < -6 ? 0 : dx > 6 ? width : width / 2
  const startY = dy < -6 ? 0 : dy > 6 ? height : height / 2
  const endX = startX === 0 ? width : startX === width ? 0 : width / 2
  const endY = startY === 0 ? height : startY === height ? 0 : height / 2
  const linear = ctx.createLinearGradient(startX, startY, endX, endY)
  linear.addColorStop(0, rgba(lighting.color, 0.22))
  linear.addColorStop(0.62, rgba(lighting.color, 0))
  ctx.fillStyle = linear
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/**
 * Build inner lighting from the overlay's actual DOM bounds, then project that
 * texture through its own quad. The light is not necessarily the same size as
 * the video's object-fit box — applying it to the video buffer creates false
 * letterbox bands.
 */
export function buildNativeInnerLightingLayer(
  root: HTMLElement,
  layers: HTMLElement[],
  lighting: BackdropLighting,
  scale: number,
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (layers.length === 0) return null
  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const outCtx = out.getContext("2d")
  if (!outCtx) return null

  let painted = false
  for (const el of layers) {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const projected = projectionFor(root, el)
    // drawImageToQuadWarp maps the texture across the quad's *local* box, so a
    // projected layer's texture must be built in local (untransformed) pixels —
    // `rect` is the perspective-bent AABB and would paint the lighting at the
    // wrong aspect. Non-projected layers keep their on-screen rect.
    const texW = projected ? projected.quad.localW : rect.width
    const texH = projected ? projected.quad.localH : rect.height
    const texture = document.createElement("canvas")
    texture.width = Math.max(1, Math.round(texW))
    texture.height = Math.max(1, Math.round(texH))
    const textureCtx = texture.getContext("2d")
    if (!textureCtx) continue
    const radius = Math.max(
      0,
      parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    )
    if (radius > 0 && typeof textureCtx.roundRect === "function") {
      textureCtx.beginPath()
      textureCtx.roundRect(0, 0, texture.width, texture.height, radius)
      textureCtx.clip()
    }
    paintInnerLighting(textureCtx, texture.width, texture.height, lighting)

    if (projected) {
      const { quad } = projected
      const projectUV: UvProjectorH = (u, v) => {
        const point = quad.projectH(u * quad.localW, v * quad.localH)
        return { x: point.x * scale, y: point.y * scale, w: point.w }
      }
      drawImageToQuadWarp(
        outCtx,
        texture,
        texture.width,
        texture.height,
        projectUV,
        chooseQuadSubdivision(projectUV)
      )
    } else {
      const rootRect = root.getBoundingClientRect()
      outCtx.drawImage(
        texture,
        (rect.left - rootRect.left) * scale,
        (rect.top - rootRect.top) * scale,
        rect.width * scale,
        rect.height * scale
      )
    }
    painted = true
  }
  return painted ? out : null
}
