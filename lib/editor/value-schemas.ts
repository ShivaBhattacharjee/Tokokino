import { z } from "zod/v4"

const finiteNumber = z.number().finite()

function rangeSchema(min: number, max: number) {
  return finiteNumber.min(min).max(max)
}

export const editorValueSchemas = {
  degree: rangeSchema(-180, 180),
  scale: rangeSchema(10, 300),
  percent: rangeSchema(0, 100),
  bipolarPercent: rangeSchema(-100, 100),
  hue: rangeSchema(-180, 360),
  blurPx: rangeSchema(0, 20),
  padding: rangeSchema(0, 240),
  borderWidth: rangeSchema(0, 12),
  borderInnerPadding: rangeSchema(0, 80),
  borderRadius: rangeSchema(0, 48),
  canvasRadius: rangeSchema(0, 80),
  patternThickness: rangeSchema(1, 10),
  asciiResolution: rangeSchema(20, 200),
  brightness: rangeSchema(0, 200),
  contrast: rangeSchema(0, 200),
  saturation: rangeSchema(0, 200),
  shadowIntensity: rangeSchema(0, 100),
  opacity: rangeSchema(0, 100),
  positionPercent: rangeSchema(-50, 150),
} as const

export type EditorValueKey = keyof typeof editorValueSchemas

export function clampNumber(
  raw: number,
  min: number = Number.NEGATIVE_INFINITY,
  max: number = Number.POSITIVE_INFINITY
): number | null {
  if (!Number.isFinite(raw)) return null
  const schema = finiteNumber
    .min(min === Number.NEGATIVE_INFINITY ? -Number.MAX_SAFE_INTEGER : min)
    .max(max === Number.POSITIVE_INFINITY ? Number.MAX_SAFE_INTEGER : max)
  const result = schema.safeParse(raw)
  if (result.success) return result.data
  if (raw < min) return min
  if (raw > max) return max
  return null
}

export function parseEditorNumber(
  raw: unknown,
  min: number = Number.NEGATIVE_INFINITY,
  max: number = Number.POSITIVE_INFINITY
): number | null {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return clampNumber(n, min, max)
}
