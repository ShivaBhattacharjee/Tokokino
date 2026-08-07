import type { MediaAdjustments } from "@/lib/editor/state-types"

/**
 * One layer's colour grade, wired to whichever state owns it. The backdrop
 * layer and the screenshot/video media expose the same knobs, so the Effects
 * control renders one of these without knowing which layer it is driving.
 */
export type LayerGrade = {
  adjustments: MediaAdjustments
  commit: (patch: Partial<MediaAdjustments>) => void
  preview: (patch: Partial<MediaAdjustments>) => void
  /** True when the grade differs from neutral — drives the tile's active dot. */
  dirty: boolean
  reset: () => void
}
