"use client"

import * as React from "react"
import { RiBlueskyFill, RiLoader4Line, RiTwitterXLine } from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { tweetUrlSchema } from "@/lib/editor/tweet-url"
import { cn } from "@/lib/utils"

type TweetUrlPopoverProps = {
  /** Resolves the pasted link into a loaded post. Throws to show an error. */
  onLoad: (url: string) => Promise<void>
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}

export function TweetUrlPopover({
  onLoad,
  children,
  side = "bottom",
  align = "center",
}: TweetUrlPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const parsed = React.useMemo(() => tweetUrlSchema.safeParse(url), [url])
  const source = parsed.success ? parsed.data.platform : null
  const invalid = url.trim().length > 0 && !parsed.success
  const canSubmit = parsed.success && !loading

  const submit = React.useCallback(async () => {
    if (!parsed.success || loading) return
    setLoading(true)
    setError(null)
    try {
      await onLoad(url.trim())
      setOpen(false)
      setUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that post")
    } finally {
      setLoading(false)
    }
  }, [parsed, loading, onLoad, url])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <PopoverTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-[300px] gap-3 p-3"
      >
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground/5 text-foreground">
            {source === "bluesky" ? (
              <RiBlueskyFill className="size-4" />
            ) : (
              <RiTwitterXLine className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-tight font-medium">
              Embed a social post
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Paste a public X or Bluesky link
            </p>
          </div>
        </div>
        <input
          type="text"
          inputMode="url"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="https://x.com/… or https://bsky.app/…"
          aria-label="Social post link"
          aria-invalid={invalid}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit()
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "h-9 w-full rounded-md border bg-foreground/4 px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:outline-none",
            invalid
              ? "border-destructive/60 focus:ring-destructive/40"
              : "border-border focus:border-foreground/30 focus:ring-foreground/20"
          )}
        />
        {error ? (
          <p className="text-[11px] leading-tight text-destructive">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={(e) => {
            e.stopPropagation()
            void submit()
          }}
          className={cn(
            "flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-white transition hover:brightness-110",
            !canSubmit && "cursor-default opacity-60 hover:brightness-100"
          )}
        >
          {loading ? <RiLoader4Line className="size-4 animate-spin" /> : null}
          {loading ? "Loading…" : "Load post"}
        </button>
      </PopoverContent>
    </Popover>
  )
}
