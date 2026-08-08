import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createSessionActions = ({ set, commit }: CommitContext) =>
  ({
    setTopBarPopoverOpen: (open) => set({ topBarPopoverOpen: open }),
    setIsPreviewMode: (p) => set({ isPreviewMode: p }),
    setIsPreviewAutoScroll: (a) => set({ isPreviewAutoScroll: a }),
    setPreviewAnimation: (a) => set({ previewAnimation: a }),
    setPreviewAutoScrollDelay: (d) => set({ previewAutoScrollDelay: d }),
    setBulkEditMode: (b) => {
      if (!b) {
        // Reset all canvas positions to center when disabling bulk edit.
        commit(
          (state) => ({
            canvases: state.canvases.map((canvas) => ({
              ...canvas,
              position: { x: 0, y: 0 },
            })),
          }),
          null
        )
      }
      set({ bulkEditMode: b, bulkCanvasDragging: false, bulkViewportZoom: 1 })
    },
    setBulkCanvasDragging: (dragging) => set({ bulkCanvasDragging: dragging }),
    setScreenshotPositionDragging: (dragging) =>
      set({ screenshotPositionDragging: dragging }),
    setBulkViewportZoom: (zoom) =>
      set({ bulkViewportZoom: Math.max(0.05, Math.min(2, zoom)) }),
    setBulkScale: (value) =>
      set({ bulkScale: Math.max(20, Math.min(100, value)) }),
  }) satisfies Partial<EditorActions>
