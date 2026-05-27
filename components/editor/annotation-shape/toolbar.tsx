"use client"

import * as React from "react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  iconBtnClass,
  ToolbarButton,
  ToolbarDeleteButton,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
} from "@/components/editor/toolbar/primitives"
import { type AnnotationShape, useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { LINE_STYLES, REDACTION_TEMPLATES } from "./constants"
import { getBlurEffect } from "./geometry"
import { LineStylePreview, RedactionTemplatePreview } from "./previews"
import { ThicknessMenuSection } from "./thickness-menu"

export function AnnotationShapeToolbar({
  shape,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
}: {
  shape: AnnotationShape
  onDragPointerDown: (e: React.PointerEvent<Element>) => void
  onDragPointerMove: (e: React.PointerEvent<Element>) => void
  onDragPointerUp: (e: React.PointerEvent<Element>) => void
}) {
  const {
    updateAnnotationShape,
    deleteAnnotationShape,
    duplicateAnnotationShape,
    bringAnnotationShapeToFront,
    sendAnnotationShapeToBack,
    setSelectedAnnotationShapeId,
  } = useEditor()
  return (
    <div
      role="toolbar"
      aria-label={`${shape.kind} annotation controls`}
      className="flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <ToolbarDragHandle
        ariaLabel="Move shape"
        rounded="md"
        cursor="move"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
      />

      <ToolbarDeleteButton
        ariaLabel="Delete shape"
        onDelete={() => {
          deleteAnnotationShape(shape.id)
          setSelectedAnnotationShapeId(null)
        }}
      />

      {shape.kind !== "step" ? (
        <ToolbarDuplicateButton
          ariaLabel="Duplicate shape"
          onDuplicate={() => {
            const id = duplicateAnnotationShape(shape.id)
            if (id) setSelectedAnnotationShapeId(id)
          }}
        />
      ) : null}

      {shape.kind === "blur" ? (
        <>
          <span className="mx-1 h-5 w-px bg-border" />
          {REDACTION_TEMPLATES.map((template) => {
            const isActive = getBlurEffect(shape) === template.id
            return (
              <ToolbarButton
                key={template.id}
                aria-label={template.label}
                tooltip={template.label}
                active={isActive}
                onClick={() =>
                  updateAnnotationShape(shape.id, {
                    blurEffect: template.id,
                  })
                }
              >
                <RedactionTemplatePreview
                  effect={template.id}
                  active={isActive}
                />
              </ToolbarButton>
            )
          })}
        </>
      ) : null}

      {shape.kind !== "blur" ? (
        <>
          <ColorPickerPopover
            value={shape.color}
            side="top"
            align="center"
            onChange={(color) => updateAnnotationShape(shape.id, { color })}
          >
            <button
              aria-label="Shape color"
              className={cn(iconBtnClass, "mx-1")}
            >
              <span
                className="block size-5 rounded-full border border-foreground/10"
                style={{ background: shape.color }}
              />
            </button>
          </ColorPickerPopover>

          {shape.kind !== "step"
            ? LINE_STYLES.map((style) => (
                <ToolbarButton
                  key={style.id}
                  aria-label={`${style.label} line`}
                  tooltip={style.label}
                  active={shape.lineStyle === style.id}
                  onClick={() =>
                    updateAnnotationShape(shape.id, { lineStyle: style.id })
                  }
                >
                  <LineStylePreview
                    style={style.id}
                    kind={shape.kind}
                    active={shape.lineStyle === style.id}
                  />
                </ToolbarButton>
              ))
            : null}
        </>
      ) : null}

      {shape.kind !== "blur" && shape.kind !== "step" ? (
        <>
          <span className="mx-1 h-5 w-px bg-border" />

          <ToolbarLayerOrderMenu
            contentClassName="w-56 p-1"
            onBringToFront={() => bringAnnotationShapeToFront(shape.id)}
            onSendToBack={() => sendAnnotationShapeToBack(shape.id)}
            extraItems={() => (
              <>
                <div className="my-1 h-px bg-border/70" />
                <ThicknessMenuSection
                  value={shape.strokeWidth}
                  color={shape.color}
                  onChange={(strokeWidth) =>
                    updateAnnotationShape(shape.id, { strokeWidth })
                  }
                />
              </>
            )}
          />
        </>
      ) : shape.kind !== "blur" ? (
        <>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarLayerOrderMenu
            contentClassName="w-56 p-1"
            onBringToFront={() => bringAnnotationShapeToFront(shape.id)}
            onSendToBack={() => sendAnnotationShapeToBack(shape.id)}
          />
        </>
      ) : null}
    </div>
  )
}
