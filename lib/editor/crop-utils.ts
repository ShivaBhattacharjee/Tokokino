import type { CSSProperties } from "react"

import { getBrowserFrame, isBrowserFrame } from "@/lib/browser-frame"
import { DEVICE_MOCKUP_SPECS, getDeviceMockup } from "@/lib/mockups"

import type { CropRegion, DeviceFrame } from "./state-types"

/**
 * True when a stored crop actually removes something from the source.
 * Full-frame regions are treated as "no crop" so we skip the polyfill path.
 */
export function isActiveCropRegion(
  region: CropRegion | null | undefined
): region is CropRegion {
  if (!region) return false
  return (
    region.x > 0.05 ||
    region.y > 0.05 ||
    region.width < 99.95 ||
    region.height < 99.95
  )
}

/** Chromium ships `object-view-box`; Firefox/Safari still do not. */
export function supportsObjectViewBox(): boolean {
  try {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("object-view-box", "inset(0%)")
    )
  } catch {
    return false
  }
}

/** Native crop via CSS object-view-box (Chrome/Edge). */
export function objectViewBoxCropStyle(region: CropRegion): CSSProperties {
  const { x, y, width, height } = region
  return {
    objectViewBox: `inset(${y}% ${100 - x - width}% ${100 - y - height}% ${x}%)`,
  }
}

/**
 * Overflow + positioned-media stand-in for `object-view-box`.
 * Use only when `supportsObjectViewBox()` is false (Firefox/Safari).
 * Parent must be `overflow: hidden` and have a definite size.
 */
export function cropMediaObjectStyle(region: CropRegion): CSSProperties {
  const width = Math.max(region.width, 0.001)
  const height = Math.max(region.height, 0.001)
  return {
    position: "absolute",
    width: `${(100 / width) * 100}%`,
    height: `${(100 / height) * 100}%`,
    left: `${(-region.x / width) * 100}%`,
    top: `${(-region.y / height) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
  }
}

/**
 * Styles for the cropped media element: native object-view-box when supported,
 * otherwise the overflow polyfill styles.
 */
export function videoCropMediaStyle(
  region: CropRegion,
  nativeObjectViewBox: boolean
): CSSProperties {
  return nativeObjectViewBox
    ? objectViewBoxCropStyle(region)
    : cropMediaObjectStyle(region)
}

/** Pixel size of a percent crop against a natural media size. */
export function croppedNaturalSize(
  naturalW: number,
  naturalH: number,
  region: CropRegion
): { w: number; h: number } {
  return {
    w: naturalW * (region.width / 100),
    h: naturalH * (region.height / 100),
  }
}

/**
 * Object-position describes where `object-fit: cover` anchors the image.
 * - "center" (default for bare/mockup): excess is split equally on both sides
 * - "top": excess is pushed to the bottom (browser frames)
 */
export type CoverPosition = "center" | "top"

export type CropTarget = {
  aspect: number | null
  initialRegion: CropRegion | null
}

type CropTargetOptions = {
  frame: DeviceFrame
  objectFit?: "contain" | "cover" | "fill"
  stageElement?: HTMLElement | null
  imageElement?: HTMLImageElement | null
  fallbackAspect?: number | null
}

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

export function computeCoverCropRegionForAspect(
  naturalW: number,
  naturalH: number,
  targetAspect: number,
  position: CoverPosition = "center"
): CropRegion | null {
  if (!targetAspect || !Number.isFinite(targetAspect) || targetAspect <= 0) {
    return null
  }

  return computeCoverCropRegion(naturalW, naturalH, targetAspect, 1, position)
}

export function insetCropRegion(
  region: CropRegion,
  factor = 0.88,
  position: CoverPosition = "center"
): CropRegion {
  const safeFactor = Math.max(0.1, Math.min(1, factor))
  const width = region.width * safeFactor
  const height = region.height * safeFactor
  const x = region.x + (region.width - width) / 2
  const y =
    position === "top" && region.y === 0
      ? region.y
      : region.y + (region.height - height) / 2

  return { x, y, width, height }
}

export function cropCoverPositionForFrame(frame: DeviceFrame): CoverPosition {
  return isBrowserFrame(frame.id) ? "top" : "center"
}

export function cropAspectForFrameScreen(frame: DeviceFrame): number | null {
  if (frame.id === "none") return null

  const browserFrame = getBrowserFrame(frame.id)
  if (browserFrame) {
    return browserFrame.size.w / browserFrame.size.h
  }

  const spec = DEVICE_MOCKUP_SPECS[frame.id]
  if (!spec) return null

  const screenAspect = parseRatio(spec.screen.aspectRatio)
  if (!screenAspect) return null

  const device = getDeviceMockup(frame.id)
  const rotatesPortraitAsset =
    frame.orientation === "horizontal" &&
    device?.orientations.includes("portrait") === true &&
    screenAspect < 1

  return rotatesPortraitAsset ? 1 / screenAspect : screenAspect
}

export function computeCropTarget({
  frame,
  objectFit = "cover",
  stageElement,
  imageElement,
  fallbackAspect,
}: CropTargetOptions): CropTarget {
  const aspect =
    elementAspect(stageElement) ??
    cropAspectForFrameScreen(frame) ??
    validAspect(fallbackAspect)

  if (!aspect) return { aspect: null, initialRegion: null }

  const naturalW = imageElement?.naturalWidth ?? 0
  const naturalH = imageElement?.naturalHeight ?? 0
  const coverPosition = cropCoverPositionForFrame(frame)
  const coverRegion =
    objectFit === "cover"
      ? computeCoverCropRegionForAspect(
          naturalW,
          naturalH,
          aspect,
          coverPosition
        )
      : null
  const initialRegion =
    coverRegion && (coverRegion.width >= 99 || coverRegion.height >= 99)
      ? insetCropRegion(coverRegion, 0.88, coverPosition)
      : coverRegion

  return { aspect, initialRegion }
}

export function cropRegionMatchesAspect(
  region: CropRegion | null | undefined,
  naturalW: number,
  naturalH: number,
  targetAspect: number | null | undefined
) {
  if (!region || !naturalW || !naturalH || !targetAspect) return false
  const cropW = (region.width / 100) * naturalW
  const cropH = (region.height / 100) * naturalH
  if (!cropW || !cropH) return false
  return Math.abs(cropW / cropH - targetAspect) < 0.01
}

function elementAspect(element: HTMLElement | null | undefined) {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const width = rect.width || element.clientWidth
  const height = rect.height || element.clientHeight
  if (!width || !height) return null
  return width / height
}

function parseRatio(value: string) {
  const [w, h] = value.split("/").map((part) => Number(part.trim()))
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null
  }
  return w / h
}

function validAspect(value: number | null | undefined) {
  return value && Number.isFinite(value) && value > 0 ? value : null
}
