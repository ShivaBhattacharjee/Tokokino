import { z } from "zod/v4"

/**
 * Shared Zod building blocks used by multiple feature schemas.
 *
 * Keep these intentionally narrow — they describe field shapes that recur
 * across drafts and presets (3D tilt, percentage offsets, etc.). Anything
 * that's specific to a single feature lives next to that feature's schema
 * file instead.
 */

export const tiltSchema = z.object({
  rx: z.number().finite(),
  ry: z.number().finite(),
  rz: z.number().finite(),
})

export const percentOffsetSchema = z.object({
  xPct: z.number().finite(),
  yPct: z.number().finite(),
})
