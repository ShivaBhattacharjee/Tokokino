"use client"

import * as React from "react"

import { Switch } from "@/components/ui/switch"
import {
  TweetFontSelect,
  TweetThemeSelect,
} from "@/components/editor/tweet-font-select"
import { EffectSlider } from "@/components/editor/inspector/effect-slider"
import {
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
} from "@/lib/editor/store"
import {
  DEFAULT_TWEET_SETTINGS,
  MAX_TWEET_FONT_SIZE,
  MIN_TWEET_FONT_SIZE,
} from "@/lib/editor/tweet-settings"

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
  const updateTweet = useEditorStore((s) => s.updateTweet)
  const activeCanvasId = useActiveCanvasId()

  // Live-preview the font size as a CSS var on the tweet card while dragging,
  // so the canvas updates instantly without waiting for the store commit.
  // See backdrop-section.tsx for the same pattern.
  const getTweetCardEl = React.useCallback((): HTMLElement | null => {
    if (typeof document === "undefined" || !activeCanvasId) return null
    return document.querySelector(
      `[data-canvas-id="${activeCanvasId}"] [data-tweet-card]`
    )
  }, [activeCanvasId])
  const setFontSizePreviewVar = React.useCallback(
    (value: string | null) => {
      const el = getTweetCardEl()
      if (!el) return
      if (value === null) el.style.removeProperty("--tweet-font-size-preview")
      else el.style.setProperty("--tweet-font-size-preview", value)
    },
    [getTweetCardEl]
  )
  const clearFontSizePreviewVarAfterPaint = React.useCallback(() => {
    if (typeof requestAnimationFrame === "undefined") return
    requestAnimationFrame(() => setFontSizePreviewVar(null))
  }, [setFontSizePreviewVar])

  if (!tweet) return null

  return (
    <div className="space-y-3">
      <Row label="Theme">
        <TweetThemeSelect
          value={tweet.theme}
          onValueChange={(theme) => updateTweet({ theme })}
        />
      </Row>

      <Row label="Show avatar">
        <Switch
          checked={tweet.showAvatar}
          onCheckedChange={(v) => updateTweet({ showAvatar: v })}
        />
      </Row>
      <Row label="Images">
        <Switch
          checked={tweet.showImages ?? true}
          onCheckedChange={(v) => updateTweet({ showImages: v })}
        />
      </Row>
      <Row label="Stats">
        <Switch
          checked={tweet.showMetrics}
          onCheckedChange={(v) => updateTweet({ showMetrics: v })}
        />
      </Row>
      <Row label="Date & time">
        <Switch
          checked={tweet.showTimestamp ?? true}
          onCheckedChange={(v) => updateTweet({ showTimestamp: v })}
        />
      </Row>
      {tweet.data.quotedTweet ? (
        <Row label="Quoted post">
          <Switch
            checked={tweet.showQuote ?? true}
            onCheckedChange={(v) => updateTweet({ showQuote: v })}
          />
        </Row>
      ) : null}
      <Row label="Font">
        <TweetFontSelect
          value={tweet.fontFamily ?? DEFAULT_TWEET_SETTINGS.fontFamily}
          onValueChange={(fontFamily) => updateTweet({ fontFamily })}
        />
      </Row>
      <EffectSlider
        label="Font size"
        value={tweet.fontSize ?? DEFAULT_TWEET_SETTINGS.fontSize}
        onChange={(fontSize) => {
          clearFontSizePreviewVarAfterPaint()
          updateTweet({ fontSize })
        }}
        onPreview={(v) => setFontSizePreviewVar(`${v}px`)}
        min={MIN_TWEET_FONT_SIZE}
        max={MAX_TWEET_FONT_SIZE}
        step={1}
        suffix="px"
      />
    </div>
  )
}
