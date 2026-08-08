import { DEFAULT_CLIP_DURATION_MS } from "../../animation-motion"
import { NEW_CLIP_EASING } from "../../clip-easing"
import {
  clipAffectsMain,
  clipAffectsSlot,
  clipBaseline,
  clipPose,
  poseAtCut,
} from "../../animation-playback"
import { MAX_DURATION_MS, resolveRippleDrop } from "../../animation-timeline"
import type { AnimationClip } from "../../state-types"
import {
  ANIMATION_EFFECTS,
  applyPoseToCanvas,
  buildRestingPose,
  captureClipPose,
  clearClipEffectsInArray,
  clipOwnsEffect,
  getCanvasAnimation,
  insertClipCopy,
  mainPositionOffsetForPoint,
  mainPositionPoint,
  MIN_ANIMATION_CLIP_MS,
  overlayEffectFields,
  resolveKeyframePose,
  resolveSelectionTarget,
} from "../animation-helpers"
import { CLEAR_SELECTION } from "../defaults"
import { makeId } from "../canvas-helpers"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createAnimationActions = ({
  set,
  get,
  commitCanvas,
}: CommitContext) =>
  ({
    setIsAnimateMode: (a) => {
      const state = get()
      const canvas = state.present.canvases.find(
        (c) => c.id === state.present.activeCanvasId
      )
      if (!canvas) {
        set({
          isAnimateMode: a,
          selectedAnimationClipId: null,
          selectedAnimationClipIds: [],
        })
        return
      }
      const animation = getCanvasAnimation(canvas)
      const sorted = [...animation.clips].sort((x, y) => x.startMs - y.startMs)
      const last = sorted[sorted.length - 1]
      if (a) {
        // Entering: the committed canvas is the final frame for every effect
        // except position (which rests at its START). Fold any edits made outside
        // Animate mode into the last clip's pose and open it for editing.
        if (!last) {
          set({
            isAnimateMode: true,
            selectedAnimationClipId: null,
            selectedAnimationClipIds: [],
          })
          return
        }
        const pose = captureClipPose(canvas)
        // The committed canvas holds the animation's START, so folding it
        // wholesale would flatten every keyframe into its own origin. Keep the
        // last clip's stored pose for anything a keyframe animates; only a
        // property nothing animates carries an outside edit onto that keyframe.
        const foldedPose = overlayEffectFields(
          pose,
          clipPose(last),
          sorted,
          (c, e) => clipOwnsEffect(c, e)
        )
        // The outside edit belongs at the animation's start instead: each
        // effect's FIRST owning keyframe is the one that eases from it.
        let nextClips = animation.clips.map((c) =>
          c.id === last.id ? { ...c, pose: foldedPose } : c
        )
        nextClips = nextClips.map((c) => {
          const startsHere = ANIMATION_EFFECTS.filter(
            (e) =>
              clipOwnsEffect(c, e) &&
              sorted.find((o) => clipOwnsEffect(o, e))?.id === c.id
          )
          if (startsHere.length === 0) return c
          return {
            ...c,
            baseline: overlayEffectFields(clipBaseline(c), pose, [c], (_c, e) =>
              startsHere.includes(e)
            ),
          }
        })
        // Load the open (last) keyframe's pose so editing it works on its own
        // values rather than on the resting start the canvas is showing.
        const canvasPatch = applyPoseToCanvas(canvas, foldedPose)
        const canvases = state.present.canvases.map((c) =>
          c.id === canvas.id
            ? {
                ...c,
                ...canvasPatch,
                animation: { ...animation, clips: nextClips },
              }
            : c
        )
        set({
          present: { ...state.present, canvases },
          isAnimateMode: true,
          selectedAnimationClipId: last.id,
          selectedAnimationClipIds: [last.id],
        })
        return
      }
      // Exiting: persist the open clip's edits, then restore the committed canvas
      // to the resting pose — where the animation STARTS (see buildRestingPose).
      // Keyframes describe motion; they must not leave their look baked into the
      // document, so the static editor and the still export show the composition
      // the user built. Clear the clip selection.
      const openId = state.selectedAnimationClipId
      let nextClips = animation.clips
      if (openId && nextClips.some((c) => c.id === openId)) {
        const pose = captureClipPose(canvas)
        nextClips = nextClips.map((c) => (c.id === openId ? { ...c, pose } : c))
      }
      const restingPose = buildRestingPose(canvas, nextClips)
      const canvasPatch = restingPose
        ? applyPoseToCanvas(canvas, restingPose)
        : {}
      const canvases = state.present.canvases.map((c) =>
        c.id === canvas.id
          ? {
              ...c,
              ...canvasPatch,
              animation: { ...animation, clips: nextClips },
            }
          : c
      )
      set({
        present: { ...state.present, canvases },
        isAnimateMode: false,
        selectedAnimationClipId: null,
        selectedAnimationClipIds: [],
      })
    },
    selectAnimationClip: (id, canvasId) => {
      const state = get()
      // Re-selecting the already-open clip is a no-op for the canvas: its live
      // edits are in the committed canvas; reloading its (not-yet-saved) stored
      // pose would wipe them. onClipPointerDown re-selects on every click, so
      // this matters. Still collapse any multi-selection down to just this clip.
      if (id === state.selectedAnimationClipId) {
        const next = id ? [id] : []
        const cur = state.selectedAnimationClipIds
        if (cur.length !== next.length || cur[0] !== next[0]) {
          set({ selectedAnimationClipIds: next })
        }
        return
      }
      const targetCanvasId = canvasId ?? state.present.activeCanvasId
      const canvas = state.present.canvases.find((c) => c.id === targetCanvasId)
      if (!canvas) {
        set({
          selectedAnimationClipId: id,
          selectedAnimationClipIds: id ? [id] : [],
        })
        return
      }
      const animation = getCanvasAnimation(canvas)
      const openId = state.selectedAnimationClipId
      let nextClips = animation.clips
      // Persist the previously-open clip's edits from the live canvas.
      if (openId && openId !== id && nextClips.some((c) => c.id === openId)) {
        const pose = captureClipPose(canvas)
        nextClips = nextClips.map((c) => (c.id === openId ? { ...c, pose } : c))
      }
      // Load the resolved look AT this keyframe (its owned effects + those held
      // from earlier keyframes) so the inspector/canvas show what it really looks
      // like there and you can edit from that state.
      const opened = id ? nextClips.find((c) => c.id === id) : undefined
      const canvasPatch = opened
        ? applyPoseToCanvas(
            canvas,
            resolveKeyframePose(canvas, nextClips, opened)
          )
        : {}
      const canvases = state.present.canvases.map((c) =>
        c.id === canvas.id
          ? {
              ...c,
              ...canvasPatch,
              animation: { ...animation, clips: nextClips },
            }
          : c
      )
      // Point the inspector at the screenshot this clip targets, so edits route
      // to the right screenshot (main vs a slot) and get recorded as this clip's
      // effects. A slot target that no longer exists falls back to the main.
      const targetSelection = (() => {
        const t = opened?.target ?? { scope: "all" as const }
        if (
          t.scope === "slot" &&
          canvas.screenshotSlots.some((s) => s.id === t.slotId)
        ) {
          return { ...CLEAR_SELECTION, selectedScreenshotSlotId: t.slotId }
        }
        if (t.scope === "main") {
          return { ...CLEAR_SELECTION, isScreenshotSelected: true }
        }
        return { ...CLEAR_SELECTION }
      })()
      // Route through raw `set` (not commit) so navigating between clips does not
      // pile up undo history; property edits still commit normally.
      set({
        present: { ...state.present, canvases },
        selectedAnimationClipId: id,
        selectedAnimationClipIds: id ? [id] : [],
        ...(opened ? targetSelection : {}),
      })
    },
    setAnimationDuration: (ms, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          animation: { ...getCanvasAnimation(canvas), durationMs: ms },
        }),
        "animation-duration"
      ),
    addAnimationClip: (canvasId, atMs) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const clipLen = Math.min(DEFAULT_CLIP_DURATION_MS, MAX_DURATION_MS)
          const sorted = [...animation.clips].sort(
            (a, b) => a.startMs - b.startMs
          )
          let startMs: number
          if (atMs != null) {
            // Drop the clip where the pointer released — allowed past the set
            // duration (clamped only to the absolute max range).
            const maxStart = Math.max(0, MAX_DURATION_MS - clipLen)
            startMs = Math.max(0, Math.min(maxStart, atMs))
          } else {
            // Append right after the last clip — allowed to run PAST the set
            // duration (clamped only to the absolute max range). Clips beyond the
            // duration are shown faded in the timeline to signal they won't play
            // until the duration is extended.
            const lastEnd = sorted.reduce(
              (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
              0
            )
            startMs = Math.min(lastEnd, Math.max(0, MAX_DURATION_MS - clipLen))
          }
          // Never overlap a neighbouring clip: keep the start past the previous
          // clip's end, and shrink the duration so it stops at the next clip.
          const prevEnd = sorted
            .filter((c) => c.startMs <= startMs)
            .reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0)
          startMs = Math.max(startMs, prevEnd)
          const nextStart = sorted
            .filter((c) => c.startMs >= startMs)
            .reduce((min, c) => Math.min(min, c.startMs), MAX_DURATION_MS)
          const fittedDuration = Math.max(
            MIN_ANIMATION_CLIP_MS,
            Math.min(clipLen, nextStart - startMs)
          )
          const snapshot = captureClipPose(canvas)
          const clip: AnimationClip = {
            id,
            startMs,
            durationMs: fittedDuration,
            target: resolveSelectionTarget(
              canvas,
              get().selectedScreenshotSlotId,
              get().isScreenshotSelected
            ),
            pose: snapshot,
            // The state BEFORE this keyframe's edits — captured at creation so an
            // effect (e.g. background) can cross-fade FROM the pre-edit value
            // rather than from a neutral/black origin. The canvas always has a
            // background, so the first background swap starts from this one.
            baseline: snapshot,
            // A fresh keyframe owns nothing until you edit an effect on it.
            effects: [],
            // Explicit linear so undefined easing can keep meaning historic
            // ease-out for drafts/templates saved before per-clip easing.
            easing: NEW_CLIP_EASING,
          }
          return {
            animation: { ...animation, clips: [...animation.clips, clip] },
          }
        },
        null
      )
      return id
    },
    updateAnimationClip: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          return {
            animation: {
              ...animation,
              clips: animation.clips.map((clip) =>
                clip.id === id ? { ...clip, ...patch } : clip
              ),
            },
          }
        },
        `animation-clip:${id}`
      ),
    clearAnimationClipEffects: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const nextClips = clearClipEffectsInArray(animation.clips, id)
          // Same array back → nothing owned, nothing to strip.
          if (nextClips === animation.clips) return {}
          const cleared = nextClips.find((c) => c.id === id)
          // If this clip is open for editing, the committed canvas is showing its
          // (now-removed) effects — reload the resolved look WITHOUT this clip so
          // the canvas reflects the strip (e.g. the lit backdrop goes dark).
          const isOpen = get().selectedAnimationClipId === id
          const canvasPatch =
            isOpen && cleared
              ? applyPoseToCanvas(
                  canvas,
                  resolveKeyframePose(canvas, nextClips, cleared)
                )
              : {}
          return {
            ...canvasPatch,
            animation: { ...animation, clips: nextClips },
          }
        },
        `animation-clip:${id}`
      ),
    removeAnimationClip: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          // Just drop the clip — the others keep their positions. The removed
          // clip fades out via AnimatePresence in the timeline view.
          return {
            animation: {
              ...animation,
              clips: animation.clips.filter((clip) => clip.id !== id),
            },
          }
        },
        null
      ),
    moveAnimationClip: (id, startMs, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const moving = animation.clips.find((clip) => clip.id === id)
          if (!moving) return {}
          const dur = moving.durationMs
          const others = animation.clips.filter((clip) => clip.id !== id)
          const {
            startMs: start,
            shiftAfterMs,
            shiftMs: shift,
          } = resolveRippleDrop(startMs, dur, others, MAX_DURATION_MS)
          const clips = animation.clips.map((clip) => {
            if (clip.id === id) return { ...clip, startMs: start }
            if (clip.startMs < shiftAfterMs) return clip
            return {
              ...clip,
              startMs: Math.min(
                clip.startMs + shift,
                Math.max(0, MAX_DURATION_MS - clip.durationMs)
              ),
            }
          })
          // Duration is user-controlled via the end handle — moving a clip never
          // grows it; clips past the duration are just shown faded.
          return { animation: { ...animation, clips } }
        },
        // Merge with the drag's history entries so the whole gesture undoes once.
        `animation-clip:${id}`
      ),
    duplicateAnimationClip: (id, canvasId) => {
      const state = get().present
      const resolvedId = canvasId ?? state.activeCanvasId
      const canvas = state.canvases.find((c) => c.id === resolvedId)
      const animation = canvas ? getCanvasAnimation(canvas) : null
      if (!animation) return null
      const source = animation.clips.find((clip) => clip.id === id)
      if (!source) return null
      const newId = makeId()
      const clips = insertClipCopy(animation.clips, source.id, newId)
      if (clips === animation.clips) return null
      commitCanvas(
        resolvedId,
        (c) => {
          const current = getCanvasAnimation(c)
          // The copy sits immediately after the original (it may land past the
          // set duration and render faded). Duration is user-controlled — the
          // copy never grows it.
          return {
            animation: {
              ...current,
              clips,
            },
          }
        },
        null
      )
      return newId
    },
    setAnimationClipSelection: (ids, canvasId) => {
      const unique = Array.from(new Set(ids))
      // 0 or 1 clip → identical to a normal single select (loads its pose so the
      // inspector edits that keyframe, or deselects on empty).
      if (unique.length <= 1) {
        get().selectAnimationClip(unique[0] ?? null, canvasId)
        return
      }
      const state = get()
      const targetCanvasId = canvasId ?? state.present.activeCanvasId
      const canvas = state.present.canvases.find((c) => c.id === targetCanvasId)
      if (!canvas) {
        set({ selectedAnimationClipIds: unique, selectedAnimationClipId: null })
        return
      }
      const animation = getCanvasAnimation(canvas)
      const openId = state.selectedAnimationClipId
      let nextClips = animation.clips
      // Persist the currently-open clip's live edits before clearing the primary.
      if (openId && nextClips.some((c) => c.id === openId)) {
        const pose = captureClipPose(canvas)
        nextClips = nextClips.map((c) => (c.id === openId ? { ...c, pose } : c))
      }
      const canvases = state.present.canvases.map((c) =>
        c.id === canvas.id
          ? { ...c, animation: { ...animation, clips: nextClips } }
          : c
      )
      // A multi-selection opens no single keyframe for editing (primary = null)
      // so inspector edits can't mis-route; bulk actions read the id set.
      set({
        present: { ...state.present, canvases },
        selectedAnimationClipIds: unique,
        selectedAnimationClipId: null,
      })
    },
    removeAnimationClips: (ids, canvasId) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          return {
            animation: {
              ...animation,
              clips: animation.clips.filter((clip) => !idSet.has(clip.id)),
            },
          }
        },
        null
      )
      // Drop the removed ids from the selection.
      set((s) => ({
        selectedAnimationClipIds: s.selectedAnimationClipIds.filter(
          (id) => !idSet.has(id)
        ),
        selectedAnimationClipId:
          s.selectedAnimationClipId && idSet.has(s.selectedAnimationClipId)
            ? null
            : s.selectedAnimationClipId,
      }))
    },
    clearAnimationClipsEffects: (ids, canvasId) => {
      if (ids.length === 0) return
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          let nextClips = animation.clips
          for (const id of ids)
            nextClips = clearClipEffectsInArray(nextClips, id)
          // No clip owned anything → nothing changed.
          if (nextClips === animation.clips) return {}
          // If the open clip was among those cleared, reload its resolved look
          // so the committed canvas reflects the strip.
          const openId = get().selectedAnimationClipId
          const opened =
            openId && ids.includes(openId)
              ? nextClips.find((c) => c.id === openId)
              : undefined
          const canvasPatch = opened
            ? applyPoseToCanvas(
                canvas,
                resolveKeyframePose(canvas, nextClips, opened)
              )
            : {}
          return {
            ...canvasPatch,
            animation: { ...animation, clips: nextClips },
          }
        },
        null
      )
    },
    duplicateAnimationClips: (ids, canvasId) => {
      if (ids.length === 0) return []
      const state = get().present
      const resolvedId = canvasId ?? state.activeCanvasId
      const canvas = state.canvases.find((c) => c.id === resolvedId)
      if (!canvas) return []
      const existing = getCanvasAnimation(canvas).clips
      // Duplicate in timeline order so each copy lands right after its original.
      const sources = ids
        .map((id) => existing.find((c) => c.id === id))
        .filter((c): c is AnimationClip => Boolean(c))
        .sort((a, b) => a.startMs - b.startMs)
      if (sources.length === 0) return []
      const newIds: string[] = []
      let clips = existing
      for (const source of sources) {
        const newId = makeId()
        const inserted = insertClipCopy(clips, source.id, newId)
        // Bulk duplicate is atomic for the valid selected clips: if any copy
        // cannot fit, keep the timeline unchanged instead of committing a
        // partial group while reporting overall success.
        if (inserted === clips) return []
        clips = inserted
        newIds.push(newId)
      }
      commitCanvas(
        resolvedId,
        (c) => {
          const animation = getCanvasAnimation(c)
          return { animation: { ...animation, clips } }
        },
        null
      )
      return newIds
    },
    splitAnimationClip: (id, atMs, canvasId) => {
      const state = get().present
      const resolvedId = canvasId ?? state.activeCanvasId
      const canvas = state.canvases.find((c) => c.id === resolvedId)
      const source = canvas
        ? getCanvasAnimation(canvas).clips.find((clip) => clip.id === id)
        : undefined
      if (!source) return null
      const end = source.startMs + source.durationMs
      // A cut has to leave a real clip on each side, so the clip must be at
      // least twice the minimum length. Anything shorter simply can't be split.
      if (source.durationMs < MIN_ANIMATION_CLIP_MS * 2) {
        return null
      }
      // Clamp the cut into the legal window (≥ MIN from each edge) so a click
      // near an edge still cuts at the nearest valid point instead of silently
      // doing nothing.
      atMs = Math.min(
        Math.max(atMs, source.startMs + MIN_ANIMATION_CLIP_MS),
        end - MIN_ANIMATION_CLIP_MS
      )
      // When the clip being cut is the one open for editing, its live edits sit
      // on the committed canvas (not yet folded into its stored pose), so capture
      // the canvas as the true target keyframe. "Open" status then transfers to
      // the second half below so the follow-up reselect doesn't overwrite the
      // first half's cut pose with the live one.
      const wasOpen = get().selectedAnimationClipId === id
      const newId = makeId()
      commitCanvas(
        canvasId,
        (c, state) => {
          const animation = getCanvasAnimation(c)
          const src = animation.clips.find((clip) => clip.id === id)
          if (!src) return {}
          const srcEnd = src.startMs + src.durationMs
          // The clip's own target keyframe (what it eases TO)...
          const toPose = wasOpen ? captureClipPose(c) : clipPose(src)
          // ...and the pose it eases FROM — the accumulated state the instant
          // before it starts, resolved with the same logic playback uses (ask
          // for the keyframe pose just before this clip's start).
          const fromPose = resolveKeyframePose(c, animation.clips, {
            ...src,
            startMs: src.startMs - 1,
          })
          const affectedSlotIds = c.screenshotSlots
            .filter((s) => clipAffectsSlot(src, s.id))
            .map((s) => s.id)
          // Main position eases in percent-point space (as playback does), then
          // inverts back to a (cell, offset) keyframe pinned to the target cell.
          const aspect = c.aspect ?? state.aspect
          const positionAt = (easedP: number) => {
            const slots = c.screenshotSlots
            const fromPt = mainPositionPoint(
              aspect,
              c.frame,
              fromPose.screenshotPosition,
              fromPose.screenshotOffset,
              slots
            )
            const toPt = mainPositionPoint(
              aspect,
              c.frame,
              toPose.screenshotPosition,
              toPose.screenshotOffset,
              slots
            )
            const midPt = {
              xPct: fromPt.xPct + (toPt.xPct - fromPt.xPct) * easedP,
              yPct: fromPt.yPct + (toPt.yPct - fromPt.yPct) * easedP,
            }
            const cell = toPose.screenshotPosition
            return {
              screenshotPosition: cell,
              screenshotOffset: mainPositionOffsetForPoint(
                aspect,
                c.frame,
                cell,
                slots,
                midPt
              ),
            }
          }
          // The eased pose at the cut becomes the boundary keyframe: the first
          // half eases from → cut, the second half eases cut → to, so each piece
          // plays its portion of the original motion instead of the whole thing.
          const midPose = poseAtCut(
            fromPose,
            toPose,
            (atMs - src.startMs) / src.durationMs,
            src.effects ?? [],
            clipAffectsMain(src),
            affectedSlotIds,
            positionAt
          )
          const clips = animation.clips.flatMap((clip) => {
            if (clip.id !== id) return [clip]
            const first: AnimationClip = {
              ...clip,
              durationMs: atMs - clip.startMs,
              pose: midPose,
            }
            const second: AnimationClip = {
              ...clip,
              id: newId,
              startMs: atMs,
              durationMs: srcEnd - atMs,
              pose: toPose,
            }
            return [first, second]
          })
          return { animation: { ...animation, clips } }
        },
        null
      )
      // Hand the open-clip role to the second half (its pose is the live canvas,
      // so the canvas already shows it — no reload needed). A later
      // selectAnimationClip(newId) then no-ops instead of re-saving over the cut.
      if (wasOpen) {
        set({
          selectedAnimationClipId: newId,
          selectedAnimationClipIds: [newId],
        })
      }
      return newId
    },
    clearAnimationClips: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          animation: { ...getCanvasAnimation(canvas), clips: [] },
        }),
        null
      ),
  }) satisfies Partial<EditorActions>
