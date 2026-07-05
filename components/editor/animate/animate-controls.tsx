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
  canDelete: boolean
  onExit: () => void
  onToggleAudio: () => void
  onPickAudio: (e: React.ChangeEvent<HTMLInputElement>) => void
  audioInputRef: React.RefObject<HTMLInputElement | null>
  onAddClip: () => void
  onTogglePlay: () => void
  onDeleteSelected: () => void
  onReset: () => void
}

const iconButton =
  "flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors"

export function AnimateControls({
  audio,
  isPlaying,
  playheadMs,
  durationMs,
  canDelete,
  onExit,
  onToggleAudio,
  onPickAudio,
  audioInputRef,
  onAddClip,
  onTogglePlay,
  onDeleteSelected,
  onReset,
}: AnimateControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickAudio}
      />

      <button
        type="button"
        onClick={onExit}
        aria-label="Exit animate"
        className={cn(
          iconButton,
          "bg-foreground/8 text-foreground hover:bg-foreground/15"
        )}
      >
        <RiArrowLeftLine className="size-5" />
      </button>

      <div className="mx-auto flex items-center gap-2">
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
            <RiVolumeUpLine className="size-5" />
          ) : (
            <RiVolumeMuteLine className="size-5" />
          )}
        </button>

        <button
          type="button"
          onClick={onAddClip}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground/8 px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15"
        >
          <RiAddLine className="size-4" />
          Animation
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-24 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
        >
          {isPlaying ? (
            <RiPauseFill className="size-4" />
          ) : (
            <RiPlayFill className="size-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!canDelete}
          aria-label="Delete selected clip"
          title="Delete selected clip"
          className={cn(
            iconButton,
            canDelete
              ? "text-foreground hover:bg-foreground/10"
              : "cursor-not-allowed text-muted-foreground/40"
          )}
        >
          <RiScissorsCutLine className="size-5" />
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Reset"
          title="Reset playhead"
          className={cn(iconButton, "text-foreground hover:bg-foreground/10")}
        >
          <RiResetLeftLine className="size-5" />
        </button>
      </div>

      <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {formatTime(playheadMs)} / {formatShort(durationMs)}
      </span>
    </div>
  )
}
