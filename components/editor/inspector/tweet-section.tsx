"use client"

import * as React from "react"

import { Switch } from "@/components/ui/switch"
import {
  TweetFontSelect,
  TweetThemeSelect,
} from "@/components/editor/tweet-font-select"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"
import { DEFAULT_TWEET_SETTINGS } from "@/lib/editor/tweet-settings"

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
      <Row label="Font">
        <TweetFontSelect
          value={tweet.fontFamily ?? DEFAULT_TWEET_SETTINGS.fontFamily}
          onValueChange={(fontFamily) => updateTweet({ fontFamily })}
        />
      </Row>
    </div>
  )
}
