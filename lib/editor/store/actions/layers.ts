import { FONT_FAMILIES } from "../../fonts"
import { CANVAS_BASE_W, duplicateLayerItem, makeId } from "../canvas-helpers"
import { computeNextLayerZ } from "../layer-stack"
import { CLEAR_SELECTION } from "../defaults"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

export const createLayerActions = ({
  set,
  get,
  commit,
  commitCanvas,
  makeLayerOps,
}: CommitContext) => {
  const textLayerOps = makeLayerOps("text")
  const assetLayerOps = makeLayerOps("asset")
  const annotationShapeLayerOps = makeLayerOps("annotation")

  return {
    setAnnotation: (patch) =>
      commit(
        (state) => ({ annotation: { ...state.annotation, ...patch } }),
        "annotation"
      ),

    addAnnotationStroke: (stroke, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: [
            ...canvas.annotations,
            { ...stroke, id, zIndex: computeNextLayerZ(canvas) },
          ],
        }),
        `annotation-stroke-${id}`
      )
      return id
    },
    updateAnnotationStroke: (id, points, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.map((stroke) =>
            stroke.id === id ? { ...stroke, points } : stroke
          ),
        }),
        `annotation-stroke-${id}`
      ),
    updateAnnotationStrokeLayer: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.map((stroke) =>
            stroke.id === id ? { ...stroke, ...patch } : stroke
          ),
        }),
        `annotation-stroke-${id}`
      ),
    deleteAnnotationStroke: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.filter((stroke) => stroke.id !== id),
        }),
        null
      ),

    addAnnotationShape: (shape, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: [
            ...canvas.annotationShapes,
            { ...shape, id, zIndex: computeNextLayerZ(canvas) },
          ],
        }),
        null
      )
      return id
    },
    updateAnnotationShape: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: canvas.annotationShapes.map((shape) =>
            shape.id === id ? { ...shape, ...patch } : shape
          ),
        }),
        `annotation-shape-${id}`
      ),
    deleteAnnotationShape: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: canvas.annotationShapes.filter(
            (shape) => shape.id !== id
          ),
        }),
        null
      ),
    duplicateAnnotationShape: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const result = duplicateLayerItem(
            canvas.annotationShapes,
            id,
            copyId,
            computeNextLayerZ(canvas),
            { offset: 3, maxPct: 98 }
          )
          didCopy = result.ok
          return { annotationShapes: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAnnotationShapeToFront: annotationShapeLayerOps.toFront,
    sendAnnotationShapeToBack: annotationShapeLayerOps.toBack,
    clearAnnotations: (canvasId) =>
      commitCanvas(canvasId, { annotations: [], annotationShapes: [] }, null),

    addText: (canvasId) => {
      const id = makeId()
      const state = get()
      const aw = state.present.aspect.w || 16
      const ah = state.present.aspect.h || 10
      const canvasW = CANVAS_BASE_W
      const canvasH = (CANVAS_BASE_W * ah) / aw
      const defaultFontSize = Math.round(
        Math.min(96, Math.max(18, Math.max(canvasW, canvasH) * 0.028))
      )
      commitCanvas(
        canvasId,
        (canvas) => ({
          texts: [
            ...canvas.texts,
            {
              id,
              content: "Double-click to edit",
              xPct: 50,
              yPct: 85,
              rotation: 0,
              fontSize: defaultFontSize,
              fontFamily: FONT_FAMILIES[0].css,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: 0,
              color: "#ffffff",
              align: "left",
              borderColor: null,
              borderWidth: 1,
              borderStyle: "solid",
              zIndex: computeNextLayerZ(canvas),
              widthPx: null,
              heightPx: null,
              autoColor: true,
              opacity: 100,
              blendMode: "normal",
            },
          ],
        }),
        null
      )
      return id
    },
    updateText: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          texts: canvas.texts.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }),
        `text-${id}`
      ),
    deleteText: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ texts: canvas.texts.filter((t) => t.id !== id) }),
        null
      ),
    duplicateText: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const result = duplicateLayerItem(
            canvas.texts,
            id,
            copyId,
            computeNextLayerZ(canvas)
          )
          didCopy = result.ok
          return { texts: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringTextToFront: textLayerOps.toFront,
    sendTextToBack: textLayerOps.toBack,
    setSelectedTextId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedTextId: id }
          : { selectedTextId: null }
      ),

    addAsset: (src, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          assets: [
            ...canvas.assets,
            {
              id,
              src,
              xPct: 50,
              yPct: 50,
              widthPct: 25,
              heightPct: null,
              rotation: 0,
              zIndex: computeNextLayerZ(canvas),
              opacity: 100,
              filter: "none",
              blendMode: "normal",
              hidden: false,
            },
          ],
        }),
        null
      )
      return id
    },
    updateAsset: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          assets: canvas.assets.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        }),
        `asset-${id}`
      ),
    deleteAsset: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ assets: canvas.assets.filter((a) => a.id !== id) }),
        null
      ),
    duplicateAsset: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const result = duplicateLayerItem(
            canvas.assets,
            id,
            copyId,
            computeNextLayerZ(canvas)
          )
          didCopy = result.ok
          return { assets: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAssetToFront: assetLayerOps.toFront,
    sendAssetToBack: assetLayerOps.toBack,
    setSelectedAssetId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedAssetId: id }
          : { selectedAssetId: null }
      ),
    setSelectedAnnotationShapeId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedAnnotationShapeId: id }
          : { selectedAnnotationShapeId: null }
      ),
    setSelectedScreenshotSlotId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedScreenshotSlotId: id }
          : { selectedScreenshotSlotId: null }
      ),
    setIsScreenshotSelected: (selected) =>
      set(
        selected
          ? { ...CLEAR_SELECTION, isScreenshotSelected: true }
          : { isScreenshotSelected: false }
      ),
  } satisfies Partial<EditorActions>
}
