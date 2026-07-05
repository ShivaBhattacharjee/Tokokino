"use client"

import { motion } from "motion/react"
import { RiAddCircleLine, RiImageAddLine } from "@remixicon/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
} from "@/lib/editor/animation-timeline"
import { cn } from "@/lib/utils"

import { AnimateControls } from "./animate-controls"
import { TimelineClip } from "./timeline-clip"
import { TimelineRuler } from "./timeline-ruler"
import { useAnimateTimeline } from "./use-animate-timeline"

export function AnimateBar() {
  const t = useAnimateTimeline()
  const { pxFor, durationMs, playheadMs, lastClipEnd } = t

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 rounded-2xl border border-border/70 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <AlertDialog open={t.confirmExitOpen} onOpenChange={t.setConfirmExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave animate mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Your animation timeline{t.audio ? " and audio" : ""} will be
              discarded. This can be undone from the editor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={t.confirmExit}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Discard &amp; exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimateControls
        audio={t.audio}
        isPlaying={t.isPlaying}
        playheadMs={playheadMs}
        durationMs={durationMs}
        canDelete={Boolean(t.selectedClipId)}
        onExit={t.requestExit}
        onToggleAudio={t.onAudioButton}
        onPickAudio={t.onPickAudio}
        audioInputRef={t.audioInputRef}
        onAddClip={t.addClip}
        onTogglePlay={t.toggle}
        onDeleteSelected={t.deleteSelectedClip}
        onReset={t.reset}
      />

      {/* Scrollable timeline — ruler + tracks share one horizontal scroll so
          they stay aligned. */}
      <div
        ref={t.scrollRef}
        className="mt-3 [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative" style={{ width: t.contentWidth }}>
          {/* Click / drag anywhere on the ruler to move the playhead. Shares
              the same scrub handlers as the track (both start at left 0). */}
          <div
            className="cursor-pointer touch-none select-none"
            onPointerDown={t.onScrubDown}
            onPointerMove={t.onScrubMove}
            onPointerUp={t.onScrubUp}
            onPointerCancel={t.onScrubUp}
          >
            <TimelineRuler
              ticks={t.ticks}
              durationMs={durationMs}
              pxFor={pxFor}
            />
          </div>

          {/* Tracks + playhead */}
          <div
            ref={t.trackRef}
            className="relative mt-1 cursor-pointer touch-none select-none"
            onPointerDown={t.onScrubDown}
            onPointerMove={t.onScrubMove}
            onPointerUp={t.onScrubUp}
            onPointerCancel={t.onScrubUp}
          >
            {/* Playhead — the knob is grabbable; the thin line isn't so it
                doesn't block clip interactions underneath. */}
            <div
              className="pointer-events-none absolute -top-2 bottom-0 z-40 w-[2px] -translate-x-1/2 bg-primary"
              style={{ left: pxFor(Math.min(playheadMs, durationMs)) }}
            >
              <div className="pointer-events-auto absolute -top-2 left-1/2 flex h-4 w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-[3px] bg-primary shadow-sm">
                <div className="h-2 w-px bg-white/70" />
              </div>
            </div>

            {/* Duration end handle — drag to lengthen/shorten the timeline. */}
            <div
              onPointerDown={t.onDurationHandleDown}
              onPointerMove={t.onDurationHandleMove}
              onPointerUp={t.onDurationHandleUp}
              onPointerCancel={t.onDurationHandleUp}
              role="slider"
              aria-label="Timeline duration"
              aria-valuemin={Math.round(
                Math.max(MIN_DURATION_MS, lastClipEnd) / 1000
              )}
              aria-valuemax={MAX_DURATION_MS / 1000}
              aria-valuenow={Math.round(durationMs / 1000)}
              className="group absolute -top-2 bottom-0 z-30 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
              style={{ left: pxFor(durationMs) }}
            >
              <div
                className={cn(
                  "rounded-full transition-all duration-150",
                  t.isDurationDragging
                    ? "h-full w-1 bg-primary"
                    : "h-[calc(100%-1rem)] w-[3px] bg-foreground/30 group-hover:h-full group-hover:w-1 group-hover:bg-primary"
                )}
              />
            </div>

            {/* Motion clips row — spans the current duration so the end handle
                sits right at its edge. */}
            <div
              ref={t.clipsRowRef}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={t.onClipsRowMove}
              onPointerLeave={t.onClipsRowLeave}
              onClick={t.onClipsRowClick}
              className={cn(
                "relative h-11 overflow-hidden rounded-lg border border-border/50 bg-background/40",
                t.ghostVisible && "cursor-copy"
              )}
              style={{ width: pxFor(durationMs) }}
            >
              {/* Cursor-following add affordance (position written via transform
                  in the move handler — no React re-render, so it can't lag). */}
              <div
                ref={t.ghostRef}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1 bottom-1 left-0 z-10 box-border flex items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-primary/60 bg-primary/10 px-1 text-[11px] font-medium text-primary backdrop-blur-sm transition-opacity duration-150 ease-out will-change-transform",
                  t.ghostVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ width: t.ghostWidthPx }}
              >
                <RiAddCircleLine className="size-4 shrink-0" />
                {t.ghostWidthPx >= 92 && (
                  <span className="truncate">Animation</span>
                )}
              </div>

              {t.clips.map((clip) => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  left={pxFor(clip.startMs)}
                  width={pxFor(clip.durationMs)}
                  selected={clip.id === t.selectedClipId}
                  dragging={clip.id === t.draggingClipId}
                  interacting={
                    clip.id === t.interactingClipId || !t.clipsAnimated
                  }
                  screenshot={t.screenshot}
                  dupShortcut={t.dupShortcut}
                  onPointerDownClip={(e, mode) =>
                    t.onClipPointerDown(e, clip, mode)
                  }
                  onPointerMoveClip={t.onClipPointerMove}
                  onPointerUpClip={t.onClipPointerUp}
                  onSelect={() => t.selectClip(clip.id)}
                  onDuplicate={() => t.duplicateClip(clip.id)}
                  onDelete={() => t.deleteClip(clip.id)}
                  onMenuOpenChange={t.onClipMenuOpenChange}
                />
              ))}
            </div>

            {/* Base image row — the track background spans the full duration,
                but the label/thumbnail is sticky so it stays pinned to the left
                while the timeline scrolls. Only the thumbnail image is clickable
                (click it to replace the screenshot). */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="relative mt-1 flex h-11 items-center rounded-lg border border-border/50 bg-background/40"
              style={{ width: pxFor(durationMs) }}
            >
              <input
                ref={t.screenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={t.onPickScreenshot}
              />
              {/* Sticky label — follows the horizontal scroll's left edge. */}
              <div className="sticky left-0 z-10 flex items-center gap-2 px-2">
                <button
                  type="button"
                  aria-label="Change screenshot"
                  onClick={t.onBaseLayerClick}
                  className="relative h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded outline-none"
                >
                  {t.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.screenshot}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-foreground/10">
                      <RiImageAddLine className="size-4 text-muted-foreground" />
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[11px] text-muted-foreground">
                    Mockup
                  </span>
                  <span className="truncate text-[13px] font-medium text-foreground">
                    Screenshot
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
