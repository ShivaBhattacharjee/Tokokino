"use client"

import * as React from "react"
import {
  RiCheckLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

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
  const [copied, setCopied] = React.useState(false)
  const [imageFailed, setImageFailed] = React.useState(false)
  const pageUrl =
    typeof window === "undefined" ? `/share/${id}` : window.location.href

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      toast.success("Share link copied")
      setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      console.error(error)
      toast.error("Could not copy link")
    }
  }, [pageUrl])

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-dashed border-border/70 pb-4">
          <div className="min-w-0">
            <p className="label-eyebrow">Shared screenshot</p>
            <h1 className="mt-1 truncate text-lg font-medium">Noctivy share</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {sharedBy ? `Shared by ${sharedBy}` : "Shared with Noctivy"}
              {views === null ? null : ` · ${views} view${views === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => void handleCopy()}>
              {copied ? <RiCheckLine /> : <RiFileCopyLine />}
              <span>{copied ? "Copied" : "Copy link"}</span>
            </Button>
            <Button asChild size="lg">
              <a href={`/api/share/${id}/download`}>
                <RiDownloadLine />
                <span>Download</span>
              </a>
            </Button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 place-items-center py-6">
          <div className="bg-checker shadow-artboard w-full overflow-hidden rounded-lg border border-border/70">
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Shared Noctivy screenshot"
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
