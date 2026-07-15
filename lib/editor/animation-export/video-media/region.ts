/**
 * Geometry for compositing decoded frames onto a once-rasterized styled scene:
 * where the clone's `<video>` visibly renders, and which sub-rect of the decoded
 * frame maps there.
 */

export type VideoRegion = {
  /** Destination rect on the styled scene, in the scene root's CSS-px space. */
  destX: number
  destY: number
  destW: number
  destH: number
  /** Source rect as fractions (0–1) of the decoded frame's own dimensions. */
  srcXFrac: number
  srcYFrac: number
  srcWFrac: number
  srcHFrac: number
  /** CSS-px width of the scene root, to scale dest into output pixels. */
  rootW: number
  /**
   * Rounded box of the overflow-clip ancestor (scene CSS-px + corner radii) so
   * the composite can reproduce the shell's border-radius; null when square.
   */
  clip: { x: number; y: number; w: number; h: number; radii: number[] } | null
}

/** Resolve one object-position component against the box − content slack. */
function resolvePositionComponent(component: string, slack: number): number {
  const value = parseFloat(component)
  if (!Number.isFinite(value)) return slack / 2
  return component.trim().endsWith("%") ? (value / 100) * slack : value
}

/**
 * Measure where the clone's `<video>` visibly renders inside the styled scene,
 * and which sub-rect of the decoded frame maps there. The content rect is
 * derived from object-fit/-position (fill/contain/cover are all linear maps of
 * the frame into a rect), then intersected with the `<video>` box and its
 * nearest overflow-clip ancestor (crop polyfill container or video shell), so
 * crop, letterboxing and cover-cropping are all reflected. Invalid for a
 * 3D-tilted/rotated video (bounding rects stop being the rendered quad) —
 * callers gate on tilt. Returns null when it can't be composited this way.
 */
export function measureVideoRegion(
  root: HTMLElement,
  video: HTMLVideoElement
): VideoRegion | null {
  const nw = video.videoWidth
  const nh = video.videoHeight
  if (!nw || !nh) return null
  const videoStyle = getComputedStyle(video)
  const fit = videoStyle.objectFit
  if (fit !== "fill" && fit !== "contain" && fit !== "cover") return null

  const rootRect = root.getBoundingClientRect()
  const videoRect = video.getBoundingClientRect()
  if (!rootRect.width || !videoRect.width || !videoRect.height) return null

  // Content rect: where the frame's pixels actually land inside the box.
  let contentW = videoRect.width
  let contentH = videoRect.height
  if (fit !== "fill") {
    const s =
      fit === "contain"
        ? Math.min(videoRect.width / nw, videoRect.height / nh)
        : Math.max(videoRect.width / nw, videoRect.height / nh)
    contentW = nw * s
    contentH = nh * s
  }
  const position = videoStyle.objectPosition.split(" ")
  const contentLeft =
    videoRect.left +
    resolvePositionComponent(position[0] ?? "50%", videoRect.width - contentW)
  const contentTop =
    videoRect.top +
    resolvePositionComponent(position[1] ?? "50%", videoRect.height - contentH)

  // Nearest overflow-clip ancestor within the scene bounds the visible region.
  let clipEl: HTMLElement | null = video.parentElement
  while (clipEl && clipEl !== root) {
    const overflow = getComputedStyle(clipEl).overflowX
    if (overflow === "hidden" || overflow === "clip") break
    clipEl = clipEl.parentElement
  }
  const clipRect = (clipEl ?? video).getBoundingClientRect()

  const left = Math.max(videoRect.left, clipRect.left, contentLeft)
  const top = Math.max(videoRect.top, clipRect.top, contentTop)
  const right = Math.min(
    videoRect.right,
    clipRect.right,
    contentLeft + contentW
  )
  const bottom = Math.min(
    videoRect.bottom,
    clipRect.bottom,
    contentTop + contentH
  )
  const visW = right - left
  const visH = bottom - top
  if (visW <= 0 || visH <= 0) return null

  let clip: VideoRegion["clip"] = null
  if (clipEl) {
    const clipStyle = getComputedStyle(clipEl)
    const radii = [
      clipStyle.borderTopLeftRadius,
      clipStyle.borderTopRightRadius,
      clipStyle.borderBottomRightRadius,
      clipStyle.borderBottomLeftRadius,
    ].map((r) => Math.max(0, parseFloat(r) || 0))
    if (radii.some((r) => r > 0)) {
      clip = {
        x: clipRect.left - rootRect.left,
        y: clipRect.top - rootRect.top,
        w: clipRect.width,
        h: clipRect.height,
        radii,
      }
    }
  }

  return {
    destX: left - rootRect.left,
    destY: top - rootRect.top,
    destW: visW,
    destH: visH,
    srcXFrac: (left - contentLeft) / contentW,
    srcYFrac: (top - contentTop) / contentH,
    srcWFrac: visW / contentW,
    srcHFrac: visH / contentH,
    rootW: rootRect.width,
    clip,
  }
}
