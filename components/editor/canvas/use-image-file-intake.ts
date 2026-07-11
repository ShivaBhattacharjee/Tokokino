"use client"

import * as React from "react"
import { toast } from "sonner"

import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import {
  createVideoObjectUrl,
  isGifFile,
  isVideoFile,
} from "@/lib/editor/media-type"

// Only re-encode screenshots when they're truly oversized — leaves typical
// 1–5 MB phone screenshots untouched and pixel-perfect.
const SCREENSHOT_DOWNSCALE_THRESHOLD = 10 * 1024 * 1024
// Videos play from a blob object URL (no base64 inflation, GPU-decoded), so the
// only real ceiling is RAM/decode — keep a generous 1 GB guard.
const VIDEO_SIZE_LIMIT = 1024 * 1024 * 1024

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
  }
) {
  const allowVideo = options?.allowVideo ?? true
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const readFile = React.useCallback(
    (file: File) => {
      if (isVideoFile(file)) {
        if (!allowVideo) {
          toast.error("Videos can only be used as a single screenshot")
          return
        }
        if (file.size > VIDEO_SIZE_LIMIT) {
          toast.error("Video is too large (max 1 GB)")
          return
        }
        // Play straight from an object URL — no base64, no size blow-up.
        onImage(createVideoObjectUrl(file))
        return
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image, GIF, or video")
        return
      }

      // GIFs must skip the canvas re-encode or they'd freeze on frame one.
      if (isGifFile(file)) {
        readRawDataUrl(file, onImage)
        return
      }

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
        readFile(file)
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
      if (file) readFile(file)
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
      if (file) readFile(file)
    },
  }

  return {
    fileInputRef,
    fileInputProps,
    isDragOver,
    readFile,
    dropHandlers,
  }
}
