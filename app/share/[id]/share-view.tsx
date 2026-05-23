"use client"

import * as React from "react"
import { RiCheckLine, RiDownloadLine, RiImageLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ShimmerImage } from "@/components/ui/shimmer-image"

export function ShareView({
  id,
  imageUrl,
  sharedBy,
  views,
}: {
  id: string
  imageUrl: string
  sharedBy: string | null
  views: number | null
}) {
  const [imageCopied, setImageCopied] = React.useState(false)
  const [imageFailed, setImageFailed] = React.useState(false)
  const handleCopyImage = React.useCallback(async () => {
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
  }, [id])

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-dashed border-border/70 pb-4">
          <div className="min-w-0">
            <p className="label-eyebrow">Shared screenshot</p>
            <h1 className="mt-1 truncate text-lg font-medium">
              Tokokino share
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {sharedBy ? `Shared by ${sharedBy}` : "Shared with Tokokino"}
              {views === null
                ? null
                : ` · ${views} view${views === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="w-44"
              variant="outline"
              size="lg"
              onClick={() => void handleCopyImage()}
            >
              {imageCopied ? <RiCheckLine /> : <RiImageLine />}
              <span>{imageCopied ? "Copied" : "Copy"}</span>
            </Button>
            <Button className="w-44" asChild size="lg">
              <a href={`/api/share/${id}/download`}>
                <RiDownloadLine />
                <span>Download</span>
              </a>
            </Button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 place-items-center py-6">
          <div className="bg-checker w-full overflow-hidden rounded-lg border border-border/70">
            {imageFailed ? (
              <div className="grid min-h-[52vh] place-items-center p-8 text-center">
                <div className="max-w-sm space-y-2">
                  <RiImageLine className="mx-auto size-8 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Image unavailable</h2>
                  <p className="text-xs/relaxed text-muted-foreground">
                    The share link exists, but the uploaded image could not be
                    loaded from storage.
                  </p>
                </div>
              </div>
            ) : (
              <ShimmerImage
                src={imageUrl}
                alt="Shared Tokokino screenshot"
                className="block h-auto max-h-[calc(100svh-9rem)] w-full object-contain"
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
