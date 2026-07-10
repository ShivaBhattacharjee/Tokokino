import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

/** User-saved custom preset kind: static look vs timeline (animate). */
export type CustomPresetType = "style" | "animate"

/**
 * Stored snapshot for a custom preset. Carries full canvas styling (every
 * inspector field, including background, border, shadow, overlay, portrait,
 * etc.) along with geometry, but never screenshot pixels.
 *
 * Animate presets also carry `animation` (duration + clips). Audio object URLs
 * are never stored. Pose backgrounds may omit bulky data-URLs that match the
 * canvas style background.
 */
export type StoredPresetGeometry = {
  canvasTilt: { rx: number; ry: number; rz: number }
  canvasScale: number
  slots: Array<Record<string, unknown>>
  mainOffset?: { xPct: number; yPct: number }
  relativeSlotPositions?: boolean
  canvasStyle?: Record<string, unknown>
  animation?: {
    durationMs: number
    clips: Array<Record<string, unknown>>
    /** Slot ids from the source canvas at save time, in `slots` order. */
    sourceSlotIds?: string[]
  }
}

/** Draft / project kind for Open-project filtering. */
export type DraftType = "style" | "animate"

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    canvasCount: integer("canvas_count").notNull(),
    byteSize: integer("byte_size").notNull(),
    /** "style" = present/static edit; "animate" = timeline project. */
    type: text("type").$type<DraftType>().notNull().default("style"),
    stateKey: text("state_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_drafts_user_updated").on(table.userId, table.updatedAt),
    index("idx_drafts_user_type_updated").on(
      table.userId,
      table.type,
      table.updatedAt
    ),
  ]
)

export const customPresets = sqliteTable(
  "custom_presets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    slotCount: integer("slot_count").notNull(),
    type: text("type").$type<CustomPresetType>().notNull().default("style"),
    geometry: text("geometry", { mode: "json" })
      .$type<StoredPresetGeometry>()
      .notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_custom_presets_user_created").on(table.userId, table.createdAt),
    index("idx_custom_presets_user_type_created").on(
      table.userId,
      table.type,
      table.createdAt
    ),
  ]
)

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  exportFilenameFormat: text("export_filename_format"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

/** Still screenshot share vs animate (video/gif) share. */
export type ShareType = "style" | "animate"

export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull(),
    imageUrl: text("image_url").notNull(),
    imageHash: text("image_hash"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    type: text("type").$type<ShareType>().notNull().default("style"),
    contentType: text("content_type").notNull().default("image/png"),
    // Poster still-frame object key for animate shares (nullable).
    posterKey: text("poster_key"),
    userId: text("user_id").notNull(),
    userName: text("user_name"),
    userEmail: text("user_email"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastViewedAt: text("last_viewed_at"),
    viewCount: integer("view_count").notNull().default(0),
    uniqueViewCount: integer("unique_view_count").notNull().default(0),
  },
  (table) => [
    index("idx_shares_user_created").on(table.userId, table.createdAt),
    index("idx_shares_user_type_created").on(
      table.userId,
      table.type,
      table.createdAt
    ),
  ]
)

export const shareViews = sqliteTable(
  "share_views",
  {
    shareId: text("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
    firstViewedAt: text("first_viewed_at").notNull(),
    lastViewedAt: text("last_viewed_at").notNull(),
    visitCount: integer("visit_count").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.shareId, table.ipHash] }),
    index("idx_share_views_share").on(table.shareId),
  ]
)
