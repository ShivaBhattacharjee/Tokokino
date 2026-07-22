"use client"

import { elementPositionVars } from "@/lib/editor/live-preview-vars"
import { cn } from "@/lib/utils"

import { TextElementFloatingToolbar } from "./text-element-parts/floating-toolbar"
import { TextSelectionControls } from "./text-element-parts/selection-controls"
import {
  EditableTextContent,
  StaticTextContent,
} from "./text-element-parts/text-content"
import type { TextElementViewProps } from "./text-element-parts/types"
import { useTextElementInteractions } from "./text-element-parts/use-text-element-interactions"

export function TextElementView({
  text,
  canvasRef,
  onCenterGuideChange,
  previewMode,
}: TextElementViewProps) {
  const {
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
  } = useTextElementInteractions({ text, canvasRef, onCenterGuideChange })

  const positionVars = elementPositionVars(text.id)
  const showBorder = isSelected || (text.borderColor && text.borderWidth > 0)
  const borderColor = text.borderColor
    ? text.borderColor
    : isSelected
      ? "rgb(146 185 122 / 0.9)"
      : "transparent"
  const borderWidth = text.borderColor ? text.borderWidth : isSelected ? 1 : 0
  const borderStyle = text.borderColor ? text.borderStyle || "solid" : "dashed"
  const counterRotate = `rotate(${-text.rotation}deg)`

  const isAutoWidth = text.widthPx == null
  const outerWidth = isAutoWidth ? "max-content" : `${text.widthPx}px`
  const outerHeight = text.heightPx != null ? `${text.heightPx}px` : undefined
  const isXInside = text.xPct >= 0 && text.xPct <= 100
  const outerMaxWidth =
    isAutoWidth && isXInside
      ? `${2 * Math.min(text.xPct, 100 - text.xPct)}%`
      : undefined

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={elRef}
        className={cn(
          "nodrag nopan absolute select-none",
          isEditing
            ? "cursor-text"
            : isDragging
              ? "cursor-grabbing"
              : "cursor-grab",
          !isEditing && "touch-none"
        )}
        style={{
          // Per-id var first so a drag can be broadcast from the canvas root
          // and reach the preset thumbnails' copy of this text; the generic
          // element-scoped var stays as the fallback for the writers that
          // still target a single element directly.
          left: `var(${positionVars.x}, var(--editor-position-x, ${text.xPct}%))`,
          top: `var(${positionVars.y}, var(--editor-position-y, ${text.yPct}%))`,
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
        data-export-stack="foreground"
        onClick={(e) => {
          e.stopPropagation()
          selectTextElement()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          editTextElement()
        }}
        tabIndex={isSelected && !isEditing ? 0 : undefined}
        onKeyDown={
          isSelected && !isEditing
            ? (e) => {
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault()
                  e.stopPropagation()
                  deleteSelectedText()
                }
              }
            : undefined
        }
      >
        {isSelected && !isEditing && !previewMode ? (
          <TextSelectionControls
            text={text}
            counterRotate={counterRotate}
            isRotateSnapped={isRotateSnapped}
            resizeLens={resizeLens}
            borderStyle={borderStyle}
            borderWidth={borderWidth}
            borderColor={borderColor}
            startRotate={startRotate}
            moveRotate={moveRotate}
            endRotate={endRotate}
            startResize={startResize}
            moveResize={moveResize}
            endResize={endResize}
          />
        ) : null}

        {isEditing ? (
          <EditableTextContent
            text={text}
            editorRef={editorRef}
            showBorder={showBorder}
            borderStyle={borderStyle}
            borderWidth={borderWidth}
            borderColor={borderColor}
            commitContent={commitContent}
          />
        ) : (
          <StaticTextContent
            text={text}
            textViewRef={textViewRef}
            showBorder={showBorder}
            borderStyle={borderStyle}
            borderWidth={borderWidth}
            borderColor={borderColor}
            isSelected={isSelected}
          />
        )}
      </div>
      {!previewMode &&
      !bulkCanvasDragging &&
      isSelected &&
      !hideFloatingToolbar &&
      toolbarRect ? (
        <TextElementFloatingToolbar
          text={text}
          toolbarRect={toolbarRect}
          bulkEditMode={bulkEditMode}
          bulkViewportZoom={bulkViewportZoom}
          startDrag={startDrag}
          moveDrag={moveDrag}
          endDrag={endDrag}
        />
      ) : null}
    </>
  )
}
