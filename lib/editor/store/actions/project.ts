import { clipBaseline, clipPose } from "../../animation-playback"
import { mergeCanvasStyle } from "../../preset-fields"
import { resolveMainOffsetPx } from "../../preset-geometry"
import { remapAnimationForApply } from "../../custom-preset-snapshot"
import type {
  CanvasState,
  EditorState,
  ScreenshotSlot,
} from "../../state-types"
import { applyPoseToCanvas, buildRestingPose } from "../animation-helpers"
import { computeNextLayerZ } from "../layer-stack"
import { CLEAR_SELECTION } from "../defaults"
import { makeId } from "../canvas-helpers"
import { normalizeEditorState } from "../draft-persistence"
import type { CommitContext } from "../commit-context"
import type { CustomPresetSummary, EditorActions } from "../types"

// Identity of the newest custom-presets request. A response that does not match
// is stale (logout, account switch, or a superseding sort request).
let customPresetsRequestToken = 0
let customPresetsInFlightUserId: string | null = null

export const createProjectActions = ({ set, get, commit }: CommitContext) =>
  ({
    setActiveTool: (t) => commit({ activeTool: t }, null),
    setPresetTab: (tab) => set({ presetTab: tab }),
    setActiveLayoutPresetId: (id) => set({ activeLayoutPresetId: id }),
    setActiveCustomPresetId: (id) => set({ activeCustomPresetId: id }),
    setActiveSinglePresetId: (id) => set({ activeSinglePresetId: id }),
    setCustomPresets: (presets) =>
      set({
        customPresets: presets,
        customPresetsLoaded: true,
        customPresetsError: false,
      }),
    clearCustomPresets: () => {
      customPresetsRequestToken++
      customPresetsInFlightUserId = null
      set({
        customPresets: [],
        customPresetsLoaded: false,
        customPresetsLoading: false,
        customPresetsError: false,
        customPresetsForUserId: null,
      })
    },
    loadCustomPresets: (userId, sort) => {
      const state = get()
      const nextSort = sort ?? state.customPresetsSort
      const sortChanged = nextSort !== state.customPresetsSort
      // A failed load also lands on `customPresetsLoaded` (it stops the
      // skeleton), so it must not dedupe away the retry.
      if (
        state.customPresetsLoaded &&
        !state.customPresetsError &&
        state.customPresetsForUserId === userId &&
        !sortChanged
      )
        return
      // Dedupe concurrent mounts only for the SAME account. A load for a
      // different user supersedes the in-flight request instead of being
      // blocked by it — its late response is dropped by the token check.
      // A sort change also supersedes: the in-flight list is ordered wrong.
      if (
        state.customPresetsLoading &&
        customPresetsInFlightUserId === userId &&
        !sortChanged
      )
        return
      const token = ++customPresetsRequestToken
      customPresetsInFlightUserId = userId
      set({
        customPresetsLoading: true,
        customPresetsError: false,
        customPresetsSort: nextSort,
        // Account switch: never show the previous account's presets while the
        // new list loads. A sort change keeps the current list on screen and
        // reorders it in place when the response lands.
        ...(state.customPresetsForUserId !== null &&
        state.customPresetsForUserId !== userId
          ? {
              customPresets: [],
              customPresetsLoaded: false,
              customPresetsForUserId: null,
            }
          : {}),
      })
      void fetch(`/api/presets?sort=${nextSort}`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Preset load failed: ${res.status}`)
          const body: { presets: CustomPresetSummary[] } = await res.json()
          return body.presets
        })
        .then((presets) => {
          // Stale: cleared/logged out, or another account's load took over.
          if (token !== customPresetsRequestToken) return
          customPresetsInFlightUserId = null
          set({
            customPresets: presets,
            customPresetsLoaded: true,
            customPresetsLoading: false,
            customPresetsError: false,
            customPresetsForUserId: userId,
            // The displayed list now reflects the requested sort.
            customPresetsListSort: nextSort,
          })
        })
        .catch((err) => {
          console.error("Could not load custom presets", err)
          if (token !== customPresetsRequestToken) return
          customPresetsInFlightUserId = null
          // Keep whatever list is on screen: a failed re-sort must not erase
          // presets that loaded fine. Roll the requested sort back to the order
          // actually displayed so the picker matches it.
          set((current) => {
            const rolledSort = current.customPresetsLoaded
              ? current.customPresetsListSort
              : nextSort
            return {
              customPresetsSort: rolledSort,
              customPresetsListSort: rolledSort,
              customPresetsLoaded: true,
              customPresetsLoading: false,
              // Only an empty list is a lie about the account. A failed re-sort
              // still has real presets on screen, so it stays a plain list.
              customPresetsError: current.customPresets.length === 0,
              customPresetsForUserId: userId,
            }
          })
        })
    },
    addCustomPreset: (preset) =>
      set((state) => ({
        // A new preset is the newest, so it belongs at whichever end the
        // displayed order puts newest — otherwise saving under "Oldest" drops it
        // at the top, where a refetch would not have put it. Uses the list's real
        // sort, not a sort request still in flight.
        customPresets:
          state.customPresetsListSort === "oldest"
            ? [...state.customPresets, preset]
            : [preset, ...state.customPresets],
        customPresetsLoaded: true,
      })),
    updateCustomPreset: (id, patch) =>
      set((state) => ({
        customPresets: state.customPresets.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      })),
    removeCustomPreset: (id) =>
      set((state) => ({
        customPresets: state.customPresets.filter((p) => p.id !== id),
        activeCustomPresetId:
          state.activeCustomPresetId === id ? null : state.activeCustomPresetId,
      })),
    setCurrentDraft: (draft) => set({ currentDraft: draft }),
    loadDraftState: (state, draft, ui) => {
      const present = normalizeEditorState(state)
      const defaultBulk = present.canvases.length > 1
      const restoreAnimate = Boolean(ui?.isAnimateMode)
      // When re-entering Animate, select the last clip on the active canvas so
      // the timeline opens ready to edit (matches setIsAnimateMode(true)).
      let selectedClipId: string | null = null
      if (restoreAnimate) {
        const active = present.canvases.find(
          (c) => c.id === present.activeCanvasId
        )
        const clips = active?.animation?.clips ?? []
        if (clips.length > 0) {
          const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
          selectedClipId = sorted[sorted.length - 1]?.id ?? null
        }
      }
      set({
        past: [],
        present,
        future: [],
        _lastGroup: null,
        _lastTs: 0,
        currentDraft: draft,
        // UI state — fall back to defaults when the saved draft predates the
        // wrapped payload shape.
        presetTab: ui?.presetTab ?? "single",
        activeLayoutPresetId: ui?.activeLayoutPresetId ?? null,
        activeCustomPresetId: ui?.activeCustomPresetId ?? null,
        activeSinglePresetId: ui?.activeSinglePresetId ?? null,
        bulkEditMode: ui?.bulkEditMode ?? defaultBulk,
        bulkViewportZoom: ui?.bulkViewportZoom ?? 1,
        bulkScale: ui?.bulkScale ?? 65,
        previewAutoScrollDelay: ui?.previewAutoScrollDelay ?? 3000,
        previewAnimation: ui?.previewAnimation ?? "slide",
        isAnimateMode: restoreAnimate,
        selectedAnimationClipId: selectedClipId,
        selectedAnimationClipIds: selectedClipId ? [selectedClipId] : [],
        ...CLEAR_SELECTION,
      })
    },
    loadTemplateState: (state, ui) => {
      const incoming = normalizeEditorState(state)
      // A template ships a screenshot only so it can render a thumbnail — the
      // composition (background, frame, shadow, layout…) is what we apply. Drop
      // every media field and carry over whatever the user already had on their
      // active canvas, so applying a template restyles their screenshot (or
      // leaves the canvas empty when they have none).
      const prev = get().present
      const prevActive = prev.canvases.find((c) => c.id === prev.activeCanvasId)
      const present: EditorState = {
        ...incoming,
        canvases: incoming.canvases.map((canvas) => {
          const cleared: CanvasState = {
            ...canvas,
            screenshot: null,
            originalScreenshot: null,
            lastCropRegion: null,
            videoClips: null,
            tweet: null,
            fullPageCapture: { scrollPosition: 0 },
            screenshotSlots: canvas.screenshotSlots.map((slot) => ({
              ...slot,
              src: null,
            })),
          }
          if (canvas.id === incoming.activeCanvasId && prevActive) {
            return {
              ...cleared,
              screenshot: prevActive.screenshot,
              originalScreenshot: prevActive.originalScreenshot,
              lastCropRegion: prevActive.lastCropRegion,
              videoClips: prevActive.videoClips ?? null,
              fullPageCapture: prevActive.fullPageCapture ?? {
                scrollPosition: 0,
              },
            }
          }
          return cleared
        }),
      }
      const defaultBulk = present.canvases.length > 1
      const restoreAnimate = Boolean(ui?.isAnimateMode)
      let selectedClipId: string | null = null
      if (restoreAnimate) {
        const active = present.canvases.find(
          (c) => c.id === present.activeCanvasId
        )
        const clips = active?.animation?.clips ?? []
        if (clips.length > 0) {
          const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
          selectedClipId = sorted[sorted.length - 1]?.id ?? null
        }
      }
      set({
        past: [],
        present,
        future: [],
        _lastGroup: null,
        _lastTs: 0,
        // Templates are a starting point, not a saved project: keep the draft
        // pointer empty so the first Save writes a new draft.
        currentDraft: null,
        presetTab: ui?.presetTab ?? "single",
        activeLayoutPresetId: ui?.activeLayoutPresetId ?? null,
        activeCustomPresetId: ui?.activeCustomPresetId ?? null,
        activeSinglePresetId: ui?.activeSinglePresetId ?? null,
        bulkEditMode: ui?.bulkEditMode ?? defaultBulk,
        bulkViewportZoom: ui?.bulkViewportZoom ?? 1,
        bulkScale: ui?.bulkScale ?? 65,
        previewAutoScrollDelay: ui?.previewAutoScrollDelay ?? 3000,
        previewAnimation: ui?.previewAnimation ?? "slide",
        isAnimateMode: restoreAnimate,
        selectedAnimationClipId: selectedClipId,
        selectedAnimationClipIds: selectedClipId ? [selectedClipId] : [],
        ...CLEAR_SELECTION,
      })
    },
    applyPresetSnapshot: (snapshot, canvasId) => {
      commit((state) => {
        const targetId = canvasId ?? state.activeCanvasId
        const canvases = state.canvases.map((canvas) => {
          if (canvas.id !== targetId) return canvas

          const existingSlots = canvas.screenshotSlots
          const slots: ScreenshotSlot[] = canvas.tweet
            ? []
            : snapshot.slots.map((config, index) => {
                const previous = existingSlots[index]
                // Preset geometry drives pose; live media + per-slot overrides
                // that presets don't capture (frame, border, padding, …) stay
                // on the matching index so mixed-frame layouts survive apply.
                return {
                  id: previous?.id ?? makeId(),
                  src: previous?.src ?? null,
                  originalSrc: previous?.originalSrc ?? null,
                  lastCropRegion: previous?.lastCropRegion ?? null,
                  fullPageCapture: previous?.fullPageCapture ?? null,
                  xPct: config.xPct,
                  yPct: config.yPct,
                  widthPct: config.widthPct ?? previous?.widthPct ?? 60,
                  heightPct: config.heightPct ?? previous?.heightPct ?? 28,
                  rotation: config.rotation,
                  tilt: config.tilt,
                  scale: config.scale,
                  zIndex:
                    config.zIndex ??
                    previous?.zIndex ??
                    computeNextLayerZ(canvas) + index,
                  filter: config.filter ?? previous?.filter ?? "none",
                  adjustments: config.adjustments ?? previous?.adjustments,
                  hidden: config.hidden ?? previous?.hidden,
                  objectFit: config.objectFit ?? previous?.objectFit,
                  shadow: config.shadow ?? previous?.shadow,
                  border: previous?.border,
                  borderRadius: previous?.borderRadius,
                  padding: previous?.padding,
                  lighting: previous?.lighting,
                  frame: previous?.frame,
                }
              })

          const offset = resolveMainOffsetPx(snapshot.mainOffset)

          const style = snapshot.canvasStyle
          let next: CanvasState = {
            // Style bag (background, shadow, layers, …) layered over the live
            // canvas. mergeCanvasStyle honours the frame-vs-tweet and
            // tweetSettings special cases and skips absent fields.
            ...mergeCanvasStyle(canvas, style),
            // geometry — always driven by the preset, never the style bag
            tilt: snapshot.canvasTilt,
            scale: snapshot.canvasScale,
            screenshotPosition: style?.screenshotPosition ?? "center",
            screenshotOffset: offset,
            screenshotSlots: canvas.tweet ? [] : slots,
            // live pixels are preserved by mergeCanvasStyle (not in the style
            // bag); kept explicit here for clarity at the apply boundary.
            screenshot: canvas.screenshot,
            originalScreenshot: canvas.originalScreenshot,
            lastCropRegion: canvas.lastCropRegion,
          }

          // Animate presets replace the timeline and fold the last clip pose
          // into the committed canvas (matches exit-animate end-frame behavior).
          if (
            snapshot.animation &&
            Array.isArray(snapshot.animation.clips) &&
            snapshot.animation.clips.length > 0
          ) {
            const liveSlotIds = next.screenshotSlots.map((s) => s.id)
            const remapped = remapAnimationForApply(
              snapshot.animation,
              liveSlotIds,
              next.background
            )
            const sorted = [...remapped.clips].sort(
              (a, b) => a.startMs - b.startMs
            )
            const last = sorted[sorted.length - 1]
            // Older animate presets could save the open final clip before its
            // live inspector edits had been copied into `clip.pose`. When that
            // clip owns Position, its stale pose equals its baseline while the
            // top-level preset geometry still contains the real final placement.
            // Recover that placement so existing presets animate correctly too.
            const lastPose = last ? clipPose(last) : null
            const lastBaseline = last ? clipBaseline(last) : null
            let repairedAnimation = remapped
            if (
              last &&
              lastPose &&
              lastBaseline &&
              (last.effects ?? []).includes("position") &&
              lastPose.screenshotPosition === lastBaseline.screenshotPosition &&
              lastPose.screenshotOffset.x === lastBaseline.screenshotOffset.x &&
              lastPose.screenshotOffset.y === lastBaseline.screenshotOffset.y &&
              (lastPose.screenshotPosition !== next.screenshotPosition ||
                lastPose.screenshotOffset.x !== next.screenshotOffset.x ||
                lastPose.screenshotOffset.y !== next.screenshotOffset.y)
            ) {
              repairedAnimation = {
                ...remapped,
                clips: remapped.clips.map((clip) =>
                  clip.id === last.id
                    ? {
                        ...clip,
                        pose: {
                          ...lastPose,
                          screenshotPosition: next.screenshotPosition,
                          screenshotOffset: next.screenshotOffset,
                        },
                      }
                    : clip
                ),
              }
            }
            // Rest at the animation's final frame, but position sits at its START
            // (see buildRestingPose) so a "move" preset shows where it begins.
            const restingPose = buildRestingPose(next, repairedAnimation.clips)
            const posePatch = restingPose
              ? applyPoseToCanvas(next, restingPose)
              : {}
            next = {
              ...next,
              ...posePatch,
              // Pose may rewrite slots; keep ids from geometry apply.
              screenshotSlots: (
                posePatch.screenshotSlots ?? next.screenshotSlots
              ).map((s, i) => ({
                ...s,
                id: next.screenshotSlots[i]?.id ?? s.id,
                src: next.screenshotSlots[i]?.src ?? s.src,
              })),
              animation: repairedAnimation,
            }
          }

          return next
        })
        return { canvases }
      }, "preset:apply")
    },
  }) satisfies Partial<EditorActions>
