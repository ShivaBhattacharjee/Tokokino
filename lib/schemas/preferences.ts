import { z } from "zod/v4"

import { EXPORT_FILENAME_FORMAT_MAX_LENGTH } from "@/lib/editor/export-filename"

/** Request body for `PUT /api/preferences`. */
export const updatePreferencesBodySchema = z.object({
  exportFilenameFormat: z
    .string()
    .trim()
    .max(EXPORT_FILENAME_FORMAT_MAX_LENGTH)
    .nullable(),
})

export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>
