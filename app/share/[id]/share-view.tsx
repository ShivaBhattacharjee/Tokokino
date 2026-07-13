"use client"

import * as React from "react"
import { RiCheckLine, RiDownloadLine, RiImageLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { SharePlyrPlayer } from "@/components/share/share-plyr-player"
import { triggerAnchorDownload } from "@/lib/download"
import { isVideoShareContentType } from "@/lib/share"

export function ShareView({
  id,
  imageUrl,
  sharedBy,
  views,
  contentType = "image/png",
  shareType = "style",
}: {
  id: string
  imageUrl: string
  sharedBy: string | null
  views: number | null
  contentType?: string
  shareType?: "style" | "animate"
}) {
  const [imageCopied, setImageCopied] = React.useState(false)
  const [imageFailed, setImageFailed] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const isVideo = isVideoShareContentType(contentType)
  const isGif = contentType.toLowerCase() === "image/gif"
  const isAnimate = shareType === "animate" || isVideo || isGif

  const handleCopyImage = React.useCallback(async () => {
    if (isVideo) {
      toast.error("Copy works for still images. Download the video instead.")
      return
    }
    try {
      const response = await fetch(`/api/share/${id}/download`)
      const blob = await response.blob()
      const pngBlob =
        blob.type === "image/png"
          ? blob
          : await new Promise<Blob>((resolve, reject) => {
              const img = new Image()
              img.crossOrigin = "anonymous"
              img.onload = () => {
                const canvas = document.createElement("canvas")
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext("2d")!
                ctx.drawImage(img, 0, 0)
                canvas.toBlob(
                  (b) =>
                    b
                      ? resolve(b)
                      : reject(new Error("Could not convert image to PNG")),
                  "image/png"
                )
              }
              img.onerror = reject
              img.src = URL.createObjectURL(blob)
            })
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ])
      setImageCopied(true)
      toast.success("Image copied to clipboard")
      setTimeout(() => setImageCopied(false), 1600)
    } catch (error) {
      console.error(error)
      toast.error("Could not copy image")
    }
  }, [id, isVideo])

  const handleDownload = React.useCallback(() => {
    if (downloading) return
    // Point a transient anchor at the API URL so the browser streams the file
    // straight to disk — buffering it through res.blob() loads the whole share
    // (videos can be ~1GB) into the JS heap and can OOM the tab. The route sets
    // Content-Disposition, so the server supplies the filename.
    setDownloading(true)
    triggerAnchorDownload(`/api/share/${id}/download`, "")
    setTimeout(() => setDownloading(false), 2000)
  }, [downloading, id])

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-dashed border-border/70 pb-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium">Tokokino share</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {sharedBy ? `Shared by ${sharedBy}` : "Shared with Tokokino"}
              {views === null
                ? null
                : ` · ${views} view${views === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isVideo ? (
              <Button
                className="w-44"
                variant="outline"
                size="lg"
                onClick={() => void handleCopyImage()}
              >
                {imageCopied ? <RiCheckLine /> : <RiImageLine />}
                <span>{imageCopied ? "Copied" : "Copy"}</span>
              </Button>
            ) : null}
            <Button
              className="w-44"
              size="lg"
              disabled={downloading}
              onClick={handleDownload}
            >
              <RiDownloadLine />
              <span>{downloading ? "Downloading…" : "Download"}</span>
            </Button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 place-items-center py-6">
          <div className="w-full overflow-hidden">
            {imageFailed ? (
              <div className="bg-checker grid min-h-[52vh] place-items-center rounded-lg border border-border/70 p-8 text-center">
                <div className="max-w-sm space-y-2">
                  <RiImageLine className="mx-auto size-8 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Media unavailable</h2>
                  <p className="text-xs/relaxed text-muted-foreground">
                    The share link exists, but the uploaded file could not be
                    loaded from storage.
                  </p>
                </div>
              </div>
            ) : isVideo ? (
              <SharePlyrPlayer
                src={imageUrl}
                contentType={contentType}
                className="max-h-[calc(100svh-9rem)]"
              />
            ) : (
              <div className="bg-checker overflow-hidden rounded-lg border border-border/70">
                <ShimmerImage
                  src={imageUrl}
                  alt={
                    isAnimate
                      ? "Shared Tokokino animation"
                      : "Shared Tokokino screenshot"
                  }
                  className="block h-auto max-h-[calc(100svh-9rem)] w-full object-contain"
                  onError={() => setImageFailed(true)}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
