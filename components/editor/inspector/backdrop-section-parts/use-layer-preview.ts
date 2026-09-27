"use client"

import * as React from "react"

import { backgroundCss } from "@/lib/editor/css-utils"
import { isVideoSrc } from "@/lib/editor/media-type"
import type { Background } from "@/lib/editor/state-types"
import { videoPosterBlob } from "@/lib/editor/video-poster"

const POSTER_MAX_WIDTH = 240

function useMediaPreviewUrl(src: string | null, enabled: boolean) {
  const isVideo = isVideoSrc(src)
  const [poster, setPoster] = React.useState<{
    src: string
    url: string
  } | null>(null)

  React.useEffect(() => {
    if (!enabled || !src || !isVideo) return
    let cancelled = false
    let url: string | null = null
    void videoPosterBlob(src, 0, POSTER_MAX_WIDTH)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPoster({ src, url })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [enabled, src, isVideo])

  if (!src) return null
  if (!isVideo) return src
  return poster?.src === src ? poster.url : null
}

/**
 * Background style for a picker tile that previews the real layer a control
 * edits — the canvas background, or the screenshot/video (a poster frame for
 * video). Undefined when there is nothing to show yet.
 */
export function useLayerPreviewStyle(
  layer: "background" | "media",
  mediaSrc: string | null,
  background: Background
): React.CSSProperties | undefined {
  const mediaPreviewUrl = useMediaPreviewUrl(mediaSrc, layer === "media")
  return React.useMemo(() => {
    if (layer === "background") {
      return background.type === "none"
        ? undefined
        : backgroundCss({
            ...background,
            value:
              background.type === "image"
                ? (background.thumbUrl ?? background.value)
                : background.value,
          })
    }
    if (!mediaPreviewUrl) return undefined
    return {
      backgroundImage: `url("${mediaPreviewUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  }, [layer, background, mediaPreviewUrl])
}
