import { MAX_DURATION_MS, resolveRippleDrop } from "../../animation-timeline"
import { makeId } from "../canvas-helpers"
import { computeNextLayerZ } from "../layer-stack"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createMediaActions = ({
  commitCanvas,
  commitCanvasEffect,
}: CommitContext) =>
  ({
    setScreenshot: (screenshot, canvasId) => {
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshot,
          originalScreenshot: screenshot,
          lastCropRegion: null,
          fullPageCapture: null,
          videoClips: null,
          // A screenshot replaces any tweet as the canvas's main content.
          tweet: screenshot ? null : canvas.tweet,
          objectFit: canvas.objectFit ?? "contain",
          screenshotLayer: {
            ...canvas.screenshotLayer,
            zIndex:
              screenshot && !canvas.screenshot
                ? computeNextLayerZ(canvas)
                : canvas.screenshotLayer.zIndex,
            hidden: false,
          },
        }),
        null
      )
    },
    setFullPageScreenshot: (src, canvasId) => {
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshot: src,
          originalScreenshot: src,
          lastCropRegion: null,
          fullPageCapture: src ? { scrollPosition: 0 } : null,
          videoClips: null,
          // A URL capture replaces any tweet as the canvas's main content.
          tweet: src ? null : canvas.tweet,
          objectFit: canvas.objectFit ?? "contain",
          screenshotLayer: {
            ...canvas.screenshotLayer,
            zIndex:
              src && !canvas.screenshot
                ? computeNextLayerZ(canvas)
                : canvas.screenshotLayer.zIndex,
            hidden: false,
          },
        }),
        null
      )
    },
    setFullPageScreenshotScrollPosition: (scrollPosition, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          fullPageCapture: canvas.fullPageCapture
            ? { scrollPosition: Math.max(0, Math.min(100, scrollPosition)) }
            : canvas.fullPageCapture,
        }),
        "full-page-scroll"
      ),
    applyCroppedScreenshot: (s, region, canvasId) =>
      commitCanvas(
        canvasId,
        { screenshot: s, lastCropRegion: region, fullPageCapture: null },
        "applyCroppedScreenshot"
      ),
    setScreenshotCropRegion: (region, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          lastCropRegion: region,
          fullPageCapture: region ? null : canvas.fullPageCapture,
        }),
        "setScreenshotCropRegion",
        "crop"
      ),
    updateVideoClip: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const clips = canvas.videoClips ?? [
            { id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null },
          ]
          return {
            videoClips: clips.map((clip) =>
              clip.id === id ? { ...clip, ...patch } : clip
            ),
          }
        },
        "video-trim"
      ),
    splitVideoClip: (id, atMs, canvasId) => {
      let newId: string | null = null
      commitCanvas(
        canvasId,
        (canvas) => {
          const clips = canvas.videoClips ?? [
            { id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null },
          ]
          const clip = clips.find((item) => item.id === id)
          if (
            !clip ||
            atMs <= clip.startMs ||
            (clip.endMs !== null && atMs >= clip.endMs)
          ) {
            return {}
          }
          newId = makeId()
          return {
            videoClips: clips.flatMap((item) =>
              item.id === id
                ? [
                    { ...item, endMs: atMs },
                    {
                      ...item,
                      id: newId!,
                      timelineStartMs:
                        (item.timelineStartMs ?? item.startMs) +
                        (atMs - item.startMs),
                      startMs: atMs,
                    },
                  ]
                : [item]
            ),
          }
        },
        "video-split"
      )
      return newId
    },
    duplicateVideoClip: (id, durationMs, canvasId) => {
      let newId: string | null = null
      commitCanvas(
        canvasId,
        (canvas) => {
          const clips = canvas.videoClips ?? [
            { id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null },
          ]
          const source = clips.find((clip) => clip.id === id)
          if (!source || durationMs <= 0) return {}
          const sourceStart = source.timelineStartMs ?? source.startMs
          const sourceEndMs = source.endMs ?? source.startMs + durationMs
          const { startMs, shiftAfterMs, shiftMs } = resolveRippleDrop(
            sourceStart + durationMs,
            durationMs,
            clips
              .filter((clip) => clip.id !== id)
              .map((clip) => ({
                startMs: clip.timelineStartMs ?? clip.startMs,
                durationMs:
                  clip.endMs === null ? durationMs : clip.endMs - clip.startMs,
              })),
            MAX_DURATION_MS
          )
          newId = makeId()
          return {
            videoClips: [
              ...clips.map((clip) => {
                const timelineStartMs = clip.timelineStartMs ?? clip.startMs
                const positioned =
                  timelineStartMs < shiftAfterMs
                    ? clip
                    : { ...clip, timelineStartMs: timelineStartMs + shiftMs }
                return clip.id === id && clip.endMs === null
                  ? { ...positioned, endMs: sourceEndMs }
                  : positioned
              }),
              {
                ...source,
                id: newId,
                endMs: sourceEndMs,
                timelineStartMs: startMs,
              },
            ],
          }
        },
        "video-duplicate"
      )
      return newId
    },
    removeVideoClips: (ids, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const clips = canvas.videoClips ?? [
            { id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null },
          ]
          const kept = clips.filter((clip) => !ids.includes(clip.id))
          return kept.length > 0
            ? { videoClips: kept }
            : {
                screenshot: null,
                originalScreenshot: null,
                videoClips: null,
                fullPageCapture: null,
              }
        },
        "video-delete"
      ),
  }) satisfies Partial<EditorActions>
