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
 * Animate presets (`type: "animate"`) also carry a timeline under
 * `geometry.animation` (duration + clips). Audio is never persisted.
 *
 * Slot configs, `canvasStyle`, and `animation` are intentionally `.loose()` /
 * open records: the client owns those shapes and the server only needs to
 * confirm the basic envelope plus enforce a size cap. See
 * {@link MAX_PRESET_BYTES}.
 */

export const PRESET_NAME_MAX_LENGTH = 60
/** Raised from 512 KB so animate presets with multiple pose snapshots fit. */
export const MAX_PRESET_BYTES = 1024 * 1024

export const customPresetTypeSchema = z.enum(["style", "animate"])
export type CustomPresetType = z.infer<typeof customPresetTypeSchema>

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

const animationSchema = z
  .object({
    durationMs: z.number().finite(),
    clips: z.array(z.record(z.string(), z.unknown())).max(64),
    sourceSlotIds: z.array(z.string()).max(3).optional(),
  })
  .loose()

export const presetGeometrySchema = z
  .object({
    canvasTilt: tiltSchema,
    canvasScale: z.number().finite(),
    slots: z.array(slotSchema).min(0).max(3),
    mainOffset: percentOffsetSchema.optional(),
    relativeSlotPositions: z.boolean().optional(),
    canvasStyle: z.record(z.string(), z.unknown()).optional(),
    animation: animationSchema.optional(),
  })
  .loose()

/** Request body for `POST /api/presets`. */
export const createPresetBodySchema = z.object({
  name: z.string().trim().min(1).max(PRESET_NAME_MAX_LENGTH),
  type: customPresetTypeSchema.default("style"),
  geometry: presetGeometrySchema,
})

/** Request body for `PUT /api/presets/[id]`. */
export const updatePresetBodySchema = z.object({
  name: z.string().trim().min(1).max(PRESET_NAME_MAX_LENGTH).optional(),
  type: customPresetTypeSchema.optional(),
  geometry: presetGeometrySchema.optional(),
})

export type ParsedPresetBody = z.infer<typeof createPresetBodySchema>
