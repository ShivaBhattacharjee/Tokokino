"use client"

import * as React from "react"
import { toast } from "sonner"

import { capture } from "@/lib/analytics"
import { transcodeGifToVideo } from "@/lib/editor/gif-to-video"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import {
  createVideoObjectUrl,
  isGifFile,
  isVideoFile,
  registerObjectUrl,
} from "@/lib/editor/media-type"
import { confirmVideoImport } from "@/lib/editor/video-capacity"

// Only re-encode screenshots when they're truly oversized — leaves typical
// 1–5 MB phone screenshots untouched and pixel-perfect.
const SCREENSHOT_DOWNSCALE_THRESHOLD = 10 * 1024 * 1024

/** How the media reached the editor, for activation analytics. */
export type MediaIntakeSource = "drop" | "paste" | "browse"

function readRawDataUrl(file: File, onImage: (src: string) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === "string") onImage(reader.result)
  }
  reader.readAsDataURL(file)
}

export function useImageFileIntake(
  onImage: (src: string) => void,
  options?: {
    /** Whether a dropped/pasted/selected video is accepted. Videos are only
     * allowed as the sole screenshot (no extra slots), so callers pass false
     * once a multi-screenshot composition exists. Defaults to true. */
    allowVideo?: boolean
    /** Fired around async media preparation (GIF→video transcode) so the caller
     * can show a skeleton/placeholder in the canvas while it runs. */
    onPreparingChange?: (preparing: boolean) => void
  }
) {
  const allowVideo = options?.allowVideo ?? true
  const onPreparingChange = options?.onPreparingChange
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [pendingGif, setPendingGif] = React.useState<{
    file: File
    source: MediaIntakeSource
  } | null>(null)

  const runGifTranscode = React.useCallback(
    (file: File, source: MediaIntakeSource) => {
      onPreparingChange?.(true)
      // The user agreed to a conversion in the dialog, so a fallback to the
      // plain <img> path is a different result than the one they asked for —
      // no timeline, no video bar. Say so rather than let them hunt for it.
      const fallBackToImage = () => {
        capture("screenshot_added", {
          source,
          media_kind: "gif",
          transcoded: false,
          size_bytes: file.size,
        })
        toast.error("Could not convert that GIF — added it as an image instead")
        readRawDataUrl(file, onImage)
      }
      transcodeGifToVideo(file)
        .then((blob) => {
          if (!blob) {
            fallBackToImage()
            return
          }
          capture("screenshot_added", {
            source,
            media_kind: "gif",
            transcoded: true,
            size_bytes: file.size,
          })
          onImage(registerObjectUrl(blob))
        })
        .catch(fallBackToImage)
        .finally(() => onPreparingChange?.(false))
    },
    [onImage, onPreparingChange]
  )

  const readFile = React.useCallback(
    (file: File, source: MediaIntakeSource = "browse") => {
      if (isVideoFile(file)) {
        if (!allowVideo) {
          toast.error("Videos can only be used as a single screenshot")
          return
        }
        void confirmVideoImport(file).then((proceed) => {
          if (!proceed) return
          capture("screenshot_added", {
            source,
            media_kind: "video",
            size_bytes: file.size,
          })
          // Play straight from an object URL — no base64, no size blow-up.
          onImage(createVideoObjectUrl(file))
        })
        return
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image, GIF, or video")
        return
      }

      // A GIF is animated media, so treat it like a video: transcode to WebM so
      // it plays through the video control bar (play/pause/scrub) and exports as
      // animated. Videos are single-screenshot only, so we only do this where a
      // video is allowed; in slot/multi contexts the GIF stays a native animated
      // <img>. Static GIFs and browsers without WebCodecs fall back to the same
      // <img> path (transcodeGifToVideo returns null).
      if (isGifFile(file)) {
        if (!allowVideo) {
          capture("screenshot_added", {
            source,
            media_kind: "gif",
            transcoded: false,
            size_bytes: file.size,
          })
          readRawDataUrl(file, onImage)
          return
        }
        setPendingGif({ file, source })
        return
      }

      capture("screenshot_added", {
        source,
        media_kind: "image",
        size_bytes: file.size,
      })
      void readImageFileAsDataUrl(file, {
        downscaleAbove: SCREENSHOT_DOWNSCALE_THRESHOLD,
        maxDimension: 2400,
      })
        .then((src) => onImage(src))
        .catch(() => {
          // Fallback: read raw if downscale somehow blows up.
          readRawDataUrl(file, onImage)
        })
    },
    [onImage, allowVideo]
  )

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (!item.type.startsWith("image/") && !item.type.startsWith("video/"))
          continue
        const file = item.getAsFile()
        if (!file) continue
        readFile(file, "paste")
        e.preventDefault()
        break
      }
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [readFile])

  const fileInputProps = {
    ref: fileInputRef,
    type: "file",
    accept: allowVideo ? "image/*,video/*" : "image/*",
    className: "hidden",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) readFile(file, "browse")
      e.target.value = ""
    },
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(true)
    },
    onDragLeave: () => setIsDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) readFile(file, "drop")
    },
  }

  const confirmGifTranscode = React.useCallback(() => {
    if (pendingGif) runGifTranscode(pendingGif.file, pendingGif.source)
    setPendingGif(null)
  }, [pendingGif, runGifTranscode])

  const cancelGifTranscode = React.useCallback(() => setPendingGif(null), [])

  return {
    fileInputRef,
    fileInputProps,
    isDragOver,
    readFile,
    dropHandlers,
    pendingGif,
    confirmGifTranscode,
    cancelGifTranscode,
  }
}
