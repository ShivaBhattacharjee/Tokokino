import {
  RiBubbleChartLine,
  RiCloudLine,
  RiContrastLine,
  RiDropLine,
  RiEqualizerLine,
  RiFireLine,
  RiFlashlightLine,
  RiFocus2Line,
  RiGradienterLine,
  RiGridLine,
  RiHazeLine,
  RiImageLine,
  RiMacLine,
  RiMoonClearLine,
  RiOilLine,
  RiRhythmLine,
  RiSquareLine,
  RiSunLine,
  RiTreeLine,
} from "@remixicon/react"

export const BACKGROUND_PREVIEW_COUNT = 8
export const GRADIENT_PREVIEW_COUNT = 8
export const BACKGROUND_MAX_DIMENSION = 1600

export const POP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const TILE_GRID_VARIANTS = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.018, delayChildren: 0 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: POP_EASE },
  },
}

// Note: no animated `filter: blur()` here — animating blur across the whole
// tile grid stalls the main thread on mobile and causes a blank/white flash
// before the tiles appear. Transform + opacity stay GPU-cheap.
export const TILE_ITEM_VARIANTS = {
  initial: { opacity: 0, y: 6, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: POP_EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.1, ease: POP_EASE },
  },
}

export const DEFAULT_LINEAR_GRADIENT = {
  angle: 135,
  colors: ["#60a5fa", "#a78bfa", "#34d399", "#f472b6"],
}

export const GRADIENT_COLOR_CONTROLS = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "accent", label: "Accent" },
  { id: "foreground", label: "Foreground" },
]

export interface GradientOption {
  id: string
  baseValue: string
  value: string
}

export type UnsplashResult = {
  id: string
  alt: string
  thumb: string
  full: string
  downloadLocation: string
  photographer: string
  photographerUrl: string
}

export function parseLinearGradient(gradientValue: string): {
  angle: number
  colors: string[]
} | null {
  if (
    !gradientValue.startsWith("linear-gradient(") ||
    !gradientValue.endsWith(")")
  )
    return null
  const gradientBody = gradientValue.slice("linear-gradient(".length, -1)
  const parts = splitByTopLevelComma(gradientBody)
  if (parts.length < 3) return null
  const angleMatch = parts[0].trim().match(/(-?\d+(\.\d+)?)deg/)
  const angle = angleMatch
    ? Number.parseFloat(angleMatch[1])
    : DEFAULT_LINEAR_GRADIENT.angle
  const colors = parts
    .slice(1)
    .map((part) => part.trim().replace(/\s+\d+%$/g, ""))
    .filter(Boolean)
  if (colors.length < 2) return null
  return { angle, colors }
}

function splitByTopLevelComma(value: string): string[] {
  const parts: string[] = []
  let currentValue = ""
  let depth = 0
  for (const char of value) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      parts.push(currentValue)
      currentValue = ""
      continue
    }
    currentValue += char
  }
  if (currentValue.trim()) parts.push(currentValue)
  return parts
}

export function normalizeGradientColors(
  colors: string[],
  targetLength: number
): string[] {
  const safeColors =
    colors.length > 0
      ? colors.slice(0, targetLength)
      : [...DEFAULT_LINEAR_GRADIENT.colors]
  while (safeColors.length < targetLength) {
    safeColors.push(
      safeColors[safeColors.length - 1] ?? DEFAULT_LINEAR_GRADIENT.colors[0]
    )
  }
  return safeColors
}

export function buildLinearGradient({
  angle,
  colors,
}: {
  angle: number
  colors: string[]
}): string {
  return `linear-gradient(${Math.round(angle)}deg, ${colors.join(", ")})`
}

export function withGradientOptions({
  values,
  valuePrefix,
  overrides,
}: {
  values: string[]
  valuePrefix: string
  overrides: Record<string, string>
}): GradientOption[] {
  return values.map((value, index) => {
    const id = `${valuePrefix}-${index}`
    return {
      id,
      baseValue: value,
      value: overrides[id] ?? value,
    }
  })
}

export function gradientCategoryIcon(key: string) {
  switch (key) {
    case "trending":
      return RiFireLine
    case "warm":
      return RiSunLine
    case "cool":
      return RiMoonClearLine
    case "vivid":
      return RiFlashlightLine
    case "mono":
      return RiContrastLine
    case "pastel":
      return RiDropLine
    case "noise":
      return RiHazeLine
    case "mesh":
      return RiBubbleChartLine
    case "aurora":
      return RiRhythmLine
    default:
      return RiGradienterLine
  }
}

export function backgroundCategoryIcon(key: string) {
  switch (key) {
    case "mesh":
      return RiGridLine
    case "lines":
      return RiEqualizerLine
    case "gradient":
      return RiGradienterLine
    case "raycast":
      return RiFocus2Line
    case "mac":
      return RiMacLine
    case "cloud":
      return RiCloudLine
    case "wood":
      return RiTreeLine
    case "fluid":
      return RiOilLine
    case "minimal":
      return RiSquareLine
    default:
      return RiImageLine
  }
}
