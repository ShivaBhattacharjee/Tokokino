import { z } from "zod/v4"

import { percentOffsetSchema, tiltSchema } from "@/lib/schemas/common"

/**
 * Server-side validation for custom layout presets.
 *
 * Each preset captures both layout geometry (canvas tilt/scale, slot
 * positions, main offset) and a full canvas-style snapshot of every
 * inspector field — background, backdrop, border, shadow, overlay, frame,
 * portrait, enhance, text/asset/annotation layers, etc. The actual
 * screenshot pixels are deliberately excluded so the same preset can be
 * applied to any project.
 *
 * Slot configs and `canvasStyle` are intentionally `.loose()` /
 * `z.record(..., z.unknown())`: the client owns those shapes and the
 * server only needs to confirm the basic envelope plus enforce a size
 * cap. See {@link MAX_PRESET_BYTES}.
 */

export const PRESET_NAME_MAX_LENGTH = 60
export const MAX_PRESET_BYTES = 512 * 1024

const slotSchema = z
  .object({
    xPct: z.number().finite(),
    yPct: z.number().finite(),
    widthPct: z.number().finite().optional(),
    heightPct: z.number().finite().optional(),
    rotation: z.number().finite(),
    tilt: tiltSchema,
    scale: z.number().finite(),
    zIndex: z.number().finite().optional(),
  })
  // slot extras (filter, hidden, objectFit, shadow) flow through;
  // the client knows the exact shape and merges defensively on apply.
  .loose()

export const presetGeometrySchema = z
  .object({
    canvasTilt: tiltSchema,
    canvasScale: z.number().finite(),
    slots: z.array(slotSchema).min(0).max(3),
    mainOffset: percentOffsetSchema.optional(),
    relativeSlotPositions: z.boolean().optional(),
    canvasStyle: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()

/** Request body for `POST /api/presets`. */
export const createPresetBodySchema = z.object({
  name: z.string().trim().min(1).max(PRESET_NAME_MAX_LENGTH),
  geometry: presetGeometrySchema,
})

export type ParsedPresetBody = z.infer<typeof createPresetBodySchema>
