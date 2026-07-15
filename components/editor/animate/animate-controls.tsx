"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiMoreLine,
  RiPauseFill,
  RiPlayFill,
  RiResetLeftLine,
  RiScissorsCutLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatShort, formatTime } from "@/lib/editor/animation-timeline"
import { cn } from "@/lib/utils"

type AnimateControlsProps = {
  isPlaying: boolean
  playheadMs: number
  durationMs: number
  canRazor: boolean
  razorActive: boolean
  /** Whether the canvas video exists and carries an audio track. */
  canMuteVideo: boolean
  videoMuted: boolean
  onToggleVideoMute: () => void
  onExit: () => void
  onAddClip: () => void
  onTogglePlay: () => void
  onToggleRazor: () => void
  onReset: () => void
  /** Selected clip's transition button — only present while a clip is selected. */
  transitionControl?: React.ReactNode
}

const iconButton =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"

export function AnimateControls({
  isPlaying,
  playheadMs,
  durationMs,
  canRazor,
  razorActive,
  canMuteVideo,
  videoMuted,
  onToggleVideoMute,
  onExit,
  onAddClip,
  onTogglePlay,
  onToggleRazor,
  onReset,
  transitionControl,
}: AnimateControlsProps) {
  return (
    // Roomy: equal `1fr` side columns keep the center cluster centered whatever
    // the sides hold, so the transition button appearing never shifts it. They
    // must stay `1fr` (auto minimum) and not `minmax(0,1fr)` — a collapsible
    // column plus `justify-end` makes the right cell overflow leftward, on top
    // of the center controls.
    //
    // Compact: equal side columns are unaffordable, since the left cell (one
    // 32px arrow) would have to match the right cell carrying the pill and the
    // timecode. Below 52rem the secondary tools move into the overflow menu and
    // the row falls back to justify-between, which packs to actual content.
    <div className="@container">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 @max-[52rem]:flex @max-[52rem]:justify-between">
        <div className="flex items-center">
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit animate"
            className={cn(
              iconButton,
              "bg-foreground/8 text-foreground hover:bg-foreground/15"
            )}
          >
            <RiArrowLeftLine className="size-[18px]" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleVideoMute}
            disabled={!canMuteVideo}
            aria-label={videoMuted ? "Unmute video" : "Mute video"}
            title={
              canMuteVideo
                ? videoMuted
                  ? "Unmute video"
                  : "Mute video"
                : "No audio"
            }
            className={cn(
              iconButton,
              "@max-[52rem]:hidden",
              !canMuteVideo
                ? "cursor-not-allowed text-muted-foreground/40"
                : videoMuted
                  ? "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
                  : "bg-foreground/8 text-foreground hover:bg-foreground/15"
            )}
          >
            {!canMuteVideo || videoMuted ? (
              <RiVolumeMuteLine className="size-[18px]" />
            ) : (
              <RiVolumeUpLine className="size-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={onAddClip}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-foreground/8 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15"
          >
            <RiAddLine className="size-4" />
            Animation
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-8 w-16 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
          >
            {isPlaying ? (
              <RiPauseFill className="size-4" />
            ) : (
              <RiPlayFill className="size-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleRazor}
            disabled={!canRazor}
            aria-pressed={razorActive}
            aria-label="Cut tool"
            title={
              razorActive
                ? "Cut tool on — click a clip to split (S)"
                : "Cut tool — split clips (S)"
            }
            className={cn(
              iconButton,
              "@max-[52rem]:hidden",
              !canRazor
                ? "cursor-not-allowed text-muted-foreground/40"
                : razorActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-foreground/10"
            )}
          >
            <RiScissorsCutLine className="size-[18px]" />
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset"
            title="Reset playhead"
            className={cn(
              iconButton,
              "text-foreground hover:bg-foreground/10 @max-[52rem]:hidden"
            )}
          >
            <RiResetLeftLine className="size-[18px]" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More tools"
              className={cn(
                iconButton,
                "text-foreground hover:bg-foreground/10 data-[state=open]:bg-foreground/10 @min-[52rem]:hidden"
              )}
            >
              <RiMoreLine className="size-[18px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={8}>
              <DropdownMenuItem
                onSelect={onToggleVideoMute}
                disabled={!canMuteVideo}
              >
                {!canMuteVideo || videoMuted ? (
                  <RiVolumeMuteLine />
                ) : (
                  <RiVolumeUpLine />
                )}
                {!canMuteVideo
                  ? "No audio"
                  : videoMuted
                    ? "Unmute video"
                    : "Mute video"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onToggleRazor} disabled={!canRazor}>
                <RiScissorsCutLine />
                {razorActive ? "Cut tool on" : "Cut tool"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onReset}>
                <RiResetLeftLine />
                Reset playhead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-end gap-2">
          {transitionControl}
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatTime(playheadMs)} / {formatShort(durationMs)}
          </span>
        </div>
      </div>
    </div>
  )
}
