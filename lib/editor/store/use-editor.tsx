"use client"

import * as React from "react"
import { useShallow } from "zustand/react/shallow"

import type { CanvasState, EditorState, ScreenshotSlot } from "../state-types"

import { DEFAULT_CANVAS_BASE } from "./defaults"
import type { EditorActions, EditorStore } from "../store"
import { useEditorStore } from "../store"

const CanvasIdContext = React.createContext<string | null>(null)

const CanvasOverrideContext = React.createContext<Partial<CanvasState> | null>(
  null
)

const CanvasPreviewModeContext = React.createContext<boolean>(false)

export function CanvasPreviewScope({
  override,
  children,
}: {
  override: Partial<CanvasState> | null
  children: React.ReactNode
}) {
  return (
    <CanvasPreviewModeContext.Provider value={true}>
      <CanvasOverrideContext.Provider value={override}>
        {children}
      </CanvasOverrideContext.Provider>
    </CanvasPreviewModeContext.Provider>
  )
}

export function useCanvasPreviewMode() {
  return React.useContext(CanvasPreviewModeContext)
}

export function CanvasScope({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <CanvasIdContext.Provider value={id}>{children}</CanvasIdContext.Provider>
  )
}

export function useCanvasScopeId() {
  return React.useContext(CanvasIdContext)
}

export function useActiveCanvasId() {
  return useEditorStore((s) => s.present.activeCanvasId)
}

export function useCanvases() {
  return useEditorStore((s) => s.present.canvases)
}

export function useCanvasById(id: string): CanvasState | undefined {
  return useEditorStore((s) => s.present.canvases.find((c) => c.id === id))
}

export function useSelectedScreenshotSlot(): ScreenshotSlot | null {
  const selectedId = useEditorStore((s) => s.selectedScreenshotSlotId)
  return useActiveCanvasField((canvas) =>
    selectedId
      ? (canvas.screenshotSlots.find((slot) => slot.id === selectedId) ?? null)
      : null
  )
}

const FALLBACK_CANVAS: CanvasState = {
  ...DEFAULT_CANVAS_BASE,
  id: "__fallback__",
  position: { x: 0, y: 0 },
}

export function useActiveCanvasField<T>(
  selector: (canvas: CanvasState) => T
): T {
  const scopeId = React.useContext(CanvasIdContext)
  const override = React.useContext(CanvasOverrideContext)

  const overrideRef = React.useRef(override)
  const selectorRef = React.useRef(selector)
  // Refs must reflect the latest values synchronously so the stable selector
  // (read by zustand during render) sees fresh data. useEffect would lag.
  /* eslint-disable react-hooks/refs */
  overrideRef.current = override
  selectorRef.current = selector
  /* eslint-enable react-hooks/refs */

  const mergedCacheRef = React.useRef<{
    base: CanvasState | null
    ov: Partial<CanvasState> | null
    merged: CanvasState | null
  }>({ base: null, ov: null, merged: null })

  const stableSelector = React.useCallback(
    (s: EditorStore) => {
      const id = scopeId ?? s.present.activeCanvasId
      const base =
        s.present.canvases.find((c) => c.id === id) ??
        s.present.canvases[0] ??
        FALLBACK_CANVAS
      const ov = overrideRef.current
      let canvas: CanvasState
      if (ov) {
        const cache = mergedCacheRef.current
        if (cache.base === base && cache.ov === ov && cache.merged !== null) {
          canvas = cache.merged
        } else {
          canvas = { ...base, ...ov }
          mergedCacheRef.current = { base, ov, merged: canvas }
        }
      } else {
        canvas = base
      }
      return selectorRef.current(canvas)
    },
    [scopeId]
  )

  // Wrap with useShallow so selectors returning a new object literal (e.g.
  // `(c) => ({ frame: c.frame, padding: c.padding })`) don't trigger re-renders
  // when field values haven't changed, and also satisfy React's requirement that
  // getSnapshot returns a stable reference between calls (preventing the
  // "getSnapshot should be cached" infinite loop warning).
  return useEditorStore(useShallow(stableSelector))
}

export type EditorContext = Omit<EditorState, "canvases"> &
  CanvasState &
  EditorActions & {
    topBarPopoverOpen: boolean
    isPreviewMode: boolean
    isPreviewAutoScroll: boolean
    previewAutoScrollDelay: number
    previewAnimation: "slide" | "fade" | "zoom" | "flip"
    bulkEditMode: boolean
    bulkCanvasDragging: boolean
    bulkViewportZoom: number
    bulkScale: number
    selectedTextId: string | null
    selectedAssetId: string | null
    selectedAnnotationShapeId: string | null
    selectedScreenshotSlotId: string | null
    isScreenshotSelected: boolean
    canUndo: boolean
    canRedo: boolean
    canvases: CanvasState[]
    canvasScopeId: string
    canvasCount: number
  }

export function useEditor(): EditorContext {
  const scopeId = React.useContext(CanvasIdContext)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const targetId = scopeId ?? activeCanvasId
  const activeTool = useEditorStore((s) => s.present.activeTool)
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasAspectOverride = useEditorStore(
    (s) => s.present.canvases.find((c) => c.id === targetId)?.aspect
  )
  const aspect = canvasAspectOverride ?? globalAspect
  const canvasZoom = useEditorStore((s) => s.present.canvasZoom)
  const annotation = useEditorStore((s) => s.present.annotation)
  const canvas = useActiveCanvasField((c) => c)
  const topBarPopoverOpen = useEditorStore((s) => s.topBarPopoverOpen)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const isPreviewAutoScroll = useEditorStore((s) => s.isPreviewAutoScroll)
  const previewAutoScrollDelay = useEditorStore((s) => s.previewAutoScrollDelay)
  const previewAnimation = useEditorStore((s) => s.previewAnimation)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const bulkCanvasDragging = useEditorStore((s) => s.bulkCanvasDragging)
  const bulkViewportZoom = useEditorStore((s) => s.bulkViewportZoom)
  const bulkScale = useEditorStore((s) => s.bulkScale)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectedAssetId = useEditorStore((s) => s.selectedAssetId)
  const selectedAnnotationShapeId = useEditorStore(
    (s) => s.selectedAnnotationShapeId
  )
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const store = useEditorStore.getState()

  return {
    // shared editor state
    topBarPopoverOpen,
    activeTool,
    aspect,
    canvasZoom,
    annotation,
    canvases: store.present.canvases,
    activeCanvasId,
    canvasScopeId: canvas.id,

    // flattened canvas state
    id: canvas.id,
    position: canvas.position,
    screenshot: canvas.screenshot,
    originalScreenshot: canvas.originalScreenshot,
    lastCropRegion: canvas.lastCropRegion,
    background: canvas.background,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    canvasBorderRadius: canvas.canvasBorderRadius,
    border: canvas.border,
    backdrop: canvas.backdrop,
    tilt: canvas.tilt,
    scale: canvas.scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    screenshotLayer: canvas.screenshotLayer,
    shadow: canvas.shadow,
    overlay: canvas.overlay,
    frame: canvas.frame,
    frameAddress: canvas.frameAddress,
    portrait: canvas.portrait,
    texts: canvas.texts,
    assets: canvas.assets,
    enhance: canvas.enhance,
    annotations: canvas.annotations,
    annotationShapes: canvas.annotationShapes,
    screenshotSlots: canvas.screenshotSlots,
    objectFit: canvas.objectFit,
    tweet: canvas.tweet,

    isPreviewMode,
    isPreviewAutoScroll,
    previewAutoScrollDelay,
    previewAnimation,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
    bulkScale,
    selectedTextId,
    selectedAssetId,
    selectedAnnotationShapeId,
    selectedScreenshotSlotId,
    isScreenshotSelected,
    canUndo,
    canRedo,

    setTopBarPopoverOpen: store.setTopBarPopoverOpen,
    setActiveTool: store.setActiveTool,
    setPresetTab: store.setPresetTab,
    setActiveLayoutPresetId: store.setActiveLayoutPresetId,
    setActiveCustomPresetId: store.setActiveCustomPresetId,
    setActiveSinglePresetId: store.setActiveSinglePresetId,
    setCustomPresets: store.setCustomPresets,
    addCustomPreset: store.addCustomPreset,
    updateCustomPreset: store.updateCustomPreset,
    removeCustomPreset: store.removeCustomPreset,
    setCurrentDraft: store.setCurrentDraft,
    loadDraftState: store.loadDraftState,
    applyPresetSnapshot: (snapshot, canvasId) =>
      store.applyPresetSnapshot(snapshot, canvasId ?? targetId),
    setScreenshot: (s, canvasId) =>
      store.setScreenshot(s, canvasId ?? targetId),
    applyCroppedScreenshot: (s, region, canvasId) =>
      store.applyCroppedScreenshot(s, region, canvasId ?? targetId),
    setAspect: store.setAspect,
    setCanvasAspect: store.setCanvasAspect,
    setBackground: (b, canvasId) =>
      store.setBackground(b, canvasId ?? targetId),
    setPadding: (n, canvasId) => store.setPadding(n, canvasId ?? targetId),
    setBorderRadius: (n, canvasId) =>
      store.setBorderRadius(n, canvasId ?? targetId),
    setCanvasBorderRadius: (n, canvasId) =>
      store.setCanvasBorderRadius(n, canvasId ?? targetId),
    setBorder: (b, canvasId) => store.setBorder(b, canvasId ?? targetId),
    setMainScreenshotPadding: (n, canvasId) =>
      store.setMainScreenshotPadding(n, canvasId ?? targetId),
    setMainScreenshotBorderRadius: (n, canvasId) =>
      store.setMainScreenshotBorderRadius(n, canvasId ?? targetId),
    setMainScreenshotBorder: (b, canvasId) =>
      store.setMainScreenshotBorder(b, canvasId ?? targetId),
    setBackdropEffects: (e, canvasId) =>
      store.setBackdropEffects(e, canvasId ?? targetId),
    setBackdropPattern: (p, canvasId) =>
      store.setBackdropPattern(p, canvasId ?? targetId),
    setBackdropLighting: (l, canvasId) =>
      store.setBackdropLighting(l, canvasId ?? targetId),
    setMainScreenshotBackdropLighting: (l, canvasId) =>
      store.setMainScreenshotBackdropLighting(l, canvasId ?? targetId),
    setBackdropFilter: (f, canvasId) =>
      store.setBackdropFilter(f, canvasId ?? targetId),
    setTilt: (t, canvasId) => store.setTilt(t, canvasId ?? targetId),
    setScale: (n, canvasId) => store.setScale(n, canvasId ?? targetId),
    setTiltAndScale: (t, scale, canvasId) =>
      store.setTiltAndScale(t, scale, canvasId ?? targetId),
    setScreenshotTilt: (t, canvasId) =>
      store.setScreenshotTilt(t, canvasId ?? targetId),
    setScreenshotScale: (n, canvasId) =>
      store.setScreenshotScale(n, canvasId ?? targetId),
    setScreenshotRotation: (n, canvasId) =>
      store.setScreenshotRotation(n, canvasId ?? targetId),
    setCanvasZoom: store.setCanvasZoom,
    setScreenshotPosition: (p, canvasId) =>
      store.setScreenshotPosition(p, canvasId ?? targetId),
    setScreenshotOffset: (o, canvasId) =>
      store.setScreenshotOffset(o, canvasId ?? targetId),
    setScreenshotPlacement: (p, o, canvasId) =>
      store.setScreenshotPlacement(p, o, canvasId ?? targetId),
    updateScreenshotLayer: (patch, canvasId) =>
      store.updateScreenshotLayer(patch, canvasId ?? targetId),
    setShadow: (s, canvasId) => store.setShadow(s, canvasId ?? targetId),
    setMainScreenshotShadow: (s, canvasId) =>
      store.setMainScreenshotShadow(s, canvasId ?? targetId),
    setOverlay: (o, canvasId) => store.setOverlay(o, canvasId ?? targetId),
    setFrame: (f, canvasId) => store.setFrame(f, canvasId ?? targetId),
    setFrameForMatchingScreenshots: (f, canvasId) =>
      store.setFrameForMatchingScreenshots(f, canvasId ?? targetId),
    setObjectFit: (fit, canvasId) =>
      store.setObjectFit(fit, canvasId ?? targetId),
    setFrameAddress: (address, canvasId) =>
      store.setFrameAddress(address, canvasId ?? targetId),
    setTweet: (card, canvasId) => store.setTweet(card, canvasId ?? targetId),
    updateTweet: (patch, canvasId) =>
      store.updateTweet(patch, canvasId ?? targetId),
    clearTweet: (canvasId) => store.clearTweet(canvasId ?? targetId),
    bringScreenshotToFront: (canvasId) =>
      store.bringScreenshotToFront(canvasId ?? targetId),
    sendScreenshotToBack: (canvasId) =>
      store.sendScreenshotToBack(canvasId ?? targetId),
    setPortrait: (p, canvasId) => store.setPortrait(p, canvasId ?? targetId),
    setEnhance: (e, canvasId) => store.setEnhance(e, canvasId ?? targetId),
    setAnnotation: store.setAnnotation,
    addAnnotationStroke: (stroke, canvasId) =>
      store.addAnnotationStroke(stroke, canvasId ?? targetId),
    updateAnnotationStroke: (id, points, canvasId) =>
      store.updateAnnotationStroke(id, points, canvasId ?? targetId),
    updateAnnotationStrokeLayer: (id, patch, canvasId) =>
      store.updateAnnotationStrokeLayer(id, patch, canvasId ?? targetId),
    deleteAnnotationStroke: (id, canvasId) =>
      store.deleteAnnotationStroke(id, canvasId ?? targetId),
    addAnnotationShape: (shape, canvasId) =>
      store.addAnnotationShape(shape, canvasId ?? targetId),
    updateAnnotationShape: (id, patch, canvasId) =>
      store.updateAnnotationShape(id, patch, canvasId ?? targetId),
    deleteAnnotationShape: (id, canvasId) =>
      store.deleteAnnotationShape(id, canvasId ?? targetId),
    duplicateAnnotationShape: (id, canvasId) =>
      store.duplicateAnnotationShape(id, canvasId ?? targetId),
    bringAnnotationShapeToFront: (id, canvasId) =>
      store.bringAnnotationShapeToFront(id, canvasId ?? targetId),
    sendAnnotationShapeToBack: (id, canvasId) =>
      store.sendAnnotationShapeToBack(id, canvasId ?? targetId),
    clearAnnotations: (canvasId) =>
      store.clearAnnotations(canvasId ?? targetId),
    addText: (canvasId) => store.addText(canvasId ?? targetId),
    updateText: (id, patch, canvasId) =>
      store.updateText(id, patch, canvasId ?? targetId),
    deleteText: (id, canvasId) => store.deleteText(id, canvasId ?? targetId),
    duplicateText: (id, canvasId) =>
      store.duplicateText(id, canvasId ?? targetId),
    bringTextToFront: (id, canvasId) =>
      store.bringTextToFront(id, canvasId ?? targetId),
    sendTextToBack: (id, canvasId) =>
      store.sendTextToBack(id, canvasId ?? targetId),
    setSelectedTextId: store.setSelectedTextId,
    addAsset: (src, canvasId) => store.addAsset(src, canvasId ?? targetId),
    updateAsset: (id, patch, canvasId) =>
      store.updateAsset(id, patch, canvasId ?? targetId),
    deleteAsset: (id, canvasId) => store.deleteAsset(id, canvasId ?? targetId),
    duplicateAsset: (id, canvasId) =>
      store.duplicateAsset(id, canvasId ?? targetId),
    bringAssetToFront: (id, canvasId) =>
      store.bringAssetToFront(id, canvasId ?? targetId),
    sendAssetToBack: (id, canvasId) =>
      store.sendAssetToBack(id, canvasId ?? targetId),
    setSelectedAssetId: store.setSelectedAssetId,
    setSelectedAnnotationShapeId: store.setSelectedAnnotationShapeId,
    setSelectedScreenshotSlotId: store.setSelectedScreenshotSlotId,
    setIsScreenshotSelected: store.setIsScreenshotSelected,
    setIsPreviewMode: store.setIsPreviewMode,
    setIsPreviewAutoScroll: store.setIsPreviewAutoScroll,
    setPreviewAutoScrollDelay: store.setPreviewAutoScrollDelay,
    setPreviewAnimation: store.setPreviewAnimation,
    setBulkEditMode: store.setBulkEditMode,
    setBulkCanvasDragging: store.setBulkCanvasDragging,
    setBulkViewportZoom: store.setBulkViewportZoom,
    setBulkScale: store.setBulkScale,
    reset: store.reset,
    undo: store.undo,
    redo: store.redo,
    addCanvas: store.addCanvas,
    removeCanvas: store.removeCanvas,
    duplicateCanvas: store.duplicateCanvas,
    setActiveCanvasId: store.setActiveCanvasId,
    setCanvasPosition: store.setCanvasPosition,
    setCanvasPositions: store.setCanvasPositions,
    requestBulkFitView: store.requestBulkFitView,
    addScreenshotSlot: (canvasId) =>
      store.addScreenshotSlot(canvasId ?? targetId),
    updateScreenshotSlot: (id, patch, canvasId) =>
      store.updateScreenshotSlot(id, patch, canvasId ?? targetId),
    setScreenshotSlotImage: (id, src, canvasId) =>
      store.setScreenshotSlotImage(id, src, canvasId ?? targetId),
    applyCroppedScreenshotSlot: (id, src, region, canvasId) =>
      store.applyCroppedScreenshotSlot(id, src, region, canvasId ?? targetId),
    deleteScreenshotSlot: (id, canvasId) =>
      store.deleteScreenshotSlot(id, canvasId ?? targetId),
    duplicateScreenshotSlot: (id, canvasId) =>
      store.duplicateScreenshotSlot(id, canvasId ?? targetId),
    bringScreenshotSlotToFront: (id, canvasId) =>
      store.bringScreenshotSlotToFront(id, canvasId ?? targetId),
    sendScreenshotSlotToBack: (id, canvasId) =>
      store.sendScreenshotSlotToBack(id, canvasId ?? targetId),
    arrangeScreenshotSlotsInRow: (canvasId) =>
      store.arrangeScreenshotSlotsInRow(canvasId ?? targetId),
    setScreenshotSlotGroupPosition: (position, canvasId) =>
      store.setScreenshotSlotGroupPosition(position, canvasId ?? targetId),
    canvasCount,
  }
}
