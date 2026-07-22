"use client"

import * as React from "react"

import {
  clearElementLivePosition,
  livePreviewRoots,
  setElementLivePosition,
} from "@/lib/editor/live-preview-roots"
import {
  type TextElement,
  pickContrastColorAtPosition,
  useEditor,
} from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { useDragSession } from "@/components/editor/canvas/use-drag-session"

import {
  CENTER_SNAP_ENTER_PX,
  CENTER_SNAP_EXIT_PX,
  DRAG_THRESHOLD,
  clamp,
  isTextEditingTarget,
  readCanvasFitScale,
} from "./constants"
import type {
  DragState,
  PinchState,
  ResizeHandleId,
  ResizeLensState,
  ResizeState,
  RotateState,
  TextElementViewProps,
} from "./types"

export function useTextElementInteractions({
  text,
  canvasRef,
  onCenterGuideChange,
}: Pick<TextElementViewProps, "text" | "canvasRef" | "onCenterGuideChange">) {
  const {
    id: canvasScopeId,
    canvasZoom,
    selectedTextId,
    setSelectedTextId,
    setSelectedAnnotationShapeId,
    updateText,
    deleteText,
    screenshot,
    background,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
  } = useEditor()
  const isSelected = selectedTextId === text.id
  const [editingRequested, setEditingRequested] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isRotateSnapped, setIsRotateSnapped] = React.useState(false)
  const [resizeLens, setResizeLens] = React.useState<ResizeLensState | null>(
    null
  )
  const isEditing = isSelected && editingRequested
  const elRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<HTMLDivElement>(null)
  const textViewRef = React.useRef<HTMLDivElement>(null)
  const {
    toolbarRect,
    hideFloatingToolbar,
    shouldAnimatePositionMove,
    measureRect,
    setToolbarRect,
  } = useFloatingToolbarRect({
    elRef,
    isSelected,
    bulkCanvasDragging,
    kind: "text",
    elementId: text.id,
    trackPositionAnimate: true,
  })
  const dragRef = React.useRef<DragState | null>(null)
  const dragSession = useDragSession()
  const rotateRef = React.useRef<RotateState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)
  const pinchRef = React.useRef<PinchState | null>(null)
  const activePtrsRef = React.useRef(
    new Map<number, { x: number; y: number }>()
  )

  const textRef = React.useRef(text)
  const canvasZoomRef = React.useRef(canvasZoom)
  const bulkEditModeRef = React.useRef(bulkEditMode)
  const bulkViewportZoomRef = React.useRef(bulkViewportZoom)
  const onCenterGuideChangeRef = React.useRef(onCenterGuideChange)
  const canvasScopeIdRef = React.useRef(canvasScopeId)
  React.useEffect(() => {
    textRef.current = text
    canvasZoomRef.current = canvasZoom
    bulkEditModeRef.current = bulkEditMode
    bulkViewportZoomRef.current = bulkViewportZoom
    onCenterGuideChangeRef.current = onCenterGuideChange
    canvasScopeIdRef.current = canvasScopeId
  })

  const pointerScale = React.useCallback(() => {
    const fitScale = readCanvasFitScale(
      canvasRef.current,
      canvasZoomRef.current / 100
    )
    const flowScale = bulkEditModeRef.current ? bulkViewportZoomRef.current : 1
    return Math.max(0.05, fitScale * flowScale)
  }, [canvasRef])

  React.useEffect(() => {
    if (!isEditing) return
    const node = editorRef.current
    if (!node) return
    node.innerText = text.content
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [isEditing, text.content, text.widthPx])

  React.useEffect(() => {
    const selectText = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail
      if (detail?.id !== text.id) return
      setEditingRequested(false)
    }
    const editText = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail
      if (detail?.id !== text.id) return
      setSelectedTextId(text.id)
      setSelectedAnnotationShapeId(null)
      setEditingRequested(true)
    }

    window.addEventListener("tokokino:select-text", selectText)
    window.addEventListener("tokokino:edit-text", editText)
    return () => {
      window.removeEventListener("tokokino:select-text", selectText)
      window.removeEventListener("tokokino:edit-text", editText)
    }
  }, [setSelectedAnnotationShapeId, setSelectedTextId, text.id])

  React.useEffect(() => {
    if (!isSelected || isEditing) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isTextEditingTarget(e.target)) return
        e.preventDefault()
        deleteText(text.id)
        setSelectedTextId(null)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isSelected, isEditing, text.id, deleteText, setSelectedTextId])

  React.useEffect(() => {
    if (!text.autoColor) return
    const canvas = canvasRef.current
    const timer = setTimeout(() => {
      pickContrastColorAtPosition(
        canvas,
        text.xPct,
        text.yPct,
        screenshot,
        background
      )
        .then((color) => {
          if (color !== text.color) {
            updateText(text.id, { color, autoColor: true })
          }
        })
        .catch(() => {
          /* ignore */
        })
    }, 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, screenshot])

  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected) return
    measureRect()
  }, [
    bulkCanvasDragging,
    isSelected,
    measureRect,
    text.xPct,
    text.yPct,
    text.rotation,
    text.fontSize,
    text.lineHeight,
    text.letterSpacing,
    text.content,
    text.widthPx,
    text.heightPx,
  ])

  const selectTextElement = React.useCallback(() => {
    setEditingRequested(false)
    setSelectedTextId(text.id)
    setSelectedAnnotationShapeId(null)
  }, [setSelectedAnnotationShapeId, setSelectedTextId, text.id])

  const editTextElement = React.useCallback(() => {
    setSelectedTextId(text.id)
    setSelectedAnnotationShapeId(null)
    setEditingRequested(true)
  }, [setSelectedAnnotationShapeId, setSelectedTextId, text.id])

  const deleteSelectedText = React.useCallback(() => {
    deleteText(text.id)
    setSelectedTextId(null)
  }, [deleteText, setSelectedTextId, text.id])

  const updateResizeLens = React.useCallback((handle: ResizeHandleId) => {
    const el = elRef.current
    if (!el) return
    const width = el.offsetWidth
    const height = el.offsetHeight
    if (!width || !height) return

    const x =
      handle === "ml" || handle === "tl" || handle === "bl"
        ? 0
        : handle === "mr" || handle === "tr" || handle === "br"
          ? width
          : width / 2
    const y =
      handle === "mt" || handle === "tl" || handle === "tr"
        ? 0
        : handle === "mb" || handle === "bl" || handle === "br"
          ? height
          : height / 2

    const liveFontSize = Number.parseFloat(
      textViewRef.current?.style.fontSize ?? ""
    )
    setResizeLens({
      x,
      y,
      width,
      height,
      fontSize: Number.isFinite(liveFontSize)
        ? liveFontSize
        : textRef.current.fontSize,
    })
  }, [])

  const startDrag = React.useCallback(
    (e: React.PointerEvent<Element>) => {
      const t = textRef.current
      if (e.button !== 0) return
      const canvas = canvasRef.current
      if (!canvas) return
      e.stopPropagation()
      e.preventDefault()

      activePtrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      e.currentTarget.setPointerCapture?.(e.pointerId)

      if (activePtrsRef.current.size >= 2) {
        if (dragRef.current) {
          dragRef.current = null
          setIsDragging(false)
          onCenterGuideChangeRef.current?.({ x: false, y: false })
        }
        const ptrs = [...activePtrsRef.current.entries()]
        const [id1, p1] = ptrs[0]
        const [id2, p2] = ptrs[1]
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
        pinchRef.current = {
          pointer1Id: id1,
          pointer2Id: id2,
          startDistance: Math.max(dist, 1),
          startFontSize: t.fontSize,
        }
        return
      }

      setSelectedTextId(t.id)
      setSelectedAnnotationShapeId(null)
      setEditingRequested(false)
      const rect = canvas.getBoundingClientRect()
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: t.xPct,
        startYPct: t.yPct,
        canvasW: rect.width,
        canvasH: rect.height,
        moved: false,
        snapXActive: false,
        snapYActive: false,
        lastXPct: t.xPct,
        lastYPct: t.yPct,
      }
      dragSession.begin()
    },
    [canvasRef, dragSession, setSelectedAnnotationShapeId, setSelectedTextId]
  )

  const moveDrag = React.useCallback(
    (e: React.PointerEvent<Element>) => {
      if (activePtrsRef.current.has(e.pointerId)) {
        activePtrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }

      const pinch = pinchRef.current
      if (
        pinch &&
        (e.pointerId === pinch.pointer1Id || e.pointerId === pinch.pointer2Id)
      ) {
        e.preventDefault()
        const p1 = activePtrsRef.current.get(pinch.pointer1Id)
        const p2 = activePtrsRef.current.get(pinch.pointer2Id)
        if (p1 && p2) {
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
          const scaleFactor = dist / pinch.startDistance
          const newFontSize = clamp(
            Math.round(pinch.startFontSize * scaleFactor),
            8,
            200
          )
          const textView = textViewRef.current
          if (textView) textView.style.fontSize = `${newFontSize}px`
          updateResizeLens("br")
        }
        return
      }

      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.preventDefault()
      const pointerScale = canvasZoomRef.current / 100
      const rawDx = e.clientX - drag.startClientX
      const rawDy = e.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(rawDx, rawDy) < DRAG_THRESHOLD) return
      if (!drag.moved) {
        drag.moved = true
        setIsDragging(true)
      }

      const dx = rawDx / pointerScale
      const dy = rawDy / pointerScale
      let nextX = drag.startXPct + (dx / drag.canvasW) * 100
      let nextY = drag.startYPct + (dy / drag.canvasH) * 100

      const snapEnterXPct = (CENTER_SNAP_ENTER_PX / drag.canvasW) * 100
      const snapEnterYPct = (CENTER_SNAP_ENTER_PX / drag.canvasH) * 100
      const snapExitXPct = (CENTER_SNAP_EXIT_PX / drag.canvasW) * 100
      const snapExitYPct = (CENTER_SNAP_EXIT_PX / drag.canvasH) * 100

      const xDistance = Math.abs(nextX - 50)
      const yDistance = Math.abs(nextY - 50)

      const shouldSnapX = drag.snapXActive
        ? xDistance <= snapExitXPct
        : xDistance <= snapEnterXPct
      const shouldSnapY = drag.snapYActive
        ? yDistance <= snapExitYPct
        : yDistance <= snapEnterYPct

      drag.snapXActive = shouldSnapX
      drag.snapYActive = shouldSnapY

      if (shouldSnapX) nextX = 50
      if (shouldSnapY) nextY = 50
      onCenterGuideChangeRef.current?.({ x: shouldSnapX, y: shouldSnapY })

      const clampedX = clamp(nextX, -20, 120)
      const clampedY = clamp(nextY, -20, 120)
      drag.lastXPct = clampedX
      drag.lastYPct = clampedY

      // Broadcast rather than writing this element's inline style, so the
      // preset thumbnails' copy of this text follows the drag too.
      setElementLivePosition(
        livePreviewRoots(canvasScopeIdRef.current),
        textRef.current.id,
        clampedX,
        clampedY
      )

      const el = elRef.current
      if (el) setToolbarRect(el.getBoundingClientRect())
    },
    [setToolbarRect, updateResizeLens]
  )

  const endDrag = React.useCallback(
    (e: React.PointerEvent<Element>) => {
      activePtrsRef.current.delete(e.pointerId)

      const pinch = pinchRef.current
      if (
        pinch &&
        (e.pointerId === pinch.pointer1Id || e.pointerId === pinch.pointer2Id)
      ) {
        const textView = textViewRef.current
        if (textView) {
          const liveFontSize = Number.parseFloat(textView.style.fontSize)
          if (
            Number.isFinite(liveFontSize) &&
            liveFontSize !== textRef.current.fontSize
          ) {
            updateText(textRef.current.id, { fontSize: liveFontSize })
          }
        }
        pinchRef.current = null
        setResizeLens(null)
        return
      }

      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      if (drag.moved) {
        const el = elRef.current
        if (el) {
          const x = drag.lastXPct
          const y = drag.lastYPct
          const t = textRef.current
          updateText(t.id, {
            xPct: clamp(x, -20, 120),
            yPct: clamp(y, -20, 120),
          })
          if (t.autoColor !== false) {
            const canvas = canvasRef.current
            pickContrastColorAtPosition(
              canvas,
              clamp(x, -20, 120),
              clamp(y, -20, 120),
              screenshot,
              background
            )
              .then((color) => updateText(t.id, { color, autoColor: true }))
              .catch(() => {
                /* ignore */
              })
          }
        }
      }
      dragRef.current = null
      // Clear a frame after the commit paints, so the committed xPct/yPct
      // takes over from the var without a one-frame jump back to the old spot.
      // Skip if the text was grabbed again in the meantime — the new drag owns
      // the vars now and clearing them would strand it at the committed spot.
      const textId = textRef.current.id
      const roots = livePreviewRoots(canvasScopeIdRef.current)
      const token = dragSession.current()
      const clearIfCurrent = () => {
        if (!dragSession.isCurrent(token)) return
        clearElementLivePosition(roots, textId)
      }
      if (typeof requestAnimationFrame === "undefined") {
        clearIfCurrent()
      } else {
        requestAnimationFrame(clearIfCurrent)
      }

      setIsDragging(false)
      onCenterGuideChangeRef.current?.({ x: false, y: false })
    },
    [updateText, screenshot, background, canvasRef, dragSession]
  )

  const startRotate = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = elRef.current
      if (!el) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      rotateRef.current = {
        pointerId: e.pointerId,
        centerX: cx,
        centerY: cy,
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        startRotation: textRef.current.rotation,
      }
    },
    []
  )

  const moveRotate = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const rot = rotateRef.current
      if (!rot || rot.pointerId !== e.pointerId) return
      const angle = Math.atan2(e.clientY - rot.centerY, e.clientX - rot.centerX)
      const delta = ((angle - rot.startAngle) * 180) / Math.PI
      let next = rot.startRotation + delta

      next = ((next % 360) + 360) % 360
      let snapped = false

      if (e.shiftKey) {
        next = Math.round(next / 15) * 15
        if (next % 90 === 0) snapped = true
      } else {
        const nearest90 = Math.round(next / 90) * 90
        if (
          Math.abs(next - nearest90) < 4 ||
          Math.abs(next - nearest90 + 360) < 4
        ) {
          next = nearest90 % 360
          snapped = true
        }
      }

      setIsRotateSnapped(snapped)
      updateText(textRef.current.id, { rotation: next })
    },
    [updateText]
  )

  const endRotate = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const rot = rotateRef.current
      if (!rot || rot.pointerId !== e.pointerId) return
      rotateRef.current = null
      setIsRotateSnapped(false)
    },
    []
  )

  const startResize = React.useCallback(
    (handle: ResizeHandleId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const elNode = elRef.current
      const canvasNode = canvasRef.current
      if (!canvasNode || !elNode) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const canvasRect = canvasNode.getBoundingClientRect()
      const scale = pointerScale()
      const t = textRef.current
      const elRect = elNode.getBoundingClientRect()
      resizeRef.current = {
        pointerId: e.pointerId,
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: t.xPct,
        startYPct: t.yPct,
        startWidthPx: elRect.width / scale,
        startHeightPx: elRect.height / scale,
        startFontSize: t.fontSize,
        storeWidthPx: t.widthPx,
        storeHeightPx: t.heightPx,
        canvasW: canvasRect.width / scale,
        canvasH: canvasRect.height / scale,
        elW: elRect.width / scale,
        elH: elRect.height / scale,
        lastPatch: null,
      }
      updateResizeLens(handle)
    },
    [canvasRef, pointerScale, updateResizeLens]
  )

  const moveResize = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const rs = resizeRef.current
      if (!rs || rs.pointerId !== e.pointerId) return
      const el = elRef.current
      if (!el) return
      const scale = pointerScale()
      const dx = (e.clientX - rs.startClientX) / scale
      const dy = (e.clientY - rs.startClientY) / scale

      const isCorner =
        rs.handle === "tl" ||
        rs.handle === "tr" ||
        rs.handle === "bl" ||
        rs.handle === "br"

      if (isCorner) {
        let scaleFactor: number
        switch (rs.handle) {
          case "tl": {
            const sw = (rs.elW - dx) / rs.elW
            const sh = (rs.elH - dy) / rs.elH
            scaleFactor = Math.max(0.2, Math.max(sw, sh))
            break
          }
          case "tr": {
            const sw = (rs.elW + dx) / rs.elW
            const sh = (rs.elH - dy) / rs.elH
            scaleFactor = Math.max(0.2, Math.max(sw, sh))
            break
          }
          case "bl": {
            const sw = (rs.elW - dx) / rs.elW
            const sh = (rs.elH + dy) / rs.elH
            scaleFactor = Math.max(0.2, Math.max(sw, sh))
            break
          }
          case "br":
          default: {
            const sw = (rs.elW + dx) / rs.elW
            const sh = (rs.elH + dy) / rs.elH
            scaleFactor = Math.max(0.2, Math.max(sw, sh))
            break
          }
        }

        const newFontSize = clamp(
          Math.round(rs.startFontSize * scaleFactor),
          8,
          200
        )
        const actualScale = newFontSize / rs.startFontSize
        const newW = rs.elW * actualScale
        const newH = rs.elH * actualScale

        let xShiftPx = 0
        let yShiftPx = 0
        if (rs.handle === "tl" || rs.handle === "bl") {
          xShiftPx = (newW - rs.elW) / 2
        } else {
          xShiftPx = -(newW - rs.elW) / 2
        }
        if (rs.handle === "tl" || rs.handle === "tr") {
          yShiftPx = (newH - rs.elH) / 2
        } else {
          yShiftPx = -(newH - rs.elH) / 2
        }

        const xPct = clamp(
          rs.startXPct - (xShiftPx / rs.canvasW) * 100,
          -20,
          120
        )
        const yPct = clamp(
          rs.startYPct - (yShiftPx / rs.canvasH) * 100,
          -20,
          120
        )

        const patch: Partial<TextElement> = {
          fontSize: newFontSize,
          xPct,
          yPct,
        }
        if (rs.storeWidthPx != null)
          patch.widthPx = Math.max(
            20,
            Math.round(rs.storeWidthPx * actualScale)
          )
        if (rs.storeHeightPx != null)
          patch.heightPx = Math.max(
            16,
            Math.round(rs.storeHeightPx * actualScale)
          )
        rs.lastPatch = patch

        el.style.left = `${xPct}%`
        el.style.top = `${yPct}%`
        const textView = textViewRef.current
        if (textView) textView.style.fontSize = `${newFontSize}px`
        if (patch.widthPx != null) el.style.width = `${patch.widthPx}px`
        if (patch.heightPx != null) el.style.height = `${patch.heightPx}px`
        setToolbarRect(el.getBoundingClientRect())
        updateResizeLens(rs.handle)
      } else {
        let newW = rs.startWidthPx
        let newH = rs.startHeightPx
        let xShiftPx = 0
        let yShiftPx = 0

        switch (rs.handle) {
          case "ml":
            newW = Math.max(20, rs.startWidthPx - dx)
            xShiftPx = -(newW - rs.startWidthPx) / 2
            break
          case "mr":
            newW = Math.max(20, rs.startWidthPx + dx)
            xShiftPx = (newW - rs.startWidthPx) / 2
            break
          case "mt":
            newH = Math.max(16, rs.startHeightPx - dy)
            yShiftPx = -(newH - rs.startHeightPx) / 2
            break
          case "mb":
            newH = Math.max(16, rs.startHeightPx + dy)
            yShiftPx = (newH - rs.startHeightPx) / 2
            break
          default:
            return
        }

        const xPct = clamp(
          rs.startXPct + (xShiftPx / rs.canvasW) * 100,
          -20,
          120
        )
        const yPct = clamp(
          rs.startYPct + (yShiftPx / rs.canvasH) * 100,
          -20,
          120
        )

        const patch: Partial<TextElement> = { xPct, yPct }
        if (rs.handle === "ml" || rs.handle === "mr")
          patch.widthPx = Math.round(newW)
        if (rs.handle === "mt" || rs.handle === "mb")
          patch.heightPx = Math.round(newH)
        rs.lastPatch = patch

        el.style.left = `${xPct}%`
        el.style.top = `${yPct}%`
        if (patch.widthPx != null) el.style.width = `${patch.widthPx}px`
        if (patch.heightPx != null) el.style.height = `${patch.heightPx}px`
        setToolbarRect(el.getBoundingClientRect())
        updateResizeLens(rs.handle)
      }
    },
    [setToolbarRect, updateResizeLens, pointerScale]
  )

  const endResize = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const rs = resizeRef.current
      if (!rs || rs.pointerId !== e.pointerId) return
      if (rs.lastPatch) {
        updateText(textRef.current.id, rs.lastPatch)
      }
      resizeRef.current = null
      setResizeLens(null)
    },
    [updateText]
  )

  const commitContent = React.useCallback(() => {
    const node = editorRef.current
    if (!node) return
    const next = node.innerText.replace(/ /g, " ")
    updateText(text.id, { content: next || " " })
    setEditingRequested(false)
  }, [text.id, updateText])

  return {
    bulkCanvasDragging,
    bulkEditMode,
    bulkViewportZoom,
    commitContent,
    deleteSelectedText,
    editTextElement,
    editorRef,
    elRef,
    endDrag,
    endResize,
    endRotate,
    hideFloatingToolbar,
    isDragging,
    isEditing,
    isRotateSnapped,
    isSelected,
    moveDrag,
    moveResize,
    moveRotate,
    resizeLens,
    selectTextElement,
    shouldAnimatePositionMove,
    startDrag,
    startResize,
    startRotate,
    textViewRef,
    toolbarRect,
  }
}
