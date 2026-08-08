import { isVideoSrc } from "../../media-type"
import { resolveSlotPositionPct } from "../../preset-geometry"
import { computeRowLayout } from "../../screenshot-layout"
import type {
  AnimationEffect,
  CanvasState,
  ScreenshotSlot,
} from "../../state-types"
import {
  clampPct,
  cloneBorder,
  cloneLighting,
  cloneShadow,
  createScreenshotSlot,
  layoutSlotsInRow,
  makeId,
  placeNewSlotInRow,
  removeSlotFromRow,
  resolveActiveLayoutGeometry,
  stateCanvasAspect,
} from "../canvas-helpers"
import { MAX_SCREENSHOT_SLOTS } from "../defaults"
import { computeNextLayerZ } from "../layer-stack"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createSlotActions = ({
  get,
  commitCanvas,
  commitCanvasEffect,
  makeLayerOps,
}: CommitContext) => {
  const slotLayerOps = makeLayerOps("slot", (id) => "slot-layer-" + id)

  return {
    addScreenshotSlot: (canvasId) => {
      const targetId = canvasId ?? get().present.activeCanvasId
      const target = get().present.canvases.find(
        (canvas) => canvas.id === targetId
      )
      if (
        !target ||
        target.tweet ||
        (target.screenshot && isVideoSrc(target.screenshot)) ||
        target.screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
      ) {
        return null
      }
      const id = makeId()
      commitCanvas(
        targetId,
        (canvas, state) => {
          const next = createScreenshotSlot(
            {
              id,
              tilt: { ...canvas.tilt },
              scale: canvas.scale,
              border: cloneBorder(canvas.border),
              borderRadius: canvas.borderRadius,
              padding: canvas.padding,
              shadow: cloneShadow(canvas.shadow),
              lighting: cloneLighting(canvas.backdrop.lighting),
            },
            computeNextLayerZ(canvas)
          )
          return {
            screenshotSlots: placeNewSlotInRow(
              canvas.screenshotSlots,
              next,
              canvas.frame,
              stateCanvasAspect(state)
            ),
          }
        },
        null
      )
      return id
    },
    updateScreenshotSlot: (id, patch, canvasId) => {
      const apply = (canvas: CanvasState) => ({
        screenshotSlots: canvas.screenshotSlots.map((slot) =>
          slot.id === id ? { ...slot, ...patch } : slot
        ),
      })
      // A slot's transform + shadow + position + border/radius/padding/lighting
      // edits become owned effects on the open keyframe; other slot changes (fit,
      // filter…) don't animate, so they commit normally.
      const effects: AnimationEffect[] = []
      if ("tilt" in patch || "rotation" in patch) effects.push("tilt")
      if ("scale" in patch) effects.push("zoom")
      if ("shadow" in patch) effects.push("shadow")
      if ("xPct" in patch || "yPct" in patch) effects.push("position")
      if ("border" in patch) effects.push("border")
      if ("borderRadius" in patch) effects.push("borderRadius")
      if ("padding" in patch) effects.push("padding")
      if ("lighting" in patch) effects.push("lighting")
      if (effects.length === 0) {
        commitCanvas(canvasId, apply, `screenshot-slot-${id}`)
      } else {
        commitCanvasEffect(canvasId, apply, `screenshot-slot-${id}`, effects)
      }
    },
    setScreenshotSlotImage: (id, src, canvasId) => {
      if (src === null) {
        commitCanvas(
          canvasId,
          (canvas) => ({
            screenshotSlots: canvas.screenshotSlots.map((slot) =>
              slot.id === id
                ? {
                    ...slot,
                    src,
                    originalSrc: null,
                    lastCropRegion: null,
                    fullPageCapture: null,
                  }
                : slot
            ),
          }),
          null
        )
        return
      }

      const snapshot = get()
      commitCanvas(
        canvasId,
        (canvas, state) => {
          const activeLayoutGeometry = resolveActiveLayoutGeometry(
            snapshot,
            canvas.frame
          )
          const updatedSlots = canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  src,
                  originalSrc: src,
                  lastCropRegion: null,
                  fullPageCapture: null,
                  objectFit: slot.objectFit ?? "contain",
                }
              : slot
          )
          if (
            !activeLayoutGeometry ||
            updatedSlots.length !== activeLayoutGeometry.slots.length
          ) {
            return { screenshotSlots: updatedSlots }
          }
          // When the active layout preset uses relative slot positions, the
          // preset's xPct/yPct are offsets from each slot's natural row-layout
          // position — not absolute values. Mirror the same resolution
          // applyLayoutPreset does so uploading an image doesn't snap the box
          // to (0, 0).
          const naturalLayout = computeRowLayout(
            [
              { id: "__main__", frame: canvas.frame },
              ...updatedSlots.map((slot) => ({
                id: slot.id,
                frame: slot.frame ?? canvas.frame,
              })),
            ],
            stateCanvasAspect(state)
          )
          return {
            screenshotSlots: updatedSlots.map((slot, index) => {
              const config = activeLayoutGeometry.slots[index]
              if (!config) return slot
              const { xPct, yPct } = resolveSlotPositionPct({
                config,
                naturalSlotXPct: naturalLayout[index + 1]?.xPct ?? slot.xPct,
                relativeSlotPositions:
                  activeLayoutGeometry.relativeSlotPositions,
              })
              return {
                ...slot,
                xPct,
                yPct,
                rotation: config.rotation,
                tilt: config.tilt,
                scale: config.scale,
                ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
              }
            }),
          }
        },
        null
      )
    },
    setFullPageScreenshotSlot: (id, src, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotSlots: canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  src,
                  originalSrc: src,
                  lastCropRegion: null,
                  fullPageCapture: src ? { scrollPosition: 0 } : null,
                }
              : slot
          ),
        }),
        null
      ),
    setFullPageScreenshotSlotScrollPosition: (id, scrollPosition, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotSlots: canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  fullPageCapture: slot.fullPageCapture
                    ? {
                        scrollPosition: Math.max(
                          0,
                          Math.min(100, scrollPosition)
                        ),
                      }
                    : slot.fullPageCapture,
                }
              : slot
          ),
        }),
        `full-page-slot-scroll-${id}`
      ),
    applyCroppedScreenshotSlot: (id, src, region, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotSlots: canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  src,
                  originalSrc: slot.originalSrc ?? slot.src,
                  lastCropRegion: region,
                  fullPageCapture: null,
                }
              : slot
          ),
        }),
        `screenshot-slot-crop-${id}`
      ),
    deleteScreenshotSlot: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => ({
          screenshotSlots: removeSlotFromRow(
            canvas.screenshotSlots,
            id,
            canvas.frame,
            stateCanvasAspect(state)
          ),
        }),
        null
      ),
    duplicateScreenshotSlot: (id, canvasId) => {
      const targetId = canvasId ?? get().present.activeCanvasId
      const target = get().present.canvases.find(
        (canvas) => canvas.id === targetId
      )
      if (!target || target.screenshotSlots.length >= MAX_SCREENSHOT_SLOTS) {
        return null
      }
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        targetId,
        (canvas, state) => {
          const src = canvas.screenshotSlots.find((slot) => slot.id === id)
          if (!src) return { screenshotSlots: canvas.screenshotSlots }
          didCopy = true
          const copy: ScreenshotSlot = {
            ...src,
            id: copyId,
            zIndex: computeNextLayerZ(canvas),
          }
          return {
            screenshotSlots: placeNewSlotInRow(
              canvas.screenshotSlots,
              copy,
              canvas.frame,
              stateCanvasAspect(state)
            ),
          }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringScreenshotSlotToFront: slotLayerOps.toFront,
    sendScreenshotSlotToBack: slotLayerOps.toBack,
    arrangeScreenshotSlotsInRow: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => ({
          screenshotSlots: layoutSlotsInRow(
            canvas.screenshotSlots,
            canvas.frame,
            stateCanvasAspect(state)
          ),
        }),
        null
      ),
    setScreenshotSlotGroupPosition: (position, canvasId) =>
      // Position is animatable — register ownership on the open keyframe so
      // group moves (and the animate Position pad's "all" path) keyframe correctly.
      commitCanvasEffect(
        canvasId,
        (canvas) => {
          if (canvas.screenshotSlots.length === 0) {
            return { screenshotSlots: canvas.screenshotSlots }
          }

          const bounds = canvas.screenshotSlots.reduce(
            (acc, slot) => ({
              minX: Math.min(acc.minX, slot.xPct - slot.widthPct / 2),
              maxX: Math.max(acc.maxX, slot.xPct + slot.widthPct / 2),
              minY: Math.min(acc.minY, slot.yPct - slot.heightPct / 2),
              maxY: Math.max(acc.maxY, slot.yPct + slot.heightPct / 2),
            }),
            {
              minX: Number.POSITIVE_INFINITY,
              maxX: Number.NEGATIVE_INFINITY,
              minY: Number.POSITIVE_INFINITY,
              maxY: Number.NEGATIVE_INFINITY,
            }
          )
          const centerX = (bounds.minX + bounds.maxX) / 2
          const centerY = (bounds.minY + bounds.maxY) / 2
          const dx = position.xPct - centerX
          const dy = position.yPct - centerY

          return {
            screenshotSlots: canvas.screenshotSlots.map((slot) => ({
              ...slot,
              xPct: clampPct(slot.xPct + dx),
              yPct: clampPct(slot.yPct + dy),
            })),
          }
        },
        "screenshot-slot-group-position",
        "position"
      ),
  } satisfies Partial<EditorActions>
}
