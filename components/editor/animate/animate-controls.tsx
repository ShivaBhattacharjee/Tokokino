"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiPauseFill,
  RiPlayFill,
  RiResetLeftLine,
  RiScissorsCutLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import type { AnimationAudio } from "@/lib/editor/state-types"
import { formatShort, formatTime } from "@/lib/editor/animation-timeline"
import { cn } from "@/lib/utils"

type AnimateControlsProps = {
  audio: AnimationAudio | null
  isPlaying: boolean
  playheadMs: number
  durationMs: number
  canRazor: boolean
  razorActive: boolean
  onExit: () => void
  onToggleAudio: () => void
  onPickAudio: (e: React.ChangeEvent<HTMLInputElement>) => void
  audioInputRef: React.RefObject<HTMLInputElement | null>
  onAddClip: () => void
  onTogglePlay: () => void
  onToggleRazor: () => void
  onReset: () => void
  /** Selected clip's transition button — only present while a clip is selected. */
  transitionControl?: React.ReactNode
}

const iconButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"

export function AnimateControls({
  audio,
  isPlaying,
  playheadMs,
  durationMs,
  canRazor,
  razorActive,
  onExit,
  onToggleAudio,
  onPickAudio,
  audioInputRef,
  onAddClip,
  onTogglePlay,
  onToggleRazor,
  onReset,
  transitionControl,
}: AnimateControlsProps) {
  return (
    // 3-column grid: the center controls stay centered no matter what the side
    // cells hold, so the transition button appearing on the right never shifts
    // the play controls (a plain flex + mx-auto re-centered on every toggle).
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickAudio}
      />

      <div className="flex items-center justify-self-start">
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
          onClick={onToggleAudio}
          aria-label={audio ? (audio.muted ? "Unmute" : "Mute") : "Add music"}
          title={audio ? audio.name : "Add music"}
          className={cn(
            iconButton,
            audio && !audio.muted
              ? "bg-foreground/8 text-foreground hover:bg-foreground/15"
              : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
          )}
        >
          {audio && !audio.muted ? (
            <RiVolumeUpLine className="size-[18px]" />
          ) : (
            <RiVolumeMuteLine className="size-[18px]" />
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
          className={cn(iconButton, "text-foreground hover:bg-foreground/10")}
        >
          <RiResetLeftLine className="size-[18px]" />
        </button>
      </div>

      {/* Right cell: the selected clip's transition control on the left, then
          the playhead / total-duration readout on the right. Its own grid column
          so it never moves the centered controls. */}
      <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">
        {transitionControl}
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatTime(playheadMs)} / {formatShort(durationMs)}
        </span>
      </div>
    </div>
  )
}
