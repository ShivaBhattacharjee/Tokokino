"use client"

import * as React from "react"
import { toast } from "sonner"

import { fetchTweetData } from "@/lib/editor/load-tweet"
import { revokeObjectUrl } from "@/lib/editor/media-type"
import { useEditorStore } from "@/lib/editor/store"
import {
  DEFAULT_TWEET_SETTINGS,
  tweetSettingsFromCard,
  type TweetCardSettings,
} from "@/lib/editor/tweet-settings"
import { useVideoRegistry } from "@/lib/editor/video-registry"

import type { CaptureSettings } from "./upload-card"
import { useImageFileIntake } from "./use-image-file-intake"

type TweetCard = Parameters<typeof tweetSettingsFromCard>[0]

/**
 * Every way media enters a canvas: file drop/paste/browse, the website-capture
 * API, pre-captured demos, and tweet cards — plus the main `<video>`
 * registration the docked control bar drives.
 *
 * Kept together because they all funnel through one screenshot setter that owns
 * the object-URL lifecycle: replacing media must revoke the outgoing URL, but
 * only when no other canvas still references it (duplicates share the string).
 */
export function useCanvasMediaIntake({
  scopeId,
  isCanvasPreview,
  slotCount,
  tweet,
  setScreenshot,
  setFullPageScreenshot,
  setScreenshotSlotImage,
  setTweet,
  onNaturalDimsReset,
}: {
  scopeId: string | null | undefined
  isCanvasPreview: boolean
  slotCount: number
  tweet: TweetCard | null | undefined
  setScreenshot: (src: string) => void
  setFullPageScreenshot: (src: string) => void
  setScreenshotSlotImage: (slotId: string, src: string) => void
  setTweet: (card: TweetCard) => void
  onNaturalDimsReset: () => void
}) {
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )

  const setMainScreenshotImage = React.useCallback(
    (src: string, isFullPageCapture = false) => {
      // Free the outgoing image/video object URL so replacements don't leak —
      // unless another canvas still references it (e.g. after duplicate).
      const canvases = useEditorStore.getState().present.canvases
      const prev = canvases.find((c) => c.id === scopeId)?.screenshot
      if (prev && prev !== src) {
        const stillUsed = canvases.some(
          (c) =>
            c.id !== scopeId &&
            (c.screenshot === prev || c.originalScreenshot === prev)
        )
        if (!stillUsed) revokeObjectUrl(prev)
      }
      if (isFullPageCapture) {
        setFullPageScreenshot(src)
      } else {
        setScreenshot(src)
      }
      onNaturalDimsReset()
    },
    [scopeId, setFullPageScreenshot, setScreenshot, onNaturalDimsReset]
  )

  const handleImageFile = React.useCallback(
    (src: string) => {
      if (selectedScreenshotSlotId) {
        setScreenshotSlotImage(selectedScreenshotSlotId, src)
        return
      }
      setMainScreenshotImage(src)
    },
    [selectedScreenshotSlotId, setMainScreenshotImage, setScreenshotSlotImage]
  )

  // Register the main <video> element so the docked control bar can drive it.
  // Preview/thumbnail scopes never register — only the real editable canvas.
  const registerVideo = useVideoRegistry((s) => s.registerVideo)
  const handleMediaElement = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (!scopeId || isCanvasPreview) return
      registerVideo(scopeId, el)
    },
    [isCanvasPreview, registerVideo, scopeId]
  )
  React.useEffect(() => {
    return () => {
      if (scopeId && !isCanvasPreview) registerVideo(scopeId, null)
    }
  }, [isCanvasPreview, registerVideo, scopeId])

  // True while an incoming GIF is transcoding to video — drives the canvas
  // skeleton so the user sees progress instead of a frozen empty box.
  const [preparingMedia, setPreparingMedia] = React.useState(false)
  const intake = useImageFileIntake(handleImageFile, {
    // A video may only be the sole screenshot — once extra slots exist, block
    // dropping/pasting one into the main box (and route slots reject it too).
    allowVideo: slotCount === 0,
    onPreparingChange: setPreparingMedia,
  })

  const handleCaptureWebsite = React.useCallback(
    async (rawUrl: string, settings: CaptureSettings) => {
      let target: URL
      try {
        target = new URL(rawUrl)
      } catch {
        toast.error("Enter a valid URL")
        return
      }
      try {
        const res = await fetch("/api/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: target.toString(),
            device: settings.device,
            width: settings.width,
            aspectRatio: settings.aspectRatio,
            delay: settings.delay,
          }),
        })
        if (!res.ok) {
          const { error } = (await res
            .json()
            .catch(() => ({ error: "Capture failed" }))) as { error?: string }
          throw new Error(error ?? "Capture failed")
        }
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () =>
            resolve(typeof fr.result === "string" ? fr.result : "")
          fr.onerror = () => reject(fr.error ?? new Error("FileReader error"))
          fr.readAsDataURL(blob)
        })
        // API captures are always full-page (screenshotOptions.fullPage).
        setMainScreenshotImage(dataUrl, true)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not capture screenshot"
        )
      }
    },
    [setMainScreenshotImage]
  )

  /** Pre-captured R2 demos are full-page PNGs — same path as /api/screenshot. */
  const handleDemoScreenshot = React.useCallback(
    (src: string) => {
      setMainScreenshotImage(src, true)
    },
    [setMainScreenshotImage]
  )

  const handleLoadTweet = React.useCallback(
    async (
      url: string,
      settings: TweetCardSettings = DEFAULT_TWEET_SETTINGS
    ) => {
      // fetchTweetData throws a user-facing Error; let the caller surface it.
      const data = await fetchTweetData(url)
      setTweet({ data, ...settings })
    },
    [setTweet]
  )

  const handleReplaceTweet = React.useCallback(
    async (url: string, settings?: TweetCardSettings) => {
      await handleLoadTweet(
        url,
        settings ??
          (tweet ? tweetSettingsFromCard(tweet) : DEFAULT_TWEET_SETTINGS)
      )
    },
    [handleLoadTweet, tweet]
  )

  return {
    ...intake,
    preparingMedia,
    setMainScreenshotImage,
    handleImageFile,
    handleMediaElement,
    handleCaptureWebsite,
    handleDemoScreenshot,
    handleLoadTweet,
    handleReplaceTweet,
  }
}
