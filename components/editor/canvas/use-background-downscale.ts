"use client"

import * as React from "react"

import {
  downscaleImageFromUrl,
  getOptimizedUrlSync,
} from "@/lib/editor/image-resize"
import { useEditorStore } from "@/lib/editor/store"
import { isUnsplashImageUrl } from "@/lib/editor/unsplash"
import type { Background } from "@/lib/editor/state-types"

const DOWNSCALE_OPTS = { maxDimension: 1600, jpegQuality: 0.9 }

/**
 * Downscale an image background whenever its `sourceUrl` changes — on
 * mount/hydration, and when a custom preset applies a new image mid-session.
 *
 * Unsplash CDN URLs must stay hotlinked for view tracking, so they are never
 * converted to data URLs; a stored data URL from an older session is restored
 * back to the hotlink instead. Writes are `silent` so they never land in undo.
 */
export function useBackgroundDownscale(
  background: Background,
  canvasId: string | null | undefined
) {
  React.useEffect(() => {
    if (background.type !== "image" || !background.sourceUrl || !canvasId)
      return

    const sourceUrl = background.sourceUrl
    const thumbUrl = background.thumbUrl ?? undefined
    const setBackground = (value: string) =>
      useEditorStore
        .getState()
        .setBackground(
          { type: "image", value, sourceUrl, thumbUrl },
          canvasId,
          {
            silent: true,
          }
        )

    if (isUnsplashImageUrl(sourceUrl)) {
      if (background.value !== sourceUrl) setBackground(sourceUrl)
      return
    }

    if (background.value.startsWith("data:")) return

    // Apply a cached downscale synchronously so we never show a stale or wrong
    // image (e.g. after a preset re-apply).
    const cached = getOptimizedUrlSync(sourceUrl, DOWNSCALE_OPTS)
    if (cached) {
      setBackground(cached)
      return
    }

    void downscaleImageFromUrl(sourceUrl, DOWNSCALE_OPTS)
      .then((downscaled) => {
        const c = useEditorStore
          .getState()
          .present.canvases.find((cv) => cv.id === canvasId)
        // The background may have changed while the downscale was in flight.
        if (
          c?.background.type !== "image" ||
          c.background.sourceUrl !== sourceUrl
        )
          return
        setBackground(downscaled)
      })
      .catch((err) => {
        console.log("[bg] downscale failed", err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background.sourceUrl])
}
