import type { CropRegion } from "./state-types"

/**
 * Object-position describes where `object-fit: cover` anchors the image.
 * - "center" (default for bare/mockup): excess is split equally on both sides
 * - "top": excess is pushed to the bottom (browser frames)
 */
export type CoverPosition = "center" | "top"

/**
 * Compute the crop region (in %) that `object-fit: cover` would display
 * for an image with `naturalW × naturalH` inside a container of
 * `containerW × containerH`.
 *
 * @param position – Where the image is anchored within the container.
 *   "center" splits excess equally; "top" aligns the image to the top edge.
 *
 * Returns `null` when the aspect ratios already match (no cropping needed)
 * or when any dimension is zero/invalid.
 */
export function computeCoverCropRegion(
  naturalW: number,
  naturalH: number,
  containerW: number,
  containerH: number,
  position: CoverPosition = "center"
): CropRegion | null {
  if (!naturalW || !naturalH || !containerW || !containerH) return null
  const imageAspect = naturalW / naturalH
  const containerAspect = containerW / containerH

  // Aspects match closely enough — no visible cropping
  if (Math.abs(imageAspect - containerAspect) < 0.01) return null

  if (imageAspect > containerAspect) {
    // Image is wider than container → sides are cropped
    const visibleWidthFraction = containerAspect / imageAspect
    const widthPct = visibleWidthFraction * 100
    // Horizontal position: "top" only affects vertical alignment
    const xPct = (100 - widthPct) / 2
    return { x: xPct, y: 0, width: widthPct, height: 100 }
  } else {
    // Image is taller than container → top/bottom are cropped
    const visibleHeightFraction = imageAspect / containerAspect
    const heightPct = visibleHeightFraction * 100
    const yPct =
      position === "top"
        ? 0 // anchor to top — visible region starts at top
        : (100 - heightPct) / 2 // center — split excess equally
    return { x: 0, y: yPct, width: 100, height: heightPct }
  }
}
