import type { StoreApi } from "zustand"

import { moveLayerInStack } from "./layer-stack"
import {
  captureClipPose,
  getCanvasAnimation,
  mergeEffectsIntoPose,
  resolveKeyframePose,
  resolveSelectionTarget,
  SLOT_ANIMATABLE_EFFECTS,
} from "./animation-helpers"
import { GROUP_MERGE_MS, HISTORY_LIMIT } from "./defaults"
import type { AnimationEffect } from "../state-types"
import type { CanvasPatch, EditorStore, SetPatch } from "./types"

export type StoreSet = StoreApi<EditorStore>["setState"]
export type StoreGet = StoreApi<EditorStore>["getState"]

export const createCommitContext = (set: StoreSet, get: StoreGet) => {
  const commit = (patch: SetPatch, group: string | null) => {
    const state = get()
    const resolvedPatch =
      typeof patch === "function" ? patch(state.present) : patch
    const present = { ...state.present, ...resolvedPatch }
    const now = Date.now()
    const canMerge =
      group !== null &&
      group === state._lastGroup &&
      now - state._lastTs < GROUP_MERGE_MS
    if (canMerge) {
      set({ present, future: [], _lastTs: now })
      return
    }
    const past = [...state.past, state.present]
    if (past.length > HISTORY_LIMIT) past.shift()
    set({
      past,
      present,
      future: [],
      _lastGroup: group,
      _lastTs: now,
    })
  }

  const commitCanvas = (
    targetId: string | undefined,
    patch: CanvasPatch,
    group: string | null
  ) => {
    commit((state) => {
      const canvasId = targetId ?? state.activeCanvasId
      const canvases = state.canvases.map((canvas) => {
        if (canvas.id !== canvasId) return canvas
        const resolvedPatch =
          typeof patch === "function" ? patch(canvas, state) : patch
        return { ...canvas, ...resolvedPatch }
      })
      return { canvases }
    }, group)
  }

  /**
   * Like `commitCanvas`, but while a keyframe is open in Animate mode it also
   * records `effects` as owned by that keyframe. This is how "changing an effect
   * while a clip is selected makes that clip own it" — the ONLY thing a keyframe
   * animates is the effect set recorded here.
   */
  const commitCanvasEffect = (
    targetId: string | undefined,
    patch: CanvasPatch,
    group: string | null,
    effects: AnimationEffect | AnimationEffect[]
  ) => {
    const list = Array.isArray(effects) ? effects : [effects]
    commitCanvas(
      targetId,
      (canvas, state) => {
        const base = typeof patch === "function" ? patch(canvas, state) : patch
        const full = get()
        // A patch that touches nothing animatable must not reach the keyframe
        // bookkeeping below: an empty list satisfies every `list.every(...)`
        // test and would re-target an unbound clip on a non-animatable edit.
        if (!full.isAnimateMode || list.length === 0) return base
        const anim = getCanvasAnimation(canvas)
        const selId = full.selectedAnimationClipId

        // Multi-selection opens no single keyframe (primary = null), so route the
        // edit to EVERY selected clip: record the effect on each and write its new
        // value into each clip's pose, leaving their other keyframed values intact.
        const multiIds = full.selectedAnimationClipIds
        if (!selId && multiIds.length > 1) {
          const idSet = new Set(multiIds)
          if (!anim.clips.some((c) => idSet.has(c.id))) return base
          const beforePose = captureClipPose(canvas)
          const editedPose = captureClipPose({
            ...canvas,
            ...base,
          })
          return {
            ...base,
            animation: {
              ...anim,
              clips: anim.clips.map((c) => {
                if (!idSet.has(c.id)) return c
                const owned = c.effects ?? []
                const merged = Array.from(new Set([...owned, ...list]))
                const basePose =
                  c.pose ?? resolveKeyframePose(canvas, anim.clips, c)
                return {
                  ...c,
                  effects: merged,
                  pose: mergeEffectsIntoPose(
                    basePose,
                    beforePose,
                    editedPose,
                    list
                  ),
                }
              }),
            },
          }
        }

        if (!selId) return base
        const clip = anim.clips.find((c) => c.id === selId)
        if (!clip) return base
        const owned = clip.effects ?? []
        const merged = Array.from(new Set([...owned, ...list]))
        // Auto-bind: an as-yet-unbound ("all") keyframe binds to the SLOT this
        // edit targets, so selecting it later re-selects that slot and further
        // edits scope to it. Only for the effects a slot can actually animate
        // (SLOT_ANIMATABLE_EFFECTS: transform, shadow, position, border, radius,
        // padding, lighting) — canvas-wide effects (background, backdrop, pattern,
        // filter, portrait, overlay, canvas radius) always edit the canvas/main
        // even when a slot is selected, so they must not re-bind the clip. A
        // keyframe already bound keeps its binding.
        const currentTarget = clip.target ?? { scope: "all" as const }
        const nextTarget = resolveSelectionTarget(
          canvas,
          full.selectedScreenshotSlotId,
          full.isScreenshotSelected
        )
        const retarget =
          currentTarget.scope === "all" &&
          nextTarget.scope === "slot" &&
          list.every((e) => SLOT_ANIMATABLE_EFFECTS.includes(e))
        if (list.every((e) => owned.includes(e)) && !retarget) return base
        return {
          ...base,
          animation: {
            ...anim,
            clips: anim.clips.map((c) =>
              c.id === selId
                ? {
                    ...c,
                    effects: merged,
                    ...(retarget ? { target: nextTarget } : {}),
                  }
                : c
            ),
          },
        }
      },
      group
    )
  }

  const makeLayerOps = (
    prefix: string,
    getGroup?: (id: string) => string | null
  ) => ({
    toFront: (id: string, canvasId?: string) =>
      commitCanvas(
        canvasId,
        (c) => moveLayerInStack(c, `${prefix}:${id}`, "front"),
        getGroup?.(id) ?? null
      ),
    toBack: (id: string, canvasId?: string) =>
      commitCanvas(
        canvasId,
        (c) => moveLayerInStack(c, `${prefix}:${id}`, "back"),
        getGroup?.(id) ?? null
      ),
  })

  return { set, get, commit, commitCanvas, commitCanvasEffect, makeLayerOps }
}

export type CommitContext = ReturnType<typeof createCommitContext>
