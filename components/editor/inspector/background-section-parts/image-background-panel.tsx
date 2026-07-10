"use client"

import * as React from "react"
import debounce from "lodash/debounce"
import {
  RiLoader4Line,
  RiSearchLine,
  RiUnsplashLine,
  RiUpload2Line,
} from "@remixicon/react"
import InfiniteScroll from "react-infinite-scroll-component"

import { ScrollFadeBody } from "@/components/editor/scroll-fade"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Background } from "@/lib/editor/state-types"
import { trackUnsplashDownload } from "@/lib/editor/unsplash"
import { cn } from "@/lib/utils"

import { BackgroundLibrary } from "./background-library"
import type { UnsplashResult } from "./constants"

function unsplashCreditUrl(url: string) {
  try {
    const creditUrl = new URL(url)
    creditUrl.searchParams.set("utm_source", "Tokokino")
    creditUrl.searchParams.set("utm_medium", "referral")
    return creditUrl.toString()
  } catch {
    return url
  }
}

function unsplashAuthorLabel(name: string) {
  const firstName = name.trim().split(/\s+/)[0]
  return firstName && firstName !== name.trim() ? `${firstName}...` : name
}

export function ImageBackgroundPanel({
  background,
  flat,
  onUpload,
  selectImageFromUrl,
}: {
  background: Background
  flat: boolean
  onUpload: (file: File) => Promise<void>
  selectImageFromUrl: (url: string, thumbUrl?: string) => void
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [unsplashQuery, setUnsplashQuery] = React.useState("")
  const [unsplashStatus, setUnsplashStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")
  const [unsplashError, setUnsplashError] = React.useState<string | null>(null)
  const [unsplashResults, setUnsplashResults] = React.useState<
    UnsplashResult[]
  >([])
  const [unsplashPage, setUnsplashPage] = React.useState(1)
  const [unsplashHasMore, setUnsplashHasMore] = React.useState(false)
  const [unsplashOpen, setUnsplashOpen] = React.useState(false)

  const searchUnsplash = React.useCallback(
    async (overrideQuery?: string, page = 1) => {
      const query = (overrideQuery ?? unsplashQuery).trim()
      if (!query) return

      setUnsplashStatus("loading")
      setUnsplashError(null)
      try {
        const response = await fetch(
          `/api/unsplash/search?q=${encodeURIComponent(query)}&page=${page}`
        )
        const data: Record<string, unknown> = await response.json()

        if (!response.ok || !("results" in data)) {
          throw new Error(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Unable to search Unsplash"
          )
        }

        const results = data.results as UnsplashResult[]
        setUnsplashResults((prev) =>
          page === 1 ? results : [...prev, ...results]
        )
        setUnsplashPage(page)
        setUnsplashHasMore(Boolean(data.hasMore))
        setUnsplashStatus("ready")
        setUnsplashOpen(true)
      } catch (error) {
        setUnsplashStatus("error")
        setUnsplashHasMore(false)
        setUnsplashError(
          error instanceof Error ? error.message : "Unable to search Unsplash"
        )
      }
    },
    [unsplashQuery]
  )

  const debouncedSearchUnsplash = React.useMemo(
    () =>
      debounce((query: string) => {
        void searchUnsplash(query, 1)
      }, 200),
    [searchUnsplash]
  )

  React.useEffect(
    () => () => debouncedSearchUnsplash.cancel(),
    [debouncedSearchUnsplash]
  )

  const loadMoreUnsplash = () => {
    if (
      unsplashStatus === "loading" ||
      unsplashStatus === "error" ||
      !unsplashHasMore
    )
      return
    void searchUnsplash(undefined, unsplashPage + 1)
  }

  const selectUnsplashImage = (photo: UnsplashResult) => {
    // Track the download first so Unsplash attributes the selection even if
    // the subsequent background apply is slow or the tab closes.
    trackUnsplashDownload(photo.downloadLocation)
    selectImageFromUrl(photo.full, photo.thumb)
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onUpload(f)
          e.target.value = ""
        }}
      />
      <div className="flex gap-2">
        <Popover open={unsplashOpen} onOpenChange={setUnsplashOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-9 flex-1 cursor-pointer gap-2 bg-[#9BCD64] text-[#10220e] hover:bg-[#8ec25a]"
            >
              <RiUnsplashLine className="size-4" />
              <span className="text-[11px] font-medium">Unsplash</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="left"
            align="start"
            sideOffset={10}
            className="w-[320px] space-y-1.5 border-border/60 bg-popover/95 p-3 backdrop-blur-md"
          >
            <div>
              <p className="text-[12px] font-medium">Search Unsplash</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Pick a landscape photo as the canvas background.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  value={unsplashQuery}
                  onChange={(e) => {
                    const next = e.target.value
                    setUnsplashQuery(next)
                    debouncedSearchUnsplash(next)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchUnsplash()
                  }}
                  placeholder="Search backgrounds"
                  className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-secondary/30 px-3 text-[12px] transition-colors outline-none placeholder:text-muted-foreground focus:border-[#9BCD64]/70"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  onClick={() => void searchUnsplash()}
                  disabled={unsplashStatus === "loading"}
                >
                  {unsplashStatus === "loading" ? (
                    <RiLoader4Line className="size-4 animate-spin" />
                  ) : (
                    <RiSearchLine className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Abstract", "Minimal", "Nature", "Gradient", "Space"].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setUnsplashQuery(q)
                        void searchUnsplash(q, 1)
                      }}
                      className={cn(
                        "cursor-pointer rounded-md border border-border/60 bg-secondary/30 px-2 py-1 text-[10px] font-medium transition-all hover:border-[#9BCD64]/40 hover:bg-[#9BCD64]/10 hover:text-foreground",
                        unsplashQuery === q &&
                          "border-[#9BCD64]/50 bg-[#9BCD64]/10 text-[#9BCD64] ring-1 ring-[#9BCD64]/20"
                      )}
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
              {unsplashStatus === "error" ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                  {unsplashError}
                </p>
              ) : null}
              <ScrollFadeBody
                id="unsplash-results-scroll"
                rootClassName="h-[300px] max-h-[300px]"
                className="p-2"
              >
                {unsplashResults.length > 0 ? (
                  <InfiniteScroll
                    dataLength={unsplashResults.length}
                    next={loadMoreUnsplash}
                    hasMore={unsplashHasMore}
                    loader={
                      <div className="col-span-3 flex justify-center py-2 text-muted-foreground">
                        <RiLoader4Line className="size-4 animate-spin" />
                      </div>
                    }
                    scrollableTarget="unsplash-results-scroll"
                    className="grid w-full grid-cols-3 gap-2.5"
                  >
                    {unsplashResults.map((photo) => {
                      const selected =
                        background.type === "image" &&
                        (background.sourceUrl ?? background.value) ===
                          photo.full

                      return (
                        <div
                          key={photo.id}
                          className={cn(
                            "group/unsplash relative aspect-video overflow-hidden rounded-lg border transition-colors",
                            selected
                              ? "border-primary/80 ring-2 ring-primary/60 ring-inset"
                              : "border-border/60 hover:border-foreground/30"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => selectUnsplashImage(photo)}
                            title={`Photo by ${photo.photographer}`}
                            className="absolute inset-0 cursor-pointer"
                          >
                            <span
                              aria-hidden
                              className="block size-full bg-cover bg-center"
                              style={{
                                backgroundImage: `url("${photo.thumb}")`,
                              }}
                            />
                          </button>
                          <a
                            href={unsplashCreditUrl(photo.photographerUrl)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={photo.photographer}
                            className="absolute bottom-[1] left-[6] z-10 max-w-[calc(100%-12px)] rounded bg-black/65 px-1.5 py-0.5 text-[8px] leading-none font-medium text-white shadow-sm backdrop-blur-sm transition-all hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                          >
                            <span className="block truncate">
                              {unsplashAuthorLabel(photo.photographer)}
                            </span>
                          </a>
                        </div>
                      )
                    })}
                  </InfiniteScroll>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                    <p className="text-[11px]">
                      Select a topic or search to load photos.
                    </p>
                  </div>
                )}
              </ScrollFadeBody>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="default"
          size="sm"
          className="h-9 flex-1 cursor-pointer gap-2"
          onClick={() => fileRef.current?.click()}
        >
          <RiUpload2Line className="size-4" />
          <span className="text-[11px] font-medium">Upload</span>
        </Button>
      </div>

      <BackgroundLibrary
        flat={flat}
        activeSourceUrl={
          background.type === "image"
            ? (background.sourceUrl ?? background.value)
            : null
        }
        onSelect={(value, thumb) => selectImageFromUrl(value, thumb)}
      />
    </>
  )
}
