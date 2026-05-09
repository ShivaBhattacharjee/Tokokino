import { getBrowserFrame, isBrowserFrame } from "@/lib/browser-frame"
import { DEVICE_MOCKUP_SPECS, getDeviceMockup } from "@/lib/mockups"
import type { AspectState, DeviceFrame } from "./state-types"

type RatioDirection = "portrait" | "square" | "landscape"

export type FrameAspectCompatibilityWarning = {
  title: string
  description: string
}

const MIN_FIT_COVERAGE = 0.42
const PORTRAIT_RATIO_MAX = 0.75
const LANDSCAPE_RATIO_MIN = 1.33

export function getFrameAspectCompatibilityWarning({
  aspect,
  frame,
  aspectName,
}: {
  aspect: AspectState
  frame: DeviceFrame
  aspectName?: string
}): FrameAspectCompatibilityWarning | null {
  const aspectRatio = aspectRatioFromSize(aspect.w, aspect.h)
  const frameInfo = getFrameRatioInfo(frame)

  if (!aspectRatio || !frameInfo) return null

  const fitCoverage = Math.min(
    aspectRatio / frameInfo.ratio,
    frameInfo.ratio / aspectRatio
  )
  if (fitCoverage >= MIN_FIT_COVERAGE) return null

  const aspectLabel = aspectName ?? formatAspectLabel(aspect)
  const aspectDirection = ratioDirection(aspectRatio)
  const frameDirection = ratioDirection(frameInfo.ratio)

  if (frameDirection === "landscape" && aspectDirection === "portrait") {
    return {
      title: `${frameInfo.name} may not fit this aspect`,
      description: `${frameInfo.name} is a landscape frame, but ${aspectLabel} is portrait. It will render small with extra empty space; use a landscape aspect or switch to a phone/tablet frame.`,
    }
  }

  if (frameDirection === "portrait" && aspectDirection === "landscape") {
    return {
      title: `${frameInfo.name} may not fit this aspect`,
      description: `${frameInfo.name} is a portrait frame, but ${aspectLabel} is landscape. It will render small with extra empty space; use a portrait aspect or switch to a browser/desktop frame.`,
    }
  }

  return {
    title: `${frameInfo.name} may look cramped`,
    description: `${aspectLabel} is far from the ${frameInfo.name} frame shape. The frame will fit, but it may look tiny or leave awkward space.`,
  }
}

function getFrameRatioInfo(frame: DeviceFrame) {
  if (frame.id === "none") return null

  if (isBrowserFrame(frame.id)) {
    const browserFrame = getBrowserFrame(frame.id)
    const ratio = browserFrame
      ? parseAspectRatio(browserFrame.aspectRatio)
      : null
    return ratio && browserFrame
      ? { name: `${browserFrame.name} browser`, ratio }
      : null
  }

  const mockup = getDeviceMockup(frame.id)
  const spec = DEVICE_MOCKUP_SPECS[frame.id]
  const baseRatio = spec ? parseAspectRatio(spec.aspectRatio) : null
  if (!mockup || !baseRatio) return null

  const canRotate = mockup.orientations.includes("portrait")
  const ratio =
    canRotate && frame.orientation === "horizontal" ? 1 / baseRatio : baseRatio

  return { name: mockup.name, ratio }
}

function aspectRatioFromSize(width: number, height: number) {
  if (!width || !height) return null
  return width / height
}

function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio
    .split("/")
    .map((part) => Number(part.trim()))

  if (!width || !height) return null
  return width / height
}

function ratioDirection(ratio: number): RatioDirection {
  if (ratio < PORTRAIT_RATIO_MAX) return "portrait"
  if (ratio > LANDSCAPE_RATIO_MIN) return "landscape"
  return "square"
}

function formatAspectLabel(aspect: AspectState) {
  if (!aspect.w || !aspect.h) return "Auto"
  return `${aspect.w}x${aspect.h}`
}
