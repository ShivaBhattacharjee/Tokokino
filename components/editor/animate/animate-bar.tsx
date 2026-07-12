"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  RiAddCircleLine,
  RiDeleteBinLine,
  RiImageAddLine,
  RiVidiconFill,
} from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
} from "@/lib/editor/animation-timeline"
import { getVideoMutedPreferenceSync } from "@/lib/editor/video-mute-preference"
import { cn } from "@/lib/utils"

import { AnimateControls } from "./animate-controls"
import { ClipTransitionButton } from "./clip-transition-toolbar"
import { TimelineClip } from "./timeline-clip"
import { RAZOR_CURSOR } from "./timeline-clip-interactions"
import { TimelineVideoClip } from "./timeline-video-clip"
import { TimelineRuler } from "./timeline-ruler"
import { useAnimateTimeline } from "./use-animate-timeline"

export function AnimateBar() {
  const {
    pxFor,
    durationMs,
    playheadMs,
    isPlaying,
    canRazor,
    razorMode,
    requestExit,
    videoMuted,
    canMuteVideo,
    onToggleVideoMute,
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
    onClipsRowPointerDown,
    onClipsRowPointerUp,
    marqueeRect,
    ghostVisible,
    ghostRef,
    ghostWidthPx,
    clips,
    highlightedClipIds,
    selectedClip,
    selectedClipIds,
    selectedVideoClipIds,
    videoSelected,
    trimmingVideo,
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
    deleteSelectedClip,
    onClipMenuOpenChange,
    onVideoMenuOpenChange,
    screenshotInputRef,
    onPickScreenshot,
    layers,
    onLayerClick,
    onVideoPointerDown,
    onVideoPointerMove,
    onVideoPointerUp,
    videoRowRef,
    videoMarqueeRect,
    onVideoRowPointerDown,
    onVideoRowPointerMove,
    onVideoRowPointerUp,
    deleteVideo,
    duplicateVideo,
    toggleVideoClipMute,
    copyVideoClip,
    deselectVideo,
  } = useAnimateTimeline()

  const selectionEffectCount = clips.filter(
    (c) => highlightedClipIds.includes(c.id) && (c.effects?.length ?? 0) > 0
  ).length
  const selectedCount = selectedClipIds.length
  const hasSelection = selectedCount > 0 || videoSelected
  const deleteLabel = videoSelected
    ? "Delete video"
    : selectedCount > 1
      ? `Delete ${selectedCount} keyframes`
      : "Delete keyframe"

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 rounded-2xl border border-border/70 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <AnimateControls
        isPlaying={isPlaying}
        playheadMs={playheadMs}
        durationMs={durationMs}
        canRazor={canRazor}
        razorActive={razorMode}
        canMuteVideo={canMuteVideo}
        videoMuted={videoMuted}
        onToggleVideoMute={onToggleVideoMute}
        onExit={requestExit}
        onAddClip={addClip}
        onTogglePlay={toggle}
        onToggleRazor={toggleRazor}
        onReset={reset}
        transitionControl={
          hasSelection ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={deleteLabel}
                    disabled={isPlaying}
                    onClick={
                      videoSelected ? () => deleteVideo() : deleteSelectedClip
                    }
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  >
                    <RiDeleteBinLine className="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {deleteLabel}
                  <kbd
                    data-slot="kbd"
                    className="rounded border border-border/60 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    del
                  </kbd>
                </TooltipContent>
              </Tooltip>
              {selectedClip && !videoSelected ? (
                <ClipTransitionButton
                  clip={selectedClip}
                  onUpdate={(patch) =>
                    updateAnimationClip(selectedClip.id, patch)
                  }
                  disabled={isPlaying}
                />
              ) : null}
            </>
          ) : null
        }
      />

      <div
        ref={scrollRef}
        className="mt-3 [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative" style={{ width: contentWidth }}>
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

          <div
            ref={trackRef}
            className="relative mt-1 cursor-pointer touch-none select-none"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
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

            <div
              className="pointer-events-none absolute -top-2 bottom-0 z-40 w-[2px] -translate-x-1/2 bg-primary"
              style={{ left: pxFor(Math.min(playheadMs, durationMs)) }}
            >
              <div className="pointer-events-auto absolute -top-2 left-1/2 flex h-4 w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-[3px] bg-primary shadow-sm">
                <div className="h-2 w-px bg-white/70" />
              </div>
            </div>

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

            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              ref={clipsRowRef}
              onPointerDown={onClipsRowPointerDown}
              onPointerMove={onClipsRowMove}
              onPointerUp={onClipsRowPointerUp}
              onPointerLeave={onClipsRowLeave}
              onClick={onClipsRowClick}
              className={cn(
                "relative h-11 touch-none overflow-visible rounded-lg border border-border/50 bg-background/40",
                ghostVisible && "cursor-copy"
              )}
              style={{
                width: pxFor(durationMs),
                ...(razorMode ? { cursor: RAZOR_CURSOR } : null),
              }}
            >
              {marqueeRect && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 z-0 rounded-md border border-primary/70 bg-primary/15"
                  style={{
                    left: marqueeRect.left,
                    width: marqueeRect.width,
                  }}
                />
              )}
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
                    selected={highlightedClipIds.includes(clip.id)}
                    selectedCount={
                      highlightedClipIds.includes(clip.id)
                        ? highlightedClipIds.length
                        : 1
                    }
                    selectionEffectCount={selectionEffectCount}
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

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={onPickScreenshot}
            />
            {layers.map((layer, i) => {
              const strip = layer.isVideo ? layer.filmstrip : null
              const rowWidth = pxFor(durationMs)

              if (layer.isVideo) {
                const tileWidth = Math.max(
                  24,
                  Math.round(44 * (strip?.aspect ?? 16 / 9))
                )
                return (
                  <div
                    key={layer.id}
                    ref={videoRowRef}
                    onPointerDown={onVideoRowPointerDown}
                    onPointerMove={onVideoRowPointerMove}
                    onPointerUp={onVideoRowPointerUp}
                    onPointerCancel={onVideoRowPointerUp}
                    className="relative mt-1 h-11"
                    style={{ width: contentWidth }}
                  >
                    {videoMarqueeRect && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-0 rounded-md border border-primary/70 bg-primary/15"
                        style={{
                          left: videoMarqueeRect.left,
                          width: videoMarqueeRect.width,
                        }}
                      />
                    )}
                    {layer.videoClips.map((clip) => {
                      const clipWidth = pxFor(clip.endMs - clip.startMs)
                      const tileCount = strip
                        ? Math.max(1, Math.ceil(clipWidth / tileWidth))
                        : 0
                      return (
                        <TimelineVideoClip
                          key={clip.id}
                          left={pxFor(clip.timelineStartMs)}
                          width={clipWidth}
                          selected={selectedVideoClipIds.includes(clip.id)}
                          trimming={trimmingVideo && videoSelected}
                          razorMode={razorMode}
                          muted={clip.muted ?? getVideoMutedPreferenceSync()}
                          onPointerDownClip={(event, mode) =>
                            onVideoPointerDown(event, clip.id, mode)
                          }
                          onPointerMoveClip={onVideoPointerMove}
                          onPointerUpClip={onVideoPointerUp}
                          onDelete={() => deleteVideo(clip.id)}
                          onDuplicate={() => duplicateVideo(clip.id)}
                          onCopy={() => copyVideoClip(clip.id)}
                          onToggleMute={() => toggleVideoClipMute(clip.id)}
                          onDeselect={deselectVideo}
                          onMenuOpenChange={onVideoMenuOpenChange}
                        >
                          {strip && strip.frames.length > 0 ? (
                            <>
                              <div
                                aria-hidden
                                className="absolute inset-0 flex"
                              >
                                {Array.from({ length: tileCount }, (_, idx) => {
                                  const frameIdx = Math.min(
                                    strip.frames.length - 1,
                                    Math.floor(
                                      ((clip.startMs +
                                        ((idx + 0.5) / tileCount) *
                                          (clip.endMs - clip.startMs)) /
                                        strip.durationMs) *
                                        strip.targetFrames
                                    )
                                  )
                                  return (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={idx}
                                      src={strip.frames[frameIdx]}
                                      alt=""
                                      draggable={false}
                                      className="pointer-events-none h-full shrink-0 object-cover"
                                      style={{ width: tileWidth }}
                                    />
                                  )
                                })}
                              </div>
                              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-1.5 bg-linear-to-l from-black/70 via-black/40 to-transparent pr-3 pl-14 text-white">
                                <RiVidiconFill className="size-4 shrink-0" />
                                <span className="text-[12px] font-medium whitespace-nowrap">
                                  Video{" "}
                                  {((clip.endMs - clip.startMs) / 1000).toFixed(
                                    1
                                  )}
                                  s
                                </span>
                              </div>
                            </>
                          ) : (
                            <div
                              aria-hidden
                              className="absolute inset-0 animate-pulse bg-foreground/5"
                            />
                          )}
                        </TimelineVideoClip>
                      )
                    })}
                  </div>
                )
              }

              return (
                <div
                  key={layer.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="relative mt-1 flex h-11 items-center rounded-lg border border-border/50 bg-background/40"
                  style={{ width: rowWidth }}
                >
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
