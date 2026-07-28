"use client"

import * as React from "react"
import {
  RiBlueskyLine,
  RiBrushLine,
  RiDragMove2Line,
  RiLayoutGrid2Line,
  RiMoonClearLine,
  RiPaletteLine,
  RiRotateLockLine,
  RiSunLine,
  RiTwitterXLine,
} from "@remixicon/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useAnimationIsPlaying } from "@/hooks/use-animation-player"
import { useActiveCanvasField } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { BackdropSection } from "./inspector/backdrop-section"
import { BackgroundSection } from "./inspector/background-section"
import { BorderSection } from "./inspector/border-section"
import { PaddingSection } from "./inspector/padding-section"
import { PositionSection } from "./inspector/position-section"
import { Section } from "./inspector/primitives"
import { ShadowSection } from "./inspector/shadow-section"
import { TiltSection } from "./inspector/tilt-section"
import { TweetSection } from "./inspector/tweet-section"

export function Inspector({
  className,
  animateMode = false,
}: {
  className?: string
  animateMode?: boolean
}) {
  const frameId = useActiveCanvasField((c) => c.frame.id)
  const hasTweet = useActiveCanvasField((c) => c.tweet !== null)
  const tweetSource = useActiveCanvasField((c) => c.tweet?.data.source ?? "x")
  const screenshotBoxCount = useActiveCanvasField(
    (c) => (c.screenshot ? 1 : 0) + c.screenshotSlots.length
  )
  // Styling the canvas mid-playback fights the animation (and lands halfway
  // through a transition), so the whole panel goes inert until playback stops.
  const isPlaying = useAnimationIsPlaying()
  const hasDeviceFrame = frameId !== "none"
  // A device frame and screenshot padding are screenshot-only concepts; the
  // tweet card is styled through its own section instead.
  const showPadding = !hasTweet && screenshotBoxCount <= 1

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[260px] shrink-0 flex-col overflow-hidden border-l border-dashed border-border/70 bg-sidebar xl:w-[308px]",
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3 xl:px-4">
        <span className="text-[13px] font-medium tracking-tight">Tools</span>
        {isPlaying ? (
          <span className="text-[11px] text-muted-foreground">Playing</span>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          inert={isPlaying}
          className={cn(
            "px-3 py-3 pb-24 transition-opacity xl:px-4",
            isPlaying && "opacity-40"
          )}
        >
          {animateMode ? (
            <>
              <Section icon={RiDragMove2Line} title="Position" defaultOpen>
                <PositionSection />
              </Section>
              <div className="my-3 h-px bg-border/50" />
            </>
          ) : null}

          {hasTweet ? (
            <>
              <Section
                icon={
                  tweetSource === "bluesky" ? RiBlueskyLine : RiTwitterXLine
                }
                title={tweetSource === "bluesky" ? "Bluesky Post" : "X Post"}
                defaultOpen
              >
                <TweetSection />
              </Section>
              <div className="my-3 h-px bg-border/50" />
            </>
          ) : null}

          <Section icon={RiPaletteLine} title="Background" defaultOpen>
            <BackgroundSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiSunLine} title="Backdrop">
            <BackdropSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          {!hasDeviceFrame && !hasTweet ? (
            <>
              <Section icon={RiBrushLine} title="Border" defaultOpen>
                <BorderSection />
              </Section>
              <div className="my-3 h-px bg-border/50" />
            </>
          ) : null}

          {showPadding ? (
            <>
              <Section icon={RiLayoutGrid2Line} title="Padding" defaultOpen>
                <PaddingSection />
              </Section>
              <div className="my-3 h-px bg-border/50" />
            </>
          ) : null}

          <Section icon={RiRotateLockLine} title="Tilt & Scale" defaultOpen>
            <TiltSection />
          </Section>
          <div className="my-3 h-px bg-border/50" />

          <Section icon={RiMoonClearLine} title="Shadow" defaultOpen>
            <ShadowSection />
          </Section>
        </div>
      </ScrollArea>
    </aside>
  )
}
