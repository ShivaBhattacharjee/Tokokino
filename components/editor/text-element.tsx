"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiRefreshLine } from "@remixicon/react"

import { TextToolbar } from "@/components/editor/text-toolbar"
import {
  bulkToolbarScale,
  floatingToolbarTransform,
} from "@/components/editor/toolbar/primitives"
import { type TextElement, pickContrastColorAtPosition, useEditor } from "@/lib/editor/store"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"
import { cn } from "@/lib/utils"

type Props = {
  text: TextElement
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
  previewMode?: boolean
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
  moved: boolean
}

type RotateState = {
  pointerId: number
  centerX: number
  centerY: number
  startAngle: number
  startRotation: number
}

type ResizeHandleId = "ml" | "mr" | "mt" | "mb" | "tl" | "tr" | "bl" | "br"

type ResizeState = {
  pointerId: number
  handle: ResizeHandleId
  startClientX: number
  startClientY: number
  startXPct: number
  startYPct: number
  startWidthPx: number
  startHeightPx: number
  startFontSize: number
  storeWidthPx: number | null
  storeHeightPx: number | null
  canvasW: number
  canvasH: number
  elW: number
  elH: number
  lastPatch: Partial<TextElement> | null
}

const DRAG_THRESHOLD = 4

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

export function TextElementView({ text, canvasRef, onCenterGuideChange, previewMode }: Props) {
  const { canvasZoom, selectedTextId, setSelectedTextId, setSelectedAnnotationShapeId, updateText, deleteText, screenshot, background, bulkEditMode, bulkCanvasDragging, bulkViewportZoom } =
    useEditor()
  const isSelected = selectedTextId === text.id
  const [editingRequested, setEditingRequested] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isRotateSnapped, setIsRotateSnapped] = React.useState(false)
  const isEditing = isSelected && editingRequested
  const elRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<HTMLDivElement>(null)
  const textViewRef = React.useRef<HTMLDivElement>(null)
  const { toolbarRect, hideFloatingToolbar, shouldAnimatePositionMove, measureRect, setToolbarRect } =
    useFloatingToolbarRect({
      elRef,
      isSelected,
      bulkCanvasDragging,
      kind: "text",
      elementId: text.id,
      trackPositionAnimate: true,
    })
  const dragRef = React.useRef<DragState | null>(null)
  const rotateRef = React.useRef<RotateState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)

  // Keep latest text values in refs so drag handlers read fresh values
  // without needing to re-create callbacks on every render.
  const textRef = React.useRef(text)
  textRef.current = text
  const canvasZoomRef = React.useRef(canvasZoom)
  canvasZoomRef.current = canvasZoom
  const onCenterGuideChangeRef = React.useRef(onCenterGuideChange)
  onCenterGuideChangeRef.current = onCenterGuideChange

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
  }, [isEditing, text.content])


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

    window.addEventListener("beautiful-screenshots:select-text", selectText)
    window.addEventListener("beautiful-screenshots:edit-text", editText)
    return () => {
      window.removeEventListener(
        "beautiful-screenshots:select-text",
        selectText
      )
      window.removeEventListener("beautiful-screenshots:edit-text", editText)
    }
  }, [setSelectedAnnotationShapeId, setSelectedTextId, text.id])

  // Global keyboard listener for delete when selected (toolbar mode)
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

  // Auto-detect contrast color on mount (for newly added text) and when
  // background changes, as long as user hasn't manually chosen a color.
  React.useEffect(() => {
    if (!text.autoColor) return
    const canvas = canvasRef.current
    // Small delay to ensure DOM is laid out for elementsFromPoint
    const timer = setTimeout(() => {
      pickContrastColorAtPosition(canvas, text.xPct, text.yPct, screenshot, background)
        .then((color) => {
          if (color !== text.color) {
            updateText(text.id, { color, autoColor: true })
          }
        })
        .catch(() => { /* ignore */ })
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

  /* ---- Drag (move) ---- */

  const startDrag = React.useCallback((e: React.PointerEvent<Element>) => {
    const t = textRef.current
    if (e.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.stopPropagation()
    e.preventDefault()
    setSelectedTextId(t.id)
    setSelectedAnnotationShapeId(null)
    setEditingRequested(false)
    ;(e.currentTarget).setPointerCapture?.(e.pointerId)
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
    }
   
  }, [canvasRef, setSelectedAnnotationShapeId, setSelectedTextId])

  const moveDrag = React.useCallback((e: React.PointerEvent<Element>) => {
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

    // Apply position directly to DOM for zero-rerender dragging
    const dx = rawDx / pointerScale
    const dy = rawDy / pointerScale
    let nextX = drag.startXPct + (dx / drag.canvasW) * 100
    let nextY = drag.startYPct + (dy / drag.canvasH) * 100

    // Snap to canvas center (50%)
    const snapThresholdPct = (8 / drag.canvasW) * 100
    const snapX = Math.abs(nextX - 50) <= snapThresholdPct
    const snapY = Math.abs(nextY - 50) <= snapThresholdPct
    if (snapX) nextX = 50
    if (snapY) nextY = 50
    onCenterGuideChangeRef.current?.({ x: snapX, y: snapY })

    const clampedX = clamp(nextX, -20, 120)
    const clampedY = clamp(nextY, -20, 120)

    const el = elRef.current
    if (el) {
      el.style.left = `${clampedX}%`
      el.style.top = `${clampedY}%`
      setToolbarRect(el.getBoundingClientRect())
    }
    // Store the latest values for commit
    drag.startXPct = clampedX
    drag.startYPct = clampedY
    drag.startClientX = e.clientX
    drag.startClientY = e.clientY
  }, [])

  const endDrag = React.useCallback((e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    // Commit final position to store once
    if (drag.moved) {
      const el = elRef.current
      if (el) {
        const x = parseFloat(el.style.left)
        const y = parseFloat(el.style.top)
        const t = textRef.current
        updateText(t.id, {
          xPct: clamp(x, -20, 120),
          yPct: clamp(y, -20, 120),
        })
        // Auto-detect contrast color based on what's beneath the text
        if (t.autoColor !== false) {
          const canvas = canvasRef.current
          pickContrastColorAtPosition(canvas, clamp(x, -20, 120), clamp(y, -20, 120), screenshot, background)
            .then((color) => updateText(t.id, { color, autoColor: true }))
            .catch(() => { /* ignore */ })
        }
      }
    }
    dragRef.current = null
    setIsDragging(false)
    onCenterGuideChangeRef.current?.({ x: false, y: false })
  }, [updateText, screenshot, background, canvasRef])

  /* ---- Rotate ---- */

  const startRotate = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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
  }, [])

  const moveRotate = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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
      if (Math.abs(next - nearest90) < 4 || Math.abs(next - nearest90 + 360) < 4) {
        next = nearest90 % 360
        snapped = true
      }
    }

    setIsRotateSnapped(snapped)
    updateText(textRef.current.id, { rotation: next })
  }, [updateText])

  const endRotate = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const rot = rotateRef.current
    if (!rot || rot.pointerId !== e.pointerId) return
    rotateRef.current = null
    setIsRotateSnapped(false)
  }, [])

  /* ---- Resize ---- */

  const startResize = React.useCallback(
    (handle: ResizeHandleId) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const elNode = elRef.current
      const canvasNode = canvasRef.current
      if (!canvasNode || !elNode) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const canvasRect = canvasNode.getBoundingClientRect()
      const scale = canvasZoomRef.current / 100
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
    },
  [canvasRef])

  const moveResize = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    const el = elRef.current
    if (!el) return
    const scale = canvasZoomRef.current / 100
    const dx = (e.clientX - rs.startClientX) / scale
    const dy = (e.clientY - rs.startClientY) / scale

    const isCorner = rs.handle === "tl" || rs.handle === "tr" || rs.handle === "bl" || rs.handle === "br"

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

      const newFontSize = clamp(Math.round(rs.startFontSize * scaleFactor), 8, 200)
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

      const xPct = clamp(rs.startXPct - (xShiftPx / rs.canvasW) * 100, -20, 120)
      const yPct = clamp(rs.startYPct - (yShiftPx / rs.canvasH) * 100, -20, 120)

      const patch: Partial<TextElement> = { fontSize: newFontSize, xPct, yPct }
      if (rs.storeWidthPx != null) patch.widthPx = Math.max(20, Math.round(rs.storeWidthPx * actualScale))
      if (rs.storeHeightPx != null) patch.heightPx = Math.max(16, Math.round(rs.storeHeightPx * actualScale))
      rs.lastPatch = patch

      // Apply directly to DOM — no store update, no re-render
      el.style.left = `${xPct}%`
      el.style.top = `${yPct}%`
      const textView = textViewRef.current
      if (textView) textView.style.fontSize = `${newFontSize}px`
      if (patch.widthPx != null) el.style.width = `${patch.widthPx}px`
      if (patch.heightPx != null) el.style.height = `${patch.heightPx}px`
      setToolbarRect(el.getBoundingClientRect())
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

      const xPct = clamp(rs.startXPct + (xShiftPx / rs.canvasW) * 100, -20, 120)
      const yPct = clamp(rs.startYPct + (yShiftPx / rs.canvasH) * 100, -20, 120)

      const patch: Partial<TextElement> = { xPct, yPct }
      if (rs.handle === "ml" || rs.handle === "mr") patch.widthPx = Math.round(newW)
      if (rs.handle === "mt" || rs.handle === "mb") patch.heightPx = Math.round(newH)
      rs.lastPatch = patch

      // Apply directly to DOM — no store update, no re-render
      el.style.left = `${xPct}%`
      el.style.top = `${yPct}%`
      if (patch.widthPx != null) el.style.width = `${patch.widthPx}px`
      if (patch.heightPx != null) el.style.height = `${patch.heightPx}px`
      setToolbarRect(el.getBoundingClientRect())
    }
  }, [setToolbarRect])

  const endResize = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    if (rs.lastPatch) {
      updateText(textRef.current.id, rs.lastPatch)
    }
    resizeRef.current = null
  }, [updateText])

  const commitContent = () => {
    const node = editorRef.current
    if (!node) return
    const next = node.innerText.replace(/ /g, " ")
    updateText(text.id, { content: next || " " })
    setEditingRequested(false)
  }

  const showBorder = isSelected || (text.borderColor && text.borderWidth > 0)
  const borderColor = text.borderColor
    ? text.borderColor
    : isSelected
      ? "rgb(146 185 122 / 0.9)"
      : "transparent"
  const borderWidth = text.borderColor ? text.borderWidth : isSelected ? 1 : 0
  const borderStyle = text.borderColor ? (text.borderStyle || "solid") : "dashed"
  const counterRotate = `rotate(${-text.rotation}deg)`

  // Compute outer dimensions
  const outerWidth = text.widthPx != null ? `${text.widthPx}px` : "max-content"
  const outerHeight = text.heightPx != null ? `${text.heightPx}px` : undefined
  // Center-anchored box can't extend past the nearer canvas edge while typing.
  const isXInside = text.xPct >= 0 && text.xPct <= 100
  const outerMaxWidth =
    text.widthPx == null && isXInside
      ? `${2 * Math.min(text.xPct, 100 - text.xPct)}%`
      : undefined

  return (
    <>
    <div
      ref={elRef}
      className={cn(
        "absolute select-none",
        isEditing
          ? "cursor-text"
          : isDragging
            ? "cursor-grabbing"
            : "cursor-grab"
      )}
      style={{
        left: `${text.xPct}%`,
        top: `${text.yPct}%`,
        transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
        transition:
          !isDragging && shouldAnimatePositionMove
            ? "left 300ms ease-out, top 300ms ease-out"
            : "none",
        zIndex: 60 + text.zIndex,
        width: outerWidth,
        height: outerHeight,
        maxWidth: outerMaxWidth,
        opacity: (text.opacity ?? 100) / 100,
        mixBlendMode:
          text.blendMode && text.blendMode !== "normal"
            ? text.blendMode
            : undefined,
        display: text.hidden ? "none" : undefined,
      }}
      onPointerDown={isEditing ? undefined : startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-editor-text-id={text.id}
      onClick={(e) => {
        e.stopPropagation()
        setEditingRequested(false)
        setSelectedTextId(text.id)
        setSelectedAnnotationShapeId(null)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setSelectedTextId(text.id)
        setSelectedAnnotationShapeId(null)
        setEditingRequested(true)
      }}
      tabIndex={isSelected && !isEditing ? 0 : undefined}
      onKeyDown={isSelected && !isEditing ? (e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault()
          e.stopPropagation()
          deleteText(text.id)
          setSelectedTextId(null)
        }
      } : undefined}
    >
      {isSelected && !isEditing && !previewMode ? (
        <div data-export-hidden="true" className="contents">
          {/* Snapping Guidelines */}
          {isRotateSnapped && (
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-[-1] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <div className="absolute w-[4000px] border-t border-dashed border-[#9BCD64]/95" />
              <div className="absolute h-[4000px] border-l border-dashed border-[#9BCD64]/95" />
            </div>
          )}

          {/* Rotate handle */}
          <button
            aria-label="Rotate text"
            onPointerDown={startRotate}
            onPointerMove={moveRotate}
            onPointerUp={endRotate}
            onPointerCancel={endRotate}
            onClick={(e) => e.stopPropagation()}
            className="absolute -bottom-9 left-1/2 z-10 flex size-7 cursor-grab items-center justify-center rounded-full border border-[#92b97a]/80 bg-background/95 text-[#92b97a] shadow-md backdrop-blur-md"
            style={{
              transform: `translate(-50%, 0) ${counterRotate}`,
              transformOrigin: "top center",
            }}
          >
            <RiRefreshLine className="size-3.5" />
          </button>

          {/* Resize handles */}
          {(
            [
              // Edge handles (padding only)
              ["ml", "top-1/2", "left-0", "-translate-x-1/2 -translate-y-1/2", "ew-resize"],
              ["mr", "top-1/2", "right-0", "translate-x-1/2 -translate-y-1/2", "ew-resize"],
              ["mt", "top-0", "left-1/2", "-translate-x-1/2 -translate-y-1/2", "ns-resize"],
              ["mb", "bottom-0", "left-1/2", "-translate-x-1/2 translate-y-1/2", "ns-resize"],
              // Corner handles (proportional font scale)
              ["tl", "top-0", "left-0", "-translate-x-1/2 -translate-y-1/2", "nwse-resize"],
              ["tr", "top-0", "right-0", "translate-x-1/2 -translate-y-1/2", "nesw-resize"],
              ["bl", "bottom-0", "left-0", "-translate-x-1/2 translate-y-1/2", "nesw-resize"],
              ["br", "bottom-0", "right-0", "translate-x-1/2 translate-y-1/2", "nwse-resize"],
            ] as const
          ).map(([id, vClass, hClass, transformClass, cursor]) => (
            <button
              key={id}
              aria-label={`Resize ${id}`}
              onPointerDown={startResize(id)}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute z-10 size-2.5 rounded-full border border-[#92b97a] bg-background shadow",
                vClass,
                hClass,
                transformClass
              )}
              style={{ cursor }}
            />
          ))}
        </div>
      ) : null}

      {isEditing ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onBlur={commitContent}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Escape") {
              e.preventDefault()
              commitContent()
            } else if (e.key === "Enter") {
              // Cmd+Shift+Enter (Mac) / Ctrl+Shift+Enter (Win) = new line
              if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
                // Allow default behavior (inserts newline in contentEditable)
                return
              }
              // Plain Enter = exit editing
              e.preventDefault()
              commitContent()
            }
          }}
          className={cn(
            "cursor-text whitespace-pre-wrap break-words outline-none px-2 py-1",
            showBorder && "rounded-md"
          )}
          style={{
            fontFamily: text.fontFamily,
            fontSize: text.fontSize,
            fontWeight: text.fontWeight,
            letterSpacing: `${text.letterSpacing ?? 0}px`,
            color: text.color,
            textAlign: text.align,
            lineHeight: text.lineHeight ?? 1.3,
            borderStyle,
            borderWidth,
            borderColor,
            wordBreak: "break-word",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
            ...(text.strokeColor && text.strokeWidth
              ? { WebkitTextStroke: `${text.strokeWidth}px ${text.strokeColor}`, paintOrder: "stroke fill" }
              : {}),
            ...(text.textShadow ? { textShadow: text.textShadow } : {}),
          }}
        />
      ) : (
        <div
          ref={textViewRef}
          className={cn(
            "whitespace-pre-wrap break-words px-2 py-1",
            showBorder && "rounded-md"
          )}
          data-selection-border={!text.borderColor && isSelected ? "true" : undefined}
          style={{
            fontFamily: text.fontFamily,
            fontSize: text.fontSize,
            fontWeight: text.fontWeight,
            letterSpacing: `${text.letterSpacing ?? 0}px`,
            color: text.color,
            textAlign: text.align,
            lineHeight: text.lineHeight ?? 1.3,
            borderStyle,
            borderWidth,
            borderColor,
            wordBreak: "break-word",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
            ...(text.strokeColor && text.strokeWidth
              ? { WebkitTextStroke: `${text.strokeWidth}px ${text.strokeColor}`, paintOrder: "stroke fill" }
              : {}),
            ...(text.textShadow ? { textShadow: text.textShadow } : {}),
          }}
        >
          {text.content}
        </div>
      )}
    </div>
    {!previewMode && !bulkCanvasDragging && isSelected && !hideFloatingToolbar && toolbarRect && typeof document !== "undefined"
      ? createPortal(
          (() => {
            const flipBelow = toolbarRect.top < 80
            const top = flipBelow
              ? toolbarRect.bottom + 12
              : toolbarRect.top - 12
            const left = toolbarRect.left + toolbarRect.width / 2
            const scale = bulkEditMode ? bulkToolbarScale(bulkViewportZoom) : 1
            return (
              <div
                data-editor-floating-toolbar-target={`text:${text.id}`}
                className="pointer-events-none fixed z-[100]"
                style={{
                  top,
                  left,
                  transform: floatingToolbarTransform(flipBelow, scale),
                  transformOrigin: flipBelow ? "top center" : "bottom center",
                }}
              >
                <div className="pointer-events-auto">
                  <TextToolbar
                    text={text}
                    onDragHandlePointerDown={startDrag}
                    onDragHandlePointerMove={moveDrag}
                    onDragHandlePointerUp={endDrag}
                  />
                </div>
              </div>
            )
          })(),
          document.body
        )
      : null}
    </>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
