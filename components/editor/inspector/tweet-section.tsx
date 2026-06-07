"use client"

import * as React from "react"
import { RiDeleteBinLine, RiRefreshLine } from "@remixicon/react"

import { TweetUrlPopover } from "@/components/editor/canvas/tweet-url-popover"
import { Switch } from "@/components/ui/switch"
import { fetchTweetData } from "@/lib/editor/load-tweet"
import type { TweetTheme } from "@/lib/editor/store"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const THEME_OPTIONS: { id: TweetTheme; label: string; swatch: string }[] = [
  { id: "light", label: "Light", swatch: "#ffffff" },
  { id: "dim", label: "Dim", swatch: "#15202b" },
  { id: "dark", label: "Dark", swatch: "#000000" },
]

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function TweetSection() {
  const tweet = useActiveCanvasField((c) => c.tweet)
  const setTweet = useEditorStore((s) => s.setTweet)
  const updateTweet = useEditorStore((s) => s.updateTweet)
  const clearTweet = useEditorStore((s) => s.clearTweet)

  // "Replace post" keeps the current theme/toggles and swaps only the data.
  const handleReplace = React.useCallback(
    async (url: string) => {
      const data = await fetchTweetData(url)
      setTweet(
        tweet
          ? { ...tweet, data }
          : { data, theme: "dark", showMetrics: true, showAvatar: true }
      )
    },
    [setTweet, tweet]
  )

  if (!tweet) return null

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-2 block text-[11px] tracking-tight text-muted-foreground">
          Theme
        </span>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const active = tweet.theme === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateTweet({ theme: opt.id })}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-[11px] font-medium transition-all",
                  active
                    ? "border-primary/40 bg-primary/5 text-primary ring-1 ring-primary/20"
                    : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-foreground/30"
                )}
              >
                <span
                  className="size-3 rounded-full border border-black/10 dark:border-white/15"
                  style={{ background: opt.swatch }}
                />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <Row label="Show metrics">
        <Switch
          checked={tweet.showMetrics}
          onCheckedChange={(v) => updateTweet({ showMetrics: v })}
        />
      </Row>
      <Row label="Show avatar">
        <Switch
          checked={tweet.showAvatar}
          onCheckedChange={(v) => updateTweet({ showAvatar: v })}
        />
      </Row>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <TweetUrlPopover onLoad={handleReplace} side="top" align="start">
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-secondary/20 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <RiRefreshLine className="size-3.5" />
            Replace
          </button>
        </TweetUrlPopover>
        <button
          type="button"
          onClick={() => clearTweet()}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-secondary/20 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <RiDeleteBinLine className="size-3.5" />
          Remove
        </button>
      </div>
    </div>
  )
}
