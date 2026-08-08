import {
  createCanvas,
  DEFAULT_STATE,
  MAX_CANVASES,
  CLEAR_SELECTION,
} from "../defaults"
import type { CanvasState } from "../../state-types"
import { makeId, placementAfterCanvas } from "../canvas-helpers"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createCanvasActions = ({ set, get, commit }: CommitContext) =>
  ({
    undo: () => {
      const state = get()
      if (!state.past.length) return
      const prev = state.past[state.past.length - 1]
      set({
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        _lastGroup: null,
        _lastTs: 0,
        bulkEditMode: prev.canvases.length > 1,
      })
    },
    redo: () => {
      const state = get()
      if (!state.future.length) return
      const next = state.future[0]
      set({
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        _lastGroup: null,
        _lastTs: 0,
        bulkEditMode: next.canvases.length > 1,
      })
    },
    reset: () => {
      const state = get()
      set({
        past: [...state.past, state.present],
        present: DEFAULT_STATE,
        future: [],
        _lastGroup: null,
        _lastTs: 0,
        bulkCanvasDragging: false,
        bulkViewportZoom: 1,
        currentDraft: null,
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
        activeSinglePresetId: null,
      })
    },
    addCanvas: () => {
      if (get().present.canvases.length >= MAX_CANVASES) return null
      const id = makeId()
      commit((state) => {
        const newCanvas = createCanvas(id, placementAfterCanvas(state))
        return {
          canvases: [...state.canvases, newCanvas],
          activeCanvasId: id,
        }
      }, null)
      set((s) => ({
        ...CLEAR_SELECTION,
        bulkEditMode: true,
        bulkCanvasDragging: false,
        bulkViewportZoom: 1,
        bulkFitViewSeq: s.bulkFitViewSeq + 1,
      }))
      return id
    },
    removeCanvas: (id) => {
      commit((state) => {
        if (state.canvases.length <= 1) return {}
        const remaining = state.canvases.filter((c) => c.id !== id)
        const activeCanvasId =
          state.activeCanvasId === id
            ? (remaining[0]?.id ?? state.activeCanvasId)
            : state.activeCanvasId
        return { canvases: remaining, activeCanvasId }
      }, null)
      set({ ...CLEAR_SELECTION })
    },
    duplicateCanvas: (sourceId) => {
      if (get().present.canvases.length >= MAX_CANVASES) return null
      const newId = makeId()
      let didCopy = false
      commit((state) => {
        const targetId = sourceId ?? state.activeCanvasId
        const srcIndex = state.canvases.findIndex((c) => c.id === targetId)
        if (srcIndex < 0) return {}
        didCopy = true
        const src = state.canvases[srcIndex]
        const copy: CanvasState = {
          ...src,
          id: newId,
          position: placementAfterCanvas(state, src.id),
        }
        // Insert the copy right after the source canvas
        const canvases = [...state.canvases]
        canvases.splice(srcIndex + 1, 0, copy)
        return {
          canvases,
          activeCanvasId: newId,
        }
      }, null)
      if (didCopy) {
        set((s) => ({ bulkFitViewSeq: s.bulkFitViewSeq + 1 }))
      }
      return didCopy ? newId : null
    },
    setActiveCanvasId: (id) => {
      const state = get()
      if (state.present.activeCanvasId === id) return
      commit({ activeCanvasId: id }, null)
      set({ ...CLEAR_SELECTION })
    },
    setCanvasPosition: (id, position) => {
      commit(
        (state) => ({
          canvases: state.canvases.map((c) =>
            c.id === id ? { ...c, position } : c
          ),
        }),
        `canvasPosition-${id}`
      )
    },
    setCanvasPositions: (positions) => {
      commit(
        (state) => ({
          canvases: state.canvases.map((c) =>
            positions[c.id] ? { ...c, position: positions[c.id] } : c
          ),
        }),
        null
      )
    },
    requestBulkFitView: () =>
      set((s) => ({ bulkFitViewSeq: s.bulkFitViewSeq + 1 })),
  }) satisfies Partial<EditorActions>
