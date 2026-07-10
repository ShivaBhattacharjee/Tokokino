"use client"

import { AnimatePresence, motion } from "motion/react"
import { RiAddCircleLine, RiImageAddLine } from "@remixicon/react"

import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
} from "@/lib/editor/animation-timeline"
import { cn } from "@/lib/utils"

import { AnimateControls } from "./animate-controls"
import { ClipTransitionButton } from "./clip-transition-toolbar"
import { RAZOR_CURSOR, TimelineClip } from "./timeline-clip"
import { TimelineRuler } from "./timeline-ruler"
import { useAnimateTimeline } from "./use-animate-timeline"

export function AnimateBar() {
  const {
    pxFor,
    durationMs,
    playheadMs,
    audio,
    isPlaying,
    canRazor,
    razorMode,
    requestExit,
    onAudioButton,
    onPickAudio,
    audioInputRef,
    addClip,
    toggle,
    toggleRazor,
    reset,
    scrollRef,
    contentWidth,
    onScrubDown,
    onScrubMove,
    onScrubUp,
    ticks,
    trackRef,
    onDurationHandleDown,
    onDurationHandleMove,
    onDurationHandleUp,
    isDurationDragging,
    clipsRowRef,
    onClipsRowMove,
    onClipsRowLeave,
    onClipsRowClick,
    ghostVisible,
    ghostRef,
    ghostWidthPx,
    clips,
    selectedClipId,
    selectedClip,
    updateAnimationClip,
    draggingClipId,
    interactingClipId,
    clipsAnimated,
    resolveClipImages,
    resolveClipIcons,
    dupShortcut,
    clearEffectsShortcut,
    deselectShortcut,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
    duplicateClip,
    clearClipEffects,
    deselectClip,
    deleteClip,
    onClipMenuOpenChange,
    screenshotInputRef,
    onPickScreenshot,
    layers,
    onLayerClick,
  } = useAnimateTimeline()

  return (
    <motion.div
      // Slide up + fade + settle in on enter; reverse on exit (played via the
      // AnimatePresence wrapping this in the editor page).
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 rounded-2xl border border-border/70 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <AnimateControls
        audio={audio}
        isPlaying={isPlaying}
        playheadMs={playheadMs}
        durationMs={durationMs}
        canRazor={canRazor}
        razorActive={razorMode}
        onExit={requestExit}
        onToggleAudio={onAudioButton}
        onPickAudio={onPickAudio}
        audioInputRef={audioInputRef}
        onAddClip={addClip}
        onTogglePlay={toggle}
        onToggleRazor={toggleRazor}
        onReset={reset}
        transitionControl={
          selectedClip ? (
            <ClipTransitionButton
              clip={selectedClip}
              onUpdate={(patch) => updateAnimationClip(selectedClip.id, patch)}
              disabled={isPlaying}
            />
          ) : null
        }
      />

      {/* Scrollable timeline — ruler + tracks share one horizontal scroll so
          they stay aligned. */}
      <div
        ref={scrollRef}
        className="mt-3 [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative" style={{ width: contentWidth }}>
          {/* Click / drag anywhere on the ruler to move the playhead. Shares
              the same scrub handlers as the track (both start at left 0). */}
          <div
            className="cursor-pointer touch-none select-none"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
            <TimelineRuler
              ticks={ticks}
              durationMs={durationMs}
              pxFor={pxFor}
            />
          </div>

          {/* Tracks + playhead */}
          <div
            ref={trackRef}
            className="relative mt-1 cursor-pointer touch-none select-none"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
            {/* Inactive region — everything past the current duration is dimmed
                with a diagonal hatch AND blurred so it reads as "outside" the
                timeline (it won't play). Sits ABOVE the clips (below the playhead
                z-40 and duration handle z-30) and blurs them via backdrop-filter,
                so a clip that STRADDLES the duration has just its overflow portion
                blurred while its playable portion stays sharp. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-2 bottom-0 z-25 rounded-r-lg [--tl-dim:rgba(0,0,0,0.05)] [--tl-hatch:rgba(0,0,0,0.05)] dark:[--tl-dim:rgba(0,0,0,0.28)] dark:[--tl-hatch:rgba(255,255,255,0.03)]"
              style={{
                left: pxFor(durationMs),
                right: 0,
                backgroundColor: "var(--tl-dim)",
                backgroundImage:
                  "repeating-linear-gradient(-45deg, var(--tl-hatch) 0 1px, transparent 1px 9px)",
                backdropFilter: "blur(2px) saturate(0.6)",
                WebkitBackdropFilter: "blur(2px) saturate(0.6)",
              }}
            />

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
              onPointerDown={onDurationHandleDown}
              onPointerMove={onDurationHandleMove}
              onPointerUp={onDurationHandleUp}
              onPointerCancel={onDurationHandleUp}
              role="slider"
              aria-label="Timeline duration"
              aria-valuemin={Math.round(MIN_DURATION_MS / 1000)}
              aria-valuemax={MAX_DURATION_MS / 1000}
              aria-valuenow={Math.round(durationMs / 1000)}
              className="group absolute -top-2 bottom-0 z-30 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
              style={{ left: pxFor(durationMs) }}
            >
              <div
                className={cn(
                  "rounded-full transition-all duration-150",
                  isDurationDragging
                    ? "h-full w-1 bg-primary"
                    : "h-[calc(100%-1rem)] w-[3px] bg-foreground/30 group-hover:h-full group-hover:w-1 group-hover:bg-primary"
                )}
              />
            </div>

            {/* Motion clips row — spans the current duration so the end handle
                sits right at its edge. A pointer-driven scrubbing surface; clip
                editing has keyboard shortcuts, so there's no keyboard listener
                on the row itself. */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              ref={clipsRowRef}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={onClipsRowMove}
              onPointerLeave={onClipsRowLeave}
              onClick={onClipsRowClick}
              className={cn(
                // overflow-visible so clips appended past the set duration can
                // render out into the dimmed region to the right.
                "relative h-11 overflow-visible rounded-lg border border-border/50 bg-background/40",
                ghostVisible && "cursor-copy"
              )}
              style={{
                width: pxFor(durationMs),
                ...(razorMode ? { cursor: RAZOR_CURSOR } : null),
              }}
            >
              {/* Cursor-following add affordance (position written via transform
                  in the move handler — no React re-render, so it can't lag). */}
              <div
                ref={ghostRef}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1 bottom-1 left-0 z-10 box-border flex items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-primary/60 bg-primary/10 px-1 text-[11px] font-medium text-primary backdrop-blur-sm transition-opacity duration-150 ease-out will-change-transform",
                  ghostVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ width: ghostWidthPx }}
              >
                <RiAddCircleLine className="size-4 shrink-0" />
                {ghostWidthPx >= 92 && (
                  <span className="truncate">Animation</span>
                )}
              </div>

              <AnimatePresence>
                {clips.map((clip) => (
                  <TimelineClip
                    key={clip.id}
                    clip={clip}
                    left={pxFor(clip.startMs)}
                    width={pxFor(clip.durationMs)}
                    selected={clip.id === selectedClipId}
                    dragging={clip.id === draggingClipId}
                    beyond={clip.startMs >= durationMs}
                    razorMode={razorMode}
                    interacting={
                      clip.id === interactingClipId || !clipsAnimated
                    }
                    images={resolveClipImages(clip)}
                    iconKeys={resolveClipIcons(clip)}
                    dupShortcut={dupShortcut}
                    clearEffectsShortcut={clearEffectsShortcut}
                    deselectShortcut={deselectShortcut}
                    onPointerDownClip={(e, mode) =>
                      onClipPointerDown(e, clip, mode)
                    }
                    onPointerMoveClip={onClipPointerMove}
                    onPointerUpClip={onClipPointerUp}
                    onDuplicate={() => duplicateClip(clip.id)}
                    onClearEffects={() => clearClipEffects(clip.id)}
                    onDeselect={deselectClip}
                    onDelete={() => deleteClip(clip.id)}
                    onMenuOpenChange={onClipMenuOpenChange}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Base image rows — one per image on the canvas (the main
                screenshot plus each extra slot). The track background spans the
                full duration; the label/thumbnail is sticky so it stays pinned
                to the left while the timeline scrolls. Click a thumbnail to
                set/replace that layer's image. */}
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickScreenshot}
            />
            {layers.map((layer, i) => {
              return (
                <div
                  key={layer.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="relative mt-1 flex h-11 items-center rounded-lg border border-border/50 bg-background/40"
                  style={{ width: pxFor(durationMs) }}
                >
                  {/* Sticky label — follows the horizontal scroll's left edge. */}
                  <div className="sticky left-0 z-10 flex items-center gap-2 px-2">
                    <button
                      type="button"
                      aria-label={`Change screenshot ${i + 1}`}
                      onClick={() => onLayerClick(layer.id)}
                      className="relative h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded outline-none"
                    >
                      {layer.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={layer.src}
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
                        {`Screenshot ${i + 1}`}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
