"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { TextToolbar } from "@/components/editor/text-toolbar"
import {
  bulkToolbarScale,
  floatingToolbarTransform,
} from "@/components/editor/toolbar/primitives"
import type { TextElement } from "@/lib/editor/state-types"

export function TextElementFloatingToolbar({
  text,
  toolbarRect,
  bulkEditMode,
  bulkViewportZoom,
  startDrag,
  moveDrag,
  endDrag,
}: {
  text: TextElement
  toolbarRect: DOMRect
  bulkEditMode: boolean
  bulkViewportZoom: number
  startDrag: (e: React.PointerEvent<HTMLButtonElement>) => void
  moveDrag: (e: React.PointerEvent<HTMLButtonElement>) => void
  endDrag: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  if (typeof document === "undefined") return null

  const flipBelow = toolbarRect.top < 80
  const top = flipBelow ? toolbarRect.bottom + 12 : toolbarRect.top - 12
  const left = toolbarRect.left + toolbarRect.width / 2
  const scale = bulkEditMode ? bulkToolbarScale(bulkViewportZoom) : 1

  return createPortal(
    <div
      data-editor-floating-toolbar-target={`text:${text.id}`}
      className="pointer-events-none fixed z-40"
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
    </div>,
    document.body
  )
}
